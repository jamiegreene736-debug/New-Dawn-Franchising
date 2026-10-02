import { pool } from "./db";
import { getDomainAuth, SENDING_DOMAIN } from "./deliverability-service";
import { getPostmasterConfig } from "./postmaster-service";
import { assessCampaignSpamRisk, type RiskStep, type RiskEvidence } from "./campaign-spam-risk";

export async function getCampaignSpamRisk(steps: RiskStep[]) {
  const evidence: RiskEvidence = { auth: null, postmasterConfigured: getPostmasterConfig().configured, postmaster: null, seed: null, errors: [] };
  const results = await Promise.allSettled([
    getDomainAuth(SENDING_DOMAIN),
    pool.query<{ day: string; spam_rate: string | null; domain_reputation: string | null }>(
      "SELECT day::text, spam_rate, domain_reputation FROM postmaster_stats WHERE domain=$1 ORDER BY day DESC LIMIT 1", [SENDING_DOMAIN]),
    pool.query<{ id: string; at: string; status: string; sent: number; inbox: number; spam: number; unresolved: number }>(
      `SELECT t.id, t.started_at::text AS at, t.status, t.sent,
        count(r.id) FILTER (WHERE r.placement='inbox')::int AS inbox,
        count(r.id) FILTER (WHERE r.placement='spam')::int AS spam,
        GREATEST(t.total - count(r.id) FILTER (WHERE r.placement IN ('inbox','spam')), 0)::int AS unresolved
       FROM (SELECT * FROM seed_tests st ORDER BY EXISTS (SELECT 1 FROM seed_test_results sr WHERE sr.test_id=st.id AND sr.placement IN ('inbox','spam')) DESC, started_at DESC LIMIT 1) t
       LEFT JOIN seed_test_results r ON r.test_id=t.id GROUP BY t.id,t.started_at,t.status,t.sent,t.total`),
  ]);
  const [auth, postmaster, seed] = results;
  if (auth.status === "fulfilled") evidence.auth = auth.value;
  if (postmaster.status === "fulfilled" && postmaster.value.rows[0]) {
    const row = postmaster.value.rows[0];
    const rate = row.spam_rate == null ? null : Number(row.spam_rate);
    evidence.postmaster = { day: row.day, spamRate: rate !== null && Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : null, reputation: row.domain_reputation };
  }
  if (seed.status === "fulfilled" && seed.value.rows[0]) {
    const row = seed.value.rows[0];
    evidence.seed = { id: row.id, at: new Date(row.at).toISOString(), status: row.status, accepted: row.sent, inbox: row.inbox, spam: row.spam, unresolved: row.unresolved };
  }
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const source = ["Domain checks", "Postmaster data", "Seed results"][index];
      console.error(`[Campaign spam risk] ${source} unavailable`);
      evidence.errors.push(`${source} could not be loaded. Retry before making a sending decision.`);
    }
  });
  return assessCampaignSpamRisk(steps, evidence, SENDING_DOMAIN);
}
