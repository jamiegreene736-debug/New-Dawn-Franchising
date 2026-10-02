import type { CampaignSpamRisk } from "../shared/campaign-spam-risk";
import type { DomainAuthReport } from "./deliverability-service";
import { analyzeEmail } from "./spam-test-service";

export interface RiskStep {
  id: string; stepOrder: number; stepType?: string | null;
  subject: string | null; bodyHtml: string | null; previewText?: string | null;
}
export interface RiskEvidence {
  auth: DomainAuthReport | null;
  postmasterConfigured: boolean;
  postmaster: { day: string; spamRate: number | null; reputation: string | null } | null;
  seed: Omit<NonNullable<CampaignSpamRisk["seed"]>, "fresh"> | null;
  errors: string[];
}

function fresh(at: string, now: Date, days: number): boolean {
  const age = now.getTime() - new Date(at).getTime();
  return Number.isFinite(age) && age >= 0 && age <= days * 86400_000;
}

export function assessCampaignSpamRisk(steps: RiskStep[], evidence: RiskEvidence, domain: string, now = new Date()): CampaignSpamRisk {
  const reasons: string[] = [];
  const checks = evidence.auth?.checks.filter(c => ["spf", "dkim", "dmarc", "mx"].includes(c.key)) ?? [];
  const seed = evidence.seed ? { ...evidence.seed, fresh: fresh(evidence.seed.at, now, 7) } : null;
  const pm = evidence.postmaster;
  const postmaster = { configured: evidence.postmasterConfigured, day: pm?.day ?? null, spamRate: pm?.spamRate ?? null, reputation: pm?.reputation ?? null, fresh: !!pm && fresh(pm.day, now, 7) };
  // Raw templates exclude the signature/footer injected by the sending pipeline.
  // Assess wording separately from authentication so a DNS bonus cannot hide a content issue.
  const assessed = steps.filter(s => !s.stepType || s.stepType === "email").map(s => {
    if ((s.bodyHtml?.length ?? 0) > 200_000 || (s.subject?.length ?? 0) > 2_000 || (s.previewText?.length ?? 0) > 2_000) return { id: s.id, order: s.stepOrder, subject: (s.subject || "(no subject)").slice(0, 200), level: "review" as const, words: 0, findings: ["Email content exceeds the check limit; shorten it before reviewing or sending."] };
    const report = analyzeEmail(s.subject || "", s.bodyHtml || "", { spf: "info", dkim: "info", dmarc: "info" });
    const findings = report.findings.filter(f => f.points > 0 && f.category !== "Authentication" && f.category !== "Compliance").map(f => f.message);
    const preview = s.previewText?.trim();
    if (preview) {
      const previewReport = analyzeEmail("", `<p>${preview.replace(/[<>&]/g, " ")}</p>`, { spf: "info", dkim: "info", dmarc: "info" });
      findings.push(...previewReport.findings.filter(f => f.points > 0 && f.category === "Content").map(f => `Preview text: ${f.message}`));
    }
    if (/\{\{(?!\s*(?:firstName|name|email|firmHook)\s*\}\})[^}]+\}\}/i.test(`${s.subject} ${s.bodyHtml} ${preview || ""}`)) findings.push("Check merge fields: an unsupported placeholder may reach the recipient.");
    if (/\b(?:Hi|Hello|Dear)\s+New Dawn(?:\s+Development)?\s+Team\b/i.test(s.bodyHtml || "")) findings.push("Greeting addresses your own team; correct recipient personalization.");
    if (/GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL/.test(s.bodyHtml || "")) findings.push("Contains a spam-filter test string; remove it before outreach.");
    return { id: s.id, order: s.stepOrder, subject: s.subject || "(no subject)", level: findings.length ? "review" as const : "lower" as const, words: report.stats.wordCount, findings };
  });
  if (checks.some(c => c.status === "fail")) reasons.push("A domain DNS check failed. Resolve it before sending.");
  if (seed?.spam) reasons.push(`The latest observed workspace seed test found ${seed.spam} message(s) in Spam${seed.fresh ? "" : " (older than seven days)"}. A clean content check does not override that result.`);
  const highSpam = postmaster.fresh && postmaster.spamRate !== null && postmaster.spamRate >= 0.003;
  const poorReputation = postmaster.fresh && ["LOW", "BAD"].includes(postmaster.reputation || "");
  if (highSpam) reasons.push("Google's recent user-reported spam rate is at least 0.30%.");
  if (poorReputation) reasons.push("Google reports a low or bad domain reputation.");
  const high = reasons.length > 0;
  if (postmaster.fresh && postmaster.spamRate !== null && postmaster.spamRate >= 0.001 && !highSpam) reasons.push("Google's recent user-reported spam rate is at least 0.10%; review recipient expectations and sending practices.");
  if (assessed.some(s => s.findings.length)) reasons.push("Review the flagged email wording, formatting, or links below.");
  const review = reasons.length > 0;
  if (!evidence.auth) reasons.push("Live DNS checks are unavailable.");
  if (!postmaster.configured) reasons.push("Postmaster is not connected to this app. Website verification and the app's API connection are separate.");
  if (!postmaster.day) reasons.push("No Postmaster traffic data is available in the app; this is not a zero spam rate.");
  else if (!postmaster.fresh) reasons.push("Postmaster data is older than seven days or has an invalid date.");
  if (!seed) reasons.push("No workspace seed placement test is available.");
  else if (seed.unresolved || !seed.fresh) reasons.push("Seed evidence is incomplete or stale; provider acceptance does not establish inbox placement.");
  if (!assessed.length) reasons.push("This campaign has no email steps to assess.");
  reasons.push(...evidence.errors);
  return {
    checkedAt: now.toISOString(), domain, level: high ? "high" : review ? "review" : "unknown",
    label: high ? "High risk — hold sending" : review ? "Review before sending" : "Inbox placement unverified",
    reasons, domainChecks: checks.map(c => ({ label: c.label, status: c.status, summary: c.summary })), postmaster, seed, steps: assessed,
    limitations: [
      "This is a risk checklist, not Google's spam score or a probability of inbox delivery. Google does not disclose an exact subject/body score.",
      "Seed results cover the tested workspace message and receiving mailboxes, not every step or recipient in this campaign. Changed content needs a new controlled test.",
      "Checks use saved subjects, bodies and preview text. Recipient-specific rendering, final headers and the automatic signature/unsubscribe footer require a received-message test.",
      "Recipient consent and expectations, complaints, sending volume, sender/IP reputation and linked-site reputation also affect filtering. Promotions is an inbox category, not Spam.",
    ],
  };
}
