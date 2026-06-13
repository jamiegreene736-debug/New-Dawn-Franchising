/**
 * origami-service.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Origami (origami.chat) lead-data provider — a SUPPLEMENTAL layer that runs
 * alongside Seamless.AI and Apollo.io in Lead Research.
 *
 * NOTE ON THE INTEGRATION
 * ───────────────────────
 * Origami's public contact-search API surface could not be verified against
 * official docs at build time, so this adapter is intentionally written to be
 * DEFENSIVE and CONFIGURABLE:
 *
 *   • Base URL is overridable with `ORIGAMI_API_BASE` (defaults to
 *     https://api.origami.chat). The search path is overridable with
 *     `ORIGAMI_SEARCH_PATH` (defaults to /v1/contacts/search).
 *   • Auth uses `Authorization: Bearer <ORIGAMI_API_KEY>` by default.
 *   • The response mapper reads a wide set of common field aliases
 *     (first_name/firstName, job_title/title, linkedin/linkedin_url, …) so a
 *     reasonable JSON shape "just works", and anything it can't understand is
 *     skipped rather than throwing.
 *
 * If Origami's real API differs, only the request body in `origamiSearchRaw`
 * and the field aliases in `mapPerson` need adjusting — nothing downstream.
 *
 * Like the other adapters, every function is graceful:
 *   • no API key            → returns empty immediately
 *   • any HTTP/network error → caught, returns empty (never throws)
 */

import type {
  SeamlessPerson,
  SeamlessCompany,
  SeamlessContactFilters,
  SeamlessCompanyFilters,
} from "./seamless-service";

const FETCH_TIMEOUT_MS = 12000;

function getKey(): string | null {
  return process.env.ORIGAMI_API_KEY || null;
}

function baseUrl(): string {
  return (process.env.ORIGAMI_API_BASE || "https://api.origami.chat").replace(/\/$/, "");
}

function searchPath(): string {
  const p = process.env.ORIGAMI_SEARCH_PATH || "/v1/contacts/search";
  return p.startsWith("/") ? p : `/${p}`;
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export function origamiConfigured(): boolean {
  return !!getKey();
}

// ─── Tolerant field readers ──────────────────────────────────────────────────

type Loose = Record<string, unknown>;

function str(obj: Loose, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function nested(obj: Loose, ...keys: string[]): Loose | null {
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Loose;
  }
  return null;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapPerson(raw: Loose): SeamlessPerson | null {
  const org = nested(raw, "organization", "company", "employer") || {};
  let firstName = str(raw, "first_name", "firstName", "given_name") || "";
  let lastName = str(raw, "last_name", "lastName", "family_name", "surname") || "";
  const fullName =
    str(raw, "full_name", "fullName", "name") || `${firstName} ${lastName}`.trim();
  if (!firstName && !lastName && fullName) {
    const s = splitName(fullName);
    firstName = s.firstName;
    lastName = s.lastName;
  }
  if (!fullName) return null; // nothing usable

  const email = str(raw, "email", "work_email", "email_address");
  const phone = str(raw, "phone", "phone_number", "mobile", "mobile_phone");
  const domain =
    str(raw, "domain", "company_domain") ||
    str(org, "domain", "primary_domain", "website") ||
    null;

  return {
    searchResultId: null,
    firstName,
    lastName,
    fullName,
    email,
    emailConfidence: email ? 65 : 0,
    emailVerified: false,
    emailStatus: email ? "unverified" : "not_found",
    phone,
    jobTitle: str(raw, "title", "job_title", "jobTitle", "position", "role"),
    seniority: str(raw, "seniority", "level"),
    department: str(raw, "department", "dept"),
    linkedinUrl: str(raw, "linkedin_url", "linkedinUrl", "linkedin", "li_url"),
    company: str(raw, "company", "company_name", "companyName") || str(org, "name") || null,
    domain: domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
    country: str(raw, "country") || str(org, "country"),
    city: str(raw, "city") || str(org, "city"),
    state: str(raw, "state", "region") || str(org, "state"),
    industries: str(org, "industry") ? [str(org, "industry") as string] : null,
    employeeSizeRange: str(org, "employee_count", "size", "headcount"),
    companyRevenue: str(org, "revenue", "annual_revenue"),
    companyType: str(org, "type"),
    companyCity: str(org, "city"),
    companyState: str(org, "state"),
    companyCountry: str(org, "country"),
    timeAtCompany: null,
    startedAtCurrentCompany: null,
  };
}

// ─── Raw search ──────────────────────────────────────────────────────────────

async function origamiSearchRaw(
  filters: SeamlessContactFilters | SeamlessCompanyFilters,
  mode: "contacts" | "companies",
): Promise<{ items: Loose[]; nextToken: string | null }> {
  const key = getKey();
  if (!key) return { items: [], nextToken: null };

  const f = filters as SeamlessContactFilters & SeamlessCompanyFilters;
  const limit = Math.min(f.limit || 25, 100);

  // Generic, provider-neutral query body. Origami's real schema may differ;
  // these keys are the request mapper's single point of adjustment.
  const body: Record<string, unknown> = {
    type: mode === "companies" ? "company" : "contact",
    limit,
  };
  if (f.titles?.length) body.titles = f.titles;
  if (f.seniorities?.length) body.seniorities = f.seniorities;
  if (f.departments?.length) body.departments = f.departments;
  if (f.companyNames?.length) body.companyNames = f.companyNames;
  if (f.companyDomains?.length) body.domains = f.companyDomains;
  if (f.states?.length) body.states = f.states;
  if (f.countries?.length) body.countries = f.countries;
  if (f.industries?.length) body.industries = f.industries;
  if (f.companySizes?.length) body.companySizes = f.companySizes;
  const keywords = [
    ...((filters as SeamlessContactFilters).keywords ? [(filters as SeamlessContactFilters).keywords] : []),
    ...(f.keywordList || []),
  ].filter(Boolean);
  if (keywords.length) body.keywords = keywords;
  if (f.nextToken) body.cursor = f.nextToken;

  try {
    const res = await fetch(`${baseUrl()}${searchPath()}`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { items: [], nextToken: null };
    const json = (await res.json()) as Loose;
    // Accept the array under any of the common envelope keys.
    const items =
      (Array.isArray(json.data) && (json.data as Loose[])) ||
      (Array.isArray(json.results) && (json.results as Loose[])) ||
      (Array.isArray(json.contacts) && (json.contacts as Loose[])) ||
      (Array.isArray(json.companies) && (json.companies as Loose[])) ||
      (Array.isArray(json.items) && (json.items as Loose[])) ||
      [];
    const nextToken =
      (typeof json.next_cursor === "string" && json.next_cursor) ||
      (typeof json.nextToken === "string" && json.nextToken) ||
      (typeof json.cursor === "string" && json.cursor) ||
      null;
    return { items, nextToken };
  } catch {
    return { items: [], nextToken: null };
  }
}

// ─── Public adapters ─────────────────────────────────────────────────────────

export async function origamiSearchContacts(
  filters: SeamlessContactFilters,
): Promise<{ people: SeamlessPerson[]; nextToken: string | null }> {
  const { items, nextToken } = await origamiSearchRaw(filters, "contacts");
  const people = items.map(mapPerson).filter((p): p is SeamlessPerson => !!p);
  return { people, nextToken };
}

export async function origamiSearchCompanies(
  filters: SeamlessCompanyFilters,
): Promise<{ companies: SeamlessCompany[]; nextToken: string | null }> {
  const { items, nextToken } = await origamiSearchRaw(filters, "companies");
  const companies: SeamlessCompany[] = items
    .map((raw): SeamlessCompany | null => {
      const name = str(raw, "name", "company", "company_name", "companyName");
      const domainRaw =
        str(raw, "domain", "primary_domain", "website") || null;
      const domain = domainRaw ? domainRaw.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
      if (!name && !domain) return null;
      const addr = [str(raw, "city"), str(raw, "state"), str(raw, "country")]
        .filter(Boolean)
        .join(", ");
      return {
        searchResultId: null,
        name: name || domain || "Unknown company",
        domain,
        website: domain ? `https://${domain}` : null,
        description: str(raw, "description"),
        industries: str(raw, "industry") ? [str(raw, "industry") as string] : [],
        employeeSizeRange: str(raw, "employee_count", "size", "headcount"),
        employeeCount: str(raw, "employee_count"),
        revenueRange: str(raw, "revenue", "annual_revenue"),
        companyType: str(raw, "type"),
        foundedOn: str(raw, "founded", "founded_year"),
        numContacts: null,
        linkedinUrl: str(raw, "linkedin_url", "linkedin"),
        city: str(raw, "city"),
        state: str(raw, "state"),
        country: str(raw, "country"),
        address: addr || null,
      };
    })
    .filter((c): c is SeamlessCompany => !!c);
  return { companies, nextToken };
}
