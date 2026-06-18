/**
 * search-cache.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Tiny in-memory TTL cache for provider searches. Identical lead searches
 * (same provider + mode + normalized filters) within the TTL window reuse the
 * previous result instead of re-hitting Seamless/Apollo/Origami — cutting both
 * latency and API spend. Reveals are NOT cached here (they spend credits and
 * are handled separately).
 *
 * Process-local and bounded; safe to lose on restart. Not a correctness layer.
 */

import { providerSearch, type ProviderId, type LeadSearchFilters, type SearchResult } from "./seamless-prospects";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 200;

interface Entry {
  value: SearchResult;
  expires: number;
}

const store = new Map<string, Entry>();

function stableKey(provider: string, mode: string, filters: LeadSearchFilters, nextToken?: string | null, maxResults?: number): string {
  // Sort keys + array values so semantically-equal filters share a cache key.
  const norm: Record<string, unknown> = {};
  for (const k of Object.keys(filters).sort()) {
    const v = (filters as Record<string, unknown>)[k];
    norm[k] = Array.isArray(v) ? [...v].map((x) => String(x).toLowerCase()).sort() : v;
  }
  // maxResults changes how many pages we gather, so a full-roster search must not
  // reuse a cached single-page result (or vice-versa).
  return JSON.stringify({ provider, mode, nextToken: nextToken || null, maxResults: maxResults ?? null, filters: norm });
}

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Drop the oldest-expiring entries first.
  const sorted = [...store.entries()].sort((a, b) => a[1].expires - b[1].expires);
  for (let i = 0; i < sorted.length && store.size > MAX_ENTRIES; i++) {
    store.delete(sorted[i][0]);
  }
}

export interface CachedSearch extends SearchResult {
  cached?: boolean;
}

/**
 * providerSearch with a short-lived result cache. Drop-in replacement for
 * providerSearch at the route level.
 */
export async function cachedProviderSearch(
  provider: ProviderId,
  mode: "contacts" | "companies",
  filters: LeadSearchFilters,
  opts: { limit?: number; maxResults?: number; nextToken?: string | null } = {},
): Promise<CachedSearch> {
  const key = stableKey(provider, mode, filters, opts.nextToken, opts.maxResults);
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return { ...hit.value, cached: true };
  }
  const value = await providerSearch(provider, mode, filters, opts);
  // Never cache a provider error (out-of-credits, rate-limit, network): it's
  // transient, and caching it would keep masking real results for the full TTL
  // even after the underlying issue (e.g. a credit top-up) is resolved.
  if (!value.error) {
    store.set(key, { value, expires: now + TTL_MS });
    evictIfNeeded();
  }
  return { ...value, cached: false };
}

/** Test/ops helper — clears the cache (e.g. when filters/scoring logic change). */
export function clearSearchCache(): void {
  store.clear();
}
