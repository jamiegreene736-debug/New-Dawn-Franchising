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
  keywords?: string; // contactKeyword
  fullName?: string;
  companyName?: string;
  companyDomains?: string[]; // companyDomain
  countries?: string[]; // contactCountry (full names, e.g. "United States")
  states?: string[];
  limit?: number;
  nextToken?: string | null;
}

interface SeamlessSearchItem {
  searchResultId?: string;
  name?: string;
  company?: string;
  title?: string;
  department?: string;
  seniority?: string;
  domain?: string;
  city?: string;
  state?: string;
  country?: string;
  liUrl?: string;
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
  const { firstName, lastName } = splitName(item.name || "");
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
): Promise<SeamlessSearchItem[]> {
  const apiKey = getKey();
  if (!apiKey) return [];

  const body: Record<string, unknown> = {
    limit: Math.min(filters.limit || 25, 100),
  };
  if (filters.titles?.length) body.jobTitle = filters.titles;
  if (filters.seniorities?.length) body.seniority = filters.seniorities;
  if (filters.departments?.length) body.department = filters.departments;
  if (filters.keywords) body.contactKeyword = [filters.keywords];
  if (filters.fullName) body.fullName = filters.fullName;
  if (filters.companyName) body.companyName = [filters.companyName];
  if (filters.companyDomains?.length) body.companyDomain = filters.companyDomains;
  if (filters.countries?.length) body.contactCountry = filters.countries;
  if (filters.states?.length) body.contactState = filters.states;
  if (filters.nextToken) body.nextToken = filters.nextToken;

  try {
    const res = await fetch(`${SEAMLESS_BASE}/search/contacts`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: SeamlessSearchItem[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/** Submit a research (enrichment) job. Returns the requestIds to poll. */
async function submitResearch(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const apiKey = getKey();
  if (!apiKey) return [];
  try {
    const res = await fetch(`${SEAMLESS_BASE}/contacts/research`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      // 422 = insufficient credits / missing license; treat as "no results".
      return [];
    }
    const json = (await res.json()) as { requestIds?: string[] };
    return Array.isArray(json.requestIds) ? json.requestIds : [];
  } catch {
    return [];
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
  const requestIds = await submitResearch({ searchResultIds: ids.slice(0, 100) });
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
  const items = (await searchContactsRaw(filters)).map(mapSearchItem);
  if (!opts.enrich || items.length === 0) return items;
  return enrichBySearchIds(items);
}

/** Enrich people by identity (name+company/domain, email, or LinkedIn URL). */
export async function seamlessEnrichByIdentity(
  identities: Array<{
    contactName?: string;
    companyName?: string;
    domain?: string;
    title?: string;
    email?: string;
    liProfileUrl?: string;
  }>,
): Promise<SeamlessPerson[]> {
  if (!getKey() || identities.length === 0) return [];
  const requestIds = await submitResearch({ contacts: identities.slice(0, 100) });
  const enriched = await pollResearch(requestIds);
  return enriched.map((r) => mapEnrichedContact(r.contact));
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
