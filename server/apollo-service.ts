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
} from "./seamless-service";

const APOLLO_BASE = "https://api.apollo.io/api/v1";
const FETCH_TIMEOUT_MS = 12000;

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
    p.last_name || (p.name ? p.name.split(/\s+/).slice(1).join(" ") : "") || "";
  return {
    searchResultId: null, // Apollo reveal isn't wired to Seamless credits
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

// ─── People search (POST /mixed_people/search) ──────────────────────────────

export async function apolloSearchContacts(
  filters: SeamlessContactFilters,
): Promise<{ people: SeamlessPerson[]; nextToken: string | null }> {
  const key = getKey();
  if (!key) return { people: [], nextToken: null };

  const perPage = Math.min(filters.limit || 25, 100);
  const page = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;

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
  if (filters.companyDomains?.length) body.q_organization_domains_list = filters.companyDomains;
  if (filters.companyNames?.length) body.q_organization_names = filters.companyNames;
  const sizes = mapSizes(filters.companySizes);
  if (sizes.length) body.organization_num_employees_ranges = sizes;
  if (keywords) body.q_keywords = keywords;

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { people: [], nextToken: null };
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
    return { people: [], nextToken: null };
  }
}

// ─── Company search (POST /mixed_companies/search) ──────────────────────────

export async function apolloSearchCompanies(
  filters: SeamlessCompanyFilters,
): Promise<{ companies: SeamlessCompany[]; nextToken: string | null }> {
  const key = getKey();
  if (!key) return { companies: [], nextToken: null };

  const perPage = Math.min(filters.limit || 25, 100);
  const page = filters.nextToken ? Math.max(1, parseInt(filters.nextToken, 10) || 1) : 1;

  const body: Record<string, unknown> = { page, per_page: perPage };
  if (filters.companyDomains?.length) body.q_organization_domains_list = filters.companyDomains;
  if (filters.companyNames?.length) body.q_organization_names = filters.companyNames;
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
    if (!res.ok) return { companies: [], nextToken: null };
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
    return { companies: [], nextToken: null };
  }
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
