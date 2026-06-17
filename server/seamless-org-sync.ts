/**
 * seamless-org-sync.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Auto-sync the contacts saved in your Seamless.AI account ("My Contacts") into
 * the main CRM pipeline (the `crm_clients` "CRM" tab) — automatically (on a
 * schedule) and on demand (the "Sync from Seamless" button). From the CRM tab
 * you then hand-assign them to whichever list a campaign should target.
 *
 * WHY THIS EXISTS — and why it lands in ONE place, not per-Seamless-list:
 *   Seamless's public API (verified live against its OpenAPI spec AND the running
 *   endpoint) has:
 *     • NO "Contact Lists" endpoint and NO list/tag membership on the contact
 *       record — so we cannot tell which Seamless list ("GlobeVisa …") a contact
 *       belongs to. GET /contacts ("Get Org Contacts") returns EVERY org contact,
 *       no per-list filter.
 *     • NO webhooks — Seamless can't push to us; we poll.
 *     • A HARD 30-day cap on the [startDate,endDate] window (400 otherwise), so a
 *       longer backfill is walked in ≤29-day chunks (see seamlessGetOrgContacts).
 *   So every org contact flows into the CRM tab; the user buckets them into lists
 *   on our side (CRM tab → "Add to list"), and campaigns pick from those lists.
 *
 * WHAT A SYNC DOES:
 *   1. GET /contacts over a window (full backfill on the first run, then
 *      incremental from a persisted watermark). No research credits are spent —
 *      org contacts are already revealed.
 *   2. Upsert each person into `crm_clients` via the shared CRM dedup
 *      (email → name+company), with the full Seamless enrichment payload, tagged
 *      leadSource "seamless_sync".
 *
 * The watermark + last-run stats live in the `seamless_sync_state` singleton row
 * (created in ensure-schema.ts) so the sync resumes incrementally across restarts
 * and the CRM UI can show "last synced …".
 */

import cron from "node-cron";
import { pool } from "./db";
import { addCrmClientFromSeamless } from "./contact-upsert";
import { seamlessGetOrgContacts } from "./seamless-service";

// ─── Config (env-overridable) ───────────────────────────────────────────────

const CRON_EXPR = process.env.SEAMLESS_SYNC_CRON || "*/5 * * * *"; // every 5 minutes
const BACKFILL_DAYS = Number(process.env.SEAMLESS_SYNC_BACKFILL_DAYS || 730); // first-run lookback
const MAX_PAGES = Number(process.env.SEAMLESS_SYNC_MAX_PAGES || 50); // ×100 = up to 5,000/window
const OVERLAP_HOURS = 48; // re-scan a little before the watermark to catch late updates
const INITIAL_RUN_DELAY_MS = 20_000; // first pull shortly after boot
const LEAD_SOURCE = "seamless_sync";

const isSeamlessConfigured = () => !!process.env.SEAMLESS_API_KEY;

// ─── Persisted state (singleton row) ────────────────────────────────────────

interface SyncState {
  lastSyncAt: Date | null; // watermark: only advances on a clean fetch
  lastRunAt: Date | null;
  lastFetched: number;
  lastImported: number; // newly created crm_clients
  lastSkipped: number; // already in the pipeline (deduped)
  lastError: string | null;
}

function emptyState(): SyncState {
  return {
    lastSyncAt: null,
    lastRunAt: null,
    lastFetched: 0,
    lastImported: 0,
    lastSkipped: 0,
    lastError: null,
  };
}

async function readState(): Promise<SyncState> {
  try {
    const r = await pool.query(`SELECT * FROM seamless_sync_state WHERE id = 'singleton'`);
    const row = r.rows[0];
    if (!row) return emptyState();
    return {
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      lastFetched: Number(row.last_fetched ?? 0),
      lastImported: Number(row.last_imported ?? 0),
      lastSkipped: Number(row.last_skipped ?? 0),
      lastError: row.last_error ?? null,
    };
  } catch (err: any) {
    console.error("[SeamlessSync] readState failed:", err?.message || err);
    return emptyState();
  }
}

async function saveState(s: SyncState): Promise<void> {
  try {
    // last_list_added / list_id columns survive from the earlier list-based design
    // (kept for schema stability) but are no longer used — write 0 / NULL.
    await pool.query(
      `INSERT INTO seamless_sync_state
         (id, last_sync_at, last_run_at, last_fetched, last_imported, last_skipped, last_list_added, last_error, list_id, updated_at)
       VALUES ('singleton', $1, $2, $3, $4, $5, 0, $6, NULL, now())
       ON CONFLICT (id) DO UPDATE SET
         last_sync_at  = EXCLUDED.last_sync_at,
         last_run_at   = EXCLUDED.last_run_at,
         last_fetched  = EXCLUDED.last_fetched,
         last_imported = EXCLUDED.last_imported,
         last_skipped  = EXCLUDED.last_skipped,
         last_error    = EXCLUDED.last_error,
         updated_at    = now()`,
      [s.lastSyncAt, s.lastRunAt, s.lastFetched, s.lastImported, s.lastSkipped, s.lastError],
    );
  } catch (err: any) {
    console.error("[SeamlessSync] saveState failed:", err?.message || err);
  }
}

// ─── Public result shape ────────────────────────────────────────────────────

export interface SeamlessSyncResult {
  ok: boolean;
  fetched: number; // org contacts pulled this run
  imported: number; // newly created in crm_clients (the CRM tab)
  skipped: number; // already in the pipeline (deduped)
  lastSyncAt: string | null;
  lastRunAt: string | null;
  error: string | null;
  note?: string;
}

function resultFromState(s: SyncState): SeamlessSyncResult {
  return {
    ok: !s.lastError,
    fetched: s.lastFetched,
    imported: s.lastImported,
    skipped: s.lastSkipped,
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    error: s.lastError,
  };
}

// ─── The sync ───────────────────────────────────────────────────────────────

let running = false;
let lastResult: SeamlessSyncResult | null = null;

export async function syncSeamlessOrgContacts(opts: { full?: boolean } = {}): Promise<SeamlessSyncResult> {
  if (!isSeamlessConfigured()) {
    return {
      ...resultFromState(emptyState()),
      note: "Seamless.AI is not configured (SEAMLESS_API_KEY missing).",
    };
  }
  if (running) {
    return { ...resultFromState(await readState()), note: "A Seamless sync is already in progress." };
  }

  running = true;
  const now = new Date();
  try {
    const prev = await readState();
    const startDate =
      opts.full || !prev.lastSyncAt
        ? new Date(now.getTime() - BACKFILL_DAYS * 24 * 3600 * 1000)
        : new Date(prev.lastSyncAt.getTime() - OVERLAP_HOURS * 3600 * 1000);

    // Seamless caps each GET /contacts call to a 30-day window, so a long
    // backfill is walked in ≤29-day chunks — size the window cap to the lookback.
    const maxWindows = Math.ceil(BACKFILL_DAYS / 29) + 2;
    const { people, pages, windows, error } = await seamlessGetOrgContacts({
      startDate,
      endDate: now,
      maxPages: MAX_PAGES,
      maxWindows,
    });

    // Upsert each org contact into the CRM tab (crm_clients), deduped by
    // email → name+company. Existing clients are left untouched.
    let imported = 0;
    let skipped = 0;
    for (const p of people) {
      try {
        const r = await addCrmClientFromSeamless(p, { leadSource: LEAD_SOURCE });
        if (r.status === "created") imported++;
        else skipped++;
      } catch (err: any) {
        console.error("[SeamlessSync] crm_client upsert failed:", err?.message || err);
      }
    }

    const errMsg = error ? `${error.code}: ${error.message}` : null;
    const state: SyncState = {
      // Only advance the watermark when the whole window fetched cleanly; on a
      // partial/errored fetch we keep the old watermark so the next run retries it.
      lastSyncAt: errMsg ? prev.lastSyncAt : now,
      lastRunAt: now,
      lastFetched: people.length,
      lastImported: imported,
      lastSkipped: skipped,
      lastError: errMsg,
    };
    await saveState(state);

    console.log(
      `[SeamlessSync] ${people.length} org contacts fetched (${pages} pg / ${windows} window${windows !== 1 ? "s" : ""}) → ${imported} new in CRM, ${skipped} already in pipeline${errMsg ? ` · error: ${errMsg}` : ""}`,
    );
    lastResult = resultFromState(state);
    return lastResult;
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[SeamlessSync] run failed:", msg);
    const prev = await readState();
    await saveState({ ...prev, lastRunAt: now, lastError: msg });
    lastResult = {
      ok: false,
      fetched: 0,
      imported: 0,
      skipped: 0,
      lastSyncAt: prev.lastSyncAt?.toISOString() ?? null,
      lastRunAt: now.toISOString(),
      error: msg,
    };
    return lastResult;
  } finally {
    running = false;
  }
}

// ─── Status (for the UI) ────────────────────────────────────────────────────

export function getSeamlessSyncConfig(): { configured: boolean; cron: string; running: boolean } {
  return { configured: isSeamlessConfigured(), cron: CRON_EXPR, running };
}

export async function getSeamlessSyncState(): Promise<SeamlessSyncResult> {
  return resultFromState(await readState());
}

// ─── Scheduling (called once at boot) ───────────────────────────────────────

let scheduled = false;

export function scheduleSeamlessOrgSync(): void {
  if (scheduled) return;
  scheduled = true;

  if (!isSeamlessConfigured()) {
    console.log("[SeamlessSync] SEAMLESS_API_KEY not set — org-contact sync idle until it's configured (then restart)");
    return;
  }

  cron.schedule(CRON_EXPR, () => {
    syncSeamlessOrgContacts().catch((e) => console.error("[SeamlessSync] scheduled run failed:", e?.message || e));
  });
  console.log(`[SeamlessSync] org-contact sync scheduled (${CRON_EXPR}) → CRM tab (crm_clients)`);

  // Kick an initial run shortly after boot so the CRM populates without waiting
  // for the first cron tick (the first ever run does a full backfill).
  setTimeout(() => {
    syncSeamlessOrgContacts().catch((e) => console.error("[SeamlessSync] initial run failed:", e?.message || e));
  }, INITIAL_RUN_DELAY_MS);
}
