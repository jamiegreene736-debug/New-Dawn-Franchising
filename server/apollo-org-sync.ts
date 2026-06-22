/**
 * apollo-org-sync.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Auto-sync contacts saved in your Apollo.io account into the CRM tab
 * (`crm_clients`) and mirror Apollo lists ("labels") into CRM lists so they
 * appear in the Campaigns tab audience picker.
 *
 * Flow:
 *   1. GET /labels — fetch Apollo contact lists
 *   2. POST /contacts/search — paginate all saved contacts
 *   3. Upsert each contact into crm_clients (deduped)
 *   4. For each contact's label_ids, ensure a CRM list named "Apollo · {name}"
 *      exists and add the client (mirrored to prospect_lists for campaigns)
 */

import cron from "node-cron";
import { pool } from "./db";
import { storage } from "./storage";
import { addCrmClientFromApollo } from "./contact-upsert";
import { apolloGetLabels, apolloGetOrgContacts, apolloConfigured } from "./apollo-service";
import type { SeamlessPerson } from "./seamless-service";

const CRON_EXPR = process.env.APOLLO_SYNC_CRON || "*/15 * * * *";
const INITIAL_RUN_DELAY_MS = 25_000;
const LEAD_SOURCE = "apollo_sync";
const LIST_PREFIX = "Apollo · ";

function labelIdsFromPerson(p: SeamlessPerson): string[] {
  const raw = p.raw as { apolloLabelIds?: unknown } | null | undefined;
  const ids = raw?.apolloLabelIds;
  if (!Array.isArray(ids)) return [];
  return ids.map(String).filter(Boolean);
}

interface SyncState {
  lastSyncAt: Date | null;
  lastRunAt: Date | null;
  lastFetched: number;
  lastImported: number;
  lastSkipped: number;
  lastListAdded: number;
  lastError: string | null;
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
  };
}

async function readState(): Promise<SyncState> {
  try {
    const r = await pool.query(`SELECT * FROM apollo_sync_state WHERE id = 'singleton'`);
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
    };
  } catch (err: any) {
    console.error("[ApolloSync] readState failed:", err?.message || err);
    return emptyState();
  }
}

async function saveState(s: SyncState): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO apollo_sync_state
         (id, last_sync_at, last_run_at, last_fetched, last_imported, last_skipped, last_list_added, last_error, updated_at)
       VALUES ('singleton', $1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (id) DO UPDATE SET
         last_sync_at    = EXCLUDED.last_sync_at,
         last_run_at     = EXCLUDED.last_run_at,
         last_fetched    = EXCLUDED.last_fetched,
         last_imported   = EXCLUDED.last_imported,
         last_skipped    = EXCLUDED.last_skipped,
         last_list_added = EXCLUDED.last_list_added,
         last_error      = EXCLUDED.last_error,
         updated_at      = now()`,
      [s.lastSyncAt, s.lastRunAt, s.lastFetched, s.lastImported, s.lastSkipped, s.lastListAdded, s.lastError],
    );
  } catch (err: any) {
    console.error("[ApolloSync] saveState failed:", err?.message || err);
  }
}

export interface ApolloSyncResult {
  ok: boolean;
  fetched: number;
  imported: number;
  skipped: number;
  listAdded: number;
  lastSyncAt: string | null;
  lastRunAt: string | null;
  error: string | null;
  note?: string;
}

function resultFromState(s: SyncState): ApolloSyncResult {
  return {
    ok: !s.lastError,
    fetched: s.lastFetched,
    imported: s.lastImported,
    skipped: s.lastSkipped,
    listAdded: s.lastListAdded,
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    error: s.lastError,
  };
}

/** Find an existing CRM list by exact name, or create one (with prospect_list mirror). */
async function findOrCreateCrmListByName(name: string): Promise<string> {
  const lists = await storage.getCrmLists();
  const hit = lists.find((l) => l.name === name);
  if (hit) return hit.id;
  const created = await storage.createCrmList(name);
  return created.id;
}

let running = false;

export async function syncApolloOrgContacts(_opts: { full?: boolean } = {}): Promise<ApolloSyncResult> {
  if (!apolloConfigured()) {
    return {
      ...resultFromState(emptyState()),
      note: "Apollo.io is not configured (APOLLO_API_KEY missing).",
    };
  }
  if (running) {
    return { ...resultFromState(await readState()), note: "An Apollo sync is already in progress." };
  }

  running = true;
  const now = new Date();
  try {
    const { labels, error: labelError } = await apolloGetLabels();
    const labelNameById = new Map<string, string>();
    for (const l of labels) {
      const m = (l.modality || "").toLowerCase();
      if (m && m !== "contacts" && m !== "contact") continue;
      labelNameById.set(l.id, l.name);
    }

    const { people, error: fetchError } = await apolloGetOrgContacts({});
    const errMsg = fetchError
      ? `${fetchError.code}: ${fetchError.message}`
      : labelError && people.length === 0
        ? `${labelError.code}: ${labelError.message}`
        : null;

    let imported = 0;
    let skipped = 0;
    let listAdded = 0;
    const listIdCache = new Map<string, string>();

    for (const p of people) {
      try {
        const r = await addCrmClientFromApollo(p, { leadSource: LEAD_SOURCE });
        if (r.status === "created") imported++;
        else skipped++;

        const labelIds = labelIdsFromPerson(p);
        if (labelIds.length === 0) continue;

        for (const labelId of labelIds) {
          const labelName = labelNameById.get(labelId);
          if (!labelName) continue;
          const listName = `${LIST_PREFIX}${labelName}`;
          let listId = listIdCache.get(listName);
          if (!listId) {
            listId = await findOrCreateCrmListByName(listName);
            listIdCache.set(listName, listId);
          }
          const added = await storage.addClientsToList(listId, [r.client.id]);
          listAdded += added;
        }
      } catch (err: any) {
        console.error("[ApolloSync] contact upsert failed:", err?.message || err);
      }
    }

    const state: SyncState = {
      lastSyncAt: errMsg ? (await readState()).lastSyncAt : now,
      lastRunAt: now,
      lastFetched: people.length,
      lastImported: imported,
      lastSkipped: skipped,
      lastListAdded: listAdded,
      lastError: errMsg,
    };
    await saveState(state);

    console.log(
      `[ApolloSync] ${people.length} contacts fetched → ${imported} new in CRM, ${skipped} already here, ${listAdded} list memberships added${errMsg ? ` · error: ${errMsg}` : ""}`,
    );
    return resultFromState(state);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[ApolloSync] run failed:", msg);
    const prev = await readState();
    await saveState({ ...prev, lastRunAt: now, lastError: msg });
    return {
      ok: false,
      fetched: 0,
      imported: 0,
      skipped: 0,
      listAdded: 0,
      lastSyncAt: prev.lastSyncAt?.toISOString() ?? null,
      lastRunAt: now.toISOString(),
      error: msg,
    };
  } finally {
    running = false;
  }
}

export function getApolloSyncConfig(): { configured: boolean; cron: string; running: boolean } {
  return { configured: apolloConfigured(), cron: CRON_EXPR, running };
}

export async function getApolloSyncState(): Promise<ApolloSyncResult> {
  return resultFromState(await readState());
}

let scheduled = false;

export function scheduleApolloOrgSync(): void {
  if (scheduled) return;
  scheduled = true;

  if (!apolloConfigured()) {
    console.log("[ApolloSync] APOLLO_API_KEY not set — org-contact sync idle until configured");
    return;
  }

  cron.schedule(CRON_EXPR, () => {
    syncApolloOrgContacts().catch((e) => console.error("[ApolloSync] scheduled run failed:", e?.message || e));
  });
  console.log(`[ApolloSync] org-contact sync scheduled (${CRON_EXPR}) → CRM + lists`);

  setTimeout(() => {
    syncApolloOrgContacts().catch((e) => console.error("[ApolloSync] initial run failed:", e?.message || e));
  }, INITIAL_RUN_DELAY_MS);
}
