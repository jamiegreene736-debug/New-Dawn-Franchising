import { pool } from "../db";
import { getHunterStatus, hunterVerifyEmail } from "../hunter-service";
import { event, transaction } from "./actions";
import { personRow } from "./queries";
import { DeskError } from "./policy";

type Verifier = typeof hunterVerifyEmail;
/** Persist provider evidence by email so duplicate queue entries share freshness and cost. */
export async function verifyPersonEmail(
  id: string,
  actor: string,
  verify: Verifier = hunterVerifyEmail,
): Promise<void> {
  const row = await personRow(id);
  if (!row.email) throw new DeskError(400, "No email to verify.");
  if (verify === hunterVerifyEmail && !getHunterStatus().configured)
    throw new DeskError(409, "Hunter verification is not configured.");
  const email = row.email.trim().toLowerCase();
  const claimed = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(71283043)");
    const existing = (
      await client.query<{ checked_at: Date | null; attempted_at: Date }>(
        "SELECT checked_at,attempted_at FROM outreach_desk_email_evidence WHERE email=$1",
        [email],
      )
    ).rows[0];
    if (existing && Date.now() - existing.attempted_at.getTime() < 86400_000) {
      if (!existing.checked_at || existing.checked_at < existing.attempted_at)
        throw new DeskError(
          409,
          "Verification already attempted today. Existing evidence is preserved; retry tomorrow.",
        );
      return false;
    }
    if (
      row.emailVerifiedAt &&
      Date.now() - new Date(row.emailVerifiedAt).getTime() < 86400_000
    )
      return false;
    const count = (
      await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM outreach_desk_email_evidence WHERE attempted_at>=date_trunc('day',now())",
      )
    ).rows[0].count;
    if (count >= 20)
      throw new DeskError(
        429,
        "The desk's daily limit of 20 email verifications has been reached.",
      );
    await client.query(
      `INSERT INTO outreach_desk_email_evidence(email) VALUES($1)
      ON CONFLICT(email) DO UPDATE SET attempted_at=now(),error=NULL`,
      [email],
    );
    return true;
  });
  if (!claimed) return;
  let result: Awaited<ReturnType<Verifier>>;
  try {
    result = await verify(email);
  } catch {
    result = null;
  }
  if (!result || result.email.toLowerCase().trim() !== email) {
    await pool.query(
      "UPDATE outreach_desk_email_evidence SET error='Provider unavailable or identity mismatch' WHERE email=$1",
      [email],
    );
    throw new DeskError(
      502,
      "Verification provider unavailable. Existing evidence was preserved.",
    );
  }
  const status =
    result.result === "deliverable"
      ? "valid"
      : result.result === "undeliverable"
        ? "invalid"
        : "unknown";
  await transaction(async (client) => {
    await client.query(
      "UPDATE outreach_desk_email_evidence SET email_status=$2,checked_at=now(),error=NULL WHERE email=$1",
      [email, status],
    );
    await client.query(
      "UPDATE crm_clients SET email_status=$2,email_verified_at=now() WHERE lower(trim(email))=$1",
      [email, status],
    );
    await client.query(
      "UPDATE contacts SET email_status=$2,email_verified_at=now() WHERE lower(trim(email))=$1",
      [email, status],
    );
    await client.query(
      "UPDATE prospects SET email_status=$2,email_verified_at=now() WHERE lower(trim(email))=$1",
      [email, status],
    );
    await event(
      client,
      id,
      "email_verified",
      `Hunter verification: ${status}`,
      actor,
    );
  });
}

export async function refreshContactEvidence(): Promise<void> {
  // Only fill missing fields from explicitly linked records. Never overwrite agent corrections.
  await pool.query(`UPDATE call_queue q SET phone=COALESCE(q.phone,s.phone),company=COALESCE(q.company,s.company),updated_at=now()
    FROM (SELECT q.id,COALESCE(c.phone,t.phone,p.phone) AS phone,COALESCE(c.company_name,t.firm_name,p.company) AS company
      FROM call_queue q LEFT JOIN crm_clients c ON c.id=q.crm_client_id
      LEFT JOIN contacts t ON t.id=q.contact_id LEFT JOIN prospects p ON p.id=q.prospect_id) s
    WHERE q.id=s.id AND ((q.phone IS NULL AND s.phone IS NOT NULL) OR (q.company IS NULL AND s.company IS NOT NULL))`);
  if (!getHunterStatus().configured) return;
  const circuit = await pool.query(
    "SELECT 1 FROM outreach_desk_email_evidence WHERE error IS NOT NULL AND attempted_at>now()-interval '1 hour' LIMIT 1",
  );
  if (circuit.rowCount) return;
  const candidates = (
    await pool.query<{ id: string }>(`WITH candidates AS (
    SELECT DISTINCT ON(lower(trim(q.email))) q.id,q.status,q.trigger_type,q.next_attempt_at,q.updated_at
    FROM call_queue q LEFT JOIN outreach_desk_email_evidence e ON e.email=lower(trim(q.email))
      LEFT JOIN crm_clients c ON c.id=q.crm_client_id LEFT JOIN contacts t ON t.id=q.contact_id
      LEFT JOIN prospects p ON p.id=q.prospect_id
    WHERE q.email IS NOT NULL AND q.email<>'' AND q.status IN ('queued','callback','needs_followup')
      AND (e.attempted_at IS NULL OR e.attempted_at<now()-interval '1 day')
      AND COALESCE(e.checked_at,c.email_verified_at,t.email_verified_at,p.email_verified_at,'epoch'::timestamptz)<now()-interval '30 days'
      AND NOT EXISTS(SELECT 1 FROM agent_dnc d WHERE lower(trim(d.email))=lower(trim(q.email))
        OR lower(d.domain)=split_part(lower(q.email),'@',2)
        OR NULLIF(regexp_replace(d.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace(q.phone,'[^0-9]','','g'),''))
      AND NOT EXISTS(SELECT 1 FROM meetings m WHERE lower(trim(m.invitee_email))=lower(trim(q.email)) AND m.status IN ('confirmed','completed'))
    ORDER BY lower(trim(q.email)),q.updated_at DESC)
    SELECT id FROM candidates ORDER BY CASE WHEN status='callback' THEN 0 WHEN trigger_type='reply_no_meeting' THEN 1 ELSE 2 END,
      COALESCE(next_attempt_at,updated_at) LIMIT 5`)
  ).rows;
  for (const candidate of candidates) {
    try {
      await verifyPersonEmail(candidate.id, "daily-preparation");
    } catch (error) {
      if (error instanceof DeskError && [429, 502].includes(error.status))
        break;
      if (!(error instanceof DeskError && error.status === 409)) throw error;
    }
  }
}
