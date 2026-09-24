import { pool } from "../db";
import { ensureCallQueueSchema } from "../call-queue-service";

export const DESK_SCHEMA = `
CREATE TABLE IF NOT EXISTS outreach_desk_profiles (
  queue_id varchar PRIMARY KEY REFERENCES call_queue(id),
  timezone text, linkedin_url text, permissions jsonb NOT NULL DEFAULT '{}',
  claimed_by text, claim_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outreach_desk_email_evidence (
  email text PRIMARY KEY, email_status text, checked_at timestamptz,
  attempted_at timestamptz NOT NULL DEFAULT now(), error text
);
CREATE TABLE IF NOT EXISTS outreach_desk_settings (
  id integer PRIMARY KEY CHECK (id = 1), paused boolean NOT NULL DEFAULT false,
  auto_followups boolean NOT NULL DEFAULT false, daily_limit integer NOT NULL DEFAULT 20 CHECK (daily_limit BETWEEN 1 AND 100),
  last_prepared_at timestamptz, preparation_error text
);
INSERT INTO outreach_desk_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS outreach_desk_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), queue_id varchar NOT NULL REFERENCES call_queue(id),
  operation_id text NOT NULL UNIQUE, channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp','linkedin')),
  recipient text NOT NULL, subject text NOT NULL DEFAULT '', body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','dispatching','accepted','failed','unknown','cancelled','held')),
  scheduled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  approved_by text, provider_id text, error text, dispatch_started_at timestamptz
);
CREATE INDEX IF NOT EXISTS outreach_desk_actions_due ON outreach_desk_actions(status, scheduled_at);
CREATE INDEX IF NOT EXISTS outreach_desk_actions_person ON outreach_desk_actions(queue_id, created_at DESC);
CREATE TABLE IF NOT EXISTS outreach_desk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), queue_id varchar REFERENCES call_queue(id),
  operation_id text UNIQUE, kind text NOT NULL, detail text NOT NULL,
  actor text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_desk_events_person ON outreach_desk_events(queue_id, occurred_at DESC);
CREATE TABLE IF NOT EXISTS outreach_desk_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner text NOT NULL, name text NOT NULL,
  filters jsonb NOT NULL, UNIQUE(owner, name)
);
CREATE INDEX IF NOT EXISTS outreach_desk_sends_email ON drip_sends(lower(trim(recipient_email)));
CREATE INDEX IF NOT EXISTS outreach_desk_queue_email ON call_queue(lower(trim(email)));
`;
let ready: Promise<void> | undefined;
export function ensureDeskSchema(): Promise<void> {
  return (ready ??= (async () => {
    await ensureCallQueueSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(71283041)");
      await client.query(DESK_SCHEMA);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      ready = undefined;
      throw error;
    } finally {
      client.release();
    }
  })());
}
