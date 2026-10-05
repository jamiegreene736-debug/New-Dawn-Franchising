import { simpleParser } from "mailparser";
import { randomUUID } from "crypto";
import { createImapClient, closeImapClient } from "./imap-client";
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

export async function startSeedTest(subject: string, html: string, fromEmail = "dylan@newdawnfranchising.com"): Promise<{ testId: string; sent: number; skipped: string[] }> {
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
    const res = await sendEmailFromSender(fromEmail, seed.email, subj, html || "<p>Deliverability seed test.</p>", undefined, undefined, { minimalSignature: true });
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
export interface SeedPlacement {
  placement: "inbox" | "spam" | "missing" | "unverified";
  authenticationResults?: string;
  error?: string;
}
async function checkSeedPlacement(seed: SeedInbox, token: string): Promise<SeedPlacement> {
  const password = seedPassword(seed);
  const cfg = PROVIDERS[seed.provider] || PROVIDERS.other;
  const host = seed.imapHost || cfg.host;
  if (!password || !host) return { placement: "unverified", error: "Receiving mailbox access is not configured." };
  const client = createImapClient({ host, port: cfg.port, secure: true, auth: { user: seed.imapUser || seed.email, pass: password }, logger: false,
    connectionTimeout: 15000, socketTimeout: 30000 }, "SeedPlacement");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await client.connect();
    for (const [folder, placement] of [["INBOX", "inbox"], [cfg.spam, "spam"]] as const) {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const uids = await client.search({ since, subject: token }, { uid: true });
        if (uids && uids.length) {
          const message = await client.fetchOne(uids[uids.length - 1], { source: true }, { uid: true });
          const parsed = message && message.source ? await simpleParser(message.source) : undefined;
          const header = parsed?.headerLines.filter(h => h.key === "authentication-results").map(h => h.line).join("\n");
          return { placement, authenticationResults: header || "Receiving server did not supply Authentication-Results." };
        }
      } finally { lock.release(); }
    }
    return { placement: "missing" };
  } catch {
    return { placement: "unverified", error: "Could not read the receiving mailbox; delivery is not established." };
  } finally { await closeImapClient(client, "SeedPlacement"); }
}

export async function checkSeedTest(testId: string): Promise<void> {
  const { rows: tr } = await pool.query(`SELECT * FROM seed_tests WHERE id=$1`, [testId]);
  if (!tr.length) return;
  const test = tr[0];
  const seeds = await listSeeds(false);
  const { rows: results } = await pool.query(`SELECT * FROM seed_test_results WHERE test_id=$1`, [testId]);

  let inbox = 0, spam = 0, missing = 0, unverified = 0;
  for (const r of results) {
    if (r.placement === "send_failed") { missing++; continue; }
    const seed = seeds.find((s) => s.email === r.seed_email);
    if (!seed) { unverified++; continue; }
    const result = await checkSeedPlacement(seed, test.token);
    await pool.query(`UPDATE seed_test_results SET placement=$2, authentication_results=$3,check_error=$4,checked_at=now() WHERE id=$1`, [r.id, result.placement, result.authenticationResults || null, result.error || null]);
    if (result.placement === "inbox") inbox++; else if (result.placement === "spam") spam++; else if (result.placement === "unverified") unverified++; else missing++;
  }
  await pool.query(
    `UPDATE seed_tests SET status=$5, inbox=$2, spam=$3, missing=$4, completed_at=now() WHERE id=$1`,
    [testId, inbox, spam, missing, unverified ? "needs_mailbox_access" : "complete"],
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
      `SELECT seed_email, provider, placement, checked_at,authentication_results,check_error FROM seed_test_results WHERE test_id=$1 ORDER BY provider, seed_email`,
      [latest.id],
    );
    latestResults = rows.map((r) => ({ email: r.seed_email, provider: r.provider, placement: r.placement, authenticationResults: r.authentication_results, error: r.check_error, checkedAt: r.checked_at ? new Date(r.checked_at).toISOString() : null }));
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
