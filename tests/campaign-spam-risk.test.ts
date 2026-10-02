import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { promises as dns } from "node:dns";
import { pool } from "../server/db";
import { getCampaignSpamRisk } from "../server/campaign-spam-risk-service";
import { assessCampaignSpamRisk, type RiskEvidence, type RiskStep } from "../server/campaign-spam-risk";
import { analyzeEmail } from "../server/spam-test-service";
import brokerCampaign from "../shared/broker-escrow-campaign.json";

const now = new Date("2026-10-02T01:00:00Z");
const domain = "newdawnfranchising.com";
const clean: RiskStep = { id: "step", stepOrder: 0, subject: "A review guide for franchise referrals", bodyHtml: "<p>Hi {{firstName}},</p><p>I put together a short guide covering owner responsibilities and documents to review before a referral.</p><p>Would that guide be useful?</p>" };
const empty: RiskEvidence = { auth: null, seed: null, postmaster: null, postmasterConfigured: false, errors: [] };
const healthy: RiskEvidence = {
  ...empty,
  auth: { domain, checkedAt: now.toISOString(), score: 100, checks: [
    { key: "spf", label: "SPF", status: "pass", summary: "Authorized" },
    { key: "dkim", label: "DKIM", status: "pass", summary: "Published" },
    { key: "dmarc", label: "DMARC", status: "warn", summary: "Monitor only", value: "v=DMARC1; p=none" },
  ] },
};
const assess = (evidence = healthy, steps = [clean]) => assessCampaignSpamRisk(steps, evidence, domain, now);

test("missing evidence never becomes a green inbox prediction", () => {
  const report = assess(empty);
  assert.equal(report.level, "unknown");
  assert.equal(report.postmaster.spamRate, null);
  assert.equal(report.seed, null);
  assert.match(report.reasons.join(" "), /not a zero spam rate/);
});
test("clean authenticated copy cannot override an observed spam result", () => {
  const report = assess({ ...healthy, seed: { id: "seed", at: now.toISOString(), status: "complete", accepted: 1, inbox: 0, spam: 1, unresolved: 0 } });
  assert.equal(report.steps[0].level, "lower");
  assert.equal(report.level, "high");
  assert.match(report.label, /hold sending/);
});
test("SMTP acceptance, missing placements and API errors stay unverified", () => {
  const report = assess({ ...healthy, seed: { id: "seed", at: now.toISOString(), status: "needs_mailbox_access", accepted: 1, inbox: 0, spam: 0, unresolved: 1 }, errors: ["Seed results could not be loaded."] });
  assert.equal(report.level, "unknown");
  assert.match(report.reasons.join(" "), /provider acceptance does not establish inbox placement/);
  assert.match(report.reasons.join(" "), /could not be loaded/);
});
test("stale spam is retained and stale or future Postmaster data is not current clearance", () => {
  for (const day of ["2026-08-30", "2027-01-01", "invalid"]) {
    const report = assess({ ...healthy, postmaster: { day, spamRate: 0, reputation: "HIGH" }, postmasterConfigured: true });
    assert.equal(report.level, "unknown");
    assert.equal(report.postmaster.fresh, false);
  }
  assert.equal(assess({ ...healthy, seed: { id: "seed", at: "2026-08-30", status: "complete", accepted: 1, inbox: 0, spam: 1, unresolved: 0 } }).level, "high");
});
test("Google complaint thresholds use ratios, including low reputation without a spam rate", () => {
  for (const [rate, level] of [[0, "unknown"], [0.0009, "unknown"], [0.001, "review"], [0.003, "high"]] as const) {
    assert.equal(assess({ ...healthy, postmasterConfigured: true, postmaster: { day: "2026-10-01", spamRate: rate, reputation: "HIGH" } }).level, level);
  }
  assert.equal(assess({ ...healthy, postmaster: { day: "2026-10-01", spamRate: null, reputation: "BAD" } }).level, "high");
});
test("a good workspace seed does not certify different campaign content", () => {
  assert.equal(assess({ ...healthy, postmasterConfigured: true, postmaster: { day: "2026-10-01", spamRate: 0, reputation: "HIGH" }, seed: { id: "seed", at: now.toISOString(), status: "complete", accepted: 1, inbox: 1, spam: 0, unresolved: 0 } }).level, "unknown");
});
test("DNS failure holds while a valid monitor-only DMARC policy is not a spam failure", () => {
  assert.equal(assess().level, "unknown");
  assert.equal(assess({ ...healthy, auth: { ...healthy.auth!, checks: [{ key: "spf", label: "SPF", status: "fail", summary: "Duplicate SPF" }] } }).level, "high");
  const report = analyzeEmail(clean.subject!, clean.bodyHtml!, { spf: "pass", dkim: "pass", dmarc: "warn" });
  assert.equal(report.findings.find(f => f.id === "auth.dmarc_warn")?.points, 0);
  assert.doesNotMatch(report.placementReason, /likely|filtered to spam|filtering threshold/);
});
test("supported personalization is accepted; unknown fields and own-team greetings need review", () => {
  assert.doesNotMatch(assess().steps[0].findings.join(" "), /unsupported placeholder/);
  assert.match(assess(healthy, [{ ...clean, bodyHtml: "Hi {{first_name}}, Hi New Dawn Development Team" }]).steps[0].findings.join(" "), /unsupported placeholder.*own team/);
});
test("saved preview text and misleading first-touch subjects are checked", () => {
  const report = assess(healthy, [{ ...clean, previewText: "Act now! Free money", subject: "Re: Urgent!!!" }]);
  assert.equal(report.level, "review");
  assert.match(report.steps[0].findings.join(" "), /Re:\/Fwd:/);
  assert.match(report.steps[0].findings.join(" "), /Preview text/);
});
test("non-email steps are excluded and oversized content fails visibly", () => {
  assert.equal(assess(healthy, [{ ...clean, stepType: "sms" }]).steps.length, 0);
  assert.match(assess(healthy, [{ ...clean, bodyHtml: "a".repeat(200_001) }]).steps[0].findings[0], /exceeds the check limit/);
});
test("all ten broker emails are assessed without inventing a risk-free phrase or unknown merge tag", () => {
  const report = assess(healthy, brokerCampaign.steps.map((step, i) => ({ ...step, id: `broker-${i}` })));
  assert.equal(report.steps.length, 10);
  assert.doesNotMatch(report.steps.flatMap(s => s.findings).join(" "), /unsupported placeholder/);
  assert.equal(report.level === "high", false);
});

test("service scopes Postmaster to the sending domain, retains observed placement and exposes failed reads", async () => {
  const txt = mock.method(dns, "resolveTxt", async (name: string) => name === domain ? [["v=spf1 include:_spf.google.com ~all"]] : name.startsWith("_dmarc.") ? [["v=DMARC1; p=none; rua=mailto:dmarc@example.com"]] : []);
  const mx = mock.method(dns, "resolveMx", async () => [{ exchange: "aspmx.l.google.com", priority: 10 }]);
  let fail = false;
  const query = mock.method(pool, "query", async (sql: string, values?: unknown[]) => {
    if (fail) throw new Error("database unavailable");
    if (sql.includes("postmaster_stats")) {
      assert.deepEqual(values, [domain]);
      assert.match(sql, /WHERE domain=\$1/);
      return { rows: [{ day: "2026-10-01", spam_rate: "NaN", domain_reputation: null }] };
    }
    // Pending new tests must not hide the previous observed Spam result.
    assert.match(sql, /ORDER BY EXISTS/);
    return { rows: [{ id: "seed", at: now.toISOString(), status: "complete", sent: 1, inbox: 0, spam: 1, unresolved: 0 }] };
  });
  try {
    const result = await getCampaignSpamRisk([clean]);
    assert.equal(result.postmaster.spamRate, null);
    assert.equal(result.seed?.spam, 1);
    assert.equal(result.level, "high");
    fail = true;
    const unavailable = await getCampaignSpamRisk([clean]);
    assert.equal(unavailable.postmaster.spamRate, null);
    assert.equal(unavailable.seed, null);
    assert.match(unavailable.reasons.join(" "), /Postmaster data could not be loaded.*Seed results could not be loaded/);
  } finally { query.mock.restore(); txt.mock.restore(); mx.mock.restore(); }
});
