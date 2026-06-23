import { randomUUID } from "crypto";
import { pool } from "./db";
import {
  ALL_SENDER_PROFILES,
  getSenderPassword,
  getSenderProfile,
  sendEmailFromSender,
} from "./email-service";
import { getInstantlyOverview } from "./warmup-instantly-service";

// ─────────────────────────────────────────────────────────────────────────────
// Warmup engine — a scoped, Instantly/Smartlead-style mailbox warmup.
//
// Reality check: a true warmup network is a pool of *strangers'* aged inboxes
// that open/reply/rescue your mail — impossible to fabricate with one org's
// mailboxes. What we CAN do honestly is a closed-loop self-warmup across the
// mailboxes we own (the Gmail senders): they email each other on a slow ramp,
// and the engagement service (IMAP) reads/replies/rescues on the receiving side.
// This maintains reputation and exercises auth/tracking, and is the mechanically
// faithful subset of what the big tools do.
//
// The `provider` field on settings + the `type` on pool members is the seam: a
// real network (Instantly/Smartlead/Mailreach API, or purchased seed inboxes)
// plugs in later WITHOUT changing the schema, scoring, ramp, or UI.
//
// Ships OFF by default (enabled=false). Nothing sends until an admin turns it on
// and adds pool members.
// ─────────────────────────────────────────────────────────────────────────────

export interface WarmupSettings {
  enabled: boolean;
  provider: string; // 'owned' | 'instantly' | 'smartlead' | 'mailreach'
  dailyTarget: number; // ramp ceiling, warmup emails/mailbox/day
  rampStart: number; // day-1 volume
  rampIncrement: number; // emails added per day until ceiling
  replyRatePct: number;
  markImportantPct: number;
  spamRescuePct: number;
  weekdaysOnly: boolean;
  filterTag: string; // marker placed in the subject so warmup mail is identifiable
  startedAt: string | null;
  updatedAt: string;
}

const DEFAULTS: Omit<WarmupSettings, "startedAt" | "updatedAt"> = {
  enabled: false,
  provider: "owned",
  dailyTarget: 10,
  rampStart: 2,
  rampIncrement: 2,
  replyRatePct: 30,
  markImportantPct: 30,
  spamRescuePct: 100,
  weekdaysOnly: true,
  filterTag: "ndf-warmup",
};

function rowToSettings(r: any): WarmupSettings {
  return {
    enabled: !!r.enabled,
    provider: r.provider || "owned",
    dailyTarget: Number(r.daily_target),
    rampStart: Number(r.ramp_start),
    rampIncrement: Number(r.ramp_increment),
    replyRatePct: Number(r.reply_rate_pct),
    markImportantPct: Number(r.mark_important_pct),
    spamRescuePct: Number(r.spam_rescue_pct),
    weekdaysOnly: !!r.weekdays_only,
    filterTag: r.filter_tag || DEFAULTS.filterTag,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getWarmupSettings(): Promise<WarmupSettings> {
  const { rows } = await pool.query(`SELECT * FROM warmup_settings WHERE id='singleton'`);
  if (rows.length) return rowToSettings(rows[0]);
  await pool.query(
    `INSERT INTO warmup_settings
       (id, enabled, provider, daily_target, ramp_start, ramp_increment, reply_rate_pct, mark_important_pct, spam_rescue_pct, weekdays_only, filter_tag)
     VALUES ('singleton',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO NOTHING`,
    [
      DEFAULTS.enabled, DEFAULTS.provider, DEFAULTS.dailyTarget, DEFAULTS.rampStart, DEFAULTS.rampIncrement,
      DEFAULTS.replyRatePct, DEFAULTS.markImportantPct, DEFAULTS.spamRescuePct, DEFAULTS.weekdaysOnly, DEFAULTS.filterTag,
    ],
  );
  const { rows: r2 } = await pool.query(`SELECT * FROM warmup_settings WHERE id='singleton'`);
  return rowToSettings(r2[0]);
}

const PATCH_COLS: Record<string, string> = {
  enabled: "enabled",
  provider: "provider",
  dailyTarget: "daily_target",
  rampStart: "ramp_start",
  rampIncrement: "ramp_increment",
  replyRatePct: "reply_rate_pct",
  markImportantPct: "mark_important_pct",
  spamRescuePct: "spam_rescue_pct",
  weekdaysOnly: "weekdays_only",
  filterTag: "filter_tag",
};

export async function updateWarmupSettings(patch: Partial<WarmupSettings>): Promise<WarmupSettings> {
  await getWarmupSettings(); // ensure row exists
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, col] of Object.entries(PATCH_COLS)) {
    if (k in patch && (patch as any)[k] !== undefined) {
      params.push((patch as any)[k]);
      sets.push(`${col}=$${params.length}`);
    }
  }
  // Turning warmup ON stamps started_at so the ramp clock starts now (only if not
  // already running). Turning OFF leaves started_at so re-enabling resumes the ramp.
  if (patch.enabled === true) {
    sets.push(`started_at=COALESCE(started_at, now())`);
  }
  if (!sets.length) return getWarmupSettings();
  sets.push(`updated_at=now()`);
  await pool.query(`UPDATE warmup_settings SET ${sets.join(", ")} WHERE id='singleton'`, params);
  return getWarmupSettings();
}

// ─── Pool members ─────────────────────────────────────────────────────────────

export interface WarmupMember {
  id: string;
  email: string;
  name: string | null;
  type: string; // 'owned_imap' | 'external'
  imapPassEnv: string | null;
  provider: string | null;
  active: boolean;
  createdAt: string;
}

function rowToMember(r: any): WarmupMember {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    type: r.type,
    imapPassEnv: r.imap_pass_env,
    provider: r.provider,
    active: !!r.active,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function listMembers(activeOnly = false): Promise<WarmupMember[]> {
  const { rows } = await pool.query(
    `SELECT * FROM warmup_pool_members ${activeOnly ? "WHERE active=true" : ""} ORDER BY email ASC`,
  );
  return rows.map(rowToMember);
}

export async function addMember(input: {
  email: string;
  name?: string;
  type?: string;
  imapPassEnv?: string | null;
  provider?: string | null;
}): Promise<WarmupMember> {
  const email = input.email.trim().toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO warmup_pool_members (id, email, name, type, imap_pass_env, provider, active)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO UPDATE SET
       name=EXCLUDED.name, type=EXCLUDED.type, imap_pass_env=EXCLUDED.imap_pass_env, provider=EXCLUDED.provider, active=true
     RETURNING *`,
    [email, input.name || null, input.type || "owned_imap", input.imapPassEnv || null, input.provider || null],
  );
  return rowToMember(rows[0]);
}

export async function removeMember(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM warmup_pool_members WHERE id=$1`, [id]);
  return (rowCount || 0) > 0;
}

export async function setMemberActive(id: string, active: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(`UPDATE warmup_pool_members SET active=$2 WHERE id=$1`, [id, active]);
  return (rowCount || 0) > 0;
}

// Convenience: register every configured Gmail sender as an owned warmup member.
export async function seedOwnedMembersFromSenders(): Promise<{ added: number; emails: string[] }> {
  const usable = ALL_SENDER_PROFILES.filter((p) => !!getSenderPassword(p));
  const emails: string[] = [];
  for (const p of usable) {
    await addMember({ email: p.email, name: p.name, type: "owned_imap", imapPassEnv: p.envVar, provider: "owned" });
    emails.push(p.email);
  }
  return { added: emails.length, emails };
}

// Resolve the IMAP password for an owned member (reuses the sender app passwords).
export function getMemberPassword(member: WarmupMember): string | undefined {
  if (member.imapPassEnv) {
    const raw = process.env[member.imapPassEnv];
    const clean = raw?.replace(/\s+/g, "");
    if (clean) return clean;
  }
  const profile = getSenderProfile(member.email);
  if (profile) return getSenderPassword(profile);
  return undefined;
}

// ─── Ramp maths ───────────────────────────────────────────────────────────────

export function rampTargetForDay(settings: WarmupSettings, now = new Date()): number {
  if (settings.weekdaysOnly) {
    const dow = now.getUTCDay(); // 0=Sun 6=Sat
    if (dow === 0 || dow === 6) return 0;
  }
  const start = settings.startedAt ? new Date(settings.startedAt) : now;
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  const ramped = settings.rampStart + settings.rampIncrement * daysElapsed;
  return Math.max(0, Math.min(settings.dailyTarget, ramped));
}

async function countSentToday(fromEmail: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM warmup_sends WHERE from_email=$1 AND sent_at::date = CURRENT_DATE`,
    [fromEmail],
  );
  return rows[0]?.n || 0;
}

// ─── Warmup content ───────────────────────────────────────────────────────────

const SUBJECTS = [
  "Quick question about next week",
  "Following up on our chat",
  "Re: the proposal",
  "Notes from today",
  "Touching base",
  "Plan for the project",
  "Catching up",
  "A few thoughts",
  "Update on my end",
  "Re: scheduling",
];

const BODIES = [
  "Hey — just wanted to check in and see how things are going on your side. Let me know when you get a minute.",
  "Thanks again for the other day. I jotted down a couple of follow-ups and will send them over shortly.",
  "Hope the week's going well. No rush on this, just keeping it on the radar so it doesn't slip.",
  "Appreciate you getting back to me. I think the plan looks solid — happy to talk it through whenever works.",
  "Quick note to say I've made progress on my part. Will share more details by end of week.",
  "Let's find some time to connect. Mornings tend to work best for me, but I'm flexible.",
  "Got your message — all makes sense. I'll review and circle back with any questions.",
  "Just confirming we're still on track. Everything looks good from where I'm sitting.",
];

const REPLIES = [
  "Sounds great, thanks for the update!",
  "Got it — appreciate you keeping me posted.",
  "Perfect, that works for me. Talk soon.",
  "Thanks! I'll take a look and get back to you.",
  "Makes sense. Let's keep it moving.",
  "Awesome, glad to hear it. Cheers.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildWarmupContent(filterTag: string): { subject: string; html: string; token: string } {
  const token = `${filterTag}-${randomUUID().slice(0, 8)}`;
  const subject = `${pick(SUBJECTS)} [${token}]`;
  const html = `<p>${pick(BODIES)}</p>`;
  return { subject, html, token };
}

export function buildWarmupReply(filterTag: string, replyToToken: string): { subject: string; html: string; token: string } {
  const token = `${filterTag}-${randomUUID().slice(0, 8)}`;
  // Keep the original token in the subject so threads stay linkable, add a fresh one.
  const subject = `Re: [${replyToToken}] [${token}]`;
  const html = `<p>${pick(REPLIES)}</p>`;
  return { subject, html, token };
}

// ─── Send loop (cron tick) ────────────────────────────────────────────────────

export interface WarmupTickResult {
  ran: boolean;
  reason?: string;
  sent: number;
  bySender: { from: string; to: string; ok: boolean }[];
}

let lastTick: WarmupTickResult & { at: string } = { ran: false, reason: "not started", sent: 0, bySender: [], at: new Date(0).toISOString() };
export function getLastWarmupTick() {
  return lastTick;
}

export async function runWarmupTick(): Promise<WarmupTickResult> {
  const settings = await getWarmupSettings();
  const finish = (r: WarmupTickResult) => {
    lastTick = { ...r, at: new Date().toISOString() };
    return r;
  };

  if (!settings.enabled) return finish({ ran: false, reason: "warmup disabled", sent: 0, bySender: [] });
  if (settings.provider !== "owned") {
    // External providers run their own engine; nothing for us to send.
    return finish({ ran: false, reason: `provider '${settings.provider}' manages sending`, sent: 0, bySender: [] });
  }

  const members = (await listMembers(true)).filter((m) => m.type === "owned_imap" && !!getMemberPassword(m));
  if (members.length < 2) {
    return finish({ ran: false, reason: "need ≥2 active owned members with passwords", sent: 0, bySender: [] });
  }

  const target = rampTargetForDay(settings);
  if (target <= 0) return finish({ ran: false, reason: "ramp target is 0 today (weekend / not started)", sent: 0, bySender: [] });

  const bySender: { from: string; to: string; ok: boolean }[] = [];
  let sent = 0;

  for (const sender of members) {
    const already = await countSentToday(sender.email);
    if (already >= target) continue;
    // Probabilistic per-tick send so volume is naturally jittered across the day's
    // ticks rather than fired in a burst.
    if (Math.random() > 0.4) continue;

    const recipients = members.filter((m) => m.email !== sender.email);
    const recipient = pick(recipients);
    const { subject, html, token } = buildWarmupContent(settings.filterTag);

    try {
      const res = await sendEmailFromSender(sender.email, recipient.email, subject, html, undefined, undefined, {
        skipSignature: true,
        skipUnsubscribe: true,
      });
      const ok = res.success;
      if (ok) {
        sent++;
        await pool.query(
          `INSERT INTO warmup_sends (id, from_email, to_email, subject, tag, token, landed)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending')`,
          [sender.email, recipient.email, subject, settings.filterTag, token],
        );
      }
      bySender.push({ from: sender.email, to: recipient.email, ok });
    } catch (e: any) {
      bySender.push({ from: sender.email, to: recipient.email, ok: false });
      console.error(`[Warmup] send ${sender.email}→${recipient.email} failed:`, e?.message);
    }
  }

  return finish({ ran: true, sent, bySender });
}

// ─── Health score (nightly) ───────────────────────────────────────────────────

export async function computeWarmupHealth(): Promise<{ mailbox: string; score: number | null; sent: number; inboxed: number; spam: number }[]> {
  const { rows } = await pool.query(
    `SELECT from_email AS mailbox,
       count(*) FILTER (WHERE landed IN ('inbox','tab','spam')) AS considered,
       count(*) FILTER (WHERE landed IN ('inbox','tab')) AS inboxed,
       count(*) FILTER (WHERE landed = 'spam') AS spam,
       count(*) AS sent
     FROM warmup_sends
     WHERE sent_at > now() - interval '7 days'
     GROUP BY from_email`,
  );
  const out: { mailbox: string; score: number | null; sent: number; inboxed: number; spam: number }[] = [];
  for (const r of rows) {
    const considered = Number(r.considered || 0);
    const inboxed = Number(r.inboxed || 0);
    const spam = Number(r.spam || 0);
    const sent = Number(r.sent || 0);
    const score = considered ? +((inboxed / considered) * 100).toFixed(1) : null;
    out.push({ mailbox: r.mailbox, score, sent, inboxed, spam });
    await pool.query(
      `INSERT INTO warmup_health (id, mailbox, day, sent, inboxed, spam, score)
       VALUES (gen_random_uuid(), $1, CURRENT_DATE, $2, $3, $4, $5)
       ON CONFLICT (mailbox, day) DO UPDATE SET sent=EXCLUDED.sent, inboxed=EXCLUDED.inboxed, spam=EXCLUDED.spam, score=EXCLUDED.score`,
      [r.mailbox, sent, inboxed, spam, score],
    );
  }
  return out;
}

// ─── Overview (for the UI) ────────────────────────────────────────────────────

export async function getWarmupOverview() {
  const settings = await getWarmupSettings();
  const members = await listMembers(false);
  const health = await computeWarmupHealth();
  const target = rampTargetForDay(settings);

  const { rows: recent } = await pool.query(
    `SELECT from_email, to_email, subject, landed, sent_at, replied_at, rescued_at, marked_important_at
     FROM warmup_sends ORDER BY sent_at DESC LIMIT 25`,
  );
  const { rows: totals } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE sent_at::date = CURRENT_DATE) AS today,
       count(*) FILTER (WHERE sent_at > now() - interval '7 days') AS week,
       count(*) FILTER (WHERE landed='inbox' AND sent_at > now() - interval '7 days') AS inbox_week,
       count(*) FILTER (WHERE landed='spam' AND sent_at > now() - interval '7 days') AS spam_week,
       count(*) FILTER (WHERE replied_at IS NOT NULL AND sent_at > now() - interval '7 days') AS replied_week
     FROM warmup_sends`,
  );

  // When the provider is Instantly, surface its connected accounts + warmup
  // scores (Instantly's network does the actual warming).
  const instantly = settings.provider === "instantly" ? await getInstantlyOverview().catch(() => null) : null;

  return {
    settings,
    members,
    health,
    instantly,
    todayTarget: target,
    lastTick: getLastWarmupTick(),
    totals: totals[0] || {},
    recent: recent.map((r) => ({
      from: r.from_email,
      to: r.to_email,
      subject: r.subject,
      landed: r.landed,
      sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null,
      repliedAt: r.replied_at ? new Date(r.replied_at).toISOString() : null,
      rescuedAt: r.rescued_at ? new Date(r.rescued_at).toISOString() : null,
      markedImportantAt: r.marked_important_at ? new Date(r.marked_important_at).toISOString() : null,
    })),
  };
}
