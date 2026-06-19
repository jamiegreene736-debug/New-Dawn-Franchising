/**
 * apollo-service.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Apollo.io lead-data provider — a SUPPLEMENTAL layer that runs alongside
 * Seamless.AI in Lead Research. Apollo's People Search returns search-level
 * matches (name, title, company, location, LinkedIn) for free; emails are
 * usually masked until an explicit enrichment/unlock step, so we treat masked
 * emails as "not revealed" and let the existing reveal/verification flow handle
 * real contact details.
 *
 * Like the Seamless adapter, every function here is DEFENSIVE:
 *   • no API key            → returns empty immediately (graceful no-op)
 *   • any HTTP/network error → caught, returns empty (never throws into callers)
 *
 * Auth: Apollo uses an `X-Api-Key: <key>` header. Set the key in the
 * `APOLLO_API_KEY` environment variable (Railway → Variables).
 *
 * Output is normalised onto the provider-agnostic `SeamlessPerson` shape so the
 * multi-provider search layer can merge + de-dup Apollo results with Seamless
 * and Origami without any per-provider special-casing downstream.
 */

import type {
  SeamlessPerson,
  SeamlessCompany,
  SeamlessContactFilters,
  SeamlessCompanyFilters,
  ProviderError,
} from "./seamless-service";

const APOLLO_BASE = "https://api.apollo.io/api/v1";
const FETCH_TIMEOUT_MS = 12000;

/** Classify a non-OK Apollo Response into a ProviderError (never swallowed). */
async function apolloHttpError(res: Response): Promise<ProviderError> {
  let body: any = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    /* non-JSON */
  }
  const msg =
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.message === "string" && body.message) ||
    "";
  if (res.status === 401) {
    return { status: 401, code: "unauthorized", message: "Apollo.io rejected the API key (unauthorized). Check APOLLO_API_KEY." };
  }
  if (res.status === 403) {
    // The People Search endpoint (mixed_people/api_search) only accepts a MASTER
    // API key — a regular key returns 403. Tell the user exactly how to fix it.
    return { status: 403, code: "unauthorized", message: "Apollo.io's People Search API requires a master API key. In Apollo → Settings → Integrations → API, create a key with 'Set as master key' enabled and set it as APOLLO_API_KEY." };
  }
  if (res.status === 429) {
    return { status: 429, code: "rateLimited", message: "Apollo.io rate limit reached. Try again shortly." };
  }
  if (res.status === 422 && /deprecated/i.test(msg)) {
    return { status: 422, code: "deprecated", message: "Apollo.io's people-search API endpoint is deprecated for API callers; this integration needs updating before Apollo can return results." };
  }
  return { status: res.status, code: "http", message: msg || `Apollo.io returned an error (HTTP ${res.status}).` };
}

function apolloNetworkError(): ProviderError {
  return { status: 0, code: "network", message: "Couldn't reach Apollo.io (network error or timeout)." };
}

function getKey(): string | null {
  return process.env.APOLLO_API_KEY || null;
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": key,
  };
}

/**
 * Apollo's search endpoints (mixed_people/api_search, mixed_companies/search)
 * read their filters from URL QUERY PARAMETERS, not the JSON body — anything
 * sent in the body is silently ignored, which makes the search return generic,
 * unfiltered results. Build a proper query string, repeating array filters with
 * the `key[]=value` notation Apollo expects (e.g. person_titles[]=CEO).
 */
function apolloQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        const s = String(v ?? "").trim();
        if (s) qs.append(`${key}[]`, s);
      }
    } else {
      const s = String(value).trim();
      if (s) qs.append(key, s);
    }
  }
  return qs.toString();
}

export function apolloConfigured(): boolean {
  return !!getKey();
}

// ─── Filter mapping (our enums → Apollo's expected values) ───────────────────

// Apollo person_seniorities vocabulary differs from ours; map best-effort.
const SENIORITY_MAP: Record<string, string[]> = {
  "C-Level": ["c_suite", "founder", "owner", "partner"],
  VP: ["vp"],
  Director: ["director"],
  Manager: ["manager"],
  Senior: ["senior"],
  "Entry Level": ["entry"],
  "Mid-Level": [],
  Other: [],
};

// Our COMPANY_SIZE bands → Apollo organization_num_employees_ranges ("min,max").
const SIZE_MAP: Record<string, string> = {
  "0 - 1 (Self-employed)": "1,1",
  "2 - 10": "2,10",
  "11 - 50": "11,50",
  "51 - 200": "51,200",
  "201 - 500": "201,500",
  "501 - 1,000": "501,1000",
  "1,001 - 5,000": "1001,5000",
  "5,001 - 10,000": "5001,10000",
  "10,001+": "10001,1000000",
};

function mapSeniorities(values?: string[]): string[] {
  if (!values?.length) return [];
  const out = new Set<string>();
  for (const v of values) for (const a of SENIORITY_MAP[v] || []) out.add(a);
  return Array.from(out);
}

function mapSizes(values?: string[]): string[] {
  if (!values?.length) return [];
  return values.map((v) => SIZE_MAP[v]).filter(Boolean);
}

/** Personal/organization location strings Apollo can match against. */
function buildLocations(states?: string[], countries?: string[]): string[] {
  return [...(states || []), ...(countries || [])].map((s) => s.trim()).filter(Boolean);
}

// ─── Apollo response shapes (only the fields we read) ────────────────────────

interface ApolloOrg {
  name?: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  estimated_num_employees?: number;
  annual_revenue_printed?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  /** api_search masks surnames — still useful for display until reveal. */
  last_name_obfuscated?: string;
  name?: string;
  title?: string;
  seniority?: string;
  departments?: string[];
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: ApolloOrg;
  organization_name?: string;
}

/** Apollo masks locked emails as "email_not_unlocked@domain.com" — treat as none. */
function realEmail(email?: string, status?: string): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return null;
  if (e.includes("not_unlocked") || e.includes("email_not_unlocked")) return null;
  // Apollo also returns the literal placeholder domain for locked records.
  if (e.endsWith("@domain.com")) return null;
  return email.trim();
}

function titleCase(s?: string | null): string | null {
  if (!s) return null;
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapPerson(p: ApolloPerson, companyFallback?: string | null): SeamlessPerson {
  const org = p.organization || {};
  const email = realEmail(p.email, p.email_status);
  const verified = (p.email_status || "").toLowerCase() === "verified";
  const domain =
    org.primary_domain ||
    (org.website_url ? org.website_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null) ||
    null;
  const firstName = p.first_name || (p.name ? p.name.split(/\s+/)[0] : "") || "";
  const lastName =
    p.last_name ||
    p.last_name_obfuscated ||
    (p.name ? p.name.split(/\s+/).slice(1).join(" ") : "") ||
    "";
  const company = org.name || p.organization_name || companyFallback || null;
  return {
    // Carry Apollo's person id (prefixed so the add path tells it apart from a
    // Seamless searchResultId). It's the reliable handle for revealing this
    // exact person's email/LinkedIn at add-time via apolloRevealById.
    searchResultId: p.id ? `apollo:${p.id}` : null,
    firstName,
    lastName,
    fullName: p.name || `${firstName} ${lastName}`.trim(),
    email,
    emailConfidence: email ? (verified ? 90 : 70) : 0,
    emailVerified: verified,
    emailStatus: email ? (verified ? "valid" : "unverified") : "not_found",
    phone: null, // phone numbers require an Apollo enrichment call (credits)
    jobTitle: p.title || null,
    seniority: titleCase(p.seniority),
    department: p.departments?.[0] ? titleCase(p.departments[0]) : null,
    linkedinUrl: p.linkedin_url || null,
    company,
    domain,
    country: p.country || org.country || null,
    city: p.city || org.city || null,
    state: p.state || org.state || null,
    industries: org.industry ? [org.industry] : null,
    employeeSizeRange: org.estimated_num_employees ? String(org.estimated_num_employees) : null,
    companyRevenue: org.annual_revenue_printed || null,
    companyType: null,
    companyCity: org.city || null,
    companyState: org.state || null,
    companyCountry: org.country || null,
    timeAtCompany: null,
    startedAtCurrentCompany: null,
  };
}

function mapCompany(org: ApolloOrg): SeamlessCompany {
  const domain =
    org.primary_domain ||
    (org.website_url ? org.website_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null) ||
    null;
  const website = org.website_url || (domain ? `https://${domain}` : null);
  const addr = [org.city, org.state, org.country].map((s) => (s || "").trim()).filter(Boolean);
  return {
    searchResultId: null,
    name: org.name || domain || "Unknown company",
    domain,
    website,
    description: null,
    industries: org.industry ? [org.industry] : [],
    employeeSizeRange: org.estimated_num_employees ? String(org.estimated_num_employees) : null,
    employeeCount: org.estimated_num_employees ? String(org.estimated_num_employees) : null,
    revenueRange: org.annual_revenue_printed || null,
    companyType: null,
    foundedOn: null,
    numContacts: null,
    linkedinUrl: null,
    city: org.city || null,
    state: org.state || null,
    country: org.country || null,
    address: addr.length ? addr.join(", ") : null,
  };
}

// ─── People search (POST /mixed_people/api_search) ───────────────────────────
// Apollo deprecated the old /mixed_people/search endpoint for API callers (it now
// returns HTTP 422 "deprecated"). The current endpoint is /mixed_people/api_search
// ("People API Search"), which requires a MASTER API key. It returns search-level
// matches with emails/phones masked until an explicit reveal/enrichment step.

// Resolving a company name costs one extra Apollo round-trip, so cap how many we
// look up and run them concurrently to stay well under the caller's request budget.
const COMPANY_RESOLVE_TIMEOUT_MS = 8000;
const MAX_COMPANY_RESOLVES = 3;
// Safety cap on auto-pagination (100 contacts/page → up to 1,000 per search).
const MAX_SEARCH_PAGES = 10;

// Generic words that aren't part of a company's brand/domain. Stripped so
// "GlobeVisa Consulting" matches the real org "GlobeVisa" and yields a clean
// domain guess (globevisa.com) instead of failing to resolve.
const GENERIC_COMPANY_WORDS = new Set([
  "consulting", "consultancy", "consultants", "inc", "incorporated", "llc", "ltd",
  "limited", "plc", "group", "co", "corp", "corporation", "company", "global",
  "international", "worldwide", "holdings", "partners", "ventures", "services",
  "solutions", "agency", "associates", "the", "and", "of",
]);

/** Drop generic corporate suffixes/filler so name matching + domain guessing work. */
function normalizeCompanyName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[.,&/()]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !GENERIC_COMPANY_WORDS.has(w))
    .join(" ")
    .trim();
  return cleaned || name.trim();
}

/**
 * Best-effort domain guess from a company name, e.g. "GlobeVisa Consulting" →
 * globevisa.com. Used as a fallback when Apollo's (credit-gated, master-key-only)
 * Organization Search can't resolve a real domain — so a free people-search can
 * still target the company by domain instead of degrading to a junk keyword match.
 */
function guessCompanyDomain(name: string): string | null {
  const core = normalizeCompanyName(name).replace(/[^a-z0-9]/g, "");
  return core.length >= 3 ? `${core}.com` : null;
}

/**
 * api_search targets companies by DOMAIN or organization id — it silently ignores
 * company NAMES. When the caller only has a name (e.g. "GlobeVisa"), resolve it to
 * a domain via Organization Search first; if that endpoint is unavailable (it
 * consumes credits and needs a master key, so it can 403 / run dry independently
 * of the free people search), fall back to a heuristic domain guess so the search
 * still targets the company. Returns the domains found AND any names for which even
 * a guess couldn't be formed.
 */
async function resolveCompanyDomains(
  names: string[],
  key: string,
): Promise<{ domains: string[]; unresolved: string[]; domainToName: Map<string, string> }> {
  const top = names.slice(0, MAX_COMPANY_RESOLVES);
  const overflow = names.slice(MAX_COMPANY_RESOLVES); // beyond the cap — treat as unresolved
  const domainToName = new Map<string, string>();
  const results = await Promise.all(
    top.map(async (name): Promise<{ name: string; domain: string | null; resolvedName: string }> => {
      try {
        const res = await fetch(
          `${APOLLO_BASE}/mixed_companies/search?${apolloQuery({ q_organization_name: normalizeCompanyName(name), per_page: 1 })}`,
          {
            method: "POST",
            headers: authHeaders(key),
            signal: AbortSignal.timeout(COMPANY_RESOLVE_TIMEOUT_MS),
          },
        );
        if (!res.ok) {
          // Org Search is unavailable (no master key, out of credits, deprecated…).
          // Don't give up — guess the domain so the free people-search still runs.
          console.warn(`[Apollo] company resolve "${name}" failed: HTTP ${res.status} — falling back to domain guess`);
          return { name, domain: guessCompanyDomain(name), resolvedName: name.trim() };
        }
        const json = (await res.json()) as { organizations?: ApolloOrg[]; accounts?: ApolloOrg[] };
        const org = (json.organizations || json.accounts || [])[0];
        const domain =
          org?.primary_domain ||
          (org?.website_url ? org.website_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null);
        const normalizedDomain = (domain || guessCompanyDomain(name))?.toLowerCase() ?? null;
        return {
          name,
          domain: normalizedDomain,
          resolvedName: org?.name?.trim() || name.trim(),
        };
      } catch {
        return { name, domain: guessCompanyDomain(name), resolvedName: name.trim() };
      }
    }),
  );
  for (const r of results) {
    if (r.domain) domainToName.set(r.domain, r.resolvedName);
  }
  const domains = Array.from(new Set(results.map((r) => r.domain).filter((d): d is string => !!d)));
  const unresolved = [...results.filter((r) => !r.domain).map((r) => r.name), ...overflow];
  return { domains, unresolved, domainToName };
}

export async function apolloSearchContacts(
  filters: SeamlessContactFilters,
): Promise<{ people: SeamlessPerson[]; nextToken: string | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { people: [], nextToken: null };

  const startPage = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;
  // How many contacts to gather in total, and the per-request page size. api_search
  // is free and caps at 100/page, so page at 100 when fetching a big roster.
  const maxResults = Math.max(filters.maxResults || filters.limit || 25, 1);
  const perPage = Math.min(maxResults, 100);

  const keywords = [
    ...(filters.keywords ? [filters.keywords] : []),
    ...(filters.keywordList || []),
  ].join(" ").trim();

  // api_search reads its filters from URL QUERY PARAMETERS — anything put in the
  // JSON body is ignored, which previously made every search return generic,
  // unfiltered results (e.g. one random person instead of the target company's).
  // Build the filter params ONCE (incl. resolving company names → domains, which
  // costs an Apollo round-trip) and reuse them across pages.
  const baseParams: Record<string, unknown> = {};
  if (filters.titles?.length) baseParams.person_titles = filters.titles;
  const seniorities = mapSeniorities(filters.seniorities);
  if (seniorities.length) baseParams.person_seniorities = seniorities;
  const locations = buildLocations(filters.states, filters.countries);
  if (locations.length) baseParams.person_locations = locations;
  // Company targeting on api_search is by DOMAIN (or org id) ONLY — it ignores
  // company NAMES (#138 moved this call to the api_search endpoint). Use explicit
  // domains; otherwise resolve names → domains via Organization Search so
  // "contacts at <Company>" actually returns that company's people, not nothing.
  const orgDomains = filters.companyDomains?.length ? [...filters.companyDomains] : [];
  const domainToName = new Map<string, string>();
  let unresolvedNames: string[] = [];
  if (!orgDomains.length && filters.companyNames?.length) {
    const resolved = await resolveCompanyDomains(filters.companyNames, key);
    orgDomains.push(...resolved.domains);
    unresolvedNames = resolved.unresolved;
    resolved.domainToName.forEach((name, domain) => domainToName.set(domain, name));
  }
  for (const d of filters.companyDomains || []) {
    const domain = d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (domain && !domainToName.has(domain)) domainToName.set(domain, domain);
  }
  if (orgDomains.length) baseParams.q_organization_domains_list = orgDomains;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) baseParams.organization_num_employees_ranges = sizes;
  // Free-text keywords. Only bias toward an unresolved company name when NO domain
  // resolved at all — Apollo ANDs q_keywords with q_organization_domains_list, so
  // adding a name-keyword alongside a resolved domain would prune results to ~zero.
  const nameKeywords = orgDomains.length === 0 ? unresolvedNames : [];
  const qKeywords = [keywords, ...nameKeywords].filter(Boolean).join(" ").trim();
  if (qKeywords) baseParams.q_keywords = qKeywords;

  async function fetchPage(
    pageNum: number,
  ): Promise<{ people: SeamlessPerson[]; nextToken: string | null; error?: ProviderError | null }> {
    try {
      const qs = apolloQuery({ ...baseParams, page: pageNum, per_page: perPage });
      const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search?${qs}`, {
        method: "POST",
        headers: authHeaders(key!),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const error = await apolloHttpError(res);
        console.warn(`[Apollo] /mixed_people/api_search ${error.status} ${error.code}: ${error.message}`);
        return { people: [], nextToken: null, error };
      }
      const json = (await res.json()) as {
        people?: ApolloPerson[];
        pagination?: { page?: number; total_pages?: number; total_entries?: number };
      };
      const people = Array.isArray(json.people)
        ? json.people.map((person) => {
            const mapped = mapPerson(person);
            if (mapped.company || !mapped.domain) return mapped;
            const fallback = domainToName.get(mapped.domain.toLowerCase());
            return fallback ? { ...mapped, company: fallback } : mapped;
          })
        : [];
      return { people, nextToken: computeNextToken(json.pagination, pageNum, perPage) };
    } catch {
      return { people: [], nextToken: null, error: apolloNetworkError() };
    }
  }

  // Follow pages until we've gathered maxResults, run out, or hit the safety cap.
  const all: SeamlessPerson[] = [];
  let pageNum = startPage;
  let nextToken: string | null = null;
  for (let i = 0; i < MAX_SEARCH_PAGES && all.length < maxResults; i++) {
    const res = await fetchPage(pageNum);
    // Surface an error only if we have nothing yet; otherwise return what we got.
    if (res.error) {
      if (all.length === 0) return { people: [], nextToken: null, error: res.error };
      break;
    }
    all.push(...res.people);
    nextToken = res.nextToken;
    if (!nextToken || res.people.length === 0) break;
    pageNum = parseInt(nextToken, 10) || pageNum + 1;
  }
  return { people: all.slice(0, maxResults), nextToken };
}

/**
 * Apollo paginates via `page`/`per_page`. The api_search response may report
 * `total_pages` directly or only `total_entries`; handle both, and fall back to
 * "assume more if this page came back full" so we never strand later pages.
 */
function computeNextToken(
  pg: { page?: number; total_pages?: number; total_entries?: number } | undefined,
  requestedPage: number,
  perPage: number,
): string | null {
  const curPage = pg?.page ?? requestedPage;
  let totalPages = pg?.total_pages;
  if (totalPages == null && pg?.total_entries != null) {
    totalPages = Math.max(1, Math.ceil(pg.total_entries / perPage));
  }
  if (totalPages != null) return curPage < totalPages ? String(curPage + 1) : null;
  return null;
}

// ─── Company search (POST /mixed_companies/search) ──────────────────────────

export async function apolloSearchCompanies(
  filters: SeamlessCompanyFilters,
): Promise<{ companies: SeamlessCompany[]; nextToken: string | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { companies: [], nextToken: null };

  const perPage = Math.min(filters.limit || 25, 100);
  const page = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;

  // Like api_search, mixed_companies/search reads filters from URL query
  // parameters, not the JSON body.
  const params: Record<string, unknown> = { page, per_page: perPage };
  if (filters.companyDomains?.length) params.q_organization_domains_list = filters.companyDomains;
  if (filters.companyNames?.length) params.q_organization_names = filters.companyNames;
  const locations = buildLocations(filters.states, filters.countries);
  if (locations.length) params.organization_locations = locations;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) params.organization_num_employees_ranges = sizes;
  if (filters.keywordList?.length) params.q_organization_keyword_tags = filters.keywordList;

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_companies/search?${apolloQuery(params)}`, {
      method: "POST",
      headers: authHeaders(key),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await apolloHttpError(res);
      console.warn(`[Apollo] /mixed_companies/search ${error.status} ${error.code}: ${error.message}`);
      return { companies: [], nextToken: null, error };
    }
    const json = (await res.json()) as {
      organizations?: ApolloOrg[];
      accounts?: ApolloOrg[];
      pagination?: { page?: number; total_pages?: number };
    };
    const raw = json.organizations || json.accounts || [];
    const companies = Array.isArray(raw) ? raw.map(mapCompany) : [];
    const pg = json.pagination;
    const nextToken =
      pg && pg.page != null && pg.total_pages != null && pg.page < pg.total_pages
        ? String(pg.page + 1)
        : null;
    return { companies, nextToken };
  } catch {
    return { companies: [], nextToken: null, error: apolloNetworkError() };
  }
}

// ─── Lookalike company discovery + contacts ───────────────────────────────────
// Organization Search supports keyword tags and paginates up to 500 pages
// (50,000 companies). People Search accepts up to 1,000 domains per request.

/** Apollo's hard display cap for organization-search pagination. */
export const APOLLO_MAX_COMPANY_PAGES = 500;
/** Max lookalike companies we return to the user (ranked by niche relevance). */
export const APOLLO_LOOKALIKE_MAX_COMPANIES = 50;
/** Pages to scan when building a ranking pool (100/page → up to 500 candidates). */
const LOOKALIKE_RANKING_POOL_PAGES = 5;
const APOLLO_DOMAIN_BATCH_SIZE = 1000;
const LOOKALIKE_BUDGET_MS = 45_000;

export interface ApolloLookalikeResult {
  companies: SeamlessCompany[];
  people: SeamlessPerson[];
  seedDomain: string | null;
  seedName: string | null;
  keywordTags: string[];
  /** Companies actually returned after relevance ranking (max 50). */
  companiesReturned: number;
  /** Apollo's broad keyword-index estimate from pagination — not verified niche matches. */
  totalMatchesEstimate: number | null;
  domainsSearched: number;
  error?: ProviderError | null;
}

function parseDomainInput(raw: string): string | null {
  let s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].split("?")[0];
  return s.includes(".") ? s : null;
}

/** Build focused keyword tags from a niche phrase — avoid bare "consulting" (too broad). */
export function buildLookalikeKeywordTags(niche: string, seedIndustry?: string | null): string[] {
  const tags = new Set<string>();
  const lower = (niche || "").toLowerCase();
  const nicheClean = lower
    .replace(/[.,&/()]/g, " ")
    .replace(/\b(the|a|an|in|of|and|or|like|similar|companies|company|firms|firm|space)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (nicheClean.length > 4) tags.add(nicheClean);

  const words = nicheClean
    .split(/\s+/)
    .filter((w) => w.length > 3 && !GENERIC_COMPANY_WORDS.has(w));
  for (const w of words) tags.add(w);

  if (/immigrat|visa|citizenship|residen|relocation|eb-?5|e-?2/.test(lower)) {
    ["immigration", "immigration services", "visa consulting", "citizenship"].forEach((t) => tags.add(t));
  }

  if (seedIndustry) {
    const ind = seedIndustry.toLowerCase().trim();
    if (ind.length > 3 && !GENERIC_COMPANY_WORDS.has(ind)) tags.add(ind);
  }

  return Array.from(tags).slice(0, 6);
}

/** Score how closely a company matches the lookalike niche (higher = more relevant). */
export function scoreLookalikeCompanyRelevance(
  company: SeamlessCompany,
  niche: string,
  keywordTags: string[],
  seed?: SeamlessCompany | null,
): number {
  const text = [
    company.name,
    company.description,
    ...(company.industries || []),
    company.domain,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const nicheLower = niche.toLowerCase();
  let score = 0;

  for (const word of nicheLower.split(/\s+/)) {
    if (word.length > 3 && !GENERIC_COMPANY_WORDS.has(word) && text.includes(word)) score += 3;
  }
  for (const tag of keywordTags) {
    if (tag.length > 3 && text.includes(tag)) score += 2;
  }
  if (/immigrat|visa|citizenship|relocation|eb-?5|e-?2/.test(text)) score += 4;
  if (/consult(ing|ant|ancy)/.test(text) && !/immigrat|visa|citizenship/.test(text)) score -= 3;

  if (seed?.industries?.length) {
    for (const ind of seed.industries) {
      if (ind && text.includes(ind.toLowerCase())) score += 2;
    }
  }

  return score;
}

/** Resolve a reference company name or domain via Organization Search. */
export async function apolloResolveSeedCompany(
  reference: string,
): Promise<{ company: SeamlessCompany | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { company: null };

  const domain = parseDomainInput(reference);
  const params: Record<string, unknown> = { page: 1, per_page: 5 };
  if (domain) params.q_organization_domains_list = [domain];
  else params.q_organization_name = normalizeCompanyName(reference);

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_companies/search?${apolloQuery(params)}`, {
      method: "POST",
      headers: authHeaders(key),
      signal: AbortSignal.timeout(COMPANY_RESOLVE_TIMEOUT_MS),
    });
    if (!res.ok) return { company: null, error: await apolloHttpError(res) };
    const json = (await res.json()) as { organizations?: ApolloOrg[]; accounts?: ApolloOrg[] };
    const org = (json.organizations || json.accounts || [])[0];
    return { company: org ? mapCompany(org) : null };
  } catch {
    return { company: null, error: apolloNetworkError() };
  }
}

/** Paginate Organization Search for lookalike ranking — capped pages, not full index. */
async function apolloSearchCompaniesAll(
  filters: SeamlessCompanyFilters,
  opts: { deadline?: number; maxPages?: number } = {},
): Promise<{ companies: SeamlessCompany[]; totalMatchesEstimate: number | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { companies: [], totalMatchesEstimate: null };

  const deadline = opts.deadline ?? Date.now() + LOOKALIKE_BUDGET_MS;
  const maxPages = opts.maxPages ?? LOOKALIKE_RANKING_POOL_PAGES;
  const perPage = 100;
  const all: SeamlessCompany[] = [];
  const seen = new Set<string>();
  let totalMatchesEstimate: number | null = null;

  const baseParams: Record<string, unknown> = {};
  if (filters.companyDomains?.length) baseParams.q_organization_domains_list = filters.companyDomains;
  if (filters.companyNames?.length) baseParams.q_organization_name = normalizeCompanyName(filters.companyNames[0]);
  if (filters.keywordList?.length) baseParams.q_organization_keyword_tags = filters.keywordList;
  const locations = buildLocations(filters.states, filters.countries);
  if (locations.length) baseParams.organization_locations = locations;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) baseParams.organization_num_employees_ranges = sizes;

  for (let page = 1; page <= maxPages; page++) {
    if (Date.now() > deadline) break;
    try {
      const qs = apolloQuery({ ...baseParams, page, per_page: perPage });
      const res = await fetch(`${APOLLO_BASE}/mixed_companies/search?${qs}`, {
        method: "POST",
        headers: authHeaders(key),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const error = await apolloHttpError(res);
        if (all.length === 0) return { companies: [], totalMatchesEstimate, error };
        break;
      }
      const json = (await res.json()) as {
        organizations?: ApolloOrg[];
        accounts?: ApolloOrg[];
        pagination?: { page?: number; total_pages?: number; total_entries?: number };
      };
      if (page === 1 && json.pagination?.total_entries != null) {
        totalMatchesEstimate = json.pagination.total_entries;
      }
      const raw = json.organizations || json.accounts || [];
      if (!raw.length) break;
      for (const org of raw) {
        const co = mapCompany(org);
        const dedupeKey = (co.domain || co.name).toLowerCase();
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          all.push(co);
        }
      }
      const pg = json.pagination;
      if (!pg || pg.page == null || pg.total_pages == null || pg.page >= pg.total_pages) break;
    } catch {
      if (all.length === 0) return { companies: [], totalMatchesEstimate, error: apolloNetworkError() };
      break;
    }
  }
  return { companies: all, totalMatchesEstimate };
}

/** People search across many domains (batched at 1,000 per Apollo request). */
async function apolloSearchPeopleAtDomains(
  domains: string[],
  opts: {
    titles?: string[];
    seniorities?: string[];
    countries?: string[];
    states?: string[];
    deadline?: number;
    maxResults?: number;
  } = {},
): Promise<{ people: SeamlessPerson[]; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { people: [] };

  const uniqueDomains = [...new Set(domains.map((d) => d.toLowerCase()).filter(Boolean))];
  if (!uniqueDomains.length) return { people: [] };

  const deadline = opts.deadline ?? Date.now() + LOOKALIKE_BUDGET_MS;
  const maxResults = opts.maxResults ?? 10_000;
  const all: SeamlessPerson[] = [];
  const seen = new Set<string>();
  let firstError: ProviderError | null = null;

  for (let i = 0; i < uniqueDomains.length && all.length < maxResults; i += APOLLO_DOMAIN_BATCH_SIZE) {
    if (Date.now() > deadline) break;
    const batch = uniqueDomains.slice(i, i + APOLLO_DOMAIN_BATCH_SIZE);
    const { people, error } = await apolloSearchContacts({
      companyDomains: batch,
      titles: opts.titles,
      seniorities: opts.seniorities,
      countries: opts.countries,
      states: opts.states,
      maxResults: maxResults - all.length,
    });
    if (error && !firstError) firstError = error;
    for (const p of people) {
      const k = (p.email || `${p.fullName}|${p.company}|${p.domain}`).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        all.push(p);
      }
    }
  }
  return { people: all.slice(0, maxResults), error: firstError };
}

/**
 * Find companies like a reference (e.g. GlobeVisa immigration consultants) via
 * Apollo keyword search, then return contacts at every discovered company.
 */
export async function apolloLookalikeCompaniesWithContacts(opts: {
  referenceCompany: string;
  niche?: string;
  titles?: string[];
  seniorities?: string[];
  countries?: string[];
  states?: string[];
}): Promise<ApolloLookalikeResult> {
  const key = getKey();
  const empty: ApolloLookalikeResult = {
    companies: [],
    people: [],
    seedDomain: null,
    seedName: null,
    keywordTags: [],
    companiesReturned: 0,
    totalMatchesEstimate: null,
    domainsSearched: 0,
  };
  if (!key) return empty;

  const deadline = Date.now() + LOOKALIKE_BUDGET_MS;
  const ref = (opts.referenceCompany || "").trim();
  if (!ref) return empty;

  const { company: seed, error: seedError } = await apolloResolveSeedCompany(ref);
  if (seedError && !seed) return { ...empty, error: seedError };

  const seedDomain = seed?.domain || parseDomainInput(ref);
  const seedName = seed?.name || ref;
  const niche = (opts.niche || "").trim() || ref;
  const keywordTags = buildLookalikeKeywordTags(niche, seed?.industries?.[0] ?? null);

  const { companies, totalMatchesEstimate, error: coError } = await apolloSearchCompaniesAll(
    { keywordList: keywordTags, countries: opts.countries, states: opts.states },
    { deadline },
  );
  if (coError && companies.length === 0) {
    return { ...empty, seedDomain, seedName, keywordTags, error: coError };
  }

  const excludeDomain = seedDomain?.toLowerCase() ?? null;
  const candidates = companies.filter((c) => {
    const d = (c.domain || "").toLowerCase();
    return d && d !== excludeDomain;
  });

  const ranked = candidates
    .map((c) => ({ company: c, score: scoreLookalikeCompanyRelevance(c, niche, keywordTags, seed) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, APOLLO_LOOKALIKE_MAX_COMPANIES)
    .map((x) => x.company);

  const domains = ranked.map((c) => c.domain).filter((d): d is string => !!d);

  const { people, error: peopleError } = await apolloSearchPeopleAtDomains(domains, {
    titles: opts.titles,
    seniorities: opts.seniorities,
    countries: opts.countries,
    states: opts.states,
    deadline,
    maxResults: 500,
  });

  return {
    companies: ranked,
    people,
    seedDomain,
    seedName,
    keywordTags,
    companiesReturned: ranked.length,
    totalMatchesEstimate,
    domainsSearched: domains.length,
    error: peopleError || coError || null,
  };
}

// ─── People enrichment / match (POST /people/match) ──────────────────────────
// Apollo's Enrichment API: given a name + email/domain it returns the person's
// best work email, title, company, LinkedIn, location, and (when available)
// phone numbers. Used for single-contact profile enrichment and to fill gaps in
// people-search results.

export interface ApolloEnrichment {
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  jobTitle: string | null;
  seniority: string | null;
  company: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export async function apolloEnrichPerson(opts: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  domain?: string | null;
  organizationName?: string | null;
  revealPhone?: boolean;
}): Promise<ApolloEnrichment | null> {
  const key = getKey();
  if (!key) return null;

  const body: Record<string, unknown> = { reveal_personal_emails: true };
  if (opts.firstName) body.first_name = opts.firstName;
  if (opts.lastName) body.last_name = opts.lastName;
  if (opts.name) body.name = opts.name;
  if (opts.email) body.email = opts.email;
  if (opts.domain) body.domain = opts.domain;
  if (opts.organizationName) body.organization_name = opts.organizationName;
  // Phone reveal can be async (needs a webhook) on some plans; only request it
  // when explicitly asked. Either way we read any phone_numbers Apollo returns.
  if (opts.revealPhone) body.reveal_phone_number = true;

  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      person?: ApolloPerson & {
        phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }>;
        organization?: ApolloOrg & { phone?: string };
      };
    };
    const p = json.person;
    if (!p) return null;
    const org = p.organization || {};
    const phone =
      p.phone_numbers?.find((n) => n.sanitized_number)?.sanitized_number ||
      p.phone_numbers?.[0]?.raw_number ||
      (org as ApolloOrg & { phone?: string }).phone ||
      null;
    const domain =
      org.primary_domain ||
      (org.website_url ? org.website_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null) ||
      null;
    return {
      email: realEmail(p.email, p.email_status),
      emailStatus: p.email_status || null,
      phone,
      jobTitle: p.title || null,
      seniority: titleCase(p.seniority),
      company: org.name || null,
      domain,
      linkedinUrl: p.linkedin_url || null,
      city: p.city || org.city || null,
      state: p.state || org.state || null,
      country: p.country || org.country || null,
    };
  } catch {
    return null;
  }
}

// ─── Reveal by Apollo person id (add-time enrichment) ────────────────────────
// api_search returns each person's Apollo `id` but masks name/email and omits
// phone & LinkedIn. Calling /people/match by that id reveals the verified work
// email + LinkedIn (~1 credit). Apollo CANNOT reveal phone synchronously (it
// requires an async webhook), so phone stays null — unlike Seamless. The match
// often still returns only a first name, so we derive the surname from the
// LinkedIn slug when needed.

/** Derive a surname from a LinkedIn vanity slug, e.g.
 *  "http://linkedin.com/in/hannah-ma-989521194" + first "Hannah" → "Ma". */
function lastNameFromLinkedin(url?: string | null, firstName?: string | null): string {
  if (!url) return "";
  const m = url.match(/\/in\/([^/?#]+)/i);
  if (!m) return "";
  const tokens = m[1]
    .split("-")
    .filter((t) => t && !/^\d+$/.test(t)); // drop the trailing numeric disambiguator
  const first = (firstName || "").toLowerCase();
  const rest = tokens.filter((t) => t.toLowerCase() !== first);
  const last = (rest.length ? rest : tokens.slice(1)).join(" ");
  return last ? last.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

/** Best-effort full name for a matched Apollo person whose surname may be masked. */
function deriveName(p: ApolloPerson): { firstName: string; lastName: string; fullName: string } {
  const firstName = p.first_name || (p.name ? p.name.split(/\s+/)[0] : "") || "";
  let lastName =
    p.last_name ||
    (p.name && p.name.split(/\s+/).length > 1 ? p.name.split(/\s+/).slice(1).join(" ") : "") ||
    "";
  // api_search/match frequently hand back only a first name — recover the surname
  // from the LinkedIn handle so the saved contact isn't half a name.
  if (!lastName || /\*/.test(lastName)) lastName = lastNameFromLinkedin(p.linkedin_url, firstName) || lastName;
  const fullName = `${firstName} ${lastName}`.trim() || p.name || firstName;
  return { firstName, lastName, fullName };
}

/**
 * Reveal a person Apollo returned during search, by their Apollo person id.
 * Returns a SeamlessPerson with email + LinkedIn + a best-effort full name.
 * Phone stays null (Apollo phone reveal is async-webhook-only). Returns null on
 * any failure (incl. out-of-credits / auth) so callers can react.
 */
export async function apolloRevealById(id: string): Promise<SeamlessPerson | null> {
  const key = getKey();
  if (!key || !id) return null;
  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({ id, reveal_personal_emails: true }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      person?: ApolloPerson & { phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }> };
    };
    const p = json.person;
    if (!p) return null;
    const base = mapPerson(p); // org/domain/title/location + searchResultId=apollo:<id>
    const { firstName, lastName, fullName } = deriveName(p);
    const phone =
      p.phone_numbers?.find((n) => n.sanitized_number)?.sanitized_number ||
      p.phone_numbers?.[0]?.raw_number ||
      null;
    return {
      ...base,
      firstName: firstName || base.firstName,
      lastName: lastName || base.lastName,
      fullName: fullName || base.fullName,
      phone,
      raw: p as unknown as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
