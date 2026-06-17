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
  // ─── AI search telemetry ─────────────────────────────────────────────────
  // search_events records every AI/lead search so we can measure quality and
  // tune scoring/prompts. Written fire-and-forget from the search routes.
  `CREATE TABLE IF NOT EXISTS search_events (
    id            varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    surface       text       NOT NULL,
    provider      text,
    query         text,
    filters       jsonb,
    result_count  integer,
    cached        boolean,
    duration_ms   integer,
    user_email    text,
    error         text,
    created_at    timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_search_events_created ON search_events (created_at)`,
  // ─── Semantic CRM search (pgvector) ──────────────────────────────────────
  // Optional: enables "find contacts like this" semantic search over our own
  // CRM. If the DB role can't CREATE EXTENSION, these statements are skipped
  // (logged, non-fatal) and semantic-search.ts falls back to keyword ILIKE.
  `CREATE EXTENSION IF NOT EXISTS vector`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS embedding vector(1536)`,
  // ─── Buying-intent signals (Phase 2) ─────────────────────────────────────
  // lead_signals stores detected intent events (news/relocation/visa-research/
  // business-for-sale…) per contact, folded into ICP scoring. Written by the
  // daily signal-ingestion cron and surfaced as "why now" on contact intel.
  `CREATE TABLE IF NOT EXISTS lead_signals (
    id           varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id   varchar,
    client_id    varchar,
    signal_type  text       NOT NULL,
    source       text       NOT NULL,
    title        text       NOT NULL,
    url          text,
    snippet      text,
    weight       integer    NOT NULL DEFAULT 0,
    detected_at  timestamp  NOT NULL DEFAULT now(),
    created_at   timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lead_signals_contact ON lead_signals (contact_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lead_signals_detected ON lead_signals (detected_at)`,
  // ─── Persisted ICP fit + intent scores (Phase 3) ─────────────────────────
  // Computed by lead-intelligence + signals and refreshed nightly so the CRM
  // can rank/segment stored contacts by ideal-customer fit, not just at search.
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_score integer`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_fit_score integer`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_intent_score integer`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_tier text`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_audience text`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_reasons text[]`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_explanation text`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_scored_at timestamp`,
  // ─── Saved-search monitoring + digests (Phase 5) ─────────────────────────
  // saved_searches persists a reusable ICP watchlist; the daily job re-runs each
  // and records matches in saved_search_matches, surfacing only NEW ones.
  `CREATE TABLE IF NOT EXISTS saved_searches (
    id                 varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    name               text       NOT NULL,
    provider           text       NOT NULL DEFAULT 'seamless',
    mode               text       NOT NULL DEFAULT 'contacts',
    query              text,
    filters            jsonb      NOT NULL DEFAULT '{}'::jsonb,
    active             boolean    NOT NULL DEFAULT true,
    created_by         text,
    last_run_at        timestamp,
    last_result_count  integer,
    last_new_count     integer,
    created_at         timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS saved_search_matches (
    id               varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_search_id  varchar    NOT NULL,
    contact_key      text       NOT NULL,
    full_name        text       NOT NULL,
    job_title        text,
    company          text,
    email            text,
    country          text,
    icp_score        integer    NOT NULL DEFAULT 0,
    icp_tier         text,
    reasons          text[],
    first_seen_at    timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ss_matches_search ON saved_search_matches (saved_search_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ss_matches_unique ON saved_search_matches (saved_search_id, contact_key)`,
  `CREATE INDEX IF NOT EXISTS idx_ss_matches_seen ON saved_search_matches (first_seen_at)`,
  // ─── Guardrailed auto-pilot ──────────────────────────────────────────────
  // A saved search can auto-draft outreach for high-confidence new matches. The
  // drafts land in auto_outreach_queue as 'pending_approval' — they are NEVER
  // auto-sent; a human approves each one.
  `ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS auto_outreach boolean NOT NULL DEFAULT false`,
  `ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS auto_channel text NOT NULL DEFAULT 'email'`,
  `ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS auto_min_score integer NOT NULL DEFAULT 70`,
  `CREATE TABLE IF NOT EXISTS auto_outreach_queue (
    id               varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_search_id  varchar,
    contact_key      text       NOT NULL,
    full_name        text       NOT NULL,
    company          text,
    channel          text       NOT NULL DEFAULT 'email',
    subject          text,
    body             text       NOT NULL,
    icp_score        integer    NOT NULL DEFAULT 0,
    status           text       NOT NULL DEFAULT 'pending_approval',
    created_at       timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auto_queue_status ON auto_outreach_queue (status, created_at)`,
  // CRM client lists — named lists of investor CRM clients. Created here (not just
  // via drizzle-kit push) so the tables exist in prod on the next boot, since the
  // migration CLI is unreachable against Railway's internal network.
  `CREATE TABLE IF NOT EXISTS crm_lists (
    id          varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text       NOT NULL,
    created_at  timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS crm_list_members (
    id         varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id    varchar    NOT NULL REFERENCES crm_lists(id) ON DELETE CASCADE,
    client_id  varchar    NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
    added_at   timestamp  NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_list_member_unique ON crm_list_members (list_id, client_id)`,
  // Mirror link: each CRM list is reflected into a prospect_list so it can be
  // selected as a campaign audience (campaigns enrol prospects, not clients/contacts).
  `ALTER TABLE crm_lists ADD COLUMN IF NOT EXISTS prospect_list_id varchar`,
  // A list member can be a CRM client OR a contact, so the Contacts tab can build
  // lists too. client_id becomes nullable; contact_id is the alternative member ref.
  // contact_id is left FK-free here (the `contacts` table isn't created by this
  // guard, so a hard REFERENCES could no-op on a cold DB); orphans are skipped in code.
  `ALTER TABLE crm_list_members ALTER COLUMN client_id DROP NOT NULL`,
  `ALTER TABLE crm_list_members ADD COLUMN IF NOT EXISTS contact_id varchar`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_list_member_contact_unique ON crm_list_members (list_id, contact_id)`,
  // Mirror prospect recorded per member so removal is exact (see storage.ts).
  `ALTER TABLE crm_list_members ADD COLUMN IF NOT EXISTS prospect_id varchar`,
  // Enforce "exactly one of client_id / contact_id" at the DB level (the app only
  // ever writes one, but this guards the dedup + mirror invariant). Guarded so the
  // boot guard stays idempotent.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_list_member_one_ref') THEN
       ALTER TABLE crm_list_members
         ADD CONSTRAINT crm_list_member_one_ref
         CHECK ((client_id IS NOT NULL) <> (contact_id IS NOT NULL));
     END IF;
   END $$`,
  // Seamless enrichment columns on crm_clients — added here so they exist in prod
  // on the next boot (the migration CLI is unreachable against Railway).
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS enrichment_json jsonb`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS enrichment_source text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS enriched_at timestamp`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email2 text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email3 text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email_confidence integer`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS phone2 text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS phone_type text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS seniority text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS department text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS contact_city text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS contact_state text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_domain text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_website text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_industry text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_staff_count integer`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_staff_range text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_revenue text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_revenue_exact text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_founded text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_type text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_description text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_linkedin_url text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_funding_total text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_city text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_state text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_country text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS time_at_company text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS started_at_current_company text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS job_change_alert text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS stock_ticker text`,
  // Email deliverability flag (Hunter.io verification) — powers the bad-email UI in crm.tsx.
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email_status text`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email_verified_at timestamp`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS email_score integer`,
  `ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS suggested_email text`,
  // Seamless.AI org-contact auto-sync watermark + last-run stats (single row).
  // Lets the scheduled sync (server/seamless-org-sync.ts) resume incrementally
  // across restarts and powers the "last synced …" status in the Contacts UI.
  `CREATE TABLE IF NOT EXISTS seamless_sync_state (
    id              varchar      PRIMARY KEY DEFAULT 'singleton',
    last_sync_at    timestamptz,
    last_run_at     timestamptz,
    last_fetched    integer      NOT NULL DEFAULT 0,
    last_imported   integer      NOT NULL DEFAULT 0,
    last_skipped    integer      NOT NULL DEFAULT 0,
    last_list_added integer      NOT NULL DEFAULT 0,
    last_error      text,
    list_id         varchar,
    updated_at      timestamptz  NOT NULL DEFAULT now()
  )`,
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
