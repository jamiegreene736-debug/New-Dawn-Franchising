import { pool } from "./db";

/**
 * Idempotent schema guard run at server startup.
 *
 * The app reaches Postgres over Railway's internal network, so this is the most
 * reliable place to ensure the `blog_posts` table exists (the public TCP proxy
 * and CLI were unreachable for running a migration manually). Every statement is
 * `IF NOT EXISTS` / `ADD COLUMN`, so it only creates the table or adds missing
 * columns — it never drops or modifies existing data, and is safe to run on
 * every boot.
 */
const STATEMENTS: string[] = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id              varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text       NOT NULL,
    slug            text       NOT NULL UNIQUE,
    excerpt         text       NOT NULL,
    content         text       NOT NULL,
    cover_image_url text,
    generated_by_ai text       DEFAULT 'true',
    published_at    timestamp  NOT NULL DEFAULT now(),
    created_at      timestamp  NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_url text`,
  `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS generated_by_ai text DEFAULT 'true'`,
  `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS published_at timestamp NOT NULL DEFAULT now()`,
  `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`,
  // `brokers` backs the admin/broker login. A missing table or column makes
  // getBrokerByEmail() throw, which surfaces as a 500 "Login failed".
  `CREATE TABLE IF NOT EXISTS brokers (
    id                  varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           text       NOT NULL,
    email               text       NOT NULL UNIQUE,
    phone               text,
    company             text,
    password_hash       text       NOT NULL,
    agreement_signed    boolean    NOT NULL DEFAULT false,
    agreement_signed_at timestamp,
    agreement_pdf       text,
    created_at          timestamp  NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS company text`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS agreement_signed boolean NOT NULL DEFAULT false`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS agreement_signed_at timestamp`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS agreement_pdf text`,
  `ALTER TABLE brokers ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`,
  // `session` backs express-session (connect-pg-simple). We create it here via
  // raw SQL rather than connect-pg-simple's `createTableIfMissing`, because that
  // option reads a bundled `table.sql` asset at runtime which esbuild does not
  // emit into dist/ — it throws ENOENT and breaks every login. This schema
  // matches connect-pg-simple's default table exactly.
  `CREATE TABLE IF NOT EXISTS "session" (
    "sid"    varchar       NOT NULL,
    "sess"   json          NOT NULL,
    "expire" timestamp(6)  NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`,
  // `heygen_videos` backs the HeyGen video pipeline. A missing table makes the
  // every-3-minute poll cron (pollAllRenderingVideos) throw `relation
  // "heygen_videos" does not exist` on each run. Columns mirror the Drizzle
  // `heygenVideos` table in shared/schema.ts exactly.
  `CREATE TABLE IF NOT EXISTS heygen_videos (
    id                   varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id              varchar    NOT NULL,
    lead_name            text,
    lead_email           text,
    lead_phone           text,
    franchisee_id        varchar,
    script               text       NOT NULL,
    heygen_video_id      varchar,
    status               varchar    NOT NULL DEFAULT 'pending',
    video_url            text,
    thumbnail_url        text,
    tracking_token       varchar    UNIQUE DEFAULT gen_random_uuid(),
    tracking_url         text,
    delivery_channel     varchar    DEFAULT 'email',
    delivery_status      varchar    NOT NULL DEFAULT 'not_sent',
    sent_at              timestamp,
    clicked_at           timestamp,
    render_started_at    timestamp,
    render_completed_at  timestamp,
    render_duration_sec  integer,
    daily_batch_id       varchar,
    script_template_id   varchar,
    subject_line         text,
    email_body           text,
    error_message        text,
    created_at           timestamp  NOT NULL DEFAULT now(),
    updated_at           timestamp  NOT NULL DEFAULT now()
  )`,
  // ─── Multi-channel sequence builder ──────────────────────────────────────
  // drip_steps gains a channel/type, a display name, and a priority so the
  // Seamless-style builder can render day-grouped email / SMS / call / LinkedIn steps.
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'email'`,
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS step_name text`,
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS priority text`,
  // ─── Two-way Gmail (franchising@) sync ───────────────────────────────────
  // crm_direct_emails stores inbound replies alongside outbound sends in one thread.
  `ALTER TABLE crm_direct_emails ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound'`,
  `ALTER TABLE crm_direct_emails ADD COLUMN IF NOT EXISTS message_id text`,
  // ─── Tasks from manual drip steps ────────────────────────────────────────
  // Drip call/LinkedIn steps create tasks against a prospect (not an attorney contact),
  // so contact_id must allow NULL and we add prospect_id + subtitle.
  `ALTER TABLE contact_tasks ALTER COLUMN contact_id DROP NOT NULL`,
  `ALTER TABLE contact_tasks ADD COLUMN IF NOT EXISTS prospect_id varchar`,
  `ALTER TABLE contact_tasks ADD COLUMN IF NOT EXISTS subtitle text`,
  // ─── Email link-click tracking ───────────────────────────────────────────
  // Every email is tracked for opens (pixel) and now link clicks (redirect).
  `ALTER TABLE drip_sends ADD COLUMN IF NOT EXISTS clicked_at timestamp`,
  `ALTER TABLE drip_sends ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0`,
  // ─── Unified Activity feed ───────────────────────────────────────────────
  // Every drip touch records its channel so the Activity tab can show & filter
  // email / SMS / LinkedIn / call / task touches side-by-side.
  `ALTER TABLE drip_sends ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email'`,
  `ALTER TABLE crm_direct_emails ADD COLUMN IF NOT EXISTS clicked_at timestamp`,
  `ALTER TABLE crm_direct_emails ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0`,
  // Automation triggers on campaign steps
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'time'`,
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS trigger_ref_step integer`,
  `ALTER TABLE drip_steps ADD COLUMN IF NOT EXISTS trigger_window_hours integer`,
  // ─── Two-track outreach (broker referral pitch vs direct-to-client pitch) ──
  // drip_campaigns carries which audience track its steps speak to; the bulk
  // launcher and the seeded Grok campaigns both set it. Existing campaigns are
  // broker outreach, so the backfill default is 'broker'.
  `ALTER TABLE drip_campaigns ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'broker'`,
  // outreach_leads carries which sequence track a lead is enrolled on, so the
  // automated engine can run the broker OR the client variant for the same lead
  // pool. Defaults to 'broker' to preserve existing behavior.
  `ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS sequence_track text NOT NULL DEFAULT 'broker'`,
];

export async function ensureSchema(): Promise<void> {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      // Non-fatal: e.g. CREATE EXTENSION may lack privileges, but gen_random_uuid()
      // is built into Postgres 13+ so the table still creates fine. Log and continue.
      console.error(`[ensure-schema] statement skipped (${err?.message}):`, sql.split("\n")[0].trim());
    }
  }

  // Verify the tables are queryable so the boot logs give a definitive answer.
  for (const table of ["blog_posts", "brokers", "session", "heygen_videos"]) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`[ensure-schema] ${table} is ready (${r.rows[0].n} rows)`);
    } catch (err: any) {
      console.error(`[ensure-schema] ${table} is NOT ready: ${err?.message}`);
    }
  }
}
