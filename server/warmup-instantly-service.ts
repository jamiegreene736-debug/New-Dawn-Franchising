import { pool } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Instantly.ai warmup provider adapter (Phase 3 follow-up)
//
// When warmup_settings.provider = 'instantly', Instantly's own network does the
// actual sending/engagement — our owned send + IMAP loops stay no-op. This
// adapter instead PULLS Instantly's warmup state over their v2 API and mirrors it
// into our warmup_health table so the existing dashboard + composite score show
// real warmup placement.
//
// API (developer.instantly.ai/api/v2):
//   • GET  /api/v2/accounts                — list connected mailboxes; each has
//          `email`, `warmup_status` (1=active), `stat_warmup_score` (0–100).
//   • POST /api/v2/accounts/warmup-analytics { emails } — per-email/day
//          { sent, landed_inbox, landed_spam, received }.
// Auth: Authorization: Bearer <INSTANTLY_API_KEY>.
//
// Read-only — it never enables/disables warmup or mutates the Instantly account
// (you control that in Instantly). Inert until INSTANTLY_API_KEY is set AND the
// provider is switched to 'instantly'.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (process.env.INSTANTLY_BASE_URL || "https://api.instantly.ai/api/v2").replace(/\/+$/, "");

export function getInstantlyConfig() {
  return { configured: !!process.env.INSTANTLY_API_KEY, baseUrl: BASE };
}

async function instantlyFetch(path: string, init: RequestInit = {}): Promise<any> {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new Error("INSTANTLY_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(`Instantly ${path} → HTTP ${res.status}${json?.message ? ` (${json.message})` : ""}`);
  return json;
}

export interface InstantlyAccount { email: string; warmupActive: boolean; warmupScore: number | null }

// List all connected mailboxes (cursor-paginated; capped for safety).
export async function listInstantlyAccounts(): Promise<InstantlyAccount[]> {
  const out: InstantlyAccount[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (startingAfter) qs.set("starting_after", startingAfter);
    const json = await instantlyFetch(`/accounts?${qs}`);
    const items: any[] = json?.items || json?.data || (Array.isArray(json) ? json : []);
    for (const a of items) {
      const score = a.stat_warmup_score ?? a.warmup_score ?? a.warmup?.score;
      out.push({
        email: (a.email || "").toLowerCase(),
        warmupActive: Number(a.warmup_status ?? a.warmup?.status ?? 0) === 1,
        warmupScore: score == null ? null : Number(score),
      });
    }
    startingAfter = json?.next_starting_after || json?.next_starting_after_id;
    if (!startingAfter || !items.length) break;
  }
  return out.filter((a) => a.email);
}

// Per-email warmup analytics. Response is keyed/grouped by email + date; we sum
// across whatever dates are returned. Defensive to a couple of shapes.
async function getWarmupAnalytics(emails: string[]): Promise<Record<string, { sent: number; inbox: number; spam: number }>> {
  const agg: Record<string, { sent: number; inbox: number; spam: number }> = {};
  if (!emails.length) return agg;
  const json = await instantlyFetch(`/accounts/warmup-analytics`, { method: "POST", body: JSON.stringify({ emails }) }).catch(() => null);
  if (!json) return agg;

  const bump = (email: string, sent: any, inbox: any, spam: any) => {
    const e = (email || "").toLowerCase();
    if (!e) return;
    agg[e] = agg[e] || { sent: 0, inbox: 0, spam: 0 };
    agg[e].sent += Number(sent || 0);
    agg[e].inbox += Number(inbox || 0);
    agg[e].spam += Number(spam || 0);
  };

  // Shape A: { "email": { "YYYY-MM-DD": { sent, landed_inbox, landed_spam } } }
  // Shape B: { "email": { sent, landed_inbox, landed_spam } }
  // Shape C: [ { email, sent, landed_inbox, landed_spam, date? } ]
  const container = json.data || json;
  if (Array.isArray(container)) {
    for (const r of container) bump(r.email, r.sent, r.landed_inbox ?? r.inbox, r.landed_spam ?? r.spam);
  } else if (container && typeof container === "object") {
    for (const [email, val] of Object.entries<any>(container)) {
      if (val && typeof val === "object" && ("sent" in val || "landed_inbox" in val)) {
        bump(email, val.sent, val.landed_inbox ?? val.inbox, val.landed_spam ?? val.spam);
      } else if (val && typeof val === "object") {
        for (const day of Object.values<any>(val)) bump(email, day?.sent, day?.landed_inbox ?? day?.inbox, day?.landed_spam ?? day?.spam);
      }
    }
  }
  return agg;
}

let lastSync = { at: new Date(0).toISOString(), accounts: 0, error: null as string | null };
export function getInstantlySyncStatus() { return lastSync; }

async function providerIsInstantly(): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT provider FROM warmup_settings WHERE id='singleton'`);
    return (rows[0]?.provider || "owned") === "instantly";
  } catch { return false; }
}

export async function syncInstantlyWarmup(): Promise<{ ran: boolean; reason?: string; accounts: number }> {
  if (!getInstantlyConfig().configured) { lastSync = { at: new Date().toISOString(), accounts: 0, error: "INSTANTLY_API_KEY not set" }; return { ran: false, reason: "not configured", accounts: 0 }; }
  if (!(await providerIsInstantly())) return { ran: false, reason: "provider is not 'instantly'", accounts: 0 };

  try {
    const accounts = await listInstantlyAccounts();
    const analytics = await getWarmupAnalytics(accounts.map((a) => a.email));
    for (const a of accounts) {
      const an = analytics[a.email] || { sent: 0, inbox: 0, spam: 0 };
      // Prefer Instantly's own score; else derive from landed/sent.
      const score = a.warmupScore != null ? a.warmupScore : (an.sent ? +((an.inbox / an.sent) * 100).toFixed(1) : null);
      await pool.query(
        `INSERT INTO warmup_health (id, mailbox, day, sent, inboxed, spam, score)
         VALUES (gen_random_uuid(), $1, CURRENT_DATE, $2, $3, $4, $5)
         ON CONFLICT (mailbox, day) DO UPDATE SET sent=EXCLUDED.sent, inboxed=EXCLUDED.inboxed, spam=EXCLUDED.spam, score=EXCLUDED.score`,
        [a.email, an.sent, an.inbox, an.spam, score],
      );
    }
    lastSync = { at: new Date().toISOString(), accounts: accounts.length, error: null };
    if (accounts.length) console.log(`[Instantly] synced warmup for ${accounts.length} account(s)`);
    return { ran: true, accounts: accounts.length };
  } catch (e: any) {
    console.error("[Instantly] sync failed:", e?.message);
    lastSync = { at: new Date().toISOString(), accounts: 0, error: e?.message || "sync failed" };
    return { ran: false, reason: e?.message, accounts: 0 };
  }
}

export async function getInstantlyOverview() {
  const cfg = getInstantlyConfig();
  let accounts: InstantlyAccount[] = [];
  if (cfg.configured) accounts = await listInstantlyAccounts().catch(() => []);
  return { configured: cfg.configured, syncStatus: lastSync, accounts };
}
