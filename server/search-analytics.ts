/**
 * search-analytics.ts  (Phase 5 — analytics over the AI-search funnel)
 * ───────────────────────────────────────────────────────────────────────────
 * Aggregates the search_events telemetry (+ signals + saved searches) into a
 * single dashboard payload: search volume, cache effectiveness, latency, the
 * top queries, and the signal/ICP picture — so the team can see what the AI
 * search is doing and tune scoring over time.
 *
 * Pure reads; every query is defensive so a missing table yields zeros rather
 * than a 500.
 */

import { pool } from "./db";

async function scalar(sql: string, params: any[] = []): Promise<number> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    return Number(v ?? 0);
  } catch {
    return 0;
  }
}

async function rowsOf<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as T[];
  } catch {
    return [];
  }
}

export interface SearchAnalytics {
  rangeDays: number;
  totalSearches: number;
  cachedSearches: number;
  cacheHitRate: number;          // 0-1
  avgDurationMs: number;
  bySurface: Array<{ surface: string; count: number }>;
  byProvider: Array<{ provider: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  dailyVolume: Array<{ day: string; count: number }>;
  signals: { total: number; last7d: number };
  icp: { scored: number; hot: number; warm: number };
  savedSearches: { active: number; newMatches7d: number };
}

export async function getSearchAnalytics(days = 30): Promise<SearchAnalytics> {
  const d = Math.min(Math.max(days, 1), 365);
  const since = `now() - interval '${d} days'`;

  const [
    totalSearches, cachedSearches, avgDurationMs,
    bySurface, byProvider, topQueries, dailyVolume,
    signalsTotal, signals7d, icpScored, icpHot, icpWarm,
    activeSaved, newMatches7d,
  ] = await Promise.all([
    scalar(`SELECT count(*)::int FROM search_events WHERE created_at > ${since}`),
    scalar(`SELECT count(*)::int FROM search_events WHERE cached = true AND created_at > ${since}`),
    scalar(`SELECT coalesce(round(avg(duration_ms)),0)::int FROM search_events WHERE created_at > ${since}`),
    rowsOf(`SELECT surface, count(*)::int AS count FROM search_events WHERE created_at > ${since} GROUP BY surface ORDER BY count DESC`),
    rowsOf(`SELECT coalesce(provider,'—') AS provider, count(*)::int AS count FROM search_events WHERE created_at > ${since} GROUP BY provider ORDER BY count DESC`),
    rowsOf(`SELECT query, count(*)::int AS count FROM search_events WHERE query IS NOT NULL AND query <> '' AND created_at > ${since} GROUP BY query ORDER BY count DESC LIMIT 10`),
    rowsOf(`SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day, count(*)::int AS count FROM search_events WHERE created_at > ${since} GROUP BY 1 ORDER BY 1`),
    scalar(`SELECT count(*)::int FROM lead_signals`),
    scalar(`SELECT count(*)::int FROM lead_signals WHERE detected_at > now() - interval '7 days'`),
    scalar(`SELECT count(*)::int FROM contacts WHERE icp_score IS NOT NULL`),
    scalar(`SELECT count(*)::int FROM contacts WHERE icp_tier = 'hot'`),
    scalar(`SELECT count(*)::int FROM contacts WHERE icp_tier = 'warm'`),
    scalar(`SELECT count(*)::int FROM saved_searches WHERE active = true`),
    scalar(`SELECT count(*)::int FROM saved_search_matches WHERE first_seen_at > now() - interval '7 days'`),
  ]);

  return {
    rangeDays: d,
    totalSearches,
    cachedSearches,
    cacheHitRate: totalSearches > 0 ? cachedSearches / totalSearches : 0,
    avgDurationMs,
    bySurface,
    byProvider,
    topQueries,
    dailyVolume,
    signals: { total: signalsTotal, last7d: signals7d },
    icp: { scored: icpScored, hot: icpHot, warm: icpWarm },
    savedSearches: { active: activeSaved, newMatches7d },
  };
}
