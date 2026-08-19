/**
 * outreach-autopilot-helpers.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Pure, DB-free helpers for the daily outreach autopilot: the on/off switch,
 * the "should we resume this plan?" decision, the anomaly guard that falls
 * back to manual approval, and the operator-facing SMS builder. Kept free of
 * server-side imports (db/storage) so they can be exercised directly in
 * outreach-autopilot.test.ts without a database.
 */

import type { DailyCampaignResult } from "./daily-campaign-service";

/** Max times a plan's execution is attempted before autopilot gives up. */
export const MAX_EXECUTION_ATTEMPTS = 2;

/**
 * Autopilot master switch — env-driven so flipping it is a Railway variable
 * change, no deploy. The DB-level pause (deliverability_settings
 * .outreach_autopilot_paused) is checked separately at run time.
 */
export function isAutopilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.OUTREACH_AUTOPILOT ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * Given an existing plan row for today, should autopilot pick it up and run it?
 *  • awaiting_approval — plan was drafted but never executed (flag flipped on
 *    later, or the process died between insert and auto-approve) → run it.
 *  • approved — crashed after approval but before/inside execution → run it.
 *  • failed — retry while attempts remain.
 *  • executing/completed/rejected/expired — leave alone (executing may be live
 *    in another process; completed is done; rejected/expired were human/system
 *    decisions).
 */
export function shouldAutoResume(
  status: string | null | undefined,
  executionAttempts: number | null | undefined,
): boolean {
  const attempts = executionAttempts ?? 0;
  if (status === "awaiting_approval" || status === "approved") return true;
  if (status === "failed") return attempts < MAX_EXECUTION_ATTEMPTS;
  return false;
}

/**
 * Sanity-check a freshly generated plan before auto-executing it. Returns a
 * human-readable reason when the plan looks anomalous (→ fall back to the
 * manual approval link instead of running blind), or null when it's safe.
 */
export function planLooksAnomalous(
  plan: {
    estimatedLeads?: number | null;
    searchQueries?: unknown[] | null;
    leadCategories?: unknown[] | null;
  },
  dailyTarget: number,
): string | null {
  const queries = plan.searchQueries ?? [];
  const categories = plan.leadCategories ?? [];
  if (queries.length === 0) return "the plan contains no search queries";
  if (categories.length === 0) return "the plan contains no lead categories";
  if (queries.length > 40) return `the plan contains ${queries.length} search queries (max 40 for auto-run)`;
  const est = plan.estimatedLeads ?? 0;
  if (est > dailyTarget * 3) {
    return `the plan estimates ${est} leads (over 3× the ${dailyTarget}/day target)`;
  }
  return null;
}

/**
 * Pull the outermost JSON value out of a model response: strips ```json fences
 * and any prose before/after the JSON. Throws with a snippet on failure.
 */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* fall through to bracket slice */ }
  const starts = ["{", "["].map(c => cleaned.indexOf(c)).filter(i => i >= 0);
  const first = starts.length ? Math.min(...starts) : -1;
  const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch { /* fall through to throw */ }
  }
  throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 300)}`);
}

// ─── Completion SMS builder ───────────────────────────────────────────────────

/**
 * Build the "Today's lead plan executed!" summary SMS. Pure + exported so the
 * exact operator-facing text can be asserted in tests. It surfaces WHY the leads
 * were chosen, the contacts-vs-enrolled breakdown (so "0 enrolled" is never a
 * silent failure), and the no-duplicate guarantee. In autopilot mode the header
 * makes clear no action is needed, provider outages are called out, and a pause
 * link gives a one-tap emergency brake.
 */
export function buildPlanExecutedSms(opts: {
  base: string;
  why?: string | null;
  sourcesSearched: number;
  profilesFound: number;
  leadsAdded: number;
  /** Never-campaigned pipeline leads recycled into today's build. */
  backfilled?: number;
  campaign: DailyCampaignResult | null;
  /** True when the plan was auto-approved and executed with no human tap. */
  autopilot?: boolean;
  /** Approval-page URL (carries the Pause Autopilot control). */
  pauseUrl?: string | null;
  /** Distinct provider failures hit during discovery, e.g. "serpapi: HTTP 429". */
  providerIssues?: string[];
}): string {
  const { base, campaign } = opts;
  const why = (opts.why ?? "").trim();
  const whyLine = why ? `\n\n🧭 Why these leads: ${why.slice(0, 320)}` : "";

  let campaignLine = "";
  if (campaign) {
    const parts: string[] = [];
    parts.push(`\n\n🎯 Campaign "${campaign.campaignName}" is LIVE.`);
    const enrichNote = campaign.emailsEnriched
      ? ` (${campaign.emailsEnriched} work emails found` +
        `${campaign.firmPeopleAdded ? `, incl. ${campaign.firmPeopleAdded} people discovered at firms` : ""})`
      : "";
    parts.push(
      `List "${campaign.listName}" — ${campaign.contactsAdded} contacts, ${campaign.enrolled} enrolled${enrichNote}.`,
    );
    // Always explain the gap between contacts and enrollments so "0 enrolled"
    // never looks like a silent failure.
    const skips: string[] = [];
    if (campaign.skippedNoEmail) skips.push(`${campaign.skippedNoEmail} no email`);
    if (campaign.skippedDuplicate) skips.push(`${campaign.skippedDuplicate} already contacted`);
    if (campaign.skippedUndeliverable) skips.push(`${campaign.skippedUndeliverable} undeliverable`);
    if (campaign.enrolled === 0) {
      parts.push(
        `⚠️ 0 enrolled${skips.length ? ` — ${skips.join(", ")}` : ""}. ` +
          `Add or verify emails on those contacts in the CRM to start sending.`,
      );
    } else if (skips.length) {
      parts.push(`(skipped ${skips.join(", ")})`);
    }
    // Dedup reassurance — the user asked to know duplicate research is prevented.
    parts.push(
      `🔁 No-duplicate system is active: anyone already in a campaign is skipped, and today's plan was ` +
        `steered away from the last 7 days of targets so the same people/segments aren't researched twice.`,
    );
    parts.push(`Track it: ${base}/crm`);
    campaignLine = parts.join("\n");
  }

  const issues = (opts.providerIssues ?? []).filter(Boolean);
  const issuesLine = issues.length
    ? `\n\n⚠️ Provider issues during discovery: ${issues.join("; ")}`
    : "";

  const autopilotFooter = opts.autopilot
    ? `\n\n🤖 Autopilot is ON — this ran automatically, no action needed.` +
      (opts.pauseUrl ? ` Pause it any time: ${opts.pauseUrl}` : "")
    : "";

  const backfillLine = opts.backfilled
    ? ` (+${opts.backfilled} recycled from earlier days' pipeline)`
    : "";
  const header = opts.autopilot
    ? "🤖 Autopilot: today's lead plan executed!"
    : "✅ Today's lead plan executed!";
  return (
    `${header}${whyLine}\n\n` +
    `Searched ${opts.sourcesSearched} sources → found ${opts.profilesFound} profiles → ` +
    `added ${opts.leadsAdded} new leads to your pipeline${backfillLine}.${campaignLine}${issuesLine}\n\n` +
    `View pipeline: ${base}/agent${autopilotFooter}`
  );
}
