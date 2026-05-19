import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, getTrackingPixelUrl } from "./email-service";
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

        const send = await storage.createDripSend({
          enrollmentId: enrollment.id,
          stepId: step.id,
          recipientEmail: enrollment.prospectEmail,
          recipientName: enrollment.prospectName,
          subject: step.subject,
          status: "pending",
        });

        const baseUrl = getBaseUrl();
        const trackingUrl = getTrackingPixelUrl(baseUrl, send.id);

        const personalizedHtml = step.bodyHtml
          .replace(/\{\{name\}\}/g, enrollment.prospectName)
          .replace(/\{\{email\}\}/g, enrollment.prospectEmail);

        const result = await sendEmail(
          enrollment.prospectEmail,
          step.subject.replace(/\{\{name\}\}/g, enrollment.prospectName),
          personalizedHtml,
          trackingUrl
        );

        if (result.success) {
          incrementDailyEmailCount();
          sentThisRun++;
          await storage.updateDripSend(send.id, {
            status: "sent",
            sentAt: new Date(),
          } as any);
          console.log(`[Drip] Sent step ${currentStepIndex + 1} to ${enrollment.prospectEmail} (daily total: ${getDailyEmailCount()})`);
        } else {
          await storage.updateDripSend(send.id, {
            status: "failed",
            errorMessage: result.error,
          } as any);
          console.error(`[Drip] Failed to send to ${enrollment.prospectEmail}: ${result.error}`);
        }

        await storage.updateDripEnrollment(enrollment.id, {
          currentStep: currentStepIndex + 1,
        } as any);

        // Organic jitter between emails — avoids burst-send spam signals
        if (sentThisRun > 0 && !isEmailDailyCapReached()) {
          const jitter = smartEmailDelay(sentThisRun);
          console.log(`[Drip] Waiting ${Math.round(jitter / 1000)}s before next send...`);
          await new Promise(r => setTimeout(r, jitter));
        }
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
