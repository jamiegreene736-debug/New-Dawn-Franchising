import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, getTrackingPixelUrl } from "./email-service";
import { sendSmsViaQuo } from "./quo-service";
import { isOnDnc, removeFromDnc } from "./agent-service";
import {
  isOptimalEmailWindow,
  smartEmailDelay,
  EMAIL_DAILY_CAP,
  EMAIL_HOURLY_CAP,
  EMAIL_DOMAIN_GAP_MS,
  emailDomain,
  nextWindowDescription,
} from "./smart-scheduler";

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

export async function processDripEmails(opts: { force?: boolean; campaignId?: string } = {}) {
  const { force = false, campaignId } = opts;
  console.log(`[Drip] Processing scheduled emails...${campaignId ? ` (campaign ${campaignId} only)` : ""}${force ? " (manual override — bypassing window + hourly cap)" : ""}`);

  if (dripRunInProgress) {
    console.log("[Drip] A run is already in progress — skipping this trigger.");
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
    // DB-backed rolling-window counters so throttles survive process restarts
    // (Railway redeploys) instead of resetting an in-memory counter mid-day.
    const now = Date.now();
    let sentLast24h = await storage.countSentEmailsSince(new Date(now - 24 * 60 * 60 * 1000));
    let sentLastHour = await storage.countSentEmailsSince(new Date(now - 60 * 60 * 1000));

    // Respect daily volume cap (a hard safety even on a manual override)
    if (sentLast24h >= EMAIL_DAILY_CAP) {
      console.log(`[Drip] Daily email cap reached (${sentLast24h}/${EMAIL_DAILY_CAP} in last 24h). Deferring.`);
      return;
    }
    // Respect hourly cap — spreads the day's volume across business hours so we
    // never burst the whole quota in one run (a classic bulk-sender spam signal).
    // Skipped on a manual override.
    if (!force && sentLastHour >= EMAIL_HOURLY_CAP) {
      console.log(`[Drip] Hourly email cap reached (${sentLastHour}/${EMAIL_HOURLY_CAP} in last hour). Resuming next hour.`);
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
    console.log(`[Drip] ${activeEnrollments.length} active enrollments · ${EMAIL_DAILY_CAP - sentLast24h} left today · ${EMAIL_HOURLY_CAP - sentLastHour} left this hour`);

    for (const enrollment of activeEnrollments) {
      // Stop if either throttle is hit mid-run
      if (sentLast24h >= EMAIL_DAILY_CAP) {
        console.log("[Drip] Daily cap hit mid-run. Stopping early.");
        break;
      }
      if (!force && sentLastHour >= EMAIL_HOURLY_CAP) {
        console.log("[Drip] Hourly cap hit mid-run. Stopping — will resume next hour.");
        break;
      }

      // Skip enrollments whose campaign is paused/off.
      if (!activeCampaignIds.has(enrollment.campaignId)) continue;

      const steps = await storage.getDripSteps(enrollment.campaignId);
      if (steps.length === 0) continue;

      const currentStepIndex = enrollment.currentStep;
      if (currentStepIndex >= steps.length) {
        await storage.updateDripEnrollment(enrollment.id, {
          status: "completed",
          completedAt: new Date(),
        } as any);
        continue;
      }

      const step = steps[currentStepIndex];
      const enrolledAt = new Date(enrollment.enrolledAt);
      const now = new Date();
      const daysSinceEnrollment = Math.floor((now.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));

      const existingSends = await storage.getDripSends(enrollment.id);
      const ready = evaluateTrigger(step, steps, enrolledAt, existingSends, now, !!force);
      if (ready === "wait") continue;
      if (ready === "skip") {
        await storage.updateDripEnrollment(enrollment.id, { currentStep: currentStepIndex + 1 } as any);
        console.log(`[Drip] Trigger not met within window — skipping step ${currentStepIndex + 1} for ${enrollment.prospectName}`);
        continue;
      }
      {
        const alreadySent = existingSends.some(s => s.stepId === step.id);
        if (alreadySent) {
          await storage.updateDripEnrollment(enrollment.id, {
            currentStep: currentStepIndex + 1,
          } as any);
          continue;
        }

        // Shared personalization — supports Seamless-style [Contact First Name]
        // as well as the legacy {{name}} / {{email}} tokens.
        const firstName = (enrollment.prospectName || "").trim().split(/\s+/)[0] || enrollment.prospectName || "there";
        const personalize = (s: string | null | undefined): string =>
          (s || "")
            .replace(/\[Contact First Name\]/gi, firstName)
            .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
            .replace(/\{\{\s*name\s*\}\}/gi, enrollment.prospectName)
            .replace(/\{\{\s*email\s*\}\}/gi, enrollment.prospectEmail);

        const stepType = (step.stepType || "email").toLowerCase();

        if (stepType === "email" || stepType === "manual_email") {
          // Skip addresses that are suppressed (e.g. hard-bounced). Stop the
          // enrollment so it doesn't keep retrying a dead mailbox — the user
          // can fix the email from the Activity tab to resume it.
          if (await isOnDnc(enrollment.prospectEmail)) {
            await storage.updateDripEnrollment(enrollment.id, { status: "bounced" } as any);
            console.log(`[Drip] Skipping suppressed/bounced address ${enrollment.prospectEmail} — enrollment stopped`);
            continue;
          }

          // Per-domain pacing: if we sent to this recipient's domain very
          // recently in this run, wait out the remainder of the domain gap
          // before sending again (avoids rapid bursts to one ISP).
          // (Manual force runs skip the spacing waits so they finish promptly.)
          const domain = emailDomain(enrollment.prospectEmail);
          if (domain && !force) {
            const last = lastSendByDomain.get(domain);
            if (last !== undefined) {
              const wait = EMAIL_DOMAIN_GAP_MS - (Date.now() - last);
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

          const result = await sendEmail(
            enrollment.prospectEmail,
            personalize(step.subject),
            personalize(step.bodyHtml),
            trackingUrl
          );

          if (result.success) {
            sentThisRun++;
            sentLast24h++;
            sentLastHour++;
            if (domain) lastSendByDomain.set(domain, Date.now());
            await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
            console.log(`[Drip] Sent email step ${currentStepIndex + 1} to ${enrollment.prospectEmail} (today: ${sentLast24h}/${EMAIL_DAILY_CAP}, hour: ${sentLastHour}/${EMAIL_HOURLY_CAP})`);
          } else {
            await storage.updateDripSend(send.id, { status: "failed", errorMessage: result.error } as any);
            console.error(`[Drip] Failed to email ${enrollment.prospectEmail}: ${result.error}`);
          }

          // Organic jitter between emails — avoids burst-send spam signals.
          // Skipped on manual force runs (snappy) and once the daily cap is hit.
          if (!force && sentThisRun > 0 && sentLast24h < EMAIL_DAILY_CAP && sentLastHour < EMAIL_HOURLY_CAP) {
            const jitter = smartEmailDelay(sentThisRun);
            console.log(`[Drip] Waiting ${Math.round(jitter / 1000)}s before next send...`);
            await sleep(jitter);
          }
        } else if (stepType === "sms") {
          const prospect = await storage.getProspect(enrollment.prospectId);
          const phone = prospect?.phone || "";
          const send = await storage.createDripSend({
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: "sms",
            recipientEmail: phone || enrollment.prospectEmail,
            recipientName: enrollment.prospectName,
            subject: step.stepName || "Text message",
            status: "pending",
          });

          if (!phone) {
            await storage.updateDripSend(send.id, { status: "failed", errorMessage: "Prospect has no phone number" } as any);
            console.error(`[Drip] SMS step skipped for ${enrollment.prospectName}: no phone`);
          } else {
            const result = await sendSmsViaQuo(phone, personalize(step.bodyHtml));
            if (result.success) {
              await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
              console.log(`[Drip] Sent SMS step ${currentStepIndex + 1} to ${phone}`);
            } else {
              await storage.updateDripSend(send.id, { status: "failed", errorMessage: result.error } as any);
              console.error(`[Drip] Failed to text ${phone}: ${result.error}`);
            }
          }
        } else {
          // call / linkedin / linkedin_connect / linkedin_message / task → manual to-do.
          // Record the dedup marker (drip_sends row) FIRST so a task-creation hiccup
          // can't make this step fire again on the next run; then create the task.
          await storage.createDripSend({
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: channelOf(stepType),
            recipientEmail: enrollment.prospectEmail,
            recipientName: enrollment.prospectName,
            subject: step.stepName || stepType,
            status: "task",
          });
          const title = personalize(step.stepName) || defaultTaskTitle(stepType, firstName);
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

        await storage.updateDripEnrollment(enrollment.id, {
          currentStep: currentStepIndex + 1,
        } as any);
      }
    }

    console.log(`[Drip] Run complete. Sent ${sentThisRun} emails this run (today: ${sentLast24h}/${EMAIL_DAILY_CAP}, hour: ${sentLastHour}/${EMAIL_HOURLY_CAP}).`);
  } catch (err) {
    console.error("[Drip] Processing error:", err);
  } finally {
    dripRunInProgress = false;
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
    const firstName = (enrollment.prospectName || "").trim().split(/\s+/)[0] || enrollment.prospectName || "there";
    const personalize = (s: string | null | undefined): string =>
      (s || "")
        .replace(/\[Contact First Name\]/gi, firstName)
        .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
        .replace(/\{\{\s*name\s*\}\}/gi, enrollment.prospectName)
        .replace(/\{\{\s*email\s*\}\}/gi, enrollment.prospectEmail);

    try {
      if (stepType === "sms") {
        const prospect = await storage.getProspect(enrollment.prospectId);
        const phone = prospect?.phone || "";
        const send = await storage.createDripSend({
          enrollmentId: enrollment.id, stepId: step.id, channel: "sms",
          recipientEmail: phone || enrollment.prospectEmail, recipientName: enrollment.prospectName,
          subject: step.stepName || "Text message", status: "pending",
        });
        if (!phone) {
          await storage.updateDripSend(send.id, { status: "failed", errorMessage: "Prospect has no phone number" } as any);
          result.skipped++;
          continue;
        }
        const r = await sendSmsViaQuo(phone, personalize(step.bodyHtml));
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
        const r = await sendEmail(enrollment.prospectEmail, personalize(step.subject), personalize(step.bodyHtml), trackingUrl);
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

  console.log("Drip email processing scheduled: Hourly Mon–Fri 8 AM–6 PM ET (optimal window gating active)");
}
