import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, sendEmailFromSender, getTrackingPixelUrl, chooseSenderForKey } from "./email-service";
import { sendSmsViaQuo, toSmsE164 } from "./quo-service";
import { isOnDnc, addToDnc, removeFromDnc } from "./agent-service";
import { getDeliverabilitySettings, recordSenderUse } from "./deliverability-settings-service";
import { verifyEmail } from "./zerobounce-service";
import {
  isOptimalEmailWindow,
  smartEmailDelay,
  smartSmsDelay,
  emailDomain,
  nextWindowDescription,
} from "./smart-scheduler";
import { FIRST_TOUCH, isFirstEmailStep, isLinkedInConnectStep } from "@shared/first-touch";
import { firstTouchLang } from "./introducer-qualify";
import { linkedInDailyQueueCap } from "./outreach-owner";
import { db } from "./db";
import { dripSends } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";

function etStartOfToday(): Date {
  return new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }) + " 00:00:00");
}

async function linkedInTasksCreatedToday(): Promise<number> {
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` })
      .from(dripSends)
      .where(and(
        eq(dripSends.channel, "linkedin"),
        eq(dripSends.status, "task"),
        gte(dripSends.createdAt, etStartOfToday()),
      ));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

function makePersonalize(name: string, email: string, firmHook: string) {
  const firstName = (name || "").trim().split(/\s+/)[0] || name || "there";
  return (s: string | null | undefined): string =>
    (s || "")
      .replace(/\[Contact First Name\]/gi, firstName)
      .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*email\s*\}\}/gi, email || "")
      .replace(/\{\{\s*firmHook\s*\}\}/gi, firmHook || "");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type StepReady = "send" | "wait" | "skip";

// Decide whether a step is ready to fire for an enrollment. "time" steps use the
// classic delayDays gate; behavioural steps watch a prior step's send for an
// open/click and fire (or skip after a window) accordingly.
function evaluateTrigger(step: any, steps: any[], enrolledAt: Date, sends: any[], now: Date, force: boolean): StepReady {
  const tt = (step.triggerType || "time").toLowerCase();

  if (tt === "time") {
    if (force) return "send";
    const days = Math.floor((now.getTime() - enrolledAt.getTime()) / 86_400_000);
    return days >= (step.delayDays || 0) ? "send" : "wait";
  }

  // "engaged" = opened several emails overall — escalation trigger.
  if (tt === "engaged") {
    return sends.filter((s) => s.openedAt).length >= 3 ? "send" : "wait";
  }

  // Signal triggers watch a reference send (a prior step). Default to the
  // immediately previous step when no explicit ref is set.
  const idx = steps.findIndex((s) => s.id === step.id);
  const refOrder = step.triggerRefStep ?? steps[idx - 1]?.stepOrder;
  const refStep = refOrder != null ? steps.find((s) => s.stepOrder === refOrder) : undefined;
  const refSend = refStep ? sends.find((s) => s.stepId === refStep.id) : undefined;
  const sentAt = refSend?.sentAt ? new Date(refSend.sentAt).getTime() : null;
  if (!refSend || !sentAt) return idx === 0 ? "send" : "wait";

  const windowMs = (step.triggerWindowHours ?? 120) * 3_600_000;
  const elapsed = now.getTime() - sentAt;

  switch (tt) {
    case "email_opened":
      return refSend.openedAt ? "send" : elapsed >= windowMs ? "skip" : "wait";
    case "link_clicked":
      return refSend.clickedAt ? "send" : elapsed >= windowMs ? "skip" : "wait";
    case "not_opened":
      if (refSend.openedAt) return "skip";
      return elapsed >= windowMs ? "send" : "wait";
    default:
      return "send";
  }
}

function getBaseUrl(): string {
  // This URL is embedded into recipients' emails as the open-pixel and
  // click-redirect host, so it MUST be publicly reachable from their inbox.
  // Prefer an explicit env override, then known platform domains, and fall
  // back to the production domain — never localhost (which records no opens).
  const fromEnv = process.env.APP_BASE_URL || process.env.BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return "https://www.newdawnfranchising.com";
}

function defaultTaskTitle(stepType: string, firstName: string): string {
  switch (stepType) {
    case "call": return `Call ${firstName}`;
    case "linkedin":
    case "linkedin_connect": return `LinkedIn connect: ${firstName}`;
    case "linkedin_message": return `LinkedIn message: ${firstName}`;
    default: return `Follow up with ${firstName}`;
  }
}

// Normalize a step type into the activity channel stored on each drip_send so the
// unified Activity feed can group/filter touches (email | sms | linkedin | call | task).
function channelOf(stepType: string): string {
  const t = (stepType || "email").toLowerCase();
  if (t === "email" || t === "manual_email") return "email";
  if (t === "sms") return "sms";
  if (t.startsWith("linkedin")) return "linkedin";
  if (t === "call") return "call";
  return "task";
}

// Guard against overlapping runs (a manual "Send Due Now" overlapping the cron,
// or repeated clicks) so the same enrollments aren't processed twice in parallel.
let dripRunInProgress = false;
// A run takes a one-time enrollment snapshot at its start, so contacts enrolled
// *during* a run (e.g. the post-enroll trigger firing while the cron is mid-drain)
// are invisible to it. Rather than drop that trigger, remember it and run once more
// when the current run finishes — otherwise the just-enrolled contacts would strand
// until the next top-of-hour tick, defeating the prompt-start fix.
let dripRerunRequested = false;

export async function processDripEmails(opts: { force?: boolean; campaignId?: string } = {}) {
  const { force = false, campaignId } = opts;
  console.log(`[Drip] Processing scheduled emails...${campaignId ? ` (campaign ${campaignId} only)` : ""}${force ? " (manual override — bypassing window + hourly cap)" : ""}`);

  if (dripRunInProgress) {
    // Don't silently drop it — queue a follow-up sweep for after the current run.
    dripRerunRequested = true;
    console.log("[Drip] A run is already in progress — queued a follow-up sweep.");
    return;
  }

  // Respect optimal send windows — skip if outside hours. A manual "Send Due
  // Now" passes force:true to send due emails immediately regardless of day/time.
  if (!force && !isOptimalEmailWindow()) {
    console.log(`[Drip] Outside optimal email window — ${nextWindowDescription("email")}. Skipping.`);
    return;
  }

  dripRunInProgress = true;
  try {
    // Effective throttles: "Sending & Safety" DB overrides win over the env-var
    // defaults, fetched fresh each run so changes apply without a restart. Falls
    // back to the env caps (EMAIL_DAILY_CAP etc.) when no override is set.
    const delivSettings = await getDeliverabilitySettings();
    const dailyCap = delivSettings.effectiveDailyCap;
    const hourlyCap = delivSettings.effectiveHourlyCap;
    const domainGapMs = delivSettings.effectiveDomainGapMs;

    // DB-backed rolling-window counters so throttles survive process restarts
    // (Railway redeploys) instead of resetting an in-memory counter mid-day.
    const now = Date.now();
    let sentLast24h = await storage.countSentEmailsSince(new Date(now - 24 * 60 * 60 * 1000));
    let sentLastHour = await storage.countSentEmailsSince(new Date(now - 60 * 60 * 1000));

    // Respect daily volume cap (a hard safety even on a manual override)
    if (sentLast24h >= dailyCap) {
      console.log(`[Drip] Daily email cap reached (${sentLast24h}/${dailyCap} in last 24h). Deferring.`);
      return;
    }
    // Respect hourly cap — spreads the day's volume across business hours so we
    // never burst the whole quota in one run (a classic bulk-sender spam signal).
    // Skipped on a manual override.
    if (!force && sentLastHour >= hourlyCap) {
      console.log(`[Drip] Hourly email cap reached (${sentLastHour}/${hourlyCap} in last hour). Resuming next hour.`);
      return;
    }

    // Scope to a single campaign when requested (manual "Send Due Now"); the
    // scheduled cron passes no campaignId and processes all active enrollments.
    const activeEnrollments = await storage.getActiveEnrollments(campaignId);

    // Only send for campaigns that are switched ON. This makes "Pause Campaign"
    // a real kill switch — paused/inactive campaigns are skipped entirely even
    // if their enrollments are still marked active.
    const allCampaigns = await storage.getDripCampaigns();
    const activeCampaignIds = new Set(allCampaigns.filter((c) => c.isActive).map((c) => c.id));

    let sentThisRun = 0;
    // Last send time per recipient domain, to pace bursts to one ISP/domain.
    const lastSendByDomain = new Map<string, number>();
    console.log(`[Drip] ${activeEnrollments.length} active enrollments · ${dailyCap - sentLast24h} left today · ${hourlyCap - sentLastHour} left this hour`);

    for (const enrollment of activeEnrollments) {
      // Stop if either throttle is hit mid-run
      if (sentLast24h >= dailyCap) {
        console.log("[Drip] Daily cap hit mid-run. Stopping early.");
        break;
      }
      if (!force && sentLastHour >= hourlyCap) {
        console.log("[Drip] Hourly cap hit mid-run. Stopping — will resume next hour.");
        break;
      }

      // Skip enrollments whose campaign is paused/off.
      if (!activeCampaignIds.has(enrollment.campaignId)) continue;

      const steps = await storage.getDripSteps(enrollment.campaignId);
      if (steps.length === 0) continue;

      // Drain every step that is due *now* for this enrollment in one pass — not
      // just one step per cron run. A Day-0 sequence (e.g. a LinkedIn task plus
      // the first email) should all go out in the same window instead of one step
      // per hour, and an enrollment left behind by a restart should catch up. The
      // loop stops at the first step that isn't due yet ("wait"), when the
      // sequence is finished, or when a volume cap is hit; the per-step delayDays
      // gate plus the daily/hourly caps keep the drain bounded.
      const enrolledAt = new Date(enrollment.enrolledAt);
      const firstName = (enrollment.prospectName || "").trim().split(/\s+/)[0] || enrollment.prospectName || "there";
      const prospect = enrollment.prospectId ? await storage.getProspect(enrollment.prospectId).catch(() => undefined) : undefined;
      const firmHook = (prospect?.notes || "").trim();
      const lang = firstTouchLang(prospect?.location, null);
      const personalize = makePersonalize(enrollment.prospectName, enrollment.prospectEmail, firmHook);

      // stepIdx strictly increases every iteration (send/skip/already-sent → +1,
      // wait/cap/bounce → break), so the loop always terminates.
      let stepIdx = enrollment.currentStep;
      while (stepIdx < steps.length) {
        // Re-check the throttles before every send so a multi-step drain can't
        // burst past the daily/hourly caps.
        if (sentLast24h >= dailyCap) break;
        if (!force && sentLastHour >= hourlyCap) break;

        const step = steps[stepIdx];
        const now = new Date();
        const existingSends = await storage.getDripSends(enrollment.id);
        // A force "Send Due Now" pushes the enrollment's CURRENT step immediately
        // (bypassing the delayDays gate), but the drain must NOT then leap through
        // every future-dated step — otherwise one click would blast the whole
        // sequence at one inbox. So force only overrides due-ness for the first
        // step of the drain; continuation always uses the natural schedule.
        const forceThisStep = !!force && stepIdx === enrollment.currentStep;
        const ready = evaluateTrigger(step, steps, enrolledAt, existingSends, now, forceThisStep);
        if (ready === "wait") break; // not due yet — leave the rest for a later run
        if (ready === "skip") {
          stepIdx += 1;
          await storage.updateDripEnrollment(enrollment.id, { currentStep: stepIdx } as any);
          console.log(`[Drip] Trigger not met within window — skipping step ${stepIdx} for ${enrollment.prospectName}`);
          continue;
        }

        const alreadySent = existingSends.some(s => s.stepId === step.id);
        if (alreadySent) {
          stepIdx += 1;
          await storage.updateDripEnrollment(enrollment.id, { currentStep: stepIdx } as any);
          continue;
        }

        const stepType = (step.stepType || "email").toLowerCase();

        if (stepType === "email" || stepType === "manual_email") {
          // Skip addresses that are suppressed (e.g. hard-bounced). Stop the
          // enrollment so it doesn't keep retrying a dead mailbox — the user
          // can fix the email from the Activity tab to resume it.
          // Suppression check now also covers DOMAIN-level DNC (set by the bounce
          // guard when a whole domain hard-blocks), so a suppressed domain stops
          // every address under it — not just individually-listed emails.
          const recipientDomain = emailDomain(enrollment.prospectEmail);
          if (await isOnDnc(enrollment.prospectEmail, null, recipientDomain || null)) {
            await storage.updateDripEnrollment(enrollment.id, { status: "bounced" } as any);
            console.log(`[Drip] Skipping suppressed/bounced address ${enrollment.prospectEmail} — enrollment stopped`);
            break; // suppressed mailbox/domain — stop draining this enrollment
          }

          // Optional pre-send verification gate (off by default). Only a clearly
          // INVALID address is dropped + suppressed; unknown/catch-all/valid still
          // send, so a soft verifier result never burns a deliverable contact.
          if (delivSettings.verifyBeforeSend) {
            try {
              const v = await verifyEmail(enrollment.prospectEmail);
              if (v.status === "invalid") {
                await addToDnc(enrollment.prospectEmail, undefined, undefined, "Failed pre-send verification (invalid)");
                await storage.updateDripEnrollment(enrollment.id, { status: "bounced" } as any);
                console.log(`[Drip] Pre-send verify: ${enrollment.prospectEmail} is invalid — suppressed, enrollment stopped`);
                break;
              }
            } catch { /* verifier hiccup — never block a send on it */ }
          }

          // Per-domain pacing: if we sent to this recipient's domain very
          // recently in this run, wait out the remainder of the domain gap
          // before sending again (avoids rapid bursts to one ISP). Kept even on a
          // manual "Send Due Now" — for a varied list it's a no-op (each domain is
          // seen once), and for a single-domain list it's the spam protection you
          // most want, so force shouldn't strip it.
          const domain = recipientDomain;
          if (domain) {
            const last = lastSendByDomain.get(domain);
            if (last !== undefined) {
              const wait = domainGapMs - (Date.now() - last);
              if (wait > 0) {
                console.log(`[Drip] Pacing ${domain}: waiting ${Math.round(wait / 1000)}s before next send to same domain...`);
                await sleep(wait);
              }
            }
          }

          const send = await storage.createDripSend({
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: "email",
            recipientEmail: enrollment.prospectEmail,
            recipientName: enrollment.prospectName,
            subject: step.subject || step.stepName || "Email",
            status: "pending",
          });

          const baseUrl = getBaseUrl();
          const trackingUrl = getTrackingPixelUrl(baseUrl, send.id);

          // Sender rotation (off by default → always DEFAULT_SENDER). Sticky per
          // enrollment so a contact's whole sequence threads from one mailbox.
          const fromEmail = chooseSenderForKey(enrollment.id, delivSettings.senderRotation);
          const first = isFirstEmailStep(step) ? FIRST_TOUCH[lang] : null;
          const result = await sendEmailFromSender(
            fromEmail,
            enrollment.prospectEmail,
            personalize(first?.subject ?? step.subject),
            personalize(first?.bodyHtml ?? step.bodyHtml),
            trackingUrl
          );

          if (result.success) {
            sentThisRun++;
            sentLast24h++;
            sentLastHour++;
            if (domain) lastSendByDomain.set(domain, Date.now());
            await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
            recordSenderUse(fromEmail).catch(() => {});
            console.log(`[Drip] Sent email step ${stepIdx + 1} to ${enrollment.prospectEmail} from ${fromEmail} (today: ${sentLast24h}/${dailyCap}, hour: ${sentLastHour}/${hourlyCap})`);
          } else {
            await storage.updateDripSend(send.id, { status: "failed", errorMessage: result.error } as any);
            console.error(`[Drip] Failed to email ${enrollment.prospectEmail}: ${result.error}`);
          }

          // Organic jitter between emails — avoids burst-send spam signals. Applied
          // even on a manual "Send Due Now" so a one-click whole-list send still
          // paces itself (~5–18s/email): force skips only the optimal-window and
          // hourly-cap GATES, not the spacing. Stops once the daily cap is hit
          // (no point pacing when we're about to stop), and — on a normal run —
          // once the hourly cap is hit (force ignores the hourly cap).
          if (sentThisRun > 0 && sentLast24h < dailyCap && (force || sentLastHour < hourlyCap)) {
            const jitter = smartEmailDelay(sentThisRun);
            console.log(`[Drip] Waiting ${Math.round(jitter / 1000)}s before next send...`);
            await sleep(jitter);
          }
        } else if (stepType === "sms") {
          const prospect = await storage.getProspect(enrollment.prospectId);
          // Validate + normalize the prospect's phone to E.164 BEFORE attempting a
          // send, so a missing/invalid number fails with a clear, actionable reason
          // instead of a cryptic carrier rejection — and a valid local-format number
          // (e.g. "416.800.7213") is normalized to "+14168007213" and actually sends.
          const phoneCheck = toSmsE164(prospect?.phone);
          const send = await storage.createDripSend({
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: "sms",
            // Store what we'll actually text (E.164) when valid, else the raw value
            // so the bad data stays visible in the Activity feed.
            recipientEmail: phoneCheck.ok ? phoneCheck.e164 : (prospect?.phone || enrollment.prospectEmail),
            recipientName: enrollment.prospectName,
            subject: step.stepName || "Text message",
            status: "pending",
          });

          if (!phoneCheck.ok) {
            await storage.updateDripSend(send.id, { status: "failed", errorMessage: phoneCheck.error } as any);
            console.error(`[Drip] SMS step skipped for ${enrollment.prospectName}: ${phoneCheck.error}`);
          } else {
            const result = await sendSmsViaQuo(phoneCheck.e164, personalize(step.bodyHtml));
            if (result.success) {
              await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
              console.log(`[Drip] Sent SMS step ${stepIdx + 1} to ${phoneCheck.e164}`);
              // Carrier-safe spacing between texts. The email caps/jitter don't cover
              // SMS, and the drain can fire multiple same-day SMS steps for one
              // contact back-to-back — so pace each text (skipped on a force run).
              if (!force) await sleep(smartSmsDelay(activeEnrollments.length));
            } else {
              await storage.updateDripSend(send.id, { status: "failed", errorMessage: result.error } as any);
              console.error(`[Drip] Failed to text ${phoneCheck.e164}: ${result.error}`);
            }
          }
        } else {
          // call / linkedin / linkedin_connect / linkedin_message / task → manual to-do.
          // Record the dedup marker (drip_sends row) FIRST so a task-creation hiccup
          // can't make this step fire again on the next run; then create the task.
          const isLi = stepType.startsWith("linkedin");
          const liCap = linkedInDailyQueueCap();
          const liToday = isLi ? await linkedInTasksCreatedToday() : 0;
          if (isLi && liToday >= liCap) {
            const skipped = await storage.createDripSend({
              enrollmentId: enrollment.id,
              stepId: step.id,
              channel: channelOf(stepType),
              recipientEmail: enrollment.prospectEmail,
              recipientName: enrollment.prospectName,
              subject: step.stepName || stepType,
              status: "skipped",
            });
            await storage.updateDripSend(skipped.id, { errorMessage: `LinkedIn daily queue cap (${liCap})` } as any).catch(() => {});
            console.log(`[Drip] LinkedIn cap ${liCap} reached — skipped task for ${enrollment.prospectName}`);
          } else {
            const liNote = isLinkedInConnectStep(step) ? FIRST_TOUCH[lang].linkedinNote : "";
            await storage.createDripSend({
              enrollmentId: enrollment.id,
              stepId: step.id,
              channel: channelOf(stepType),
              recipientEmail: enrollment.prospectEmail,
              recipientName: enrollment.prospectName,
              subject: step.stepName || stepType,
              status: "task",
            });
            const title = personalize(liNote || step.stepName) || defaultTaskTitle(stepType, firstName);
            try {
              await storage.createContactTask({
                prospectId: enrollment.prospectId,
                title,
                subtitle: enrollment.prospectName,
                dueDate: new Date(),
              } as any);
              console.log(`[Drip] Created ${stepType} task for ${enrollment.prospectName}: "${title}"`);
            } catch (taskErr) {
              // Don't let a single task failure abort the whole run or stall the enrollment.
              console.error(`[Drip] Failed to create ${stepType} task for ${enrollment.prospectName}:`, taskErr);
            }
          }
        }

        stepIdx += 1;
        await storage.updateDripEnrollment(enrollment.id, { currentStep: stepIdx } as any);
      }

      // A fully-drained enrollment (every step handled) is complete.
      if (stepIdx >= steps.length) {
        await storage.updateDripEnrollment(enrollment.id, {
          status: "completed",
          completedAt: new Date(),
        } as any);
      }
    }

    console.log(`[Drip] Run complete. Sent ${sentThisRun} emails this run (today: ${sentLast24h}/${dailyCap}, hour: ${sentLastHour}/${hourlyCap}).`);
  } catch (err) {
    console.error("[Drip] Processing error:", err);
  } finally {
    dripRunInProgress = false;
    // If a trigger arrived mid-run, sweep once more (globally, non-force) to pick
    // up any enrollments that weren't in this run's snapshot. Deferred slightly so
    // the flag/in-progress state settles; each sweep makes progress, so this
    // converges rather than looping.
    if (dripRerunRequested) {
      dripRerunRequested = false;
      setTimeout(() => {
        processDripEmails().catch((e) => console.error("[Drip] Queued follow-up sweep error:", e));
      }, 1500);
    }
  }
}

// Force-resend ONE step to every enrolled contact in a campaign — used by the
// per-step "Reprocess" button. Unlike processDripEmails this ignores delay
// timing and the already-sent guard (that's the whole point) but still respects
// suppression (DNC) for email and requires a phone for SMS.
export async function reprocessStep(campaignId: string, stepId: string): Promise<{ attempted: number; sent: number; failed: number; skipped: number }> {
  const steps = await storage.getDripSteps(campaignId);
  const step = steps.find((s) => s.id === stepId);
  const result = { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  if (!step) return result;

  const stepType = (step.stepType || "email").toLowerCase();
  if (!["email", "manual_email", "sms"].includes(stepType)) return result;

  const enrollments = await storage.getDripEnrollments(campaignId);
  console.log(`[Reprocess] Step "${step.stepName || step.subject}" → ${enrollments.length} enrolled contact(s)`);

  for (const enrollment of enrollments) {
    result.attempted++;
    const prospect = enrollment.prospectId ? await storage.getProspect(enrollment.prospectId).catch(() => undefined) : undefined;
    const lang = firstTouchLang(prospect?.location, null);
    const personalize = makePersonalize(enrollment.prospectName, enrollment.prospectEmail, (prospect?.notes || "").trim());

    try {
      if (stepType === "sms") {
        const prospect = await storage.getProspect(enrollment.prospectId);
        const phoneCheck = toSmsE164(prospect?.phone);
        const send = await storage.createDripSend({
          enrollmentId: enrollment.id, stepId: step.id, channel: "sms",
          recipientEmail: phoneCheck.ok ? phoneCheck.e164 : (prospect?.phone || enrollment.prospectEmail), recipientName: enrollment.prospectName,
          subject: step.stepName || "Text message", status: "pending",
        });
        if (!phoneCheck.ok) {
          await storage.updateDripSend(send.id, { status: "failed", errorMessage: phoneCheck.error } as any);
          result.skipped++;
          continue;
        }
        const r = await sendSmsViaQuo(phoneCheck.e164, personalize(step.bodyHtml));
        if (r.success) { await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any); result.sent++; }
        else { await storage.updateDripSend(send.id, { status: "failed", errorMessage: r.error } as any); result.failed++; }
      } else {
        // A manual reprocess is an explicit user action, so it overrides any
        // prior suppression: lift the DNC entry and re-activate a stopped
        // enrollment so the send goes out (and the campaign resumes).
        if (await isOnDnc(enrollment.prospectEmail)) {
          await removeFromDnc(enrollment.prospectEmail);
        }
        if (enrollment.status === "bounced" || enrollment.status === "paused") {
          await storage.updateDripEnrollment(enrollment.id, { status: "active" } as any).catch(() => {});
        }
        const send = await storage.createDripSend({
          enrollmentId: enrollment.id, stepId: step.id, channel: "email",
          recipientEmail: enrollment.prospectEmail, recipientName: enrollment.prospectName,
          subject: step.subject || step.stepName || "Email", status: "pending",
        });
        const trackingUrl = getTrackingPixelUrl(getBaseUrl(), send.id);
        const first = isFirstEmailStep(step) ? FIRST_TOUCH[lang] : null;
        const r = await sendEmail(enrollment.prospectEmail, personalize(first?.subject ?? step.subject), personalize(first?.bodyHtml ?? step.bodyHtml), trackingUrl);
        if (r.success) { await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any); result.sent++; }
        else { await storage.updateDripSend(send.id, { status: "failed", errorMessage: r.error } as any); result.failed++; }
        await sleep(1200); // gentle pacing so a reprocess isn't a hard burst
      }
    } catch (err: any) {
      console.error(`[Reprocess] ${enrollment.prospectEmail} failed:`, err?.message || err);
      result.failed++;
    }
  }

  console.log(`[Reprocess] Done — attempted ${result.attempted}, sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}`);
  return result;
}

// ─── Parallel reaction: hot-lead alert + call task on first link click ───────
// Fired from the click-tracking endpoint on the FIRST click of a drip send.
export async function fireClickReaction(send: any): Promise<void> {
  try {
    const enrollment = send.enrollmentId ? await storage.getDripEnrollment(send.enrollmentId) : null;
    const name = send.recipientName || enrollment?.prospectName || send.recipientEmail || "A contact";
    if (enrollment?.prospectId) {
      await storage.createContactTask({
        prospectId: enrollment.prospectId,
        title: `🔥 Call ${name} — clicked a link`,
        subtitle: `High intent: clicked "${send.subject || "an email"}"`,
        dueDate: new Date(),
      } as any).catch(() => {});
    }
    await sendEmail(
      "dylan@newdawnfranchising.com",
      `🔥 ${name} clicked a link — call now`,
      `<p><strong>${name}</strong> (${send.recipientEmail || "—"}) just clicked a link in "${send.subject || "your email"}". High intent — a call task has been created. Reach out now.</p>`,
    ).catch(() => {});
    console.log(`[ClickReaction] hot-lead task + alert for ${name}`);
  } catch (e: any) {
    console.error("[ClickReaction] failed:", e?.message || e);
  }
}

// ─── Parallel reaction: re-send the first email if it wasn't opened ───────────
// For each active campaign's first email step, if a contact's send is still
// unopened after ~4 days (and we haven't already re-sent), send it once more
// with a fresh subject. Idempotent: a second send for that step means done.
export async function resendUnopenedFirstEmails(): Promise<void> {
  const WAIT_MS = 96 * 3_600_000; // 4 days
  try {
    const campaigns = await storage.getDripCampaigns();
    for (const c of campaigns as any[]) {
      if (!c.isActive) continue;
      const steps = await storage.getDripSteps(c.id);
      const firstEmail = steps
        .filter((s) => ["email", "manual_email"].includes((s.stepType || "email").toLowerCase()))
        .sort((a, b) => a.stepOrder - b.stepOrder)[0];
      if (!firstEmail) continue;

      const enrollments = await storage.getActiveEnrollments(c.id);
      for (const e of enrollments) {
        if (e.status !== "active") continue;
        const sends = (await storage.getDripSends(e.id)).filter((s) => s.stepId === firstEmail.id);
        if (sends.length !== 1) continue; // 0 = not sent; >=2 = already re-sent
        const s0 = sends[0];
        if (s0.status !== "sent" || s0.openedAt) continue;
        const sentAt = s0.sentAt ? new Date(s0.sentAt).getTime() : 0;
        if (!sentAt || Date.now() - sentAt < WAIT_MS) continue;
        if (await isOnDnc(e.prospectEmail)) continue;

        const firstName = (e.prospectName || "").trim().split(/\s+/)[0] || "there";
        const personalize = (str: string | null | undefined): string =>
          (str || "")
            .replace(/\[Contact First Name\]/gi, firstName)
            .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
            .replace(/\{\{\s*name\s*\}\}/gi, e.prospectName)
            .replace(/\{\{\s*email\s*\}\}/gi, e.prospectEmail);
        const newSubject = `Following up — ${personalize(firstEmail.subject)}`;
        const send = await storage.createDripSend({
          enrollmentId: e.id, stepId: firstEmail.id, channel: "email",
          recipientEmail: e.prospectEmail, recipientName: e.prospectName,
          subject: newSubject, status: "pending",
        });
        const trackingUrl = getTrackingPixelUrl(getBaseUrl(), send.id);
        const r = await sendEmail(e.prospectEmail, newSubject, personalize(firstEmail.bodyHtml), trackingUrl);
        if (r.success) {
          await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
          console.log(`[Drip] No-open re-send → ${e.prospectEmail}`);
        } else {
          await storage.updateDripSend(send.id, { status: "failed", errorMessage: r.error } as any);
        }
        await sleep(1500);
      }
    }
  } catch (e: any) {
    console.error("[Drip] resendUnopenedFirstEmails error:", e?.message || e);
  }
}

export function scheduleDripProcessing() {
  // Run hourly during business hours (8 AM–6 PM ET) — window check inside prevents off-hours sends
  // This ensures late-enrolling prospects don't have to wait until the next day
  cron.schedule("0 8-18 * * 1-5", () => {
    console.log("[Drip] Hourly window check — running drip processor...");
    processDripEmails();
    resendUnopenedFirstEmails();
  }, { timezone: "America/New_York" });

  // Catch-up run shortly after boot. The hourly cron only fires at the top of the
  // hour, so a process restart (Railway redeploy, crash, OOM) that lands mid-run
  // would otherwise strand the remaining enrollments until the next hour — which
  // is exactly how a 50-contact send can stop after only a handful of emails.
  // This resumes within a minute instead. It's safe to run on every boot: the
  // optimal-window + daily/hourly cap gates inside processDripEmails() make it a
  // no-op outside business hours, and the per-step already-sent guard prevents
  // any double-send. The short delay lets the server + DB pool finish warming up.
  const STARTUP_CATCHUP_DELAY_MS = 45_000;
  setTimeout(() => {
    console.log("[Drip] Startup catch-up run (resuming any work stranded by a restart)...");
    processDripEmails().catch((e) => console.error("[Drip] Startup catch-up error:", e));
  }, STARTUP_CATCHUP_DELAY_MS);

  console.log("Drip email processing scheduled: Hourly Mon–Fri 8 AM–6 PM ET + startup catch-up (optimal window gating active)");
}
