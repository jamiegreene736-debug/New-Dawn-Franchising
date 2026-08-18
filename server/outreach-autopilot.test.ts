/**
 * Focused verification for the outreach autopilot's pure decision helpers:
 * the env switch, the resume decision, the anomaly guard, and the exact
 * operator-facing SMS text. No network, no DB.
 */
import {
  isAutopilotEnabled,
  shouldAutoResume,
  planLooksAnomalous,
  buildPlanExecutedSms,
  MAX_EXECUTION_ATTEMPTS,
} from "./outreach-autopilot-helpers";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ─── isAutopilotEnabled ───────────────────────────────────────────────────────
console.log("isAutopilotEnabled:");
for (const v of ["true", "1", "on", "yes", " TRUE "]) {
  assert(`"${v}" enables`, isAutopilotEnabled({ OUTREACH_AUTOPILOT: v } as NodeJS.ProcessEnv));
}
for (const v of ["", "false", "0", "off", "no", "banana"]) {
  assert(`"${v}" disables`, !isAutopilotEnabled({ OUTREACH_AUTOPILOT: v } as NodeJS.ProcessEnv));
}
assert("unset disables", !isAutopilotEnabled({} as NodeJS.ProcessEnv));

// ─── shouldAutoResume ─────────────────────────────────────────────────────────
console.log("shouldAutoResume:");
assert("awaiting_approval resumes", shouldAutoResume("awaiting_approval", 0));
assert("approved resumes (crash mid-execution)", shouldAutoResume("approved", 1));
assert("failed with attempts left retries", shouldAutoResume("failed", MAX_EXECUTION_ATTEMPTS - 1));
assert("failed at max attempts does NOT retry", !shouldAutoResume("failed", MAX_EXECUTION_ATTEMPTS));
assert("failed with null attempts retries", shouldAutoResume("failed", null));
assert("completed leaves alone", !shouldAutoResume("completed", 0));
assert("rejected respects the human decision", !shouldAutoResume("rejected", 0));
assert("executing leaves alone (may be live elsewhere)", !shouldAutoResume("executing", 0));
assert("expired leaves alone", !shouldAutoResume("expired", 0));

// ─── planLooksAnomalous ───────────────────────────────────────────────────────
console.log("planLooksAnomalous:");
const sanePlan = {
  estimatedLeads: 150,
  searchQueries: Array.from({ length: 20 }, (_, i) => ({ q: i })),
  leadCategories: Array.from({ length: 8 }, (_, i) => ({ c: i })),
};
assert("sane plan passes", planLooksAnomalous(sanePlan, 150) === null);
assert("estimate at exactly 3× target passes", planLooksAnomalous({ ...sanePlan, estimatedLeads: 450 }, 150) === null);
assert(
  "estimate over 3× target is anomalous",
  (planLooksAnomalous({ ...sanePlan, estimatedLeads: 451 }, 150) ?? "").includes("451"),
);
assert(
  "no queries is anomalous",
  (planLooksAnomalous({ ...sanePlan, searchQueries: [] }, 150) ?? "").includes("no search queries"),
);
assert(
  "no categories is anomalous",
  (planLooksAnomalous({ ...sanePlan, leadCategories: [] }, 150) ?? "").includes("no lead categories"),
);
assert(
  "41 queries is anomalous",
  (planLooksAnomalous({ ...sanePlan, searchQueries: Array.from({ length: 41 }, () => ({})) }, 150) ?? "").includes("41"),
);
assert("null fields treated as empty", planLooksAnomalous({ estimatedLeads: null, searchQueries: null, leadCategories: null }, 150) !== null);

// ─── buildPlanExecutedSms ─────────────────────────────────────────────────────
console.log("buildPlanExecutedSms:");
const campaign = {
  listName: "Daily Leads — 2026-08-18",
  listId: "l1",
  campaignName: "Grok 2.0 Brokers — 2026-08-18",
  campaignId: "c1",
  contactsAdded: 40,
  emailsEnriched: 12,
  firmPeopleAdded: 5,
  enrolled: 30,
  skippedDuplicate: 6,
  skippedUndeliverable: 2,
  skippedNoEmail: 2,
};
const base = "https://www.newdawnfranchising.com";

const manual = buildPlanExecutedSms({
  base, why: "Korean brokers", sourcesSearched: 20, profilesFound: 200, leadsAdded: 90, campaign,
});
assert("manual header unchanged", manual.startsWith("✅ Today's lead plan executed!"));
assert("manual has no autopilot footer", !manual.includes("Autopilot"));
assert("manual has no provider-issues line", !manual.includes("Provider issues"));

const auto = buildPlanExecutedSms({
  base, why: "Korean brokers", sourcesSearched: 20, profilesFound: 200, leadsAdded: 90, campaign,
  autopilot: true,
  pauseUrl: `${base}/approve/outreach-plan/tok123`,
  providerIssues: ["SerpAPI HTTP 429", "Seamless: insufficient credits"],
});
assert("autopilot header", auto.startsWith("🤖 Autopilot: today's lead plan executed!"));
assert("autopilot no-action framing", auto.includes("no action needed"));
assert("pause link included", auto.includes("/approve/outreach-plan/tok123"));
assert("provider issues surfaced", auto.includes("SerpAPI HTTP 429") && auto.includes("Seamless: insufficient credits"));
assert("campaign line still present", auto.includes(`Campaign "Grok 2.0 Brokers — 2026-08-18" is LIVE`));
assert("skips still explained", auto.includes("6 already contacted"));

const zeroEnrolled = buildPlanExecutedSms({
  base, sourcesSearched: 5, profilesFound: 10, leadsAdded: 10,
  campaign: { ...campaign, enrolled: 0 },
  autopilot: true,
});
assert("0 enrolled still loudly flagged", zeroEnrolled.includes("⚠️ 0 enrolled"));
assert("no pause line without pauseUrl", !zeroEnrolled.includes("Pause it any time"));

const noCampaign = buildPlanExecutedSms({
  base, sourcesSearched: 5, profilesFound: 0, leadsAdded: 0, campaign: null,
  providerIssues: ["Apollo: unauthorized"],
});
assert("provider issues shown even without a campaign", noCampaign.includes("Apollo: unauthorized"));

// ─── Result ───────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll outreach-autopilot assertions passed.");
