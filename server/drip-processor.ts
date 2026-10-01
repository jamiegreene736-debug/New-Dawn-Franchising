import { getOutreachReadiness, campaignWindowIssue } from "./outreach-readiness";
import { greetingName, nextEmailAllowedAt, preferFirstContact } from "./drip-scheduling";
import { campaignMessageId } from "./campaign-replies";
import cron from "node-cron";
import { storage } from "./storage";
import { sendEmailFromSender, chooseSenderForKey, getAvailableSenders, getSenderPassword } from "./email-service";
import {
  allSendersDisabled,
  isRecipientFailure,
  isTerminalDripSend,
  loadSenderHealth,
} from "./sender-health";
import { sendSmsViaQuo, toSmsE164 } from "./quo-service";
import { isOnDnc, addToDnc } from "./agent-service";
import { getDeliverabilitySettings, recordSenderUse } from "./deliverability-settings-service";
import { verifyEmailForEnrollment } from "./email-verification-service";
import {
  isOptimalEmailWindow,
  smartEmailDelay,
  smartSmsDelay,
  emailDomain,
  nextWindowDescription,
} from "./smart-scheduler";
import { FIRST_TOUCH, isLinkedInConnectStep } from "@shared/first-touch";
import { firstTouchLang } from "./introducer-qualify";
import { linkedInDailyQueueCap } from "./outreach-owner";
import { db, pool } from "./db";
import type { PoolClient } from "pg";
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
  const { firstName, fullName } = greetingName(name || "");
  return (s: string | null | undefined): string =>
    (s || "")
      .replace(/\[Contact First Name\]/gi, firstName)
      .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
      .replace(/\{\{\s*name\s*\}\}/gi, fullName)
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
  // Passive campaign signals cannot create setter calls through the task path either.
  if ((step.stepType || "").toLowerCase() === "call" && tt !== "time") return "skip";

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
  console.log(`[Drip] Processing scheduled emails...${campaignId ? ` (campaign ${campaignId} only)` : ""}${force ? " (manual override — bypassing window only)" : ""}`);

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
  let runLock: PoolClient | undefined;
  let lockAcquired = false;
  try {
    runLock = await pool.connect();
    const lock = await runLock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(71283045) AS locked");
    lockAcquired = lock.rows[0].locked;
    if (!lockAcquired) return;

    // Effective throttles: "Sending & Safety" DB overrides win over the env-var
    // defaults, fetched fresh each run so changes apply without a restart. Falls
    // back to the env caps (EMAIL_DAILY_CAP etc.) when no override is set.
    const delivSettings = await getDeliverabilitySettings();
    if (delivSettings.outreachAutopilotPaused) {
      console.log("[Drip] Outreach paused; no scheduled or forced sends.");
      return;
    }
    const dailyCap = delivSettings.effectiveDailyCap;
    const hourlyCap = delivSettings.effectiveHourlyCap;
    const domainGapMs = delivSettings.effectiveDomainGapMs;

    await loadSenderHealth();
    const configuredSenders = getAvailableSenders().map((p) => p.email);
    if (!getAvailableSenders().some(p => getSenderPassword(p))) {
      console.error("[Drip] Dylan mailbox is not configured; no outreach sent.");
      return;
    }
    if (allSendersDisabled(configuredSenders)) {
      console.error("[Drip] All sending mailboxes are disabled (Gmail 535/534). Pausing until a mailbox is re-authed.");
      return;
    }

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
    // Manual overrides retain both volume caps.
    if (sentLastHour >= hourlyCap) {
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

    const activity = await storage.getDripEmailActivity();
    const lastSendByRecipient = new Map(activity.map(row => [row.email, row.lastSentAt]));
    let firstContactsLast24h = activity.filter(row => row.firstSentAt.getTime() >= now - 86_400_000).length;
    const eligibleEnrollments = activeEnrollments.filter(e => activeCampaignIds.has(e.campaignId));
    const firstContacts = eligibleEnrollments.filter(e => !lastSendByRecipient.has(e.prospectEmail.trim().toLowerCase()));
    const followUps = eligibleEnrollments.filter(e => lastSendByRecipient.has(e.prospectEmail.trim().toLowerCase()));
    let sentThisRun = 0;
    // Last send time per recipient domain, to pace bursts to one ISP/domain.
    const lastSendByDomain = new Map<string, number>();
    console.log(`[Drip] ${activeEnrollments.length} active enrollments · ${dailyCap - sentLast24h} left today · ${hourlyCap - sentLastHour} left this hour`);

    while (firstContacts.length || followUps.length) {
      const preferNew = preferFirstContact(firstContactsLast24h, sentLast24h);
      const enrollment = (preferNew ? firstContacts.shift() ?? followUps.shift() : followUps.shift() ?? firstContacts.shift())!;
      const recipientKey = enrollment.prospectEmail.trim().toLowerCase();
      if (allSendersDisabled(configuredSenders)) {
        console.error("[Drip] All sending mailboxes are disabled mid-run — stopping.");
        break;
      }
      // Stop if either throttle is hit mid-run
      if (sentLast24h >= dailyCap) {
        console.log("[Drip] Daily cap hit mid-run. Stopping early.");
        break;
      }
      if (sentLastHour >= hourlyCap) {
        console.log("[Drip] Hourly cap hit mid-run. Stopping — will resume next hour.");
        break;
      }

      // Skip enrollments whose campaign is paused/off.
      if (!activeCampaignIds.has(enrollment.campaignId)) continue;

      const steps = await storage.getDripSteps(enrollment.campaignId);
      if (steps.length === 0) continue;

      // Tasks may advance in the same pass; email spacing always follows actual
      // sends, so a late enrollment never receives a backlog of emails at once.
      const enrolledAt = new Date(enrollment.enrolledAt);
      const firstName = (enrollment.prospectName || "").trim().split(/\s+/)[0] || enrollment.prospectName || "there";
      const prospect = enrollment.prospectId ? await storage.getProspect(enrollment.prospectId).catch(() => undefined) : undefined;
      const qualification = await pool.query<{ reason: string }>("SELECT reason FROM outreach_qualifications WHERE email=$1 AND status='approved'", [recipientKey]);
      const firmHook = (qualification.rows[0]?.reason || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
      const lang = firstTouchLang(prospect?.location, null);
      const personalize = makePersonalize(enrollment.prospectName, enrollment.prospectEmail, firmHook);

      // stepIdx strictly increases every iteration (send/skip/already-sent → +1,
      // wait/cap/bounce → break), so the loop always terminates.
      let stepIdx = enrollment.currentStep;
      while (stepIdx < steps.length) {
        // Re-check the throttles before every send so a multi-step drain can't
        // burst past the daily/hourly caps.
        if (sentLast24h >= dailyCap) break;
        if (sentLastHour >= hourlyCap) break;

        if ((await getDeliverabilitySettings()).outreachAutopilotPaused) return;
        const campaign = await storage.getDripCampaign(enrollment.campaignId);
        if (!campaign?.isActive) break;
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

        if (existingSends.some(s => s.stepId === step.id && s.channel === "email" && ["pending", "unknown"].includes(s.status))) {
          await pool.query("UPDATE drip_enrollments SET hold_reason=$2 WHERE id=$1", [enrollment.id, "An earlier send has an uncertain outcome; reconcile provider history before retrying."]);
          break;
        }
        const alreadySent = existingSends.some(s => s.stepId === step.id && isTerminalDripSend(s));
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
            await storage.updateDripEnrollment(enrollment.id, { status: "suppressed" } as any);
            console.log(`[Drip] Skipping suppressed/bounced address ${enrollment.prospectEmail} — enrollment stopped`);
            break; // suppressed mailbox/domain — stop draining this enrollment
          }

          const hold = campaignWindowIssue(campaign.outreachPolicy) || await getOutreachReadiness(enrollment.prospectEmail, campaign.audienceType || "broker", enrollment.enrolledAt, campaign.outreachPolicy);
          if (hold) {
            await pool.query("UPDATE drip_enrollments SET hold_reason=$2 WHERE id=$1", [enrollment.id, hold]);
            break;
          }
          // Manual forcing cannot bypass recipient cooldown or sequence spacing.
          if (now.getTime() < nextEmailAllowedAt(step, steps, existingSends, lastSendByRecipient.get(recipientKey))) break;


          // A provider outage or unknown result must not release unverified prospects.
          const fresh = prospect?.emailStatus === "valid" && prospect.emailVerifiedAt
            && Date.now() - new Date(prospect.emailVerifiedAt).getTime() < 30 * 86400_000
            && prospect.email?.trim().toLowerCase() === recipientKey;
          if (!fresh) {
            const verification = await verifyEmailForEnrollment(enrollment.prospectEmail);
            if (verification.status !== "valid") {
              await pool.query("UPDATE drip_enrollments SET hold_reason=$2 WHERE id=$1", [enrollment.id, `Address verification required (${verification.status}).`]);
              if (verification.status === "invalid") await addToDnc(enrollment.prospectEmail, undefined, undefined, "Invalid address confirmed by verifier");
              break;
            }
            if (prospect) await storage.updateProspect(prospect.id, { emailStatus: "valid", emailVerifiedAt: new Date() });
          }
          await pool.query("UPDATE drip_enrollments SET hold_reason=NULL WHERE id=$1", [enrollment.id]);

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

          const freshEnrollment = await storage.getDripEnrollment(enrollment.id);
          if (freshEnrollment?.status !== "active") break;
          const firstEmail = !existingSends.some(s => s.channel === "email" && s.sentAt);
          const renderedBody = (campaign.outreachPolicy !== "broker_nurture_10" && firstEmail && firmHook ? `<p>${firmHook}</p>` : "") + personalize(step.bodyHtml);
          const send = await storage.createDripSend({
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: "email",
            recipientEmail: enrollment.prospectEmail,
            recipientName: enrollment.prospectName,
            subject: personalize(step.subject || step.stepName || "Email"),
            status: "pending",
            fromAddress: chooseSenderForKey(enrollment.id, false),
            renderedBodyHtml: renderedBody,
          });

          // Keep every outreach email and reply on Dylan's mailbox.
          const fromEmail = chooseSenderForKey(enrollment.id, delivSettings.senderRotation);
          const result = await sendEmailFromSender(
            fromEmail,
            enrollment.prospectEmail,
            personalize(step.subject),
            renderedBody,
            undefined, undefined, { messageId: campaignMessageId(send.id), outreach: true, previewText: personalize(step.previewText || ""),
              onPrepared: async (html) => { await storage.updateDripSend(send.id, { renderedBodyHtml: html, providerMessageId: campaignMessageId(send.id) }); } }
          );

          if (result.success) {
            if (!lastSendByRecipient.has(recipientKey)) firstContactsLast24h++;
            lastSendByRecipient.set(recipientKey, new Date());
            sentThisRun++;
            sentLast24h++;
            sentLastHour++;
            if (domain) lastSendByDomain.set(domain, Date.now());
            await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date(), providerMessageId: result.messageId } as any);
            recordSenderUse(fromEmail).catch(() => {});
            console.log(`[Drip] Sent email step ${stepIdx + 1} to ${enrollment.prospectEmail} from ${fromEmail} (today: ${sentLast24h}/${dailyCap}, hour: ${sentLastHour}/${hourlyCap})`);
          } else {
            await storage.updateDripSend(send.id, { status: /timeout|timed out|socket|ECONNRESET|ETIMEDOUT/i.test(result.error || "") ? "unknown" : "failed", errorMessage: result.error } as any);
            console.error(`[Drip] Failed to email ${enrollment.prospectEmail}: ${result.error}`);
            // Auth / network / 421 — leave the step retryable. Recipient-level
            // 553s are terminal (alreadySent will treat them as consumed).
            if (!isRecipientFailure(result.error)) {
              if (allSendersDisabled(configuredSenders)) {
                console.error("[Drip] Last healthy mailbox just failed auth — stopping this run.");
                return;
              }
              break;
            }
          }

          // Pace accepted messages while retaining both hourly and daily caps.
          if (sentThisRun > 0 && sentLast24h < dailyCap && (sentLastHour < hourlyCap)) {
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
            await storage.updateDripSend(send.id, { status: "skipped", errorMessage: phoneCheck.error } as any);
            console.log(`[Drip] SMS step skipped for ${enrollment.prospectName}: ${phoneCheck.error}`);
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
    if (runLock) {
      try {
        if (lockAcquired) await runLock.query("SELECT pg_advisory_unlock(71283045)");
        runLock.release();
      } catch (error) {
        runLock.release(true);
        console.error("[Drip] Failed to release scheduler lock:", error);
      }
    }
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

export function scheduleDripProcessing() {
  // Run hourly during business hours (8 AM–6 PM ET) — window check inside prevents off-hours sends
  // This ensures late-enrolling prospects don't have to wait until the next day
  cron.schedule("0 8-18 * * 1-5", () => {
    console.log("[Drip] Hourly window check — running drip processor...");
    processDripEmails();
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
