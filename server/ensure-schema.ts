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

  // Verify the table is queryable so the boot logs give a definitive answer.
  try {
    const r = await pool.query(`SELECT count(*)::int AS n FROM blog_posts`);
    console.log(`[ensure-schema] blog_posts is ready (${r.rows[0].n} rows)`);
  } catch (err: any) {
    console.error(`[ensure-schema] blog_posts is NOT ready: ${err?.message}`);
  }
}
