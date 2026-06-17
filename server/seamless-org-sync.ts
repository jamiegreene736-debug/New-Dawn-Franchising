/**
 * seamless-org-sync.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Auto-sync the contacts saved in your Seamless.AI account ("My Contacts") into
 * the CRM and a campaign-selectable saved list — automatically (on a schedule)
 * and on demand (the "Sync from Seamless" button).
 *
 * WHY THIS EXISTS — and why "instant push" is a poll, not a webhook:
 *   Seamless's public API (verified against its OpenAPI spec) has:
 *     • NO "Contact Lists" endpoint — you cannot read a single named list
 *       (e.g. "GlobeVisa …") on its own. The only read of your saved contacts is
 *       GET /contacts ("Get Org Contacts"), which returns EVERY org contact in a
 *       [startDate, endDate] window, paginated, with no per-list filter.
 *     • NO webhooks — nothing to subscribe to, so Seamless can't push to us.
 *   The closest thing to "always pushes instantly" is therefore a frequent POLL
 *   of GET /contacts plus a manual "Sync now". Reading org contacts consumes NO
 *   research credits (the records are already revealed).
 *
 * WHAT A SYNC DOES:
 *   1. GET /contacts over a window (full backfill on the first run, then
 *      incremental from a persisted watermark).
 *   2. Upsert each person into `contacts` via the shared contact-upsert dedup
 *      (email → personal LinkedIn → name+company), tagged source "Seamless Sync".
 *   3. Add them all to ONE dedicated CRM list. Because every CRM list mirrors 1:1
 *      into a prospect_list, that list immediately appears in the campaign
 *      audience picker — populated and enrollable.
 *
 * The watermark + last-run stats live in the `seamless_sync_state` singleton row
 * (created in ensure-schema.ts) so the sync resumes incrementally across
 * restarts and the Contacts UI can show "last synced …".
 */

import cron from "node-cron";
import { pool } from "./db";
import { storage } from "./storage";
import { addProspectContact, type ProspectContactInput } from "./contact-upsert";
import { seamlessGetOrgContacts, type SeamlessPerson } from "./seamless-service";

// ─── Config (env-overridable) ───────────────────────────────────────────────

const LIST_NAME = process.env.SEAMLESS_SYNC_LIST_NAME || "Seamless — Synced Contacts";
const CRON_EXPR = process.env.SEAMLESS_SYNC_CRON || "*/5 * * * *"; // every 5 minutes
const BACKFILL_DAYS = Number(process.env.SEAMLESS_SYNC_BACKFILL_DAYS || 730); // first-run lookback
const MAX_PAGES = Number(process.env.SEAMLESS_SYNC_MAX_PAGES || 50); // ×100 = up to 5,000/run
const OVERLAP_HOURS = 48; // re-scan a little before the watermark to catch late updates
const INITIAL_RUN_DELAY_MS = 20_000; // first pull shortly after boot

const isSeamlessConfigured = () => !!process.env.SEAMLESS_API_KEY;

// ─── Persisted state (singleton row) ────────────────────────────────────────

interface SyncState {
  lastSyncAt: Date | null; // watermark: only advances on a clean fetch
  lastRunAt: Date | null;
  lastFetched: number;
  lastImported: number;
  lastSkipped: number;
  lastListAdded: number;
  lastError: string | null;
  listId: string | null;
}

function emptyState(): SyncState {
  return {
    lastSyncAt: null,
    lastRunAt: null,
    lastFetched: 0,
    lastImported: 0,
    lastSkipped: 0,
    lastListAdded: 0,
    lastError: null,
    listId: null,
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
      lastListAdded: Number(row.last_list_added ?? 0),
      lastError: row.last_error ?? null,
      listId: row.list_id ?? null,
    };
  } catch (err: any) {
    console.error("[SeamlessSync] readState failed:", err?.message || err);
    return emptyState();
  }
}

async function saveState(s: SyncState): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO seamless_sync_state
         (id, last_sync_at, last_run_at, last_fetched, last_imported, last_skipped, last_list_added, last_error, list_id, updated_at)
       VALUES ('singleton', $1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         last_sync_at    = EXCLUDED.last_sync_at,
         last_run_at     = EXCLUDED.last_run_at,
         last_fetched    = EXCLUDED.last_fetched,
         last_imported   = EXCLUDED.last_imported,
         last_skipped    = EXCLUDED.last_skipped,
         last_list_added = EXCLUDED.last_list_added,
         last_error      = EXCLUDED.last_error,
         list_id         = EXCLUDED.list_id,
         updated_at      = now()`,
      [s.lastSyncAt, s.lastRunAt, s.lastFetched, s.lastImported, s.lastSkipped, s.lastListAdded, s.lastError, s.listId],
    );
  } catch (err: any) {
    console.error("[SeamlessSync] saveState failed:", err?.message || err);
  }
}

// ─── Public result shape ────────────────────────────────────────────────────

export interface SeamlessSyncResult {
  ok: boolean;
  fetched: number; // org contacts pulled this run
  imported: number; // newly created in `contacts`
  skipped: number; // already existed (deduped)
  listAdded: number; // newly added to the synced list (mirrored to prospects)
  listId: string | null;
  listName: string;
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
    listAdded: s.lastListAdded,
    listId: s.listId,
    listName: LIST_NAME,
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    error: s.lastError,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toProspectInput(p: SeamlessPerson): ProspectContactInput {
  return {
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    companyName: p.company,
    email: p.email,
    phone: p.phone,
    linkedinUrl: p.linkedinUrl,
    jobTitle: p.jobTitle,
    country: p.country,
    city: p.city,
  };
}

/** Find the dedicated sync list by name (case-insensitive), creating it if new. */
async function findOrCreateSyncList(): Promise<string> {
  const want = LIST_NAME.trim().toLowerCase();
  const lists = await storage.getCrmLists();
  const found = lists.find((l) => (l.name || "").trim().toLowerCase() === want);
  if (found) return found.id;
  const created = await storage.createCrmList(LIST_NAME);
  return created.id;
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

    // 1) Upsert into `contacts` (deduped). Collect EVERY id — created or existing —
    //    so previously-imported people are (re-)ensured into the list too.
    let imported = 0;
    let skipped = 0;
    const contactIds: string[] = [];
    for (const p of people) {
      try {
        const r = await addProspectContact(toProspectInput(p), undefined, { source: "Seamless Sync" });
        if (r.status === "created") imported++;
        else skipped++;
        contactIds.push(r.contact.id);
      } catch (err: any) {
        console.error("[SeamlessSync] contact upsert failed:", err?.message || err);
      }
    }

    // 2) Mirror into the dedicated CRM list → campaign-selectable prospect_list.
    let listAdded = 0;
    let listId = prev.listId;
    if (contactIds.length) {
      listId = await findOrCreateSyncList();
      listAdded = await storage.addContactsToList(listId, contactIds);
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
      lastListAdded: listAdded,
      lastError: errMsg,
      listId,
    };
    await saveState(state);

    console.log(
      `[SeamlessSync] ${people.length} org contacts fetched (${pages} pg / ${windows} window${windows !== 1 ? "s" : ""}) → ${imported} new, ${skipped} existing, ${listAdded} added to "${LIST_NAME}"${errMsg ? ` · error: ${errMsg}` : ""}`,
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
      listAdded: 0,
      listId: prev.listId,
      listName: LIST_NAME,
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

export function getSeamlessSyncConfig(): {
  configured: boolean;
  listName: string;
  cron: string;
  running: boolean;
} {
  return { configured: isSeamlessConfigured(), listName: LIST_NAME, cron: CRON_EXPR, running };
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
  console.log(`[SeamlessSync] org-contact sync scheduled (${CRON_EXPR}) → list "${LIST_NAME}"`);

  // Kick an initial run shortly after boot so the list populates without waiting
  // for the first cron tick (the first ever run does a full backfill).
  setTimeout(() => {
    syncSeamlessOrgContacts().catch((e) => console.error("[SeamlessSync] initial run failed:", e?.message || e));
  }, INITIAL_RUN_DELAY_MS);
}
