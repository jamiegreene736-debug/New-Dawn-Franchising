/**
 * provider-credits.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Best-effort "credits remaining" lookups for each contact-search provider,
 * plus a combined status payload the Lead Research UI uses to:
 *   • show which providers are connected (have an API key), and
 *   • show how many credits remain on each (when the provider exposes it).
 *
 * Credit balances are BEST-EFFORT: not every provider exposes a public balance
 * endpoint, and the exact shape can change. Every fetcher is defensive and
 * returns `null` (meaning "unknown / not reported") on any error, missing key,
 * or unrecognised response — never throwing. The UI renders a number when one
 * is available and a neutral "—" otherwise.
 *
 * Results are cached briefly so the status endpoint stays cheap when the panel
 * re-polls.
 */

import { apolloConfigured } from "./apollo-service";
import { origamiConfigured } from "./origami-service";
import type { ProviderId } from "./seamless-prospects";

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  credits: number | null; // remaining credits, or null when not reported
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Pull the first finite number found at a set of dotted paths in a JSON object. */
function pick(obj: any, paths: string[]): number | null {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in cur) cur = cur[key];
      else { ok = false; break; }
    }
    if (ok) {
      const n = num(cur);
      if (n != null) return n;
    }
  }
  return null;
}

// ─── Per-provider best-effort credit fetchers ────────────────────────────────

async function seamlessCredits(): Promise<number | null> {
  const key = process.env.SEAMLESS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.seamless.ai/api/client/v1/credits", {
      headers: { "Content-Type": "application/json", Token: key },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return pick(json, ["creditsRemaining", "remaining", "credits", "data.creditsRemaining", "data.remaining"]);
  } catch {
    return null;
  }
}

async function apolloCredits(): Promise<number | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;
  try {
    // Apollo's usage/health surface is best-effort; tolerate any shape.
    const res = await fetch("https://api.apollo.io/api/v1/usage_stats/api_usage_stats", {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return pick(json, [
      "credits_remaining",
      "remaining",
      "email_credits.remaining",
      "data.credits_remaining",
    ]);
  } catch {
    return null;
  }
}

async function origamiCredits(): Promise<number | null> {
  const key = process.env.ORIGAMI_API_KEY;
  if (!key) return null;
  const base = (process.env.ORIGAMI_API_BASE || "https://api.origami.chat").replace(/\/$/, "");
  const path = process.env.ORIGAMI_CREDITS_PATH || "/v1/account/credits";
  try {
    const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return pick(json, [
      "credits",
      "credits_remaining",
      "creditsRemaining",
      "remaining",
      "balance",
      "data.credits",
      "data.balance",
    ]);
  } catch {
    return null;
  }
}

// ─── Combined status (cached) ────────────────────────────────────────────────

let cache: { at: number; data: ProviderStatus[] } | null = null;

export async function getProviderStatuses(force = false): Promise<ProviderStatus[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const [seamless, apollo, origami] = await Promise.all([
    seamlessCredits(),
    apolloCredits(),
    origamiCredits(),
  ]);

  const data: ProviderStatus[] = [
    { id: "seamless", label: "Seamless.AI", configured: !!process.env.SEAMLESS_API_KEY, credits: seamless },
    { id: "apollo", label: "Apollo.io", configured: apolloConfigured(), credits: apollo },
    { id: "origami", label: "Origami", configured: origamiConfigured(), credits: origami },
  ];

  cache = { at: Date.now(), data };
  return data;
}
