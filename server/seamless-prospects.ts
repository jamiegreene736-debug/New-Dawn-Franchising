/**
 * seamless-prospects.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Seamless-only Lead Research surface. Everything the "Lead Research" tab does
 * — contact search, company search, AI natural-language search, and on-demand
 * email/phone reveal — is powered exclusively by Seamless.AI here.
 *
 *   • Contact/company SEARCH is free (no credits) and returns rich metadata
 *     (name, title, company, location, LinkedIn, industry, headcount, revenue).
 *   • REVEAL (email + phone) is the only step that spends Seamless credits, and
 *     it only runs when the user explicitly asks for it.
 *
 * Results are mapped onto the existing EnrichedContact / EnrichedCompany shapes
 * so the rich result cards (Add to CRM, Add to List, WhatsApp, lead scoring)
 * keep working unchanged.
 */

import {
  seamlessSearchContacts,
  seamlessSearchCompanies,
  seamlessRevealBySearchIds,
  type SeamlessPerson,
  type SeamlessContactFilters,
  type SeamlessCompanyFilters,
} from "./seamless-service";
import { calculateDecisionMakerScore } from "./decision-maker-scorer";
import { createLazyOpenAIClient } from "./openai-client";
import type { EnrichedContact, EnrichedCompany } from "./prospect-enrichment";

const openai = createLazyOpenAIClient();

let idCounter = 0;
function makeId(): string {
  return `sl_${++idCounter}_${Date.now()}`;
}

// ─── Allowed enum values (must match the Seamless API; bad values 400 the call) ─
export const SENIORITY_VALUES = ["C-Level", "VP", "Director", "Manager", "Senior", "Entry Level", "Mid-Level", "Other"];
export const DEPARTMENT_VALUES = ["Sales", "Marketing", "Engineering", "Human Resources", "Finance", "IT", "Operations", "Support", "Legal", "Project Management", "Other"];
export const COMPANY_SIZE_VALUES = ["0 - 1 (Self-employed)", "2 - 10", "11 - 50", "51 - 200", "201 - 500", "501 - 1,000", "1,001 - 5,000", "5,001 - 10,000", "10,001+"];
export const COMPANY_REVENUE_VALUES = ["$0 - $100K", "$100K - $1M", "$1M - $5M", "$5M - $20M", "$20M - $50M", "$50M - $100M", "$100M - $500M", "$500M - $1B", "$1B+"];
export const COMPANY_FOUNDED_VALUES = ["Less than 1 Year", "Last 1-3 Years", "Last 4-10 Years", "10+ Years"];
export const COMPANY_TYPE_VALUES = ["Public", "Private"];

// ─── The filter shape shared with the client ────────────────────────────────

export interface LeadSearchFilters {
  jobTitle?: string[];
  seniority?: string[];
  department?: string[];
  industry?: string[];
  companySize?: string[];
  companyRevenue?: string[];
  companyName?: string[];
  companyDomain?: string[];
  contactState?: string[];
  contactCountry?: string[];
  contactZipCode?: string[];
  locationType?: "bothOR" | "bothAND" | "company" | "contact";
  keywords?: string[];
  fullName?: string[];
  companyType?: "" | "Public" | "Private";
  technologies?: string[];
  companyFoundedOn?: string[];
  pastCompany?: string[];
  newsTypes?: string[];
}

function normalizeDomain(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return s;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  return s.toLowerCase();
}

function clean(arr?: string[]): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out = arr.map((s) => (s || "").trim()).filter(Boolean);
  return out.length ? out : undefined;
}

function toContactFilters(f: LeadSearchFilters, limit: number, nextToken?: string | null): SeamlessContactFilters {
  return {
    titles: clean(f.jobTitle),
    seniorities: clean(f.seniority),
    departments: clean(f.department),
    industries: clean(f.industry),
    companySizes: clean(f.companySize),
    companyRevenues: clean(f.companyRevenue),
    companyNames: clean(f.companyName),
    companyDomains: clean(f.companyDomain)?.map(normalizeDomain),
    states: clean(f.contactState),
    countries: clean(f.contactCountry),
    zipCodes: clean(f.contactZipCode),
    locationType: f.locationType,
    keywordList: clean(f.keywords),
    fullNames: clean(f.fullName),
    companyType: f.companyType || undefined,
    technologies: clean(f.technologies),
    companyFoundedOn: clean(f.companyFoundedOn),
    pastCompanyNames: clean(f.pastCompany),
    newsTypes: clean(f.newsTypes),
    limit,
    nextToken: nextToken || undefined,
  };
}

function toCompanyFilters(f: LeadSearchFilters, limit: number, nextToken?: string | null): SeamlessCompanyFilters {
  return {
    companyNames: clean(f.companyName),
    companyDomains: clean(f.companyDomain)?.map(normalizeDomain),
    states: clean(f.contactState),
    countries: clean(f.contactCountry),
    zipCodes: clean(f.contactZipCode),
    industries: clean(f.industry),
    keywordList: clean(f.keywords),
    companySizes: clean(f.companySize),
    companyRevenues: clean(f.companyRevenue),
    technologies: clean(f.technologies),
    companyType: f.companyType || undefined,
    foundedOn: clean(f.companyFoundedOn),
    newsTypes: clean(f.newsTypes),
    limit,
    nextToken: nextToken || undefined,
  };
}

function deriveCategory(f: LeadSearchFilters): string {
  return f.jobTitle?.[0] || f.industry?.[0] || f.seniority?.[0] || f.keywords?.[0] || "Seamless Search";
}

function deriveLocation(f: LeadSearchFilters): string {
  return f.contactState?.[0] || f.contactCountry?.[0] || "Global";
}

function contactAddress(p: SeamlessPerson): string | null {
  const parts = [p.city, p.state, p.country].map((s) => (s || "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function companyLocation(p: SeamlessPerson): string | null {
  const parts = [p.companyCity, p.companyState, p.companyCountry].map((s) => (s || "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function companyBlurb(industries?: string[] | null, sizeRange?: string | null): string | null {
  const bits: string[] = [];
  if (industries && industries.length) bits.push(industries[0]);
  if (sizeRange) bits.push(`${sizeRange} employees`);
  return bits.length ? bits.join(" · ") : null;
}

function scoreFor(p: SeamlessPerson) {
  return calculateDecisionMakerScore({
    jobTitle: p.jobTitle,
    seniority: p.seniority,
    email: p.email,
    emailVerified: p.emailVerified,
    emailConfidence: p.emailConfidence,
    phone: p.phone,
    phoneType: p.phone ? "unverified" : null,
    linkedinUrl: p.linkedinUrl,
    bio: null,
  });
}

function personToContact(p: SeamlessPerson, companyId: string, companyName: string): EnrichedContact {
  const score = scoreFor(p);
  const revealed = !!(p.email || p.phone);
  return {
    id: makeId(),
    companyId,
    companyName,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    jobTitle: p.jobTitle,
    seniority: p.seniority || "associate",
    email: p.email,
    emailVerified: p.emailVerified,
    emailConfidence: p.emailConfidence,
    emailStatus: p.emailStatus,
    phone: p.phone,
    phoneType: p.phone ? "unverified" : null,
    whatsappEligible: !!p.phone,
    linkedinUrl: p.linkedinUrl,
    bio: null,
    sources: ["Seamless.AI"],
    decisionMakerScore: score.total,
    scoreBreakdown: score,
    e2ViaBio: false,
    internationalBio: false,
    ailaNumber: false,
    address: contactAddress(p),
    searchResultId: p.searchResultId,
    revealed,
    industries: p.industries ?? null,
    employeeSizeRange: p.employeeSizeRange ?? null,
    department: p.department ?? null,
    companyRevenue: p.companyRevenue ?? null,
    companyType: p.companyType ?? null,
    companyLocation: companyLocation(p),
    website: p.domain ? `https://${p.domain.replace(/^https?:\/\//, "")}` : null,
  };
}

// ─── Contact search (free) ───────────────────────────────────────────────────

export async function seamlessContactSearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<{ companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number; nextToken: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { people, nextToken } = await seamlessSearchContacts(toContactFilters(filters, limit, opts.nextToken));

  const category = deriveCategory(filters);
  const location = deriveLocation(filters);
  const groups = new Map<string, EnrichedCompany>();

  for (const p of people) {
    const key = (p.domain || p.company || `unknown-${groups.size}`).toLowerCase();
    let co = groups.get(key);
    if (!co) {
      const domain = p.domain || null;
      co = {
        id: makeId(),
        name: p.company || domain || "Unknown company",
        domain,
        website: domain ? `https://${domain}` : null,
        address: null,
        addressValidity: "unknown",
        phone: null,
        googleRating: null,
        googleReviews: null,
        source: "Seamless.AI",
        contacts: [],
        enrichmentStatus: "no_contacts",
        searchCategory: category,
        searchLocation: location,
        description: companyBlurb(p.industries, p.employeeSizeRange),
      };
      groups.set(key, co);
    }
    co.contacts.push(personToContact(p, co.id, co.name));
  }

  const companies = Array.from(groups.values()).map((c) => ({
    ...c,
    enrichmentStatus: (c.contacts.length ? "complete" : "no_contacts") as EnrichedCompany["enrichmentStatus"],
  }));

  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const enrichedCount = companies.filter((c) => c.contacts.length > 0).length;
  return { companies, totalContacts, enrichedCount, nextToken };
}

// ─── Company search (free) ──────────────────────────────────────────────────

export async function seamlessCompanySearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<{ companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number; nextToken: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { companies: raw, nextToken } = await seamlessSearchCompanies(toCompanyFilters(filters, limit, opts.nextToken));
  const category = deriveCategory(filters);
  const location = deriveLocation(filters);

  const companies: EnrichedCompany[] = raw.map((c) => ({
    id: makeId(),
    name: c.name,
    domain: c.domain,
    website: c.website,
    address: c.address,
    addressValidity: "unknown",
    phone: null,
    googleRating: null,
    googleReviews: null,
    source: "Seamless.AI",
    contacts: [],
    enrichmentStatus: "no_contacts",
    searchCategory: category,
    searchLocation: c.state || c.country || location,
    description: c.description || companyBlurb(c.industries, c.employeeSizeRange),
  }));

  return { companies, totalContacts: 0, enrichedCount: 0, nextToken };
}

// ─── Reveal (spends Seamless credits) ───────────────────────────────────────

export interface RevealResult {
  searchResultId: string | null;
  fullName: string;
  email: string | null;
  emailConfidence: number;
  emailStatus: string;
  emailVerified: boolean;
  phone: string | null;
  phoneType: string | null;
  whatsappEligible: boolean;
  linkedinUrl: string | null;
  decisionMakerScore: number;
  scoreBreakdown: ReturnType<typeof calculateDecisionMakerScore>;
}

export async function seamlessRevealContacts(searchResultIds: string[]): Promise<RevealResult[]> {
  const ids = searchResultIds.filter((x): x is string => !!x);
  if (ids.length === 0) return [];
  const revealed = await seamlessRevealBySearchIds(ids);
  return revealed.map(({ searchResultId, person }) => {
    const score = scoreFor(person);
    return {
      searchResultId,
      fullName: person.fullName,
      email: person.email,
      emailConfidence: person.emailConfidence,
      emailStatus: person.emailStatus,
      emailVerified: person.emailVerified,
      phone: person.phone,
      phoneType: person.phone ? "unverified" : null,
      whatsappEligible: !!person.phone,
      linkedinUrl: person.linkedinUrl,
      decisionMakerScore: score.total,
      scoreBreakdown: score,
    };
  });
}

// ─── AI natural-language → structured filters ───────────────────────────────

function keepEnum(values: string[] | undefined, allowed: string[]): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const set = new Set(allowed.map((a) => a.toLowerCase()));
  const out = values.filter((v) => typeof v === "string" && set.has(v.toLowerCase()))
    // normalise casing back to the canonical enum value
    .map((v) => allowed.find((a) => a.toLowerCase() === v.toLowerCase())!);
  return out.length ? out : undefined;
}

function sanitizeFilters(parsed: any): LeadSearchFilters {
  if (!parsed || typeof parsed !== "object") return {};
  const strArr = (v: any): string[] | undefined => {
    if (Array.isArray(v)) return clean(v.map(String));
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return undefined;
  };
  const companyType = typeof parsed.companyType === "string" && COMPANY_TYPE_VALUES.includes(parsed.companyType)
    ? (parsed.companyType as "Public" | "Private")
    : undefined;
  return {
    jobTitle: strArr(parsed.jobTitle),
    seniority: keepEnum(strArr(parsed.seniority), SENIORITY_VALUES),
    department: keepEnum(strArr(parsed.department), DEPARTMENT_VALUES),
    companySize: keepEnum(strArr(parsed.companySize), COMPANY_SIZE_VALUES),
    companyRevenue: keepEnum(strArr(parsed.companyRevenue), COMPANY_REVENUE_VALUES),
    companyFoundedOn: keepEnum(strArr(parsed.companyFoundedOn), COMPANY_FOUNDED_VALUES),
    companyType,
    companyName: strArr(parsed.companyName),
    companyDomain: strArr(parsed.companyDomain),
    contactState: strArr(parsed.contactState),
    contactCountry: strArr(parsed.contactCountry),
    fullName: strArr(parsed.fullName),
    keywords: strArr(parsed.keywords),
  };
}

const AI_SYSTEM_PROMPT = `You convert a recruiter/sales prospecting request into a JSON filter object for the Seamless.AI contact database. Output ONLY a JSON object — no prose.

Use ONLY these keys (omit any you can't infer; never invent other keys):
- jobTitle: string[]  (e.g. ["CEO","Chief Executive Officer","Founder"])
- seniority: string[]  ONLY from: ["C-Level","VP","Director","Manager","Senior","Entry Level","Mid-Level","Other"]
- department: string[]  ONLY from: ["Sales","Marketing","Engineering","Human Resources","Finance","IT","Operations","Support","Legal","Project Management","Other"]
- companySize: string[]  ONLY from: ["0 - 1 (Self-employed)","2 - 10","11 - 50","51 - 200","201 - 500","501 - 1,000","1,001 - 5,000","5,001 - 10,000","10,001+"]
- companyRevenue: string[]  ONLY from: ["$0 - $100K","$100K - $1M","$1M - $5M","$5M - $20M","$20M - $50M","$50M - $100M","$100M - $500M","$500M - $1B","$1B+"]
- companyFoundedOn: string[]  ONLY from: ["Less than 1 Year","Last 1-3 Years","Last 4-10 Years","10+ Years"]
- companyType: "Public" | "Private"
- companyName: string[]
- companyDomain: string[]  (bare domains, e.g. ["acme.com"])
- contactState: string[]  (FULL US state names, e.g. ["Texas","California"])
- contactCountry: string[]  (FULL country names, e.g. ["United States"])
- fullName: string[]  (when a specific person is named)
- keywords: string[]  (industries, skills, niches, or anything that doesn't fit the keys above — e.g. an industry like "property management" goes here)

Rules:
- "more than 500 employees" → companySize ["501 - 1,000","1,001 - 5,000","5,001 - 10,000","10,001+"].
- Map an industry/niche to keywords, NOT to a made-up key.
- For seniority words: "CEO/CFO/CTO/owner/founder/president/chief" → "C-Level"; "VP/vice president" → "VP".
Example input: "Finance CEOs in Texas with more than 500 employees"
Example output: {"jobTitle":["CEO","Chief Executive Officer"],"seniority":["C-Level"],"department":["Finance"],"contactState":["Texas"],"companySize":["501 - 1,000","1,001 - 5,000","5,001 - 10,000","10,001+"]}`;

export async function parseNaturalLanguageToFilters(query: string): Promise<LeadSearchFilters> {
  const q = (query || "").trim();
  if (!q) return {};
  try {
    const resp = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: q },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
    ]);
    if (!resp) return { keywords: [q] };
    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const filters = sanitizeFilters(parsed);
    // If the model produced nothing usable, fall back to a keyword search.
    const hasAny = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : !!v));
    return hasAny ? filters : { keywords: [q] };
  } catch (err) {
    console.error("[Seamless AI parse] failed:", err);
    return { keywords: [q] };
  }
}
