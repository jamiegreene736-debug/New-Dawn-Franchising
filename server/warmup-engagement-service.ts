import { ImapFlow } from "imapflow";
import { pool } from "./db";
import { sendEmailFromSender } from "./email-service";
import {
  getWarmupSettings,
  listMembers,
  getMemberPassword,
  buildWarmupReply,
  type WarmupMember,
  type WarmupSettings,
} from "./warmup-service";

// ─────────────────────────────────────────────────────────────────────────────
// Warmup engagement (IMAP) — the receiving half of the closed-loop warmup. For
// each mailbox we OWN, it logs in and acts on the warmup mail sent to it:
//   • Spam → moves the message back to the inbox ("spam rescue") — the single
//     strongest reputation-repair signal.
//   • Inbox → marks it read, stars it ("mark important"), and replies — the
//     positive-engagement signals warmup is built on.
// It also records where each warmup email LANDED (inbox vs spam) so the health
// score in warmup-service reflects real inbox placement.
//
// Only touches mailboxes we own (type='owned_imap'); it cannot — and must not —
// engage strangers' inboxes. Best-effort throughout: any per-mailbox failure is
// logged and skipped so one bad login never stalls the rest.
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_SPAM = "[Gmail]/Spam";

export interface EngagementResult {
  ran: boolean;
  reason?: string;
  mailboxes: number;
  rescued: number;
  inboxed: number;
  marked: number;
  replied: number;
  errors: string[];
}

let lastResult: EngagementResult & { at: string } = {
  ran: false, reason: "not started", mailboxes: 0, rescued: 0, inboxed: 0, marked: 0, replied: 0, errors: [], at: new Date(0).toISOString(),
};
export function getLastEngagement() {
  return lastResult;
}

function chance(pct: number): boolean {
  return Math.random() * 100 < pct;
}

function extractTokens(subject: string, filterTag: string): string[] {
  const esc = filterTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[(${esc}-[a-z0-9]+)\\]`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(subject)) !== null) out.push(m[1]);
  return out;
}

async function findPendingSend(toEmail: string, tokens: string[]): Promise<any | null> {
  if (!tokens.length) return null;
  const { rows } = await pool.query(
    `SELECT * FROM warmup_sends WHERE to_email=$1 AND token = ANY($2::text[]) AND landed='pending' LIMIT 1`,
    [toEmail, tokens],
  );
  return rows[0] || null;
}

async function engageMailbox(member: WarmupMember, settings: WarmupSettings, acc: EngagementResult): Promise<void> {
  const password = getMemberPassword(member);
  if (!password) {
    acc.errors.push(`${member.email}: no IMAP password`);
    return;
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: member.email, pass: password },
    logger: false,
  });

  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const handled = new Set<string>(); // tokens handled this run (avoid double-touch after a move)

  try {
    await client.connect();

    // ── 1. Spam rescue ──────────────────────────────────────────────────────
    try {
      const lock = await client.getMailboxLock(GMAIL_SPAM);
      try {
        const uids = await client.search({ since, subject: settings.filterTag }, { uid: true });
        for (const uid of (uids || []) as number[]) {
          const msg = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          const subject = (msg as any)?.envelope?.subject || "";
          const tokens = extractTokens(subject, settings.filterTag);
          const row = await findPendingSend(member.email, tokens);
          if (!row) continue;

          // It was in spam — record that, then rescue per the configured rate.
          const doRescue = chance(settings.spamRescuePct);
          await pool.query(
            `UPDATE warmup_sends SET landed='spam', checked_at=now()${doRescue ? ", rescued_at=now()" : ""} WHERE id=$1`,
            [row.id],
          );
          if (doRescue) {
            try {
              await client.messageMove(String(uid), "INBOX", { uid: true });
              acc.rescued++;
            } catch (e: any) {
              acc.errors.push(`${member.email}: rescue move failed (${e?.message})`);
            }
          }
          // Engage the rescued mail too (read + maybe star + maybe reply).
          await engageRow(client, String(uid), uid, member, settings, row, acc, /*inSpam*/ true);
          handled.add(row.token);
        }
      } finally {
        lock.release();
      }
    } catch {
      // Spam folder name may differ by locale / not exist — non-fatal.
    }

    // ── 2. Inbox engagement ─────────────────────────────────────────────────
    {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uids = await client.search({ since, subject: settings.filterTag }, { uid: true });
        for (const uid of (uids || []) as number[]) {
          // Always mark warmup mail read so it doesn't clutter the human view.
          try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch {}

          const msg = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          const subject = (msg as any)?.envelope?.subject || "";
          const tokens = extractTokens(subject, settings.filterTag);
          if (tokens.some((t) => handled.has(t))) continue; // already handled via rescue

          const row = await findPendingSend(member.email, tokens);
          if (!row) continue;

          await pool.query(`UPDATE warmup_sends SET landed='inbox', checked_at=now() WHERE id=$1`, [row.id]);
          acc.inboxed++;
          await engageRow(client, String(uid), uid, member, settings, row, acc, /*inSpam*/ false);
          handled.add(row.token);
        }
      } finally {
        lock.release();
      }
    }
  } catch (e: any) {
    acc.errors.push(`${member.email}: ${e?.message || "IMAP error"}`);
  } finally {
    try { await client.logout(); } catch {}
  }
}

// Star (mark important) + reply, applied to a matched warmup send.
async function engageRow(
  client: ImapFlow,
  uidStr: string,
  uid: number,
  member: WarmupMember,
  settings: WarmupSettings,
  row: any,
  acc: EngagementResult,
  inSpam: boolean,
): Promise<void> {
  // Mark important (Gmail star).
  if (chance(settings.markImportantPct)) {
    try {
      await client.messageFlagsAdd(uidStr, ["\\Flagged"], { uid: true });
      await pool.query(`UPDATE warmup_sends SET marked_important_at=now() WHERE id=$1`, [row.id]);
      acc.marked++;
    } catch {}
  }
  // Reply (the strongest signal) — from this mailbox back to the original sender.
  if (chance(settings.replyRatePct)) {
    try {
      const { subject, html } = buildWarmupReply(settings.filterTag, row.token);
      const res = await sendEmailFromSender(member.email, row.from_email, subject, html, undefined, undefined, {
        skipSignature: true,
        skipUnsubscribe: true,
      });
      if (res.success) {
        await pool.query(`UPDATE warmup_sends SET replied_at=now() WHERE id=$1`, [row.id]);
        acc.replied++;
      }
    } catch {}
  }
}

export async function runWarmupEngagement(): Promise<EngagementResult> {
  const settings = await getWarmupSettings();
  const acc: EngagementResult = { ran: false, mailboxes: 0, rescued: 0, inboxed: 0, marked: 0, replied: 0, errors: [] };
  const finish = () => {
    lastResult = { ...acc, at: new Date().toISOString() };
    return acc;
  };

  if (!settings.enabled) { acc.reason = "warmup disabled"; return finish(); }
  if (settings.provider !== "owned") { acc.reason = `provider '${settings.provider}' manages engagement`; return finish(); }

  const members = (await listMembers(true)).filter((m) => m.type === "owned_imap" && !!getMemberPassword(m));
  if (!members.length) { acc.reason = "no active owned members with passwords"; return finish(); }

  acc.ran = true;
  acc.mailboxes = members.length;
  for (const m of members) {
    await engageMailbox(m, settings, acc);
  }
  return finish();
}
