import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, getTrackingPixelUrl } from "./email-service";
import { sendSmsViaQuo } from "./quo-service";
import {
  isOptimalEmailWindow,
  smartEmailDelay,
  isEmailDailyCapReached,
  incrementDailyEmailCount,
  getDailyEmailCount,
  EMAIL_DAILY_CAP,
  nextWindowDescription,
} from "./smart-scheduler";

function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
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

export async function processDripEmails() {
  console.log("[Drip] Processing scheduled emails...");

  // Respect optimal send windows — skip if outside hours
  if (!isOptimalEmailWindow()) {
    console.log(`[Drip] Outside optimal email window — ${nextWindowDescription("email")}. Skipping.`);
    return;
  }

  // Respect daily email cap
  if (isEmailDailyCapReached()) {
    console.log(`[Drip] Daily email cap reached (${EMAIL_DAILY_CAP}/day). Deferring to tomorrow.`);
    return;
  }

  try {
    const activeEnrollments = await storage.getActiveEnrollments();
    let sentThisRun = 0;
    const dailyRemaining = EMAIL_DAILY_CAP - getDailyEmailCount();
    console.log(`[Drip] ${activeEnrollments.length} active enrollments, ${dailyRemaining} sends remaining today`);

    for (const enrollment of activeEnrollments) {
      // Stop if daily cap hit mid-run
      if (isEmailDailyCapReached()) {
        console.log("[Drip] Daily cap hit mid-run. Stopping early.");
        break;
      }

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
            incrementDailyEmailCount();
            sentThisRun++;
            await storage.updateDripSend(send.id, { status: "sent", sentAt: new Date() } as any);
            console.log(`[Drip] Sent email step ${currentStepIndex + 1} to ${enrollment.prospectEmail} (daily total: ${getDailyEmailCount()})`);
          } else {
            await storage.updateDripSend(send.id, { status: "failed", errorMessage: result.error } as any);
            console.error(`[Drip] Failed to email ${enrollment.prospectEmail}: ${result.error}`);
          }

          // Organic jitter between emails — avoids burst-send spam signals
          if (sentThisRun > 0 && !isEmailDailyCapReached()) {
            const jitter = smartEmailDelay(sentThisRun);
            console.log(`[Drip] Waiting ${Math.round(jitter / 1000)}s before next send...`);
            await new Promise(r => setTimeout(r, jitter));
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

    console.log(`[Drip] Run complete. Sent ${sentThisRun} emails this run (daily total: ${getDailyEmailCount()}/${EMAIL_DAILY_CAP}).`);
  } catch (err) {
    console.error("[Drip] Processing error:", err);
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
