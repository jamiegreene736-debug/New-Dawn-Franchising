import type { PoolClient } from "pg";
import { pool } from "../db";
import type { DeskOutcome, DeskAction } from "@shared/outreach-desk";
import { DeskError, normalizePhone, validTimezone } from "./policy";
import { iso, personRow, serializePerson } from "./queries";

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function event(
  client: Pick<PoolClient, "query">,
  queueId: string,
  kind: string,
  detail: string,
  actor: string,
  operationId?: string,
) {
  await client.query(
    `INSERT INTO outreach_desk_events(queue_id,kind,detail,actor,operation_id) VALUES($1,$2,$3,$4,$5)`,
    [queueId, kind, detail, actor, operationId || null],
  );
}
async function lockPerson(client: PoolClient, id: string) {
  const result = await client.query(
    "SELECT id FROM call_queue WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!result.rowCount) throw new DeskError(404, "Contact not found.");
}
function enforceClaim(
  claimedBy: string | null,
  until: string | null,
  actor: string,
) {
  if (
    claimedBy &&
    claimedBy !== actor &&
    Date.parse(iso(until) || "") > Date.now()
  )
    throw new DeskError(409, "Another agent is working this contact.");
}
export async function claimPerson(id: string, actor: string) {
  return transaction(async (client) => {
    await lockPerson(client, id);
    const row = await personRow(id, client);
    enforceClaim(row.claimedBy, row.claimUntil, actor);
    await client.query(
      `INSERT INTO outreach_desk_profiles(queue_id,claimed_by,claim_until) VALUES($1,$2,now()+interval '15 minutes')
      ON CONFLICT(queue_id) DO UPDATE SET claimed_by=$2,claim_until=now()+interval '15 minutes'`,
      [id, actor],
    );
    return serializePerson(await personRow(id, client));
  });
}
export async function handoff(id: string, actor: string) {
  return transaction(async (client) => {
    await lockPerson(client, id);
    const row = await personRow(id, client);
    enforceClaim(row.claimedBy, row.claimUntil, actor);
    const allowed = serializePerson(row).eligibility.call;
    if (!allowed.allowed) throw new DeskError(409, allowed.reason);
    await client.query(
      `INSERT INTO outreach_desk_profiles(queue_id,claimed_by,claim_until) VALUES($1,$2,now()+interval '15 minutes')
      ON CONFLICT(queue_id) DO UPDATE SET claimed_by=$2,claim_until=now()+interval '15 minutes'`,
      [id, actor],
    );
    await event(
      client,
      id,
      "call_handoff",
      "Dialer opened; waiting for provider call evidence.",
      actor,
    );
    return {
      href: `tel:${normalizePhone(row.phone)}`,
      status: "handoff_requested",
    };
  });
}
export async function saveOutcome(
  id: string,
  input: DeskOutcome,
  actor: string,
) {
  return transaction(async (client) => {
    await lockPerson(client, id);
    const row = await personRow(id, client);
    const existing = await client.query<{ queue_id: string }>(
      "SELECT queue_id FROM outreach_desk_events WHERE operation_id=$1",
      [input.operationId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].queue_id !== id)
        throw new DeskError(409, "Operation belongs to another contact.");
      return { id, saved: true };
    }
    enforceClaim(row.claimedBy, row.claimUntil, actor);
    if (iso(row.updatedAt) !== input.expectedUpdatedAt)
      throw new DeskError(
        409,
        "This contact changed. Refresh before saving; your notes are preserved.",
      );
    if (
      input.outcome === "callback" &&
      (!validTimezone(row.timezone) ||
        Date.parse(input.scheduledAt!) <= Date.now())
    ) {
      throw new DeskError(
        400,
        "Confirm the timezone and choose a future callback time.",
      );
    }
    const attempts = row.attemptCount + 1;
    const status =
      input.outcome === "details"
        ? "needs_followup"
        : input.outcome === "no_answer" || input.outcome === "voicemail"
          ? attempts >= 3
            ? "exhausted"
            : input.outcome
          : input.outcome;
    const nextAt =
      input.outcome === "callback"
        ? input.scheduledAt
        : ["no_answer", "voicemail"].includes(input.outcome) && attempts < 3
          ? new Date(
              Date.now() + (attempts === 1 ? 1 : 3) * 86400_000,
            ).toISOString()
          : null;
    await client.query(
      `INSERT INTO call_queue_attempts(queue_id,outcome,notes) VALUES($1,$2,$3)`,
      [id, input.outcome, input.notes],
    );
    await client.query(
      `UPDATE call_queue SET status=$2,attempt_count=$3,next_attempt_at=$4,outcome_notes=$5,
      last_attempt_at=now(),updated_at=now() WHERE id=$1`,
      [id, status, attempts, nextAt, input.notes],
    );
    await client.query(
      "UPDATE outreach_desk_profiles SET claimed_by=NULL,claim_until=NULL WHERE queue_id=$1",
      [id],
    );
    await event(
      client,
      id,
      "outcome",
      `${input.outcome.replaceAll("_", " ")}${input.notes ? `: ${input.notes}` : ""}`,
      actor,
      input.operationId,
    );
    if (
      [
        "details",
        "callback",
        "meeting_pending",
        "not_interested",
        "dnc",
      ].includes(input.outcome)
    ) {
      await client.query(
        `UPDATE drip_enrollments SET status='paused' WHERE lower(trim(prospect_email))=lower(trim($1)) AND status='active'`,
        [row.email],
      );
      await client.query(
        `UPDATE outreach_desk_actions SET status='cancelled',error='Agent recorded a new relationship outcome.',updated_at=now()
        WHERE queue_id=$1 AND status IN ('scheduled','draft','held')`,
        [id],
      );
    }
    if (input.outcome === "dnc") {
      await client.query(
        `INSERT INTO agent_dnc(email,phone,reason) VALUES($1,$2,$3)`,
        [
          row.email?.trim().toLowerCase() || null,
          row.phone,
          "Outreach Desk: do not contact",
        ],
      );
      await client.query(
        `UPDATE call_queue SET status='dnc',updated_at=now() WHERE id<>$1 AND
        ((email IS NOT NULL AND lower(trim(email))=lower(trim($2))) OR (phone IS NOT NULL AND phone=$3))`,
        [id, row.email, row.phone],
      );
    }
    if (input.outcome === "details") {
      const first = row.name.trim().split(/\s+/)[0] || "there";
      const body = `Hi ${first},\n\nThank you for speaking with New Dawn Franchising. As requested, here is an overview of ${row.track === "client" ? "business ownership" : "our referral process"}: https://www.newdawnfranchising.com/${row.track === "client" ? "process" : "partners"}\n\nWould a short introduction with Dylan be helpful?`;
      await client.query(
        `INSERT INTO outreach_desk_actions(queue_id,operation_id,channel,recipient,subject,body)
        VALUES($1,$2,'email',$3,'Following up on our conversation',$4)`,
        [id, `outcome:${input.operationId}`, row.email || "", body],
      );
    }
    return { id, saved: true };
  });
}
export async function listActions(): Promise<DeskAction[]> {
  const rows = (
    await pool.query<DeskAction>(`SELECT a.id,a.queue_id AS "queueId",q.name,a.channel,a.subject,a.body,
    a.recipient,a.status,a.scheduled_at AS "scheduledAt",a.created_at AS "createdAt",a.updated_at AS "updatedAt",a.provider_id AS "providerId",a.error
    FROM outreach_desk_actions a JOIN call_queue q ON q.id=a.queue_id ORDER BY a.created_at DESC LIMIT 100`)
  ).rows;
  return rows.map((row) => ({
    ...row,
    scheduledAt: iso(row.scheduledAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  }));
}
export async function createDraft(
  id: string,
  data: { operationId: string; channel: string; subject: string; body: string },
  actor: string,
) {
  return transaction(async (client) => {
    const row = await personRow(id, client);
    const recipient =
      data.channel === "email"
        ? row.email
        : data.channel === "linkedin"
          ? row.linkedinUrl
          : normalizePhone(row.phone);
    if (!recipient)
      throw new DeskError(
        400,
        "Add the contact detail for this channel first.",
      );
    const result = await client.query<{ id: string }>(
      `INSERT INTO outreach_desk_actions(queue_id,operation_id,channel,recipient,subject,body)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id
      WHERE outreach_desk_actions.queue_id=EXCLUDED.queue_id RETURNING id`,
      [id, data.operationId, data.channel, recipient, data.subject, data.body],
    );
    if (!result.rows[0])
      throw new DeskError(409, "Operation belongs to another contact.");
    await event(
      client,
      id,
      "draft_saved",
      `${data.channel} follow-up draft prepared.`,
      actor,
    );
    return result.rows[0];
  });
}
export async function approveAction(
  id: string,
  scheduledAt: string,
  actor: string,
) {
  return transaction(async (client) => {
    await client.query(
      "SELECT id FROM outreach_desk_settings WHERE id=1 FOR UPDATE",
    );
    const result = await client.query<{
      queue_id: string;
      channel: string;
      status: string;
    }>(
      "SELECT queue_id,channel,status FROM outreach_desk_actions WHERE id=$1 FOR UPDATE",
      [id],
    );
    const action = result.rows[0];
    if (!action) throw new DeskError(404, "Draft not found.");
    if (!["draft", "held"].includes(action.status))
      throw new DeskError(
        409,
        "This action is already scheduled or completed.",
      );
    if (action.channel === "linkedin")
      throw new DeskError(
        400,
        "LinkedIn is a manual profile task; copy the draft and send it yourself.",
      );
    if (Date.parse(scheduledAt) < Date.now() - 60_000)
      throw new DeskError(400, "Choose a current or future send time.");
    const row = await personRow(action.queue_id, client);
    // Hours are evaluated at dispatch so a draft can be scheduled for tomorrow.
    const permission =
      row.permissions[action.channel as "email" | "sms" | "whatsapp"];
    if (
      row.suppressed ||
      row.booked ||
      !permission?.allowed ||
      Date.parse(permission.expiresAt) <= Date.parse(scheduledAt)
    ) {
      throw new DeskError(
        409,
        "Current permission is required and the contact must not be suppressed or booked.",
      );
    }
    await client.query(
      `UPDATE outreach_desk_actions SET status='scheduled',scheduled_at=$2,approved_by=$3,error=NULL,updated_at=now() WHERE id=$1`,
      [id, scheduledAt, actor],
    );
    await event(
      client,
      action.queue_id,
      "followup_approved",
      `${action.channel} follow-up scheduled; eligibility will be checked again before dispatch.`,
      actor,
    );
    return { id, status: "scheduled" };
  });
}
