import type { PoolClient } from "pg";
import { pool } from "../db";
import type {
  CampaignPerson,
  DeskDetail,
  DeskPerson,
  DeskQuery,
} from "@shared/outreach-desk";
import { deskChannels } from "@shared/outreach-desk";
import {
  briefFor,
  channelEligibility,
  DeskError,
  safeLinkedin,
} from "./policy";
import { CALENDLY } from "@shared/campaign-tracks";

type QueryClient = Pick<PoolClient, "query">;
export const iso = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null;
export type PersonRow = Omit<
  DeskPerson,
  "eligibility" | "timezoneConfirmed"
> & {
  suppressed: boolean;
  booked: boolean;
  whatsappInboundAt: string | null;
  emailStatus: string | null;
  emailVerifiedAt: string | null;
};
export const PERSON_SQL = `SELECT q.id, q.name, q.email, q.phone, q.company, q.track, q.status,
 q.trigger_type AS "triggerType", q.trigger_at AS "triggerAt", q.email_subject AS "emailSubject",
 q.attempt_count AS "attemptCount", q.next_attempt_at AS "nextAttemptAt", q.outcome_notes AS "outcomeNotes",
 q.updated_at AS "updatedAt", p.timezone, COALESCE(p.permissions,'{}') AS permissions,
 COALESCE(p.linkedin_url,c.linkedin_url,t.linkedin_url) AS "linkedinUrl",
 p.claimed_by AS "claimedBy", p.claim_until AS "claimUntil",
 COALESCE(v.email_status,c.email_status,t.email_status,r.email_status) AS "emailStatus",
 COALESCE(v.checked_at,c.email_verified_at,t.email_verified_at,r.email_verified_at) AS "emailVerifiedAt",
 EXISTS(SELECT 1 FROM agent_dnc d WHERE
   (q.email IS NOT NULL AND lower(trim(d.email))=lower(trim(q.email))) OR
   (q.phone IS NOT NULL AND regexp_replace(d.phone,'[^0-9]','','g')=regexp_replace(q.phone,'[^0-9]','','g')) OR
   (q.email IS NOT NULL AND lower(d.domain)=split_part(lower(q.email),'@',2))) AS suppressed,
 EXISTS(SELECT 1 FROM meetings m WHERE lower(trim(m.invitee_email))=lower(trim(q.email))
   AND m.status IN ('confirmed','completed')) AS booked,
 (SELECT max(a.created_at) FROM crm_client_activities a WHERE a.client_id=q.crm_client_id
   AND a.activity_type='whatsapp_received') AS "whatsappInboundAt"
 FROM call_queue q LEFT JOIN outreach_desk_profiles p ON p.queue_id=q.id
 LEFT JOIN crm_clients c ON c.id=q.crm_client_id LEFT JOIN contacts t ON t.id=q.contact_id
 LEFT JOIN prospects r ON r.id=q.prospect_id
 LEFT JOIN outreach_desk_email_evidence v ON v.email=lower(trim(q.email))`;
export function serializePerson(row: PersonRow): DeskPerson {
  const person = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    track: row.track,
    status: row.status,
    triggerType: row.triggerType,
    triggerAt: iso(row.triggerAt)!,
    emailSubject: row.emailSubject,
    attemptCount: row.attemptCount,
    nextAttemptAt: iso(row.nextAttemptAt),
    outcomeNotes: row.outcomeNotes,
    updatedAt: iso(row.updatedAt)!,
    timezone: row.timezone,
    timezoneConfirmed: !!row.timezone,
    linkedinUrl: safeLinkedin(row.linkedinUrl),
    permissions: row.permissions,
    claimedBy: row.claimedBy,
    claimUntil: iso(row.claimUntil),
  };
  const context = {
    ...row,
    ...person,
    whatsappInboundAt: iso(row.whatsappInboundAt),
  };
  const eligibility = Object.fromEntries(
    deskChannels.map((channel) => [
      channel,
      channelEligibility(context, channel),
    ]),
  ) as DeskPerson["eligibility"];
  return { ...person, eligibility };
}
export async function personRow(
  id: string,
  client: QueryClient = pool,
): Promise<PersonRow> {
  const result = await client.query<PersonRow>(`${PERSON_SQL} WHERE q.id=$1`, [
    id,
  ]);
  if (!result.rows[0])
    throw new DeskError(404, "Contact is no longer in the queue.");
  return result.rows[0];
}
const QUEUE_RANK = `CASE WHEN q.status='callback' THEN 0 WHEN q.trigger_type='reply_no_meeting' THEN 1
 WHEN q.trigger_type='link_click' THEN 2 ELSE 3 END`;
export async function listPeople(filters: DeskQuery) {
  let cursor: { rank: number; id: string } | undefined;
  if (filters.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(filters.cursor, "base64url").toString());
      if (
        !cursor ||
        !Number.isInteger(cursor.rank) ||
        typeof cursor.id !== "string"
      )
        throw new Error();
    } catch {
      throw new DeskError(400, "Invalid queue cursor.");
    }
  }
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const conditions = [
    filters.view === "history"
      ? `q.status NOT IN ('queued','calling','callback','no_answer','voicemail','needs_phone')`
      : `q.status IN ('queued','calling','callback','no_answer','voicemail','needs_phone')`,
  ];
  if (["today", "callbacks", "replies", "opens"].includes(filters.view))
    conditions.push(
      `(q.next_attempt_at IS NULL OR q.next_attempt_at <= now())`,
    );
  if (filters.view === "callbacks") conditions.push(`q.status='callback'`);
  if (filters.view === "replies")
    conditions.push(`q.trigger_type='reply_no_meeting'`);
  if (filters.view === "opens")
    conditions.push(`q.trigger_type='engaged_open'`);
  if (filters.view === "research")
    conditions.push(
      `(q.phone IS NULL OR p.timezone IS NULL OR p.permissions='{}'::jsonb)`,
    );
  if (filters.q) {
    const q = bind(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
    conditions.push(
      `concat_ws(' ',q.name,q.email,q.phone,q.company,q.email_subject) ILIKE ${q}`,
    );
  }
  if (cursor)
    conditions.push(
      `(${QUEUE_RANK},q.id)>(${bind(cursor.rank)},${bind(cursor.id)})`,
    );
  const limit = bind(filters.limit + 1);
  const rows = (
    await pool.query<PersonRow & { rank: number }>(
      `${PERSON_SQL.replace("SELECT q.id", `SELECT ${QUEUE_RANK} AS rank, q.id`)}
    WHERE ${conditions.join(" AND ")} ORDER BY ${QUEUE_RANK},q.id LIMIT ${limit}`,
      values,
    )
  ).rows;
  const page = rows.slice(0, filters.limit);
  const last = page.at(-1);
  return {
    items: page.map(serializePerson),
    nextCursor:
      rows.length > filters.limit && last
        ? Buffer.from(
            JSON.stringify({ rank: last.rank, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export async function detail(id: string): Promise<DeskDetail> {
  const row = await personRow(id);
  const timeline = await pool.query<{
    id: string;
    kind: string;
    detail: string;
    occurredAt: string;
  }>(
    `
    SELECT * FROM (
      SELECT id::text,kind,detail,occurred_at AS "occurredAt" FROM outreach_desk_events WHERE queue_id=$1
      UNION ALL SELECT s.id, 'campaign_email', s.subject, COALESCE(s.sent_at,s.created_at)
        FROM drip_sends s WHERE lower(trim(s.recipient_email))=lower(trim($2))
      UNION ALL SELECT e.id,e.direction || '_email', e.subject || E'\n' || left(COALESCE(e.body_text,''),600),e.sent_at
        FROM crm_direct_emails e WHERE lower(trim(CASE WHEN e.direction='inbound' THEN e.from_email ELSE e.to_email END))=lower(trim($2))
      UNION ALL SELECT a.id,a.activity_type,left(COALESCE(a.metadata->>'body',a.metadata->>'message',a.metadata->>'subject',a.metadata->>'notes',a.activity_type),800),a.created_at
        FROM contact_activities a JOIN contacts c ON c.id=a.contact_id WHERE lower(trim(c.email))=lower(trim($2))
      UNION ALL SELECT a.id,a.activity_type,left(COALESCE(a.metadata->>'body',a.metadata->>'message',a.metadata->>'subject',a.metadata->>'notes',a.activity_type),800),a.created_at
        FROM crm_client_activities a JOIN crm_clients c ON c.id=a.client_id WHERE lower(trim(c.email))=lower(trim($2))
      UNION ALL SELECT id,'call_outcome',outcome || COALESCE(': ' || notes,''),attempted_at
        FROM call_queue_attempts WHERE queue_id=$1
    ) events ORDER BY "occurredAt" DESC LIMIT 60`,
    [id, row.email],
  );
  return {
    person: serializePerson(row),
    brief: briefFor(row),
    timeline: timeline.rows.map((event) => ({
      ...event,
      detail: event.detail || "",
      occurredAt: iso(event.occurredAt)!,
    })),
    emailStatus: row.emailStatus,
    emailVerifiedAt: iso(row.emailVerifiedAt),
    calendarUrl: CALENDLY,
  };
}
export async function campaignPeople(filters: DeskQuery) {
  const values: unknown[] = [
    filters.days,
    filters.campaignId,
    `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`,
    filters.cursor,
    filters.limit + 1,
  ];
  const signal =
    filters.signal === "opened"
      ? "s.opened_at IS NOT NULL"
      : filters.signal === "clicked"
        ? "s.clicked_at IS NOT NULL"
        : filters.signal === "replied"
          ? `EXISTS(SELECT 1 FROM crm_direct_emails de WHERE de.direction='inbound' AND lower(trim(de.from_email))=lower(trim(s.recipient_email)))`
          : "true";
  const rows = (
    await pool.query<CampaignPerson>(
      `
    WITH candidates AS (
      SELECT s.*,e.campaign_id,c.name AS campaign_name,p.phone AS prospect_phone,p.company,
        lower(trim(s.recipient_email)) AS email_key,
        row_number() OVER(PARTITION BY lower(trim(s.recipient_email)) ORDER BY COALESCE(s.clicked_at,s.opened_at,s.sent_at,s.created_at) DESC,s.id) AS rn,
        sum(s.open_count) OVER(PARTITION BY lower(trim(s.recipient_email))) AS opens,
        sum(s.click_count) OVER(PARTITION BY lower(trim(s.recipient_email))) AS clicks
      FROM drip_sends s JOIN drip_enrollments e ON e.id=s.enrollment_id
      JOIN drip_campaigns c ON c.id=e.campaign_id JOIN prospects p ON p.id=e.prospect_id
      WHERE s.channel='email' AND s.status='sent' AND ${signal}
        AND COALESCE(s.clicked_at,s.opened_at,s.sent_at,s.created_at)>=now()-($1::int * interval '1 day')
        AND ($2='' OR e.campaign_id=$2)
        AND concat_ws(' ',s.recipient_name,s.recipient_email,p.phone,p.company,c.name) ILIKE $3
        AND lower(trim(s.recipient_email))>$4
    ) SELECT s.email_key AS email,s.recipient_name AS name,s.prospect_phone AS phone,s.company,
      s.campaign_name AS "campaignName",s.campaign_id AS "campaignId",s.id AS "sendId",q.id AS "queueId",
      s.opens::int,s.clicks::int,COALESCE(s.clicked_at,s.opened_at,s.sent_at,s.created_at) AS "lastActivityAt",
      EXISTS(SELECT 1 FROM crm_direct_emails e WHERE e.direction='inbound' AND lower(trim(e.from_email))=s.email_key) AS replied
    FROM candidates s LEFT JOIN LATERAL(SELECT id FROM call_queue WHERE lower(trim(email))=s.email_key ORDER BY updated_at DESC LIMIT 1) q ON true
    WHERE s.rn=1 ORDER BY s.email_key LIMIT $5`,
      values,
    )
  ).rows;
  const items = rows
    .slice(0, filters.limit)
    .map((row) => ({ ...row, lastActivityAt: iso(row.lastActivityAt)! }));
  return {
    items,
    nextCursor: rows.length > filters.limit ? items.at(-1)!.email : null,
  };
}
