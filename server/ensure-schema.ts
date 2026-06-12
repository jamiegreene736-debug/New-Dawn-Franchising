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
  for (const table of ["blog_posts", "brokers", "session"]) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`[ensure-schema] ${table} is ready (${r.rows[0].n} rows)`);
    } catch (err: any) {
      console.error(`[ensure-schema] ${table} is NOT ready: ${err?.message}`);
    }
  }
}
