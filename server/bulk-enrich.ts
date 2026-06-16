// Shared contact enrichment across all configured providers.
//
// Runs Seamless.AI, Apollo.io and Origami in parallel for one person and merges
// the results field-by-field (first non-empty wins, in that provider priority).
// Used by the single-contact enrich endpoint and by the bulk-enrich endpoints
// for CRM clients and saved prospects.
//
// Enrichment NEVER overwrites existing data — callers apply the returned values
// only to fields that are currently empty.

import { apolloEnrichPerson, apolloConfigured } from "./apollo-service";
import { origamiEnrichPerson, origamiConfigured } from "./origami-service";
import { seamlessEnrichByIdentityDetailed, getSeamlessStatus, type ProviderError } from "./seamless-service";

export interface EnrichIdentity {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
}

export interface PersonEnrichment {
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export function seamlessConfigured(): boolean {
  return getSeamlessStatus().configured;
}

/** True if at least one contact-enrichment provider has an API key set. */
export function anyEnrichmentProviderConfigured(): boolean {
  return seamlessConfigured() || apolloConfigured() || origamiConfigured();
}

/** Canonical ids of the providers that are currently connected. */
export function configuredEnrichmentProviders(): Array<"seamless" | "apollo" | "origami"> {
  const out: Array<"seamless" | "apollo" | "origami"> = [];
  if (seamlessConfigured()) out.push("seamless");
  if (apolloConfigured()) out.push("apollo");
  if (origamiConfigured()) out.push("origami");
  return out;
}

/**
 * Enrich a single person via every connected provider and merge the results.
 * `found` is true when any provider returned a record with at least one usable
 * field. `sources` lists the providers that contributed.
 */
export async function enrichPersonAllProviders(
  identity: EnrichIdentity,
  options?: { only?: Array<"seamless" | "apollo" | "origami"> },
): Promise<{ found: boolean; enrichment: PersonEnrichment; sources: string[]; error: ProviderError | null }> {
  const fullName = (identity.fullName || `${identity.firstName ?? ""} ${identity.lastName ?? ""}`).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = identity.firstName || parts[0] || "";
  const lastName = identity.lastName || parts.slice(1).join(" ") || "";
  const email = identity.email || undefined;
  const domain = identity.domain || (email ? email.split("@")[1] : undefined) || undefined;
  const company = identity.company || undefined;
  const linkedinUrl = identity.linkedinUrl || undefined;

  // When `only` is given, restrict to that subset of providers (e.g. the
  // "Enrich via Seamless.AI" button passes ["seamless"]). Default: every
  // configured provider.
  const only = options?.only;
  const wants = (p: "seamless" | "apollo" | "origami") => !only || only.includes(p);

  const noSeamless = { person: null, error: null as ProviderError | null };
  const [seamlessRes, apollo, origami] = await Promise.all([
    wants("seamless") && seamlessConfigured()
      ? seamlessEnrichByIdentityDetailed([
          { contactName: fullName || undefined, companyName: company, domain, email, liProfileUrl: linkedinUrl },
        ])
          .then((r) => ({ person: r.people[0] || null, error: r.error }))
          .catch(() => noSeamless)
      : Promise.resolve(noSeamless),
    wants("apollo") && apolloConfigured()
      ? apolloEnrichPerson({
          firstName,
          lastName,
          name: fullName || undefined,
          email,
          domain,
          organizationName: company,
          revealPhone: true,
        }).catch(() => null)
      : Promise.resolve(null),
    wants("origami") && origamiConfigured()
      ? origamiEnrichPerson({
          firstName,
          lastName,
          name: fullName || undefined,
          email,
          domain,
          organizationName: company,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const seamless = seamlessRes.person;
  const sources: string[] = [];
  if (seamless) sources.push("seamless");
  if (apollo) sources.push("apollo");
  if (origami) sources.push("origami");

  // Priority: Seamless → Apollo → Origami (first non-empty value wins).
  const pick = (k: keyof PersonEnrichment): string | null =>
    ((seamless as any)?.[k] || (apollo as any)?.[k] || (origami as any)?.[k] || null) as string | null;

  const enrichment: PersonEnrichment = {
    email: pick("email"),
    phone: pick("phone"),
    jobTitle: pick("jobTitle"),
    company: pick("company"),
    domain: pick("domain"),
    linkedinUrl: pick("linkedinUrl"),
    city: pick("city"),
    state: pick("state"),
    country: pick("country"),
  };

  const found = !!(seamless || apollo || origami) && Object.values(enrichment).some(Boolean);
  // Surface the Seamless provider error (e.g. out of credits) only when nothing
  // was found, so the UI can explain the real reason instead of "no match".
  return { found, enrichment, sources, error: found ? null : seamlessRes.error };
}

/** Run `fn` over `items` with a bounded number of concurrent workers. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface BulkEnrichResult {
  id: string;
  name?: string;
  found: boolean;
  filled: string[];
  sources: string[];
}

/** Aggregate per-record bulk results into a summary for the UI. */
export function summarizeBulk(results: BulkEnrichResult[]) {
  const fieldCounts: Record<string, number> = {};
  for (const r of results) {
    for (const f of r.filled) fieldCounts[f] = (fieldCounts[f] || 0) + 1;
  }
  return {
    processed: results.length,
    enriched: results.filter((r) => r.found).length,
    updated: results.filter((r) => r.filled.length > 0).length,
    fieldCounts,
  };
}

/** Max records enriched per HTTP request (keeps the call within proxy timeouts). */
export const BULK_ENRICH_MAX_PER_REQUEST = 25;
