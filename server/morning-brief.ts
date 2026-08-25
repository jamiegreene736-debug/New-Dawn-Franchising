/**
 * Yesterday's outreach snapshot for the 8AM ET morning text.
 *
 * Opens use opened_at (so an email sent Monday that opened Tuesday counts
 * on Tuesday). Sends use sent_at. SMS has no open tracking — we report
 * texts sent, not "opened."
 */

import { pool } from "./db";

export interface YesterdayBrief {
  emailsSent: number;
  emailsOpened: number;
  peopleOpened: number;
  textsSent: number;
  campaigns: number;
  replies: number;
}

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Pure formatter — used by the SMS and by unit tests. */
export function formatYesterdayBrief(s: YesterdayBrief): string {
  if (
    s.emailsSent === 0 &&
    s.emailsOpened === 0 &&
    s.textsSent === 0 &&
    s.replies === 0
  ) {
    return "Yesterday: no emails or texts went out.";
  }

  const parts: string[] = [];
  let head = `Yesterday ${plural(s.emailsOpened, "email", "emails")} opened`;
  if (s.campaigns > 0) head += ` across ${plural(s.campaigns, "campaign", "campaigns")}`;
  if (s.peopleOpened > 0) head += ` — ${plural(s.peopleOpened, "person", "people")}`;
  parts.push(`${head}.`);
  parts.push(`${plural(s.textsSent, "text", "texts")} sent.`);
  if (s.emailsSent > 0) parts.push(`${plural(s.emailsSent, "email", "emails")} sent.`);
  if (s.replies > 0) parts.push(`${plural(s.replies, "reply", "replies")}.`);
  return parts.join(" ");
}

export async function getYesterdayBrief(): Promise<YesterdayBrief | null> {
  try {
    const { rows } = await pool.query(
      `WITH y AS (SELECT (timezone('America/New_York', now())::date - 1) AS d)
       SELECT
         count(*) FILTER (
           WHERE s.channel = 'email'
             AND timezone('America/New_York', coalesce(s.sent_at, s.created_at))::date = y.d
             AND s.status IN ('sent','delivered','opened','clicked','replied','bounced','failed')
         )::int AS emails_sent,
         count(*) FILTER (
           WHERE s.channel = 'email'
             AND s.opened_at IS NOT NULL
             AND timezone('America/New_York', s.opened_at)::date = y.d
         )::int AS emails_opened,
         count(DISTINCT lower(s.recipient_email)) FILTER (
           WHERE s.channel = 'email'
             AND s.opened_at IS NOT NULL
             AND timezone('America/New_York', s.opened_at)::date = y.d
         )::int AS people_opened,
         count(*) FILTER (
           WHERE s.channel = 'sms'
             AND timezone('America/New_York', coalesce(s.sent_at, s.created_at))::date = y.d
             AND s.status IN ('sent','delivered','opened','clicked','replied')
         )::int AS texts_sent,
         count(DISTINCT e.campaign_id) FILTER (
           WHERE e.campaign_id IS NOT NULL AND (
             (s.channel = 'email' AND s.opened_at IS NOT NULL
               AND timezone('America/New_York', s.opened_at)::date = y.d)
             OR (
               timezone('America/New_York', coalesce(s.sent_at, s.created_at))::date = y.d
               AND s.channel IN ('email','sms')
               AND s.status IN ('sent','delivered','opened','clicked','replied','bounced','failed')
             )
           )
         )::int AS campaigns,
         count(*) FILTER (
           WHERE s.channel = 'email'
             AND s.status = 'replied'
             AND timezone('America/New_York', coalesce(s.sent_at, s.created_at))::date = y.d
         )::int AS replies
       FROM drip_sends s
       CROSS JOIN y
       LEFT JOIN drip_enrollments e ON e.id = s.enrollment_id`,
    );
    const r = rows[0] ?? {};
    return {
      emailsSent: n(r.emails_sent),
      emailsOpened: n(r.emails_opened),
      peopleOpened: n(r.people_opened),
      textsSent: n(r.texts_sent),
      campaigns: n(r.campaigns),
      replies: n(r.replies),
    };
  } catch (e) {
    console.warn("[MorningBrief] Yesterday snapshot failed:", (e as Error).message);
    return null;
  }
}
