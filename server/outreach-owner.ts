/**
 * Single-owner outreach switch.
 *
 * Daily Outreach Intelligence → Grok 2.0 drip is the only automated sender.
 * The 8AM AI Agent and the broker/partner sequence processors stay available
 * for manual use, but their crons are frozen unless PARALLEL_OUTREACH is on.
 */

/** Instantly owns outreach; this switch also silences legacy agent phone alerts. */
export const OUTREACH_DISABLED_REASON = "Automatic outreach is disabled; outreach is managed in Instantly.";

export function isLegacyOutreachDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ["1", "true", "on", "yes"].includes((env.OUTREACH_DISABLED ?? "").trim().toLowerCase());
}

export function isParallelOutreachEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isLegacyOutreachDisabled(env)) return false;
  const v = (env.PARALLEL_OUTREACH ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** How many LinkedIn connect/DM tasks the drip may create per ET day. */
export function linkedInDailyQueueCap(env: NodeJS.ProcessEnv = process.env): number {
  const n = parseInt(env.LINKEDIN_DAILY_QUEUE_CAP ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

export function logParallelSkip(job: string): void {
  console.log(`[OutreachOwner] Skipping ${job} — daily intel owns automated outreach (set PARALLEL_OUTREACH=true to re-enable).`);
}
