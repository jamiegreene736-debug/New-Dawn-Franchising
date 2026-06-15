/**
 * search-telemetry.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Fire-and-forget logging of every AI search so we can measure quality and
 * tune scoring/prompts over time: what was searched, how it was parsed, which
 * provider ran, how many results came back, and (later) how many converted to
 * contacts / replies / meetings.
 *
 * Writes to the `search_events` table created idempotently in ensure-schema.ts.
 * Never throws into the request path — logging failures are swallowed.
 */

import { pool } from "./db";

export interface SearchEvent {
  surface: "agent" | "seamless-panel" | "crm-semantic";
  provider?: string | null;
  query?: string | null;            // raw natural-language query, if any
  filters?: unknown;                // parsed/applied structured filters
  resultCount?: number | null;
  cached?: boolean | null;
  durationMs?: number | null;
  userEmail?: string | null;
  error?: string | null;
}

export async function logSearchEvent(ev: SearchEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO search_events
         (surface, provider, query, filters, result_count, cached, duration_ms, user_email, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        ev.surface,
        ev.provider ?? null,
        ev.query ?? null,
        ev.filters != null ? JSON.stringify(ev.filters) : null,
        ev.resultCount ?? null,
        ev.cached ?? null,
        ev.durationMs ?? null,
        ev.userEmail ?? null,
        ev.error ?? null,
      ],
    );
  } catch (err: any) {
    // Telemetry must never break search. Log once and move on.
    console.error("[search-telemetry] insert skipped:", err?.message || err);
  }
}
