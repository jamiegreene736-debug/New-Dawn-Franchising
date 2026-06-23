import { randomUUID } from "crypto";
import { ImapFlow } from "imapflow";
import { pool } from "./db";
import { sendEmailFromSender } from "./email-service";

// ─────────────────────────────────────────────────────────────────────────────
// Seed inbox-placement test (Phase 3) — the GlockApps/MailReach-style test:
// send the REAL campaign content to a panel of seed inboxes we control across
// providers, then read each one over IMAP to see where it actually landed
// (Inbox vs Spam vs Missing) per provider.
//
// This is a genuine placement test for inboxes we own. True cross-provider
// coverage just means adding seeds on Gmail / Outlook / Yahoo (each with an app
// password). A provider seam (glockapps/mailreach) can be added later for a
// hosted seed panel; the schema + UI are already shaped for it.
//
// Reuses the real send path (sendEmailFromSender) so the test reflects exactly
// what recipients get — signature, List-Unsubscribe header, the lot.
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderCfg { host: string; port: number; spam: string }
const PROVIDERS: Record<string, ProviderCfg> = {
  gmail: { host: "imap.gmail.com", port: 993, spam: "[Gmail]/Spam" },
  outlook: { host: "outlook.office365.com", port: 993, spam: "Junk Email" },
  yahoo: { host: "imap.mail.yahoo.com", port: 993, spam: "Bulk Mail" },
  other: { host: "", port: 993, spam: "Junk" },
};

export interface SeedInbox {
  id: string;
  provider: string;
  email: string;
  imapHost: string | null;
  imapUser: string | null;
  imapPassEnv: string | null;
  active: boolean;
}

function rowToSeed(r: any): SeedInbox {
  return {
    id: r.id, provider: r.provider, email: r.email,
    imapHost: r.imap_host, imapUser: r.imap_user, imapPassEnv: r.imap_pass_env, active: !!r.active,
  };
}

export async function listSeeds(activeOnly = false): Promise<SeedInbox[]> {
  const { rows } = await pool.query(`SELECT * FROM seed_inboxes ${activeOnly ? "WHERE active=true" : ""} ORDER BY provider, email`);
  return rows.map(rowToSeed);
}

export async function addSeed(input: { email: string; provider?: string; imapHost?: string; imapUser?: string; imapPassEnv?: string }): Promise<SeedInbox> {
  const email = input.email.trim().toLowerCase();
  const provider = (input.provider || guessProvider(email)).toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO seed_inboxes (id, provider, email, imap_host, imap_user, imap_pass_env, active)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO UPDATE SET provider=EXCLUDED.provider, imap_host=EXCLUDED.imap_host,
       imap_user=EXCLUDED.imap_user, imap_pass_env=EXCLUDED.imap_pass_env, active=true
     RETURNING *`,
    [provider, email, input.imapHost || null, input.imapUser || null, input.imapPassEnv || null],
  );
  return rowToSeed(rows[0]);
}

export async function removeSeed(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM seed_inboxes WHERE id=$1`, [id]);
  return (rowCount || 0) > 0;
}
export async function setSeedActive(id: string, active: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(`UPDATE seed_inboxes SET active=$2 WHERE id=$1`, [id, active]);
  return (rowCount || 0) > 0;
}

function guessProvider(email: string): string {
  const d = email.split("@")[1] || "";
  if (/gmail\.com|googlemail\.com/.test(d)) return "gmail";
  if (/outlook\.|hotmail\.|live\.|office365|microsoft/.test(d)) return "outlook";
  if (/yahoo\.|ymail\.|rocketmail\./.test(d)) return "yahoo";
  return "other";
}

function seedPassword(seed: SeedInbox): string | undefined {
  if (!seed.imapPassEnv) return undefined;
  const raw = process.env[seed.imapPassEnv];
  return raw?.replace(/\s+/g, "") || undefined;
}

// ─── Run a test ───────────────────────────────────────────────────────────────

export async function startSeedTest(subject: string, html: string, fromEmail = "franchising@newdawnfranchising.com"): Promise<{ testId: string; sent: number; skipped: string[] }> {
  const seeds = await listSeeds(true);
  if (!seeds.length) throw new Error("No active seed inboxes configured");
  const token = `seed-${randomUUID().slice(0, 8)}`;
  const subj = `${subject || "Deliverability seed test"} [${token}]`;

  const { rows: t } = await pool.query(
    `INSERT INTO seed_tests (id, token, subject, status, total) VALUES (gen_random_uuid(), $1, $2, 'sending', $3) RETURNING id`,
    [token, subject.slice(0, 300), seeds.length],
  );
  const testId = t[0].id;

  let sent = 0;
  const skipped: string[] = [];
  for (const seed of seeds) {
    const res = await sendEmailFromSender(fromEmail, seed.email, subj, html || "<p>Deliverability seed test.</p>");
    const placement = res.success ? "pending" : "send_failed";
    if (res.success) sent++; else skipped.push(`${seed.email}: ${res.error || "send failed"}`);
    await pool.query(
      `INSERT INTO seed_test_results (id, test_id, seed_email, provider, placement) VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [testId, seed.email, seed.provider, placement],
    );
  }
  await pool.query(`UPDATE seed_tests SET status='awaiting_placement', sent=$2 WHERE id=$1`, [testId, sent]);
  return { testId, sent, skipped };
}

// Read each seed inbox over IMAP and bucket where the tagged message landed.
async function checkSeedPlacement(seed: SeedInbox, token: string): Promise<"inbox" | "spam" | "missing"> {
  const password = seedPassword(seed);
  if (!password) return "missing";
  const cfg = PROVIDERS[seed.provider] || PROVIDERS.other;
  const host = seed.imapHost || cfg.host;
  if (!host) return "missing";

  const client = new ImapFlow({ host, port: cfg.port, secure: true, auth: { user: seed.imapUser || seed.email, pass: password }, logger: false });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await client.connect();
    // Inbox first.
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uids = await client.search({ since, subject: token }, { uid: true });
        if (uids && (uids as number[]).length) return "inbox";
      } finally { lock.release(); }
    } catch {}
    // Then the provider's spam/junk folder.
    try {
      const lock = await client.getMailboxLock(cfg.spam);
      try {
        const uids = await client.search({ since, subject: token }, { uid: true });
        if (uids && (uids as number[]).length) return "spam";
      } finally { lock.release(); }
    } catch {}
    return "missing";
  } catch (e: any) {
    console.error(`[SeedTest] read ${seed.email} failed:`, e?.message);
    return "missing";
  } finally {
    try { await client.logout(); } catch {}
  }
}

export async function checkSeedTest(testId: string): Promise<void> {
  const { rows: tr } = await pool.query(`SELECT * FROM seed_tests WHERE id=$1`, [testId]);
  if (!tr.length) return;
  const test = tr[0];
  const seeds = await listSeeds(false);
  const { rows: results } = await pool.query(`SELECT * FROM seed_test_results WHERE test_id=$1`, [testId]);

  let inbox = 0, spam = 0, missing = 0;
  for (const r of results) {
    if (r.placement === "send_failed") { missing++; continue; }
    const seed = seeds.find((s) => s.email === r.seed_email);
    if (!seed) { missing++; continue; }
    const placement = await checkSeedPlacement(seed, test.token);
    await pool.query(`UPDATE seed_test_results SET placement=$2, checked_at=now() WHERE id=$1`, [r.id, placement]);
    if (placement === "inbox") inbox++; else if (placement === "spam") spam++; else missing++;
  }
  await pool.query(
    `UPDATE seed_tests SET status='complete', inbox=$2, spam=$3, missing=$4, completed_at=now() WHERE id=$1`,
    [testId, inbox, spam, missing],
  );
}

// Cron: finish any test that's been awaiting placement for ≥3 minutes.
export async function checkPendingSeedTests(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id FROM seed_tests WHERE status='awaiting_placement' AND started_at < now() - interval '3 minutes' ORDER BY started_at LIMIT 5`,
  );
  for (const r of rows) {
    await checkSeedTest(r.id).catch((e) => console.error("[SeedTest] check failed:", e?.message));
  }
}

export async function getSeedOverview() {
  const seeds = await listSeeds(false);
  const { rows: tests } = await pool.query(
    `SELECT id, token, subject, status, total, sent, inbox, spam, missing, started_at, completed_at
     FROM seed_tests ORDER BY started_at DESC LIMIT 10`,
  );
  const latest = tests[0];
  let latestResults: any[] = [];
  if (latest) {
    const { rows } = await pool.query(
      `SELECT seed_email, provider, placement, checked_at FROM seed_test_results WHERE test_id=$1 ORDER BY provider, seed_email`,
      [latest.id],
    );
    latestResults = rows.map((r) => ({ email: r.seed_email, provider: r.provider, placement: r.placement, checkedAt: r.checked_at ? new Date(r.checked_at).toISOString() : null }));
  }
  return {
    seeds,
    tests: tests.map((t) => ({
      id: t.id, subject: t.subject, status: t.status, total: t.total, sent: t.sent,
      inbox: t.inbox, spam: t.spam, missing: t.missing,
      inboxRate: t.sent ? Math.round((t.inbox / t.sent) * 100) : 0,
      startedAt: t.started_at ? new Date(t.started_at).toISOString() : null,
      completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
    })),
    latestResults,
  };
}
