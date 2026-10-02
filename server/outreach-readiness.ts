import { pool } from "./db";

export const OUTREACH_REVIEW_DAYS = 30;
export const OUTREACH_MAX_EMAILS = 3;
export const OUTREACH_SEQUENCE_DAYS = 45;
export interface Qualification {
  status: string;
  audience: string;
  source_url: string;
  reason: string;
  role: string;
  firm_domain: string;
  reviewed_at: Date | string;
}
export function qualificationIssue(q: Qualification | undefined, audience: string, now = new Date()): string | null {
  if (!q || q.status !== "approved") return "Recipient fit needs review with a current source and relevant role.";
  const reviewed = new Date(q.reviewed_at).getTime();
  if (!Number.isFinite(reviewed) || reviewed > now.getTime() || now.getTime() - reviewed > OUTREACH_REVIEW_DAYS * 86400_000)
    return "Recipient qualification is older than 30 days; verify employment and fit again.";
  if (q.audience !== audience) return "Qualification does not match this campaign's audience.";
  if (!/^https:\/\//i.test(q.source_url) || q.reason.trim().length < 30 || !q.role.trim() || !q.firm_domain.trim())
    return "Qualification needs a source, relevant role, firm and specific reason.";
  return null;
}
export function sequenceLimits(policy = "cold") {
  return policy === "broker_nurture_10"
    ? { days: 120, emails: 10 }
    : policy === "template_drip" ? { days: 45, emails: 4 }
    : { days: OUTREACH_SEQUENCE_DAYS, emails: OUTREACH_MAX_EMAILS };
}

/** A pilot baseline in Central time, not an inferred recipient timezone. */
export function campaignWindowIssue(policy: string, now = new Date()): string | null {
  if (policy !== "broker_nurture_10") return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const day = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value);
  return day !== "Sat" && day !== "Sun" && hour >= 9 && hour < 12
    ? null : "Broker nurture sends weekdays, 9 AM–noon Central; deferred until that window.";
}

export function sequenceIssue(enrolledAt: Date | string, emailCount: number, now = new Date(), policy = "cold"): string | null {
  const limits = sequenceLimits(policy);
  const age = now.getTime() - new Date(enrolledAt).getTime();
  if (!Number.isFinite(age) || age < 0) return "Enrollment date needs review.";
  if (age > limits.days * 86400_000)
    return `This sequence is over ${limits.days} days old; review it instead of releasing its backlog.`;
  if (emailCount >= limits.emails) return `${limits.emails} outreach emails already sent in ${limits.days} days; further follow-ups are held.`;
  return null;
}
export async function getOutreachReadiness(email: string, audience: string, enrolledAt: Date | string, policy = "cold"): Promise<string | null> {
  const key = email.trim().toLowerCase();
  const { rows } = await pool.query<Qualification>("SELECT * FROM outreach_qualifications WHERE email=$1", [key]);
  const q = rows[0];
  const issue = qualificationIssue(q, audience);
  if (issue) return issue;
  const history = await pool.query<{ count: number; colleague: boolean; meeting: boolean }>(`SELECT
    EXISTS(SELECT 1 FROM meetings WHERE lower(trim(invitee_email))=$1 AND status IN ('confirmed','completed')) AS meeting,
    (SELECT count(*)::int FROM drip_sends WHERE lower(trim(recipient_email))=$1 AND channel='email' AND sent_at>now()-($3::int * interval '1 day')) AS count,
    EXISTS(SELECT 1 FROM drip_sends s LEFT JOIN outreach_qualifications q ON q.email=lower(trim(s.recipient_email))
      WHERE s.channel='email' AND s.sent_at>now()-interval '7 days' AND lower(trim(s.recipient_email))<>$1
      AND (q.firm_domain=$2 OR split_part(lower(trim(s.recipient_email)),'@',2)=$2)) AS colleague`, [key, q.firm_domain, sequenceLimits(policy).days]);
  if (history.rows[0].meeting) return "A confirmed or completed meeting already exists; cold follow-ups are held.";
  const stale = sequenceIssue(enrolledAt, history.rows[0].count, new Date(), policy);
  if (stale) return stale;
  if (history.rows[0].colleague) return "Another person at this firm received outreach in the last seven days.";
  return null;
}
