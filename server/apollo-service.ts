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
  if (res.status === 401 || res.status === 403) {
    return { status: res.status, code: "unauthorized", message: "Apollo.io rejected the API key (unauthorized). Check APOLLO_API_KEY." };
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
  id?: string;
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
}

export interface ApolloResolvedOrganization {
  id: string;
  name: string;
  domain: string | null;
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

function mapPerson(p: ApolloPerson): SeamlessPerson {
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
  return {
    searchResultId: p.id ?? null,
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
    company: org.name || null,
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
// Apollo deprecated /mixed_people/search for API callers. The current People API
// Search uses organization_ids[] or q_organization_domains_list[] — NOT company
// names — so callers that only have a name should resolve the org first via
// apolloFindOrganization().

function buildPeopleSearchBody(filters: SeamlessContactFilters, page: number, perPage: number): Record<string, unknown> {
  const keywords = [
    ...(filters.keywords ? [filters.keywords] : []),
    ...(filters.keywordList || []),
  ].join(" ").trim();

  const body: Record<string, unknown> = { page, per_page: perPage };
  if (filters.titles?.length) body.person_titles = filters.titles;
  const seniorities = mapSeniorities(filters.seniorities);
  if (seniorities.length) body.person_seniorities = seniorities;
  const locations = buildLocations(filters.states, filters.countries);
  if (locations.length) body.person_locations = locations;
  if (filters.organizationIds?.length) body.organization_ids = filters.organizationIds;
  if (filters.companyDomains?.length) body.q_organization_domains_list = filters.companyDomains;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) body.organization_num_employees_ranges = sizes;
  if (keywords) body.q_keywords = keywords;
  return body;
}

export async function apolloSearchContacts(
  filters: SeamlessContactFilters,
): Promise<{ people: SeamlessPerson[]; nextToken: string | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { people: [], nextToken: null };

  const perPage = Math.min(filters.limit || 25, 100);
  const page = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(buildPeopleSearchBody(filters, page, perPage)),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await apolloHttpError(res);
      console.warn(`[Apollo] /mixed_people/api_search ${error.status} ${error.code}: ${error.message}`);
      return { people: [], nextToken: null, error };
    }
    const json = (await res.json()) as {
      people?: ApolloPerson[];
      pagination?: { page?: number; total_pages?: number };
    };
    const people = Array.isArray(json.people) ? json.people.map(mapPerson) : [];
    const pg = json.pagination;
    const nextToken =
      pg && pg.page != null && pg.total_pages != null && pg.page < pg.total_pages
        ? String(pg.page + 1)
        : null;
    return { people, nextToken };
  } catch {
    return { people: [], nextToken: null, error: apolloNetworkError() };
  }
}

/** Paginate People API Search to collect up to maxResults contacts (company-wide lists). */
export async function apolloSearchContactsAll(
  filters: SeamlessContactFilters,
  maxResults = 500,
): Promise<{ people: SeamlessPerson[]; totalAvailable: number | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { people: [], totalAvailable: null };

  const perPage = 100;
  const maxPages = Math.ceil(maxResults / perPage);
  const all: SeamlessPerson[] = [];
  let totalAvailable: number | null = null;
  let page = 1;

  for (let i = 0; i < maxPages; i++) {
    try {
      const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
        method: "POST",
        headers: authHeaders(key),
        body: JSON.stringify(buildPeopleSearchBody(filters, page, perPage)),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const error = await apolloHttpError(res);
        console.warn(`[Apollo] /mixed_people/api_search page ${page} ${error.status} ${error.code}: ${error.message}`);
        return { people: all, totalAvailable, error };
      }
      const json = (await res.json()) as {
        people?: ApolloPerson[];
        total_entries?: number;
        pagination?: { page?: number; total_pages?: number };
      };
      if (typeof json.total_entries === "number") totalAvailable = json.total_entries;
      const batch = Array.isArray(json.people) ? json.people.map(mapPerson) : [];
      all.push(...batch);
      const pg = json.pagination;
      if (!pg || pg.page == null || pg.total_pages == null || pg.page >= pg.total_pages || batch.length === 0) break;
      page = pg.page + 1;
    } catch {
      return { people: all, totalAvailable, error: apolloNetworkError() };
    }
  }
  return { people: all.slice(0, maxResults), totalAvailable };
}

// ─── Company search (POST /mixed_companies/search) ──────────────────────────

export async function apolloSearchCompanies(
  filters: SeamlessCompanyFilters,
): Promise<{ companies: SeamlessCompany[]; nextToken: string | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { companies: [], nextToken: null };

  const perPage = Math.min(filters.limit || 25, 100);
  const page = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;

  const body: Record<string, unknown> = { page, per_page: perPage };
  if (filters.companyDomains?.length) body.q_organization_domains_list = filters.companyDomains;
  // Organization Search expects a single q_organization_name string (partial match OK).
  if (filters.companyNames?.length) body.q_organization_name = filters.companyNames[0];
  const locations = buildLocations(filters.states, filters.countries);
  if (locations.length) body.organization_locations = locations;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) body.organization_num_employees_ranges = sizes;
  if (filters.keywordList?.length) body.q_organization_keyword_tags = filters.keywordList;

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
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

/** Strip conversational fluff so "GlobeVisa the Consulting Firm" → "GlobeVisa". */
export function normalizeCompanyQuery(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return s;
  s = s.replace(/\b(the|a|an)\s+(consulting\s+firm|company|firm|corporation|corp|inc|llc|ltd)\b/gi, "").trim();
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || raw.trim();
}

/** Resolve a company name to Apollo's organization id + domain (step 1 of employee lookup). */
export async function apolloFindOrganization(
  companyName: string,
): Promise<{ org: ApolloResolvedOrganization | null; error?: ProviderError | null }> {
  const key = getKey();
  if (!key) return { org: null };

  const query = normalizeCompanyQuery(companyName);
  if (!query) return { org: null };

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({ page: 1, per_page: 10, q_organization_name: query }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await apolloHttpError(res);
      return { org: null, error };
    }
    const json = (await res.json()) as { organizations?: ApolloOrg[]; accounts?: ApolloOrg[] };
    const raw = json.organizations || json.accounts || [];
    if (!Array.isArray(raw) || raw.length === 0) return { org: null };

    const q = query.toLowerCase();
    const ranked = [...raw].sort((a, b) => {
      const an = (a.name || "").toLowerCase();
      const bn = (b.name || "").toLowerCase();
      const aExact = an === q ? 0 : an.startsWith(q) ? 1 : an.includes(q) ? 2 : 3;
      const bExact = bn === q ? 0 : bn.startsWith(q) ? 1 : bn.includes(q) ? 2 : 3;
      return aExact - bExact;
    });
    const best = ranked[0];
    if (!best?.id) return { org: null };
    const domain =
      best.primary_domain ||
      (best.website_url ? best.website_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null) ||
      null;
    return { org: { id: best.id, name: best.name || query, domain } };
  } catch {
    return { org: null, error: apolloNetworkError() };
  }
}

/**
 * Find everyone at a company: resolve org by name (if needed), then paginate
 * People API Search by organization_ids + domain.
 */
export async function apolloSearchCompanyEmployees(opts: {
  companyName?: string;
  companyDomain?: string;
  maxResults?: number;
}): Promise<{
  people: SeamlessPerson[];
  organization: ApolloResolvedOrganization | null;
  totalAvailable: number | null;
  error?: ProviderError | null;
}> {
  const key = getKey();
  if (!key) return { people: [], organization: null, totalAvailable: null };

  let org: ApolloResolvedOrganization | null = null;
  const domain = opts.companyDomain?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() || null;

  if (opts.companyName) {
    const found = await apolloFindOrganization(opts.companyName);
    if (found.error) return { people: [], organization: null, totalAvailable: null, error: found.error };
    org = found.org;
  }

  const searchDomain = domain || org?.domain || null;
  if (!org?.id && !searchDomain) {
    return { people: [], organization: org, totalAvailable: null };
  }

  const filters: SeamlessContactFilters = {
    organizationIds: org?.id ? [org.id] : undefined,
    companyDomains: searchDomain ? [searchDomain] : undefined,
  };
  const { people, totalAvailable, error } = await apolloSearchContactsAll(filters, opts.maxResults ?? 500);
  return { people, organization: org, totalAvailable, error };
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
