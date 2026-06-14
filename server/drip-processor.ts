import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, getTrackingPixelUrl } from "./email-service";
import { sendSmsViaQuo } from "./quo-service";
import { isOnDnc } from "./agent-service";
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

      if (daysSinceEnrollment >= step.delayDays) {
        const existingSends = await storage.getDripSends(enrollment.id);
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

export function scheduleDripProcessing() {
  // Run hourly during business hours (8 AM–6 PM ET) — window check inside prevents off-hours sends
  // This ensures late-enrolling prospects don't have to wait until the next day
  cron.schedule("0 8-18 * * 1-5", () => {
    console.log("[Drip] Hourly window check — running drip processor...");
    processDripEmails();
  }, { timezone: "America/New_York" });

  console.log("Drip email processing scheduled: Hourly Mon–Fri 8 AM–6 PM ET (optimal window gating active)");
}
