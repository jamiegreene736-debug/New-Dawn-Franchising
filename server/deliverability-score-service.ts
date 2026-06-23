import { pool } from "./db";
import { getDomainAuth, getDeliverabilityMetrics, SENDING_DOMAIN } from "./deliverability-service";
import { getBlacklistReport } from "./blacklist-service";

// ─────────────────────────────────────────────────────────────────────────────
// Composite deliverability health score (Phase 3)
//
// One 0–100 number that rolls up every signal we collect — domain auth,
// blacklist status, bounce rate, inbox placement (seed test), warmup health, and
// Postmaster spam rate — into a single grade with the top factors dragging it
// down. Weights are renormalised over whichever factors have data, so a missing
// signal (e.g. no seed test yet) doesn't crater the score.
// ─────────────────────────────────────────────────────────────────────────────

interface Factor { key: string; label: string; score: number; weight: number; detail: string }

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function getDeliverabilityScore() {
  const factors: Factor[] = [];

  // Run the live/DB sources in parallel; each is best-effort.
  const [auth, metrics, blacklist] = await Promise.all([
    getDomainAuth(SENDING_DOMAIN).catch(() => null),
    getDeliverabilityMetrics().catch(() => null),
    getBlacklistReport(SENDING_DOMAIN).catch(() => null),
  ]);

  if (auth) {
    factors.push({ key: "auth", label: "Domain authentication (SPF/DKIM/DMARC)", score: auth.score, weight: 30, detail: `${auth.score}/100 from live DNS checks.` });
  }

  if (blacklist) {
    const listed = blacklist.listedCount;
    const score = listed === 0 ? 100 : clamp(100 - listed * 30);
    factors.push({ key: "blacklist", label: "Blacklist status", score, weight: 15, detail: listed === 0 ? "Not listed on any monitored blocklist." : `Listed on ${listed} blocklist(s).` });
  }

  if (metrics) {
    const rate = metrics.volume.last30d.bounceRate;
    // <=2% is healthy; degrade ~8 pts per point above 2%.
    const score = clamp(100 - Math.max(0, rate - 2) * 8);
    factors.push({ key: "bounce", label: "Bounce rate (30d)", score, weight: 20, detail: `${rate}% bounce over ${metrics.volume.last30d.attempted} sends (target <2%).` });
  }

  // Inbox placement — latest completed seed test.
  try {
    const { rows } = await pool.query(`SELECT sent, inbox FROM seed_tests WHERE status='complete' AND sent > 0 ORDER BY completed_at DESC LIMIT 1`);
    if (rows.length) {
      const inboxRate = Math.round((rows[0].inbox / rows[0].sent) * 100);
      factors.push({ key: "placement", label: "Inbox placement (seed test)", score: inboxRate, weight: 20, detail: `${inboxRate}% of seeds landed in the inbox.` });
    }
  } catch {}

  // Warmup health — average of latest per-mailbox scores.
  try {
    const { rows } = await pool.query(
      `SELECT avg(score)::numeric AS avg FROM warmup_health WHERE day > CURRENT_DATE - 7 AND score IS NOT NULL`,
    );
    const avg = rows[0]?.avg;
    if (avg != null) factors.push({ key: "warmup", label: "Warmup health", score: clamp(Number(avg)), weight: 10, detail: `${Math.round(Number(avg))}% warmup inbox placement (7d).` });
  } catch {}

  // Postmaster — most recent spam rate (lower is better; >0.1% degrades).
  try {
    const { rows } = await pool.query(
      `SELECT spam_rate, domain_reputation FROM postmaster_stats WHERE spam_rate IS NOT NULL ORDER BY day DESC LIMIT 1`,
    );
    if (rows.length) {
      const spamPct = Number(rows[0].spam_rate) * 100;
      const repBonus: Record<string, number> = { HIGH: 100, MEDIUM: 80, LOW: 50, BAD: 10 };
      const repScore = repBonus[rows[0].domain_reputation] ?? null;
      const spamScore = clamp(100 - Math.max(0, spamPct - 0.1) * 200);
      const score = repScore == null ? spamScore : Math.round((spamScore + repScore) / 2);
      factors.push({ key: "postmaster", label: "Gmail Postmaster", score, weight: 10, detail: `spam ${spamPct.toFixed(2)}%${rows[0].domain_reputation ? `, reputation ${rows[0].domain_reputation}` : ""}.` });
    }
  } catch {}

  // Weighted average over present factors (renormalised).
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const overall = clamp(factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight);
  const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 65 ? "C" : overall >= 50 ? "D" : "F";

  // Top issues = factors hurting the weighted score the most.
  const topIssues = [...factors]
    .filter((f) => f.score < 90)
    .sort((a, b) => (100 - a.score) * a.weight - (100 - b.score) * b.weight)
    .reverse()
    .slice(0, 3)
    .map((f) => ({ label: f.label, score: f.score, detail: f.detail }));

  return { generatedAt: new Date().toISOString(), overall, grade, factors, topIssues };
}
