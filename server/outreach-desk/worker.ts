import { pool } from "../db";
import {
  sendEmailFromSender,
  ALL_SENDER_PROFILES,
  getSenderPassword,
} from "../email-service";
import { sendSmsViaQuo } from "../quo-service";
import { sendWhatsAppMessage } from "../meta-whatsapp-service";
import { getGmailSyncLastResult } from "../gmail-sync-service";
import {
  scanEngagedOpens,
  scanRepliesWithoutMeetings,
} from "../call-queue-service";
import { personRow, serializePerson } from "./queries";
import { event, transaction } from "./actions";
import { escapeHtml, normalizePhone, nextContactHours } from "./policy";
import { refreshContactEvidence } from "./enrichment";
import { ensureDeskSchema } from "./schema";

type DispatchAction = {
  id: string;
  queue_id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  created_at: Date;
  approved_by: string;
};
export type DispatchResult = { success: boolean; id?: string; error?: string };
export type Dispatch = (action: DispatchAction) => Promise<DispatchResult>;
async function dispatch(action: DispatchAction): Promise<DispatchResult> {
  if (action.channel === "sms")
    return sendSmsViaQuo(action.recipient, action.body);
  if (action.channel === "whatsapp")
    return sendWhatsAppMessage(action.recipient, action.body);
  if (action.channel !== "email")
    return { success: false, error: "Manual channel cannot be dispatched." };
  const sender = ALL_SENDER_PROFILES.find(
    (profile) =>
      profile.email === "franchising@newdawnfranchising.com" &&
      getSenderPassword(profile),
  );
  if (!sender) return { success: false, error: "Email sender not configured." };
  const result = await sendEmailFromSender(
    sender.email,
    action.recipient,
    action.subject,
    `<p>${escapeHtml(action.body).replaceAll("\n", "<br>")}</p>`,
  );
  return { ...result, id: result.messageId };
}
export async function processOneAction(
  send: Dispatch = dispatch,
): Promise<boolean> {
  // Dispatch claims survive process crashes. An uncertain send is never retried automatically.
  await pool.query(`UPDATE outreach_desk_actions SET status='unknown',error='Dispatch interrupted; reconcile provider history before sending again.',updated_at=now()
    WHERE status='dispatching' AND dispatch_started_at<now()-interval '5 minutes'`);
  const claim = await transaction(async (client) => {
    const lock = await client.query(
      "SELECT id,paused FROM outreach_desk_settings WHERE id=1 FOR UPDATE SKIP LOCKED",
    );
    if (!lock.rows[0] || lock.rows[0].paused) return null;
    const result =
      await client.query<DispatchAction>(`SELECT * FROM outreach_desk_actions WHERE status='scheduled'
      AND scheduled_at<=now() ORDER BY scheduled_at,id FOR UPDATE SKIP LOCKED LIMIT 1`);
    const action = result.rows[0];
    if (!action) return null;
    await client.query(
      "UPDATE outreach_desk_actions SET status='dispatching',dispatch_started_at=now(),updated_at=now() WHERE id=$1",
      [action.id],
    );
    return action;
  });
  if (!claim) return false;
  await transaction(async (client) => {
    const settings = (
      await client.query<{ paused: boolean; daily_limit: number }>(
        "SELECT paused,daily_limit FROM outreach_desk_settings WHERE id=1 FOR UPDATE",
      )
    ).rows[0];
    await client.query("SELECT id FROM call_queue WHERE id=$1 FOR UPDATE", [
      claim.queue_id,
    ]);
    const actionState = (
      await client.query<{ status: string }>(
        "SELECT status FROM outreach_desk_actions WHERE id=$1 FOR UPDATE",
        [claim.id],
      )
    ).rows[0];
    if (actionState.status !== "dispatching") return;
    const row = await personRow(claim.queue_id, client);
    const person = serializePerson(row);
    let reason = settings.paused ? "Outreach Desk sending is paused." : null;
    const channel = claim.channel as "email" | "sms" | "whatsapp";
    const eligibility = person.eligibility[channel];
    if (!eligibility?.allowed)
      reason ||= eligibility?.reason || "Unsupported sending channel.";
    const actualRecipient =
      channel === "email" ? person.email : normalizePhone(person.phone);
    if (actualRecipient !== claim.recipient)
      reason ||= "The contact detail changed; prepare a new draft.";
    const lastReply = (
      await client.query<{ exists: boolean }>(
        `SELECT EXISTS(
      SELECT 1 FROM crm_direct_emails WHERE direction='inbound' AND lower(trim(from_email))=lower(trim($1)) AND sent_at>$2
      UNION ALL SELECT 1 FROM contact_activities a JOIN contacts c ON a.contact_id=c.id
        WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($3,'[^0-9]','','g'),'')) AND a.activity_type IN ('email_received','email_reply','sms_received','whatsapp_received') AND a.created_at>$2
      UNION ALL SELECT 1 FROM crm_client_activities a JOIN crm_clients c ON a.client_id=c.id
        WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($3,'[^0-9]','','g'),'')) AND a.activity_type IN ('email_received','email_reply','sms_received','whatsapp_received') AND a.created_at>$2
      ) AS exists`,
        [person.email, claim.created_at, person.phone],
      )
    ).rows[0].exists;
    if (lastReply)
      reason ||= "A reply arrived after this draft. Review the conversation.";
    const counts = (
      await client.query<{ daily: number; person: number }>(
        `SELECT
      count(*) FILTER(WHERE a.dispatch_started_at>=date_trunc('day',now()))::int AS daily,
      count(*) FILTER(WHERE (a.queue_id=$1 OR lower(trim(a.recipient))=lower(trim($2)) OR lower(trim(q.email))=lower(trim($3)) OR NULLIF(regexp_replace(q.phone,'[^0-9]','','g'),'')=$4) AND a.dispatch_started_at>now()-interval '24 hours')::int AS person
      FROM outreach_desk_actions a JOIN call_queue q ON q.id=a.queue_id WHERE a.status IN ('accepted','unknown')`,
        [
          claim.queue_id,
          claim.recipient,
          person.email,
          normalizePhone(person.phone)?.slice(1) || null,
        ],
      )
    ).rows[0];
    if (counts.daily >= settings.daily_limit)
      reason ||= "Daily send limit reached.";
    if (counts.person >= 1)
      reason ||=
        "This contact already received a desk follow-up in the last 24 hours.";
    if (channel === "email" && send === dispatch) {
      const sync = getGmailSyncLastResult();
      if (
        !sync.lastRunAt ||
        sync.error ||
        Date.now() - new Date(sync.lastRunAt).getTime() > 30 * 60_000
      )
        reason ||=
          "Reply sync is not current; waiting for mailbox reconciliation.";
      if (
        row.emailStatus !== "valid" ||
        !row.emailVerifiedAt ||
        Date.now() - new Date(row.emailVerifiedAt).getTime() > 30 * 86400_000
      )
        reason ||= "A current valid email verification is required.";
    }
    if (reason?.startsWith("Outside the contact’s calling/messaging hours")) {
      const next = nextContactHours(person.timezone);
      if (next) {
        await client.query(
          "UPDATE outreach_desk_actions SET status='scheduled',scheduled_at=$2,error='Waiting for contact local hours.',updated_at=now() WHERE id=$1",
          [claim.id, next],
        );
        return;
      }
    }
    if (reason) {
      await client.query(
        "UPDATE outreach_desk_actions SET status='held',error=$2,updated_at=now() WHERE id=$1",
        [claim.id, reason],
      );
      return;
    }
    let result: DispatchResult;
    try {
      result = await send(claim);
    } catch {
      result = {
        success: false,
        error: "Provider response unavailable; delivery is uncertain.",
      };
    }
    const status = result.success ? "accepted" : "unknown";
    await client.query(
      "UPDATE outreach_desk_actions SET status=$2,provider_id=$3,error=$4,updated_at=now() WHERE id=$1",
      [
        claim.id,
        status,
        result.id || null,
        result.success
          ? null
          : "Provider acceptance could not be confirmed. Check provider history before retrying.",
      ],
    );
    await event(
      client,
      claim.queue_id,
      result.success ? "followup_accepted" : "followup_unknown",
      result.success
        ? `${channel} accepted by provider${result.id ? ` · ${result.id}` : ""}; delivery is not yet confirmed.`
        : "Provider result uncertain; manual reconciliation required.",
      claim.approved_by,
    );
  });
  return true;
}
export async function prepareDesk(): Promise<void> {
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (
      await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(71283042) AS locked",
      )
    ).rows[0].locked;
    if (!locked) return;
    // Reuse existing signal collectors; there is one call queue and no duplicate prospecting sequence.
    await scanEngagedOpens();
    await scanRepliesWithoutMeetings();
    await refreshContactEvidence();
    await client.query(`UPDATE outreach_desk_actions a SET status='cancelled',error='Contact opted out or booked a meeting.',updated_at=now()
      FROM call_queue q WHERE q.id=a.queue_id AND a.status IN ('draft','scheduled','held') AND
      (q.status IN ('dnc','booked','not_interested') OR EXISTS(SELECT 1 FROM agent_dnc d WHERE lower(trim(d.email))=lower(trim(q.email)))
      OR EXISTS(SELECT 1 FROM meetings m WHERE lower(trim(m.invitee_email))=lower(trim(q.email)) AND m.status IN ('confirmed','completed')))`);
    // Only requested-details drafts use this exact reviewed template; no AI-generated pitches auto-send.
    await client.query(`UPDATE outreach_desk_actions a SET status='scheduled',scheduled_at=now(),approved_by='playbook:requested-details',updated_at=now()
      FROM outreach_desk_settings s WHERE s.id=1 AND s.auto_followups AND NOT s.paused
      AND a.status='draft' AND a.operation_id LIKE 'outcome:%' AND a.created_at>now()-interval '7 days'
      AND EXISTS(SELECT 1 FROM outreach_desk_profiles p WHERE p.queue_id=a.queue_id
        AND p.permissions->'email'->>'allowed'='true')`);
    await client.query(
      "UPDATE outreach_desk_settings SET last_prepared_at=now(),preparation_error=NULL WHERE id=1",
    );
  } catch (error) {
    await client.query(
      "UPDATE outreach_desk_settings SET preparation_error='Daily preparation failed; retry or inspect server logs.' WHERE id=1",
    );
    throw error;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(71283042)");
    client.release();
  }
}
export function startDeskWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await ensureDeskSchema();
      const settings = (
        await pool.query<{ last_prepared_at: Date | null }>(
          "SELECT last_prepared_at FROM outreach_desk_settings WHERE id=1",
        )
      ).rows[0];
      if (
        !settings.last_prepared_at ||
        Date.now() - settings.last_prepared_at.getTime() > 15 * 60_000
      )
        await prepareDesk();
      for (let i = 0; i < 5; i++) if (!(await processOneAction())) break;
    } catch (error) {
      console.error(
        "[outreach-desk] worker failed",
        error instanceof Error ? error.message : "unknown error",
      );
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
