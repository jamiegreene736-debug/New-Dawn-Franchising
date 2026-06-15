/**
 * saved-searches.ts  (Phase 5 — saved-search monitoring + digests)
 * ───────────────────────────────────────────────────────────────────────────
 * Persists an AI search as a reusable "ICP watchlist". A daily job re-runs each
 * active saved search, scores the results, and detects NEW matches since the
 * last run — the always-on, signal-driven prospecting an Alta-Katie-style SDR
 * provides. New high-intent matches roll up into a digest the team can action.
 *
 * Backed by `saved_searches` + `saved_search_matches` (created idempotently in
 * ensure-schema). Reuses cachedProviderSearch + the ICP intel already attached
 * to each contact, so scoring stays consistent with interactive search.
 */

import { pool } from "./db";
import { cachedProviderSearch } from "./search-cache";
import { parseNaturalLanguageToFilters, type LeadSearchFilters, type ProviderId } from "./seamless-prospects";
import type { EnrichedContact } from "./prospect-enrichment";
import { logSearchEvent } from "./search-telemetry";

export interface SavedSearch {
  id: string;
  name: string;
  provider: ProviderId;
  mode: "contacts" | "companies";
  query: string | null;
  filters: LeadSearchFilters;
  active: boolean;
  createdBy: string | null;
  lastRunAt: string | null;
  lastResultCount: number | null;
  lastNewCount: number | null;
  createdAt: string;
}

function rowToSaved(r: any): SavedSearch {
  return {
    id: r.id, name: r.name, provider: r.provider, mode: r.mode,
    query: r.query ?? null, filters: (r.filters as LeadSearchFilters) || {},
    active: !!r.active, createdBy: r.createdBy ?? null,
    lastRunAt: r.lastRunAt ?? null, lastResultCount: r.lastResultCount ?? null,
    lastNewCount: r.lastNewCount ?? null, createdAt: r.createdAt,
  };
}

const COLS = `id, name, provider, mode, query, filters, active, created_by AS "createdBy",
  last_run_at AS "lastRunAt", last_result_count AS "lastResultCount",
  last_new_count AS "lastNewCount", created_at AS "createdAt"`;

export async function createSavedSearch(input: {
  name: string; provider?: string; mode?: string; query?: string | null;
  filters?: LeadSearchFilters; createdBy?: string | null;
}): Promise<SavedSearch> {
  const provider: ProviderId = input.provider === "apollo" || input.provider === "origami" ? input.provider : "seamless";
  const mode = input.mode === "companies" ? "companies" : "contacts";
  const { rows } = await pool.query(
    `INSERT INTO saved_searches (name, provider, mode, query, filters, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
    [input.name.trim() || "Untitled search", provider, mode, input.query?.trim() || null,
     JSON.stringify(input.filters || {}), input.createdBy ?? null],
  );
  return rowToSaved(rows[0]);
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const { rows } = await pool.query(`SELECT ${COLS} FROM saved_searches ORDER BY created_at DESC`);
  return rows.map(rowToSaved);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await pool.query(`DELETE FROM saved_search_matches WHERE saved_search_id = $1`, [id]);
  await pool.query(`DELETE FROM saved_searches WHERE id = $1`, [id]);
}

export interface SavedMatch {
  contactKey: string;
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  email: string | null;
  country: string | null;
  icpScore: number;
  icpTier: string;
  reasons: string[];
}

function contactToMatch(c: EnrichedContact): SavedMatch {
  return {
    contactKey: (c.email || `${c.fullName}|${c.companyName}`).toLowerCase(),
    fullName: c.fullName,
    jobTitle: c.jobTitle ?? null,
    company: c.companyName ?? null,
    email: c.email ?? null,
    country: c.companyLocation ?? null,
    icpScore: c.icpScore ?? 0,
    icpTier: c.icpTier ?? "low",
    reasons: c.icpReasons ?? [],
  };
}

/**
 * Run one saved search: execute it, score, and persist any matches not seen
 * before. Returns the new matches (highest ICP score first).
 */
export async function runSavedSearch(id: string): Promise<{ total: number; newMatches: SavedMatch[] }> {
  const { rows } = await pool.query(`SELECT ${COLS} FROM saved_searches WHERE id = $1`, [id]);
  if (rows.length === 0) throw new Error("Saved search not found");
  const s = rowToSaved(rows[0]);

  // Merge any stored NL query into the filters, like the interactive route does.
  let filters: LeadSearchFilters = { ...s.filters };
  if (s.query) {
    const parsed = await parseNaturalLanguageToFilters(s.query);
    filters = { ...parsed, ...s.filters };
  }

  const started = Date.now();
  const result = await cachedProviderSearch(s.provider, s.mode, filters, { limit: 50 });
  const contacts: EnrichedContact[] = (result.companies || []).flatMap((c) => c.contacts || []);
  const matches = contacts.map(contactToMatch);

  // Persist matches; INSERT ... WHERE NOT EXISTS returns only the brand-new ones.
  const newMatches: SavedMatch[] = [];
  for (const m of matches) {
    const ins = await pool.query(
      `INSERT INTO saved_search_matches
         (saved_search_id, contact_key, full_name, job_title, company, email, country, icp_score, icp_tier, reasons)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       WHERE NOT EXISTS (
         SELECT 1 FROM saved_search_matches WHERE saved_search_id = $1 AND contact_key = $2
       )`,
      [id, m.contactKey, m.fullName, m.jobTitle, m.company, m.email, m.country, m.icpScore, m.icpTier, m.reasons],
    );
    if ((ins.rowCount ?? 0) > 0) newMatches.push(m);
  }
  newMatches.sort((a, b) => b.icpScore - a.icpScore);

  await pool.query(
    `UPDATE saved_searches SET last_run_at = now(), last_result_count = $2, last_new_count = $3 WHERE id = $1`,
    [id, matches.length, newMatches.length],
  );
  void logSearchEvent({
    surface: "seamless-panel", provider: s.provider, query: s.query, filters,
    resultCount: matches.length, cached: result.cached ?? null, durationMs: Date.now() - started,
  });

  return { total: matches.length, newMatches };
}

export interface DigestEntry {
  savedSearch: SavedSearch;
  newMatches: SavedMatch[];
}

/** Run every active saved search and collect the new matches into a digest. */
export async function runAllSavedSearches(): Promise<{ digest: DigestEntry[]; totalNew: number }> {
  const all = (await listSavedSearches()).filter((s) => s.active);
  const digest: DigestEntry[] = [];
  let totalNew = 0;
  for (const s of all) {
    try {
      const { newMatches } = await runSavedSearch(s.id);
      if (newMatches.length > 0) {
        digest.push({ savedSearch: s, newMatches });
        totalNew += newMatches.length;
      }
    } catch (err: any) {
      console.error(`[saved-searches] run failed for ${s.name}:`, err?.message || err);
    }
  }
  console.log(`[saved-searches] daily run complete — ${all.length} searches, ${totalNew} new matches.`);
  return { digest, totalNew };
}

/** Recent new matches across all saved searches (for the digest inbox). */
export async function getRecentDigest(hours = 24): Promise<DigestEntry[]> {
  const all = await listSavedSearches();
  const byId = new Map(all.map((s) => [s.id, s]));
  const { rows } = await pool.query(
    `SELECT saved_search_id AS "savedSearchId", contact_key AS "contactKey", full_name AS "fullName",
            job_title AS "jobTitle", company, email, country, icp_score AS "icpScore",
            icp_tier AS "icpTier", reasons
       FROM saved_search_matches
      WHERE first_seen_at > now() - ($1 || ' hours')::interval
      ORDER BY icp_score DESC`,
    [String(hours)],
  );
  const grouped = new Map<string, SavedMatch[]>();
  for (const r of rows as any[]) {
    const arr = grouped.get(r.savedSearchId) ?? [];
    arr.push({
      contactKey: r.contactKey, fullName: r.fullName, jobTitle: r.jobTitle, company: r.company,
      email: r.email, country: r.country, icpScore: r.icpScore, icpTier: r.icpTier, reasons: r.reasons || [],
    });
    grouped.set(r.savedSearchId, arr);
  }
  const out: DigestEntry[] = [];
  for (const [sid, matches] of grouped) {
    const ss = byId.get(sid);
    if (ss) out.push({ savedSearch: ss, newMatches: matches });
  }
  return out;
}
