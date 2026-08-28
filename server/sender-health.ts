/**
 * Gmail sender circuit breaker.
 *
 * Production fail rate was 57% last week because SMTP returned 535/534
 * (bad app password / Google browser challenge). Those are sender problems,
 * not recipient problems. A dead mailbox must leave rotation immediately,
 * and that step must stay retryable — otherwise we skip the email forever.
 */
import { pool } from "./db";

const AUTH_FAIL_RE =
  /Invalid login|Username and Password not accepted|Please log in with your web browser|535-5\.7\.8|534-5\.7\.9|534-5\.7\.14|BadCredentials|accounts\.google\.com\/signin/i;

const RECIPIENT_FAIL_RE =
  /553-5\.1\.|5\.1\.1|5\.1\.3|not a valid RFC|user unknown|does not exist|mailbox unavailable|550 5\.1/i;

const DISABLE_MS = 24 * 60 * 60 * 1000;

export type SenderHealthEntry = { disabledUntil: number; reason: string };

const cache = new Map<string, SenderHealthEntry>();

export function isSenderAuthFailure(error?: string | null): boolean {
  return !!error && AUTH_FAIL_RE.test(error);
}

export function isRecipientFailure(error?: string | null): boolean {
  return !!error && RECIPIENT_FAIL_RE.test(error);
}

/** A drip step is done only if it landed, bounced, was skipped, or the address is bad. */
export function isTerminalDripSend(send: {
  status?: string | null;
  errorMessage?: string | null;
}): boolean {
  const s = (send.status || "").toLowerCase();
  if (["sent", "delivered", "opened", "clicked", "replied", "bounced", "skipped"].includes(s)) {
    return true;
  }
  if (s === "failed" && isRecipientFailure(send.errorMessage)) return true;
  return false;
}

export function isSenderDisabled(email: string, now = Date.now()): boolean {
  const row = cache.get(email.toLowerCase());
  return !!row && row.disabledUntil > now;
}

export function disabledSenderEmails(now = Date.now()): string[] {
  return [...cache.entries()].filter(([, v]) => v.disabledUntil > now).map(([k]) => k);
}

export function allSendersDisabled(emails: string[], now = Date.now()): boolean {
  return emails.length > 0 && emails.every((e) => isSenderDisabled(e, now));
}

export async function loadSenderHealth(): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT sender_health FROM deliverability_settings WHERE id='singleton'`,
    );
    cache.clear();
    const raw = rows[0]?.sender_health;
    if (raw && typeof raw === "object") {
      for (const [email, v] of Object.entries(raw as Record<string, any>)) {
        const until =
          typeof v?.disabledUntil === "number" ? v.disabledUntil : Date.parse(String(v?.disabledUntil || ""));
        if (email && Number.isFinite(until)) {
          cache.set(email.toLowerCase(), {
            disabledUntil: until,
            reason: String(v?.reason || ""),
          });
        }
      }
    }
  } catch (e: any) {
    console.error("[SenderHealth] load failed:", e?.message);
  }
}

async function persist(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) return;
  const obj: Record<string, SenderHealthEntry> = {};
  for (const [k, v] of cache) obj[k] = v;
  try {
    await pool.query(
      `UPDATE deliverability_settings SET sender_health=$1::jsonb, updated_at=now() WHERE id='singleton'`,
      [JSON.stringify(obj)],
    );
  } catch (e: any) {
    console.error("[SenderHealth] persist failed:", e?.message);
  }
}

export async function markSenderAuthFailure(email: string, error: string): Promise<void> {
  if (!isSenderAuthFailure(error)) return;
  const key = email.toLowerCase();
  cache.set(key, { disabledUntil: Date.now() + DISABLE_MS, reason: error.slice(0, 180) });
  console.error(`[SenderHealth] disabled ${email} for 24h — ${error.slice(0, 100)}`);
  await persist();
}

export async function markSenderSuccess(email: string): Promise<void> {
  const key = email.toLowerCase();
  if (!cache.has(key)) return;
  cache.delete(key);
  console.log(`[SenderHealth] re-enabled ${email} after a successful send`);
  await persist();
}

/** Test helper — do not use from production send paths. */
export function _resetSenderHealthForTests(): void {
  cache.clear();
}
