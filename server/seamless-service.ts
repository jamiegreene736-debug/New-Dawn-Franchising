/**
 * seamless-service.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Seamless.AI lead-data provider — the replacement for the former Apollo.io
 * integration. This is the single, centralised adapter for everything the app
 * needs from Seamless: contact search, contact enrichment (email/phone), and
 * importing found people into the CRM `contacts` table.
 *
 * Seamless's REST API differs from Apollo's in an important way: it is a
 * TWO-STEP, ASYNC pipeline.
 *
 *   1. POST /search/contacts          → returns lightweight matches
 *                                        (searchResultId, name, title, company,
 *                                         domain, seniority, liUrl, location) —
 *                                        NO email/phone, consumes NO credits.
 *   2. POST /contacts/research        → submit searchResultIds (or identities);
 *                                        returns 202 + requestIds; consumes
 *                                        ~1 credit per contact.
 *   3. GET  /contacts/research/poll   → poll requestIds until the enriched
 *                                        `contact` object (emails, phones, etc.)
 *                                        is ready.
 *
 * Because enrichment is async + metered, every function here is DEFENSIVE:
 *   • no API key            → returns empty/null immediately (graceful no-op)
 *   • any HTTP/network error → caught, returns empty (never throws into callers)
 *   • polling is BOUNDED     → never hangs; returns whatever is ready in time
 *
 * Auth: Seamless uses a custom `Token: <key>` header (NOT `Authorization:
 * Bearer`). Set the key in the `SEAMLESS_API_KEY` environment variable
 * (Railway → Variables).
 *
 * Field names below come from the official OpenAPI spec
 * (https://docs.seamless.ai/openapi.json, server
 * https://api.seamless.ai/api/client/v1). They are best-effort and should be
 * validated against a live key on the account; the defensive guards mean a
 * shape mismatch yields empty results rather than a crash.
 *
 * Rate limit: 60 requests/minute per endpoint. The high-level helpers issue
 * at most a couple of searches + one research batch + a handful of polls per
 * call, well inside that budget.
 */

import { db } from "./db";
import { contacts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { calculateLeadScore } from "./lead-scoring";

const SEAMLESS_BASE = "https://api.seamless.ai/api/client/v1";

// Bounded polling for async research results. Kept short so that the full
// search → submit → poll round-trip stays comfortably inside the ~12s
// per-company budget the callers (e.g. prospect-enrichment) allow — otherwise
// research credits get spent on results that are then discarded.
const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 1000;
const FETCH_TIMEOUT_MS = 9000;

function getKey(): string | null {
  return process.env.SEAMLESS_API_KEY || null;
}

function authHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", Token: key };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Provider error (surfaced, never swallowed) ─────────────────────────────
// Search calls used to map EVERY non-2xx/network failure onto an empty result,
// so the UI + Lead Research agent reported "no contacts found" for what was
// really an out-of-credits / auth / rate-limit error — and then invented
// reasons (company "too small" or "misspelled"). We now classify the failure
// and propagate it so callers can tell the user the truth.
export interface ProviderError {
  provider?: string; // filled in by the higher-level provider dispatch
  status: number; // HTTP status; 0 = network/timeout (request never completed)
  code: string; // machine code: insufficientCredits | unauthorized | rateLimited | http | network
  message: string; // human-readable, safe to show the user
}

/** Classify a non-OK Seamless Response into a ProviderError (reads the body once). */
async function seamlessHttpError(res: Response): Promise<ProviderError> {
  let body: any = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    /* non-JSON error body — fall back to status-based messaging */
  }
  const apiCode = typeof body?.code === "string" ? body.code : "";
  const apiMsg =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.msg === "string" && body.msg) ||
    "";

  if (res.status === 422 && apiCode === "insufficientCredits") {
    return {
      status: 422,
      code: "insufficientCredits",
      message:
        "Seamless.AI is out of public-API credits, so no searches can run. Top up your Seamless public-API credit balance (the website uses a separate pool) to restore lead search.",
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      status: res.status,
      code: "unauthorized",
      message: "Seamless.AI rejected the API key (unauthorized). Check SEAMLESS_API_KEY.",
    };
  }
  if (res.status === 429) {
    return {
      status: 429,
      code: "rateLimited",
      message: "Seamless.AI rate limit reached. Wait a moment and try again.",
    };
  }
  return {
    status: res.status,
    code: apiCode || "http",
    message: apiMsg || `Seamless.AI returned an error (HTTP ${res.status}).`,
  };
}

/** A network/timeout failure (the request never produced a response). */
function networkError(): ProviderError {
  return {
    status: 0,
    code: "network",
    message: "Couldn't reach Seamless.AI (network error or timeout). Try again shortly.",
  };
}

// ─── Normalised person shape (provider-agnostic) ────────────────────────────

export interface SeamlessPerson {
  searchResultId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  emailConfidence: number; // 0-100
  emailVerified: boolean;
  emailStatus: string; // "verified" | "unverified" | "not_found"
  phone: string | null;
  jobTitle: string | null;
  seniority: string | null;
  department: string | null;
  linkedinUrl: string | null;
  company: string | null;
  domain: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  // Company-level metadata that the free /search/contacts step returns up-front
  // (no credits). Used to render Seamless-style result cards before reveal.
  industries?: string[] | null;
  employeeSizeRange?: string | null;
  companyRevenue?: string | null;
  companyType?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyCountry?: string | null;
  // How long the person has been at their current company (from Seamless).
  timeAtCompany?: string | null;            // human-readable, e.g. "3 yrs 2 mos"
  startedAtCurrentCompany?: string | null;  // ISO date (YYYY-MM-DD)
}

/**
 * Drop-in compatible with the former Apollo `ApolloPersonResult` so existing
 * enrichment call sites need no shape changes.
 */
export interface SeamlessPersonResult {
  firstName: string;
  lastName: string;
  email: string | null;
  emailConfidence: number;
  phone: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  seniority: string | null;
}

// ─── Filters → /search/contacts body ────────────────────────────────────────

export interface SeamlessContactFilters {
  titles?: string[]; // jobTitle
  seniorities?: string[]; // seniority (e.g. "C-Level", "VP", "Manager")
  departments?: string[];
  keywords?: string; // contactKeyword (single, legacy)
  keywordList?: string[]; // contactKeyword (multiple)
  fullName?: string; // legacy single
  fullNames?: string[]; // fullName (multiple)
  companyName?: string; // legacy single
  companyNames?: string[]; // companyName (multiple)
  companyNameSearchType?: "default" | "related" | "exact";
  companyDomains?: string[]; // companyDomain
  countries?: string[]; // contactCountry (full names, e.g. "United States")
  states?: string[]; // contactState
  zipCodes?: string[]; // contactZipCode
  locationType?: "bothOR" | "bothAND" | "company" | "contact";
  // Company-level filters (apply to the contact's current company)
  industries?: string[]; // industry
  companySizes?: string[]; // companySize bands (e.g. "201 - 500")
  companyRevenues?: string[]; // companyRevenue bands (e.g. "$5M - $20M")
  technologies?: string[];
  technologiesIsOr?: boolean;
  companyType?: "Public" | "Private";
  companyFoundedOn?: string[]; // e.g. "Last 1-3 Years"
  newsTypes?: string[];
  pastCompanyNames?: string[]; // pastCompany.names
  jobChangeType?: string; // jobChanges.changeType
  limit?: number;
  nextToken?: string | null;
}

// ─── Company search (POST /search/companies) ────────────────────────────────

export interface SeamlessCompanyFilters {
  companyNames?: string[];
  companyNameSearchType?: "default" | "related" | "exact";
  companyDomains?: string[];
  states?: string[]; // companyState
  countries?: string[]; // companyCountry
  zipCodes?: string[]; // companyZipCode
  industries?: string[];
  keywordList?: string[]; // companyKeyword
  companySizes?: string[];
  companyRevenues?: string[];
  technologies?: string[];
  technologiesIsOr?: boolean;
  companyType?: "Public" | "Private";
  foundedOn?: string[];
  newsTypes?: string[];
  limit?: number;
  nextToken?: string | null;
}

export interface SeamlessCompany {
  searchResultId: string | null;
  name: string;
  domain: string | null;
  website: string | null;
  description: string | null;
  industries: string[];
  employeeSizeRange: string | null;
  employeeCount: string | null;
  revenueRange: string | null;
  companyType: string | null;
  foundedOn: string | null;
  numContacts: string | null;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
}

interface SeamlessCompanyItem {
  searchResultId?: string;
  name?: string;
  domain?: string;
  description?: string;
  industries?: string[];
  staffCountRange?: string;
  employeeCount?: string;
  revenueRange?: string;
  annualRevenue?: string;
  companyType?: string;
  foundedOn?: string;
  numContacts?: string;
  liUrl?: string;
  companyLIURL?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postCode?: string;
  country?: string;
}

interface SeamlessSearchItem {
  searchResultId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  department?: string;
  seniority?: string;
  domain?: string;
  city?: string;
  state?: string;
  country?: string;
  liUrl?: string;
  industries?: string[];
  employeeSizeRange?: string;
  companyRevenue?: string;
  companyType?: string;
  companyCity?: string;
  companyState?: string;
  companyCountry?: string;
  // Job-tenure fields from the Seamless contact-search response.
  timeAtCompany?: string;            // human-readable, e.g. "3 yrs 2 mos"
  startedAtCurrentCompany?: string;  // ISO date (YYYY-MM-DD)
}

interface SeamlessEnrichedContact {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  email?: string;
  personalEmail?: string;
  email1?: string;
  // Seamless returns AI scores whose exact scale/type isn't documented in the
  // public OpenAPI spec — treat as number-or-string and parse defensively.
  email1EmailAI?: number | string;
  email1TotalAI?: number | string;
  email2?: string;
  email3?: string;
  contactPhone1?: string;
  contactPhone2?: string;
  companyPhone1?: string;
  company?: string;
  companyDomain?: string;
  title?: string;
  department?: string;
  seniority?: string;
  lIProfileUrl?: string;
  website?: string;
  contactLocation?: {
    city?: string;
    state?: string;
    country?: string;
    countryAbbr?: string;
  };
}

/** Parse an undocumented Seamless AI score into a 0-100 number, or null. */
function parseAiScore(v: number | string | undefined): number | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v > 0 && v <= 1 ? Math.round(v * 100) : Math.round(v);
  }
  if (typeof v === "string") {
    const n = parseInt(v.replace(/[^0-9.]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapSearchItem(item: SeamlessSearchItem): SeamlessPerson {
  const split = splitName(item.name || "");
  const firstName = item.firstName || split.firstName;
  const lastName = item.lastName || split.lastName;
  return {
    searchResultId: item.searchResultId || null,
    firstName,
    lastName,
    fullName: item.name || `${firstName} ${lastName}`.trim(),
    email: null,
    emailConfidence: 0,
    emailVerified: false,
    emailStatus: "not_found",
    phone: null,
    jobTitle: item.title || null,
    seniority: item.seniority || null,
    department: item.department || null,
    linkedinUrl: item.liUrl || null,
    company: item.company || null,
    domain: item.domain || null,
    country: item.country || null,
    city: item.city || null,
    state: item.state || null,
    industries: item.industries || null,
    employeeSizeRange: item.employeeSizeRange || null,
    companyRevenue: item.companyRevenue || null,
    companyType: item.companyType || null,
    companyCity: item.companyCity || null,
    companyState: item.companyState || null,
    companyCountry: item.companyCountry || null,
    timeAtCompany: item.timeAtCompany || null,
    startedAtCurrentCompany: item.startedAtCurrentCompany || null,
  };
}

function mapCompanyItem(item: SeamlessCompanyItem): SeamlessCompany {
  const domain = item.domain || null;
  const website = domain ? `https://${domain.replace(/^https?:\/\//, "")}` : null;
  const addressParts = [item.street1, item.city, item.state, item.postCode, item.country]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return {
    searchResultId: item.searchResultId || null,
    name: item.name || domain || "Unknown company",
    domain,
    website,
    description: item.description || null,
    industries: Array.isArray(item.industries) ? item.industries : [],
    employeeSizeRange: item.staffCountRange || null,
    employeeCount: item.employeeCount || null,
    revenueRange: item.revenueRange || item.annualRevenue || null,
    companyType: item.companyType || null,
    foundedOn: item.foundedOn || null,
    numContacts: item.numContacts || null,
    linkedinUrl: item.liUrl || item.companyLIURL || null,
    city: item.city || null,
    state: item.state || null,
    country: item.country || null,
    address: addressParts.length ? addressParts.join(", ") : null,
  };
}

function mapEnrichedContact(
  c: SeamlessEnrichedContact,
  base?: SeamlessPerson,
): SeamlessPerson {
  // Email: prefer the explicitly selected/primary verified email, then the
  // ranked email1/2/3, then personal. Seamless returns AI confidence scores
  // rather than a hard verified flag, so we mark unverified and let the
  // downstream ZeroBounce step do real verification.
  const email =
    c.email || c.email1 || c.personalEmail || c.email2 || c.email3 || null;
  // The AI score's units aren't documented; parse defensively. Accept a number
  // on a 0-1 scale (→ ×100) or a 0-100 scale, or a "NN%"/"NN" string. Clamp to
  // 0-100 and fall back to a conservative 70 — ZeroBounce does real verification.
  const rawScore = parseAiScore(c.email1TotalAI) ?? parseAiScore(c.email1EmailAI);
  const emailConfidence = email
    ? Math.min(100, Math.max(0, rawScore ?? 70))
    : 0;

  const phone = c.contactPhone1 || c.contactPhone2 || c.companyPhone1 || null;

  const fullName = c.fullName || c.name || "";
  let firstName = c.firstName || base?.firstName || "";
  let lastName = c.lastName || base?.lastName || "";
  if (!firstName && !lastName && fullName) {
    const s = splitName(fullName);
    firstName = s.firstName;
    lastName = s.lastName;
  }

  return {
    searchResultId: base?.searchResultId ?? null,
    firstName,
    lastName,
    fullName: fullName || `${firstName} ${lastName}`.trim(),
    email,
    emailConfidence,
    emailVerified: false,
    emailStatus: email ? "unverified" : "not_found",
    phone: phone ? String(phone) : base?.phone ?? null,
    jobTitle: c.title || base?.jobTitle || null,
    seniority: c.seniority || base?.seniority || null,
    department: c.department || base?.department || null,
    linkedinUrl: c.lIProfileUrl || base?.linkedinUrl || null,
    company: c.company || base?.company || null,
    domain: c.companyDomain || base?.domain || null,
    country: c.contactLocation?.country || base?.country || null,
    city: c.contactLocation?.city || base?.city || null,
    state: c.contactLocation?.state || base?.state || null,
  };
}

// ─── Low-level API calls ────────────────────────────────────────────────────

/** Step 1: search the Seamless DB. No credits. Returns lightweight matches. */
async function searchContactsRaw(
  filters: SeamlessContactFilters,
): Promise<{ items: SeamlessSearchItem[]; nextToken: string | null; error?: ProviderError | null }> {
  const apiKey = getKey();
  if (!apiKey) return { items: [], nextToken: null };

  const companyNames = [
    ...(filters.companyName ? [filters.companyName] : []),
    ...(filters.companyNames || []),
  ];
  const fullNames = [
    ...(filters.fullName ? [filters.fullName] : []),
    ...(filters.fullNames || []),
  ];
  const keywords = [
    ...(filters.keywords ? [filters.keywords] : []),
    ...(filters.keywordList || []),
  ];

  const body: Record<string, unknown> = {
    limit: Math.min(filters.limit || 25, 100),
  };
  if (filters.titles?.length) body.jobTitle = filters.titles;
  if (filters.seniorities?.length) body.seniority = filters.seniorities;
  if (filters.departments?.length) body.department = filters.departments;
  if (keywords.length) body.contactKeyword = keywords;
  if (fullNames.length) body.fullName = fullNames;
  if (companyNames.length) body.companyName = companyNames.slice(0, 100);
  if (filters.companyNameSearchType) body.companyNameSearchType = filters.companyNameSearchType;
  if (filters.companyDomains?.length) body.companyDomain = filters.companyDomains;
  if (filters.countries?.length) body.contactCountry = filters.countries;
  if (filters.states?.length) body.contactState = filters.states;
  if (filters.zipCodes?.length) body.contactZipCode = filters.zipCodes;
  if (filters.locationType) body.locationType = filters.locationType;
  if (filters.industries?.length) body.industry = filters.industries.slice(0, 5);
  if (filters.companySizes?.length) body.companySize = filters.companySizes;
  if (filters.companyRevenues?.length) body.companyRevenue = filters.companyRevenues;
  if (filters.technologies?.length) {
    body.technologies = filters.technologies;
    if (filters.technologiesIsOr !== undefined) body.technologiesIsOr = filters.technologiesIsOr;
  }
  if (filters.companyType) body.companyType = filters.companyType;
  if (filters.companyFoundedOn?.length) body.companyFoundedOn = filters.companyFoundedOn.slice(0, 4);
  if (filters.newsTypes?.length) body.newsTypes = filters.newsTypes;
  if (filters.pastCompanyNames?.length) body.pastCompany = { names: filters.pastCompanyNames.slice(0, 100) };
  if (filters.jobChangeType) body.jobChanges = { changeType: filters.jobChangeType };
  if (filters.nextToken) body.nextToken = filters.nextToken;

  try {
    const res = await fetch(`${SEAMLESS_BASE}/search/contacts`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await seamlessHttpError(res);
      console.warn(`[Seamless] /search/contacts ${error.status} ${error.code}: ${error.message}`);
      return { items: [], nextToken: null, error };
    }
    const json = (await res.json()) as { data?: SeamlessSearchItem[]; nextToken?: string };
    return {
      items: Array.isArray(json.data) ? json.data : [],
      nextToken: json.nextToken || null,
    };
  } catch {
    const error = networkError();
    console.warn(`[Seamless] /search/contacts ${error.code}: ${error.message}`);
    return { items: [], nextToken: null, error };
  }
}

/** Company search. No credits. Returns lightweight company matches. */
async function searchCompaniesRaw(
  filters: SeamlessCompanyFilters,
): Promise<{ items: SeamlessCompanyItem[]; nextToken: string | null; error?: ProviderError | null }> {
  const apiKey = getKey();
  if (!apiKey) return { items: [], nextToken: null };

  const body: Record<string, unknown> = {
    limit: Math.min(filters.limit || 25, 100),
  };
  if (filters.companyNames?.length) body.companyName = filters.companyNames.slice(0, 100);
  if (filters.companyNameSearchType) body.companyNameSearchType = filters.companyNameSearchType;
  if (filters.companyDomains?.length) body.companyDomain = filters.companyDomains;
  if (filters.states?.length) body.companyState = filters.states;
  if (filters.countries?.length) body.companyCountry = filters.countries;
  if (filters.zipCodes?.length) body.companyZipCode = filters.zipCodes;
  if (filters.industries?.length) body.industry = filters.industries;
  if (filters.keywordList?.length) body.companyKeyword = filters.keywordList;
  if (filters.companySizes?.length) body.companySize = filters.companySizes;
  if (filters.companyRevenues?.length) body.companyRevenue = filters.companyRevenues;
  if (filters.technologies?.length) {
    body.technologies = filters.technologies;
    if (filters.technologiesIsOr !== undefined) body.technologiesIsOr = filters.technologiesIsOr;
  }
  if (filters.companyType) body.companyType = filters.companyType;
  if (filters.foundedOn?.length) body.foundedOn = filters.foundedOn;
  if (filters.newsTypes?.length) body.newsTypes = filters.newsTypes;
  if (filters.nextToken) body.nextToken = filters.nextToken;

  try {
    const res = await fetch(`${SEAMLESS_BASE}/search/companies`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await seamlessHttpError(res);
      console.warn(`[Seamless] /search/companies ${error.status} ${error.code}: ${error.message}`);
      return { items: [], nextToken: null, error };
    }
    const json = (await res.json()) as { data?: SeamlessCompanyItem[]; nextToken?: string };
    return {
      items: Array.isArray(json.data) ? json.data : [],
      nextToken: json.nextToken || null,
    };
  } catch {
    const error = networkError();
    console.warn(`[Seamless] /search/companies ${error.code}: ${error.message}`);
    return { items: [], nextToken: null, error };
  }
}

/** Submit a research (enrichment) job. Returns the requestIds to poll. */
async function submitResearch(
  payload: Record<string, unknown>,
): Promise<{ requestIds: string[]; error: ProviderError | null }> {
  const apiKey = getKey();
  if (!apiKey) return { requestIds: [], error: null };
  try {
    const res = await fetch(`${SEAMLESS_BASE}/contacts/research`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Classify the real reason (422 insufficientCredits, 401/403 unauthorized,
      // 429 rate limit, …) instead of masking it as an empty "no results".
      return { requestIds: [], error: await seamlessHttpError(res) };
    }
    const json = (await res.json()) as { requestIds?: string[] };
    return { requestIds: Array.isArray(json.requestIds) ? json.requestIds : [], error: null };
  } catch {
    return { requestIds: [], error: networkError() };
  }
}

interface PollResult {
  requestId?: string;
  searchResultId?: string;
  contact: SeamlessEnrichedContact;
}

/** Poll research requestIds until enriched contacts are ready (bounded). */
async function pollResearch(requestIds: string[]): Promise<PollResult[]> {
  const apiKey = getKey();
  if (!apiKey || requestIds.length === 0) return [];

  const out = new Map<string, PollResult>();
  const pending = new Set(requestIds);
  const query = requestIds.map((id) => `requestIds=${encodeURIComponent(id)}`).join("&");

  for (let attempt = 0; attempt < POLL_ATTEMPTS && pending.size > 0; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await fetch(`${SEAMLESS_BASE}/contacts/research/poll?${query}`, {
        method: "GET",
        headers: authHeaders(apiKey),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: Array<{
          requestId?: string;
          searchResultId?: string;
          status?: string;
          contact?: SeamlessEnrichedContact;
        }>;
      };
      for (const item of json.data || []) {
        const status = (item.status || "").toLowerCase();
        const stillRunning =
          status === "pending" ||
          status === "processing" ||
          status === "in_progress" ||
          status === "queued";
        if (item.contact && !stillRunning) {
          const key = item.requestId || `anon-${out.size}`;
          out.set(key, {
            requestId: item.requestId,
            searchResultId: item.searchResultId,
            contact: item.contact,
          });
          if (item.requestId) pending.delete(item.requestId);
        } else if (item.requestId && !stillRunning && !item.contact) {
          // Terminal but no contact (failed/no-data) — stop waiting on it.
          pending.delete(item.requestId);
        }
      }
    } catch {
      // transient — keep trying until attempts exhausted
    }
  }
  if (pending.size > 0) {
    console.warn(
      `[Seamless] poll exhausted after ${POLL_ATTEMPTS} attempts — ${pending.size}/${requestIds.length} requestIds still pending; returning ${out.size} enriched (partial recall this run)`,
    );
  }
  return Array.from(out.values());
}

/** Research a batch of search results and return enriched, normalised people. */
async function enrichBySearchIds(items: SeamlessPerson[]): Promise<SeamlessPerson[]> {
  const ids = items.map((p) => p.searchResultId).filter((x): x is string => !!x);
  if (ids.length === 0) return items;
  const { requestIds } = await submitResearch({ searchResultIds: ids.slice(0, 100) });
  const enriched = await pollResearch(requestIds);
  if (enriched.length === 0) return items; // graceful: return search-level data

  // Correlate enriched records back onto the search items. Prefer the
  // searchResultId the API echoes back (reliable); fall back to name matching.
  const byId = new Map<string, SeamlessPerson>();
  for (const p of items) if (p.searchResultId) byId.set(p.searchResultId, p);
  const byName = new Map<string, SeamlessPerson>();
  for (const p of items) byName.set(p.fullName.toLowerCase(), p);

  const merged: SeamlessPerson[] = [];
  const usedBases = new Set<SeamlessPerson>();
  for (const r of enriched) {
    let base: SeamlessPerson | undefined =
      (r.searchResultId && byId.get(r.searchResultId)) || undefined;
    if (!base) base = byName.get((r.contact.fullName || r.contact.name || "").toLowerCase());
    if (base) usedBases.add(base);
    merged.push(mapEnrichedContact(r.contact, base));
  }
  // Keep search items that weren't enriched (so callers still see them) — but
  // never re-append one we already merged, which would duplicate the person.
  for (const p of items) if (!usedBases.has(p)) merged.push(p);
  return merged;
}

// ─── High-level helpers (the surface call sites use) ────────────────────────

/**
 * Find people by filters. When `enrich` is true, runs the research+poll step to
 * fill in emails/phones (consumes credits); otherwise returns search-level data
 * only (names/titles/LinkedIn — free), letting downstream providers
 * (Hunter/PDL/permutation) resolve emails.
 */
export async function seamlessFindPeople(
  filters: SeamlessContactFilters,
  opts: { enrich?: boolean } = {},
): Promise<SeamlessPerson[]> {
  const items = (await searchContactsRaw(filters)).items.map(mapSearchItem);
  if (!opts.enrich || items.length === 0) return items;
  return enrichBySearchIds(items);
}

/**
 * Free contact search returning rich, search-level people (names, titles,
 * company metadata, LinkedIn — NO email/phone, NO credits) plus the pagination
 * cursor. This is the surface the Seamless-style Lead Research UI drives.
 */
export async function seamlessSearchContacts(
  filters: SeamlessContactFilters,
): Promise<{ people: SeamlessPerson[]; nextToken: string | null; error?: ProviderError | null }> {
  const { items, nextToken, error } = await searchContactsRaw(filters);
  return { people: items.map(mapSearchItem), nextToken, error: error ?? null };
}

/** Free company search returning rich, search-level companies + cursor. */
export async function seamlessSearchCompanies(
  filters: SeamlessCompanyFilters,
): Promise<{ companies: SeamlessCompany[]; nextToken: string | null; error?: ProviderError | null }> {
  const { items, nextToken, error } = await searchCompaniesRaw(filters);
  return { companies: items.map(mapCompanyItem), nextToken, error: error ?? null };
}

/**
 * Reveal (enrich) the given search results' email + phone. Consumes ~1 Seamless
 * credit per contact. Returns the enriched person keyed by searchResultId so the
 * caller can merge the result back onto the displayed row.
 */
export async function seamlessRevealBySearchIds(
  ids: string[],
): Promise<Array<{ searchResultId: string | null; person: SeamlessPerson }>> {
  if (!getKey() || ids.length === 0) return [];
  const { requestIds } = await submitResearch({ searchResultIds: ids.slice(0, 100) });
  const enriched = await pollResearch(requestIds);
  return enriched.map((r) => ({
    searchResultId: r.searchResultId ?? null,
    person: mapEnrichedContact(r.contact),
  }));
}

export interface SeamlessEnrichIdentity {
  contactName?: string;
  companyName?: string;
  domain?: string;
  title?: string;
  email?: string;
  liProfileUrl?: string;
}

/**
 * Enrich people by identity (name+company/domain, email, or LinkedIn URL),
 * surfacing the provider error (e.g. insufficientCredits) when the request
 * fails — so callers can tell "out of credits" apart from a genuine no-match.
 */
export async function seamlessEnrichByIdentityDetailed(
  identities: SeamlessEnrichIdentity[],
): Promise<{ people: SeamlessPerson[]; error: ProviderError | null }> {
  if (!getKey() || identities.length === 0) return { people: [], error: null };
  const { requestIds, error } = await submitResearch({ contacts: identities.slice(0, 100) });
  if (error) return { people: [], error };
  const enriched = await pollResearch(requestIds);
  return { people: enriched.map((r) => mapEnrichedContact(r.contact)), error: null };
}

/** Enrich people by identity (name+company/domain, email, or LinkedIn URL). */
export async function seamlessEnrichByIdentity(
  identities: SeamlessEnrichIdentity[],
): Promise<SeamlessPerson[]> {
  return (await seamlessEnrichByIdentityDetailed(identities)).people;
}

function toPersonResult(p: SeamlessPerson): SeamlessPersonResult {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    emailConfidence: p.emailConfidence,
    phone: p.phone,
    linkedinUrl: p.linkedinUrl,
    jobTitle: p.jobTitle,
    seniority: p.seniority,
  };
}

const DECISION_MAKER_SENIORITIES = ["C-Level", "VP", "Director", "Manager", "Owner", "Partner"];

/** Drop-in for the former `apolloSearchByDomain`. */
export async function seamlessSearchByDomain(
  domain: string,
  maxContacts = 8,
): Promise<SeamlessPersonResult[]> {
  if (!getKey()) return [];
  const people = await seamlessFindPeople(
    { companyDomains: [domain], seniorities: DECISION_MAKER_SENIORITIES, limit: maxContacts },
    { enrich: true },
  );
  return people.map(toPersonResult);
}

/** Drop-in for the former `apolloSearchByCompanyName`. */
export async function seamlessSearchByCompanyName(
  companyName: string,
  domain: string | null,
  maxContacts = 6,
): Promise<SeamlessPersonResult[]> {
  if (!getKey()) return [];
  const people = await seamlessFindPeople(
    {
      companyName,
      companyDomains: domain ? [domain] : undefined,
      seniorities: DECISION_MAKER_SENIORITIES,
      limit: maxContacts,
    },
    { enrich: true },
  );
  return people.map(toPersonResult);
}

/** Drop-in for the former `apolloMatchPerson`. */
export async function seamlessMatchPerson(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<SeamlessPersonResult | null> {
  if (!getKey()) return null;
  const enriched = await seamlessEnrichByIdentity([
    { contactName: `${firstName} ${lastName}`.trim(), domain },
  ]);
  if (enriched.length === 0) return null;
  return toPersonResult(enriched[0]);
}

// ─── Contact import (drop-in for the former `apolloSearch`) ──────────────────

let lastRunStats = {
  lastRun: null as string | null,
  imported: 0,
  skipped: 0,
  total: 0,
};

function personaTypeForTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("consultant")) return "immigration_consultant";
  if (t.includes("migration")) return "business_migration_agent";
  if (t.includes("relocation")) return "relocation_consultant";
  if (t.includes("tax")) return "international_tax_advisor";
  return "immigration_attorney";
}

/**
 * Search Seamless and import found people into the CRM `contacts` table.
 * Drop-in replacement for the former `apolloSearch` used by
 * POST /api/seamless/search.
 */
export async function seamlessSearch(params: {
  titles?: string[];
  locations?: string[];
  keywords?: string;
  page?: number;
}): Promise<{ imported: number; skipped: number; total: number; error?: string }> {
  if (!getKey()) {
    return { imported: 0, skipped: 0, total: 0, error: "SEAMLESS_API_KEY not configured" };
  }

  try {
    const people = await seamlessFindPeople(
      {
        titles: params.titles,
        countries: params.locations,
        keywords: params.keywords,
        limit: 25,
      },
      { enrich: true },
    );

    let imported = 0;
    let skipped = 0;

    for (const person of people) {
      const email = person.email;

      // Need at least one usable identity to contact (and to dedup on). Seamless
      // search often returns people with no email, so we cannot rely on email
      // alone — that would let the same person be re-inserted every run.
      if (!email && !person.phone && !person.linkedinUrl) {
        skipped++;
        continue;
      }

      // Dedup on a stable identity: email when present, else LinkedIn URL, else
      // name + company. `contacts.email` is UNIQUE but NULLABLE, so null-email
      // rows never collide — the explicit lookups below are what prevent dupes.
      let existing;
      if (email) {
        [existing] = await db.select().from(contacts).where(eq(contacts.email, email));
      } else if (person.linkedinUrl) {
        [existing] = await db.select().from(contacts).where(eq(contacts.linkedinUrl, person.linkedinUrl));
      } else {
        [existing] = await db.select().from(contacts).where(and(
          eq(contacts.firstName, person.firstName),
          eq(contacts.lastName, person.lastName),
          eq(contacts.firmName, person.company ?? ""),
        ));
      }
      if (existing) {
        skipped++;
        continue;
      }

      const contactData = {
        firstName: person.firstName,
        lastName: person.lastName,
        email,
        phone: person.phone,
        firmName: person.company,
        jobTitle: person.jobTitle,
        personaType: personaTypeForTitle(person.jobTitle || ""),
        country: person.country,
        city: person.city,
        source: "Seamless",
        linkedinUrl: person.linkedinUrl,
        websiteUrl: null,
        status: "new" as const,
        tags: [] as string[],
        notes: null,
        gdprNote: null,
        consentSource: null,
        referredByContactId: null,
        possibleDuplicateOf: null,
      };

      const score = calculateLeadScore(contactData, false);
      // onConflictDoNothing guards against the unique-email constraint on
      // concurrent/re-run inserts (a no-op for null emails, hence the dedup above).
      await db.insert(contacts).values({ ...contactData, leadScore: score }).onConflictDoNothing();
      imported++;
    }

    lastRunStats = {
      lastRun: new Date().toISOString(),
      imported,
      skipped,
      total: people.length,
    };

    return { imported, skipped, total: people.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { imported: 0, skipped: 0, total: 0, error: message };
  }
}

export function getSeamlessStatus() {
  return {
    ...lastRunStats,
    configured: !!getKey(),
  };
}
