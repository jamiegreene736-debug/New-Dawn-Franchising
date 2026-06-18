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
  type SeamlessCompany,
  type SeamlessContactFilters,
  type SeamlessCompanyFilters,
  type ProviderError,
} from "./seamless-service";
import { apolloSearchContacts, apolloSearchCompanies } from "./apollo-service";
import { origamiSearchContacts, origamiSearchCompanies } from "./origami-service";
import { calculateDecisionMakerScore } from "./decision-maker-scorer";
import { scoreProspect } from "./lead-intelligence";
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
  companyNameSearchType?: "default" | "related" | "exact";
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
  jobChangeType?: string; // "New Hire" | "New Promotion"
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

function toContactFilters(f: LeadSearchFilters, limit: number, nextToken?: string | null, maxResults?: number): SeamlessContactFilters {
  return {
    titles: clean(f.jobTitle),
    seniorities: clean(f.seniority),
    departments: clean(f.department),
    industries: clean(f.industry),
    companySizes: clean(f.companySize),
    companyRevenues: clean(f.companyRevenue),
    companyNames: clean(f.companyName),
    companyNameSearchType: f.companyNameSearchType,
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
    jobChangeType: f.jobChangeType || undefined,
    limit,
    maxResults,
    nextToken: nextToken || undefined,
  };
}

function toCompanyFilters(f: LeadSearchFilters, limit: number, nextToken?: string | null): SeamlessCompanyFilters {
  return {
    companyNames: clean(f.companyName),
    companyNameSearchType: f.companyNameSearchType,
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

// ─── Provider identity ───────────────────────────────────────────────────────

export type ProviderId = "seamless" | "apollo" | "origami";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  seamless: "Seamless.AI",
  apollo: "Apollo.io",
  origami: "Origami",
};

function personToContact(
  p: SeamlessPerson,
  companyId: string,
  companyName: string,
  source: string = "Seamless.AI",
): EnrichedContact {
  const score = scoreFor(p);
  const revealed = !!(p.email || p.phone);
  const intel = scoreProspect({
    jobTitle: p.jobTitle,
    seniority: p.seniority,
    company: p.company,
    country: p.country,
    email: p.email,
    phone: p.phone,
    linkedinUrl: p.linkedinUrl,
    text: [p.jobTitle, p.company, (p.industries || []).join(" ")].filter(Boolean).join(" "),
  });
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
    sources: [source],
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
    timeAtCompany: p.timeAtCompany ?? null,
    startedAtCurrentCompany: p.startedAtCurrentCompany ?? null,
    icpScore: intel.composite,
    icpFitScore: intel.fitScore,
    icpIntentScore: intel.intentScore,
    icpTier: intel.tier,
    icpAudience: intel.audience,
    icpReasons: intel.reasons,
    icpExplanation: intel.explanation,
  };
}

// ─── Shared grouping (provider-agnostic) ─────────────────────────────────────

export type SearchResult = { companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number; nextToken: string | null; error?: ProviderError | null };

/** Tag a provider error with which provider produced it (for honest messaging). */
function withProvider(error: ProviderError | null | undefined, provider: ProviderId): ProviderError | null {
  return error ? { ...error, provider } : null;
}

/** Group a normalised people list into EnrichedCompany[] tagged with the source provider. */
function groupPeopleIntoCompanies(
  people: SeamlessPerson[],
  filters: LeadSearchFilters,
  source: string,
  nextToken: string | null,
): SearchResult {
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
        source,
        contacts: [],
        enrichmentStatus: "no_contacts",
        searchCategory: category,
        searchLocation: location,
        description: companyBlurb(p.industries, p.employeeSizeRange),
      };
      groups.set(key, co);
    }
    co.contacts.push(personToContact(p, co.id, co.name, source));
  }

  const companies = Array.from(groups.values()).map((c) => ({
    ...c,
    // Best ICP matches first within each company.
    contacts: [...c.contacts].sort((a, b) => (b.icpScore ?? 0) - (a.icpScore ?? 0)),
    enrichmentStatus: (c.contacts.length ? "complete" : "no_contacts") as EnrichedCompany["enrichmentStatus"],
  }));
  // Rank companies by their single strongest contact so the hottest fits float up.
  companies.sort((a, b) => (b.contacts[0]?.icpScore ?? 0) - (a.contacts[0]?.icpScore ?? 0));

  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const enrichedCount = companies.filter((c) => c.contacts.length > 0).length;
  return { companies, totalContacts, enrichedCount, nextToken };
}

/** Map a provider's company list into EnrichedCompany[] tagged with the source provider. */
function mapCompanies(
  raw: SeamlessCompany[],
  filters: LeadSearchFilters,
  source: string,
  nextToken: string | null,
): SearchResult {
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
    source,
    contacts: [],
    enrichmentStatus: "no_contacts",
    searchCategory: category,
    searchLocation: c.state || c.country || location,
    description: c.description || companyBlurb(c.industries, c.employeeSizeRange),
  }));
  return { companies, totalContacts: 0, enrichedCount: 0, nextToken };
}

// ─── Contact search (free) ───────────────────────────────────────────────────

export async function seamlessContactSearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { people, nextToken, error } = await seamlessSearchContacts(toContactFilters(filters, limit, opts.nextToken));
  const result = groupPeopleIntoCompanies(people, filters, "Seamless.AI", nextToken);
  return { ...result, error: withProvider(error, "seamless") };
}

// ─── Company search (free) ──────────────────────────────────────────────────

export async function seamlessCompanySearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { companies: raw, nextToken, error } = await seamlessSearchCompanies(toCompanyFilters(filters, limit, opts.nextToken));
  const result = mapCompanies(raw, filters, "Seamless.AI", nextToken);
  return { ...result, error: withProvider(error, "seamless") };
}

// ─── Apollo.io (supplemental) ────────────────────────────────────────────────

export async function apolloContactSearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; maxResults?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  // Apollo's api_search is free + paginates cheaply, so pull the full roster
  // (up to maxResults) in one search instead of stranding the user on page one.
  const maxResults = opts.maxResults != null ? Math.max(opts.maxResults, limit) : undefined;
  const { people, nextToken, error } = await apolloSearchContacts(toContactFilters(filters, limit, opts.nextToken, maxResults));
  const result = groupPeopleIntoCompanies(people, filters, "Apollo.io", nextToken);
  return { ...result, error: withProvider(error, "apollo") };
}

export async function apolloCompanySearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { companies: raw, nextToken, error } = await apolloSearchCompanies(toCompanyFilters(filters, limit, opts.nextToken));
  const result = mapCompanies(raw, filters, "Apollo.io", nextToken);
  return { ...result, error: withProvider(error, "apollo") };
}

// ─── Origami (supplemental) ──────────────────────────────────────────────────

export async function origamiContactSearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { people, nextToken, error } = await origamiSearchContacts(toContactFilters(filters, limit, opts.nextToken));
  const result = groupPeopleIntoCompanies(people, filters, "Origami", nextToken);
  return { ...result, error: withProvider(error, "origami") };
}

export async function origamiCompanySearch(
  filters: LeadSearchFilters,
  opts: { limit?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const { companies: raw, nextToken, error } = await origamiSearchCompanies(toCompanyFilters(filters, limit, opts.nextToken));
  const result = mapCompanies(raw, filters, "Origami", nextToken);
  return { ...result, error: withProvider(error, "origami") };
}

// ─── Provider dispatch ───────────────────────────────────────────────────────

export async function providerSearch(
  provider: ProviderId,
  mode: "contacts" | "companies",
  filters: LeadSearchFilters,
  opts: { limit?: number; maxResults?: number; nextToken?: string | null } = {},
): Promise<SearchResult> {
  if (provider === "apollo") {
    return mode === "companies" ? apolloCompanySearch(filters, opts) : apolloContactSearch(filters, opts);
  }
  if (provider === "origami") {
    return mode === "companies" ? origamiCompanySearch(filters, opts) : origamiContactSearch(filters, opts);
  }
  return mode === "companies" ? seamlessCompanySearch(filters, opts) : seamlessContactSearch(filters, opts);
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
    jobChangeType: typeof parsed.jobChangeType === "string" && ["New Hire", "New Promotion"].includes(parsed.jobChangeType)
      ? parsed.jobChangeType
      : undefined,
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
- jobChangeType: "New Hire" | "New Promotion"  (ONLY when the user asks for people who recently changed jobs — "new hires", "recently promoted", "just started", "newly appointed")

Rules:
- "more than 500 employees" → companySize ["501 - 1,000","1,001 - 5,000","5,001 - 10,000","10,001+"].
- Map an industry/niche to keywords, NOT to a made-up key.
- For seniority words: "CEO/CFO/CTO/owner/founder/president/chief" → "C-Level"; "VP/vice president" → "VP".
Example input: "Finance CEOs in Texas with more than 500 employees"
Example output: {"jobTitle":["CEO","Chief Executive Officer"],"seniority":["C-Level"],"department":["Finance"],"contactState":["Texas"],"companySize":["501 - 1,000","1,001 - 5,000","5,001 - 10,000","10,001+"]}`;

// ─── Deterministic heuristic parse (no OpenAI dependency) ────────────────────
// A network-free parser that extracts the high-value filters from a prospecting
// sentence. It is the SAFETY NET: the AI Search box must keep working — and must
// never dump the whole sentence into keywords — even when OpenAI is unreachable.

// Full US state names → Seamless expects the full name (contactState passes
// straight through), so we normalise to it.
const US_STATE_NAMES: Record<string, string> = {
  alabama: "Alabama", alaska: "Alaska", arizona: "Arizona", arkansas: "Arkansas",
  california: "California", colorado: "Colorado", connecticut: "Connecticut",
  delaware: "Delaware", florida: "Florida", georgia: "Georgia", hawaii: "Hawaii",
  idaho: "Idaho", illinois: "Illinois", indiana: "Indiana", iowa: "Iowa",
  kansas: "Kansas", kentucky: "Kentucky", louisiana: "Louisiana", maine: "Maine",
  maryland: "Maryland", massachusetts: "Massachusetts", michigan: "Michigan",
  minnesota: "Minnesota", mississippi: "Mississippi", missouri: "Missouri",
  montana: "Montana", nebraska: "Nebraska", nevada: "Nevada",
  "new hampshire": "New Hampshire", "new jersey": "New Jersey", "new mexico": "New Mexico",
  "new york": "New York", "north carolina": "North Carolina", "north dakota": "North Dakota",
  ohio: "Ohio", oklahoma: "Oklahoma", oregon: "Oregon", pennsylvania: "Pennsylvania",
  "rhode island": "Rhode Island", "south carolina": "South Carolina", "south dakota": "South Dakota",
  tennessee: "Tennessee", texas: "Texas", utah: "Utah", vermont: "Vermont",
  virginia: "Virginia", washington: "Washington", "west virginia": "West Virginia",
  wisconsin: "Wisconsin", wyoming: "Wyoming",
};

// Country lexicon → the full name Seamless expects (contactCountry).
const COUNTRY_NAMES: Record<string, string> = {
  "united states": "United States", usa: "United States", us: "United States", america: "United States",
  "united kingdom": "United Kingdom", uk: "United Kingdom", "great britain": "United Kingdom", england: "United Kingdom",
  canada: "Canada", australia: "Australia", india: "India", ireland: "Ireland",
  germany: "Germany", france: "France", spain: "Spain", italy: "Italy",
  netherlands: "Netherlands", mexico: "Mexico", brazil: "Brazil",
  china: "China", japan: "Japan", singapore: "Singapore",
  "united arab emirates": "United Arab Emirates", uae: "United Arab Emirates", "new zealand": "New Zealand",
};

// Title phrases → canonical jobTitle variants + a seniority bucket (only values
// from SENIORITY_VALUES). Order matters: more specific phrases come first so
// "vice president" wins over the "president" nested inside it.
const TITLE_LEXICON: Array<{ re: RegExp; titles: string[]; seniority?: string }> = [
  { re: /\bchief executive officers?\b|\bceos?\b/i,               titles: ["CEO", "Chief Executive Officer"], seniority: "C-Level" },
  { re: /\bchief financial officers?\b|\bcfos?\b/i,               titles: ["CFO", "Chief Financial Officer"], seniority: "C-Level" },
  { re: /\bchief (?:technology|technical) officers?\b|\bctos?\b/i, titles: ["CTO", "Chief Technology Officer"], seniority: "C-Level" },
  { re: /\bchief operating officers?\b|\bcoos?\b/i,               titles: ["COO", "Chief Operating Officer"], seniority: "C-Level" },
  { re: /\bchief marketing officers?\b|\bcmos?\b/i,               titles: ["CMO", "Chief Marketing Officer"], seniority: "C-Level" },
  { re: /\bvice presidents?\b|\bvps?\b/i,                         titles: ["VP", "Vice President"], seniority: "VP" },
  { re: /\bpresidents?\b/i,                                       titles: ["President"], seniority: "C-Level" },
  { re: /\bco[- ]?founders?\b|\bfounders?\b/i,                    titles: ["Founder", "Co-Founder"], seniority: "C-Level" },
  { re: /\b(?:business )?owners?\b/i,                             titles: ["Owner"], seniority: "C-Level" },
  { re: /\bdirectors?\b/i,                                        titles: ["Director"], seniority: "Director" },
  { re: /\bmanagers?\b/i,                                         titles: ["Manager"], seniority: "Manager" },
  { re: /\bprincipals?\b/i,                                       titles: ["Principal"] },
  { re: /\bpartners?\b/i,                                         titles: ["Partner"] },
];

// People-noun vocabulary that gates the "<people> at <company>" capture.
const PEOPLE_NOUNS =
  "contacts?|people|persons?|employees?|leads?|staff|team members?|team|workers?|reps?|decision[- ]?makers?|executives?|prospects?|professionals?";

// Once one of these connectives appears it ends the captured company tail, so
// "contacts at globevisa in texas" → company "globevisa", not "globevisa in texas".
const TRAILING_STOP = /\b(?:in|from|for|with|located|based|near|around|that|who|which|and|or)\b.*$/i;

function titleCaseCompany(raw: string): string {
  const s = raw.trim().replace(/[.,!?;:]+$/g, "").trim();
  // Leave ALLCAPS / camel-brand tokens alone ("IBM", "GlobeVisa"); otherwise
  // Title Case a plain multi-word name ("acme widgets" → "Acme Widgets").
  if (/^[A-Z0-9&.\- ]+$/.test(s) || /[a-z][A-Z]/.test(s)) return s;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Deterministic, OpenAI-independent parse of a prospecting sentence into
 * structured filters. Pulls out company / titles / state / country WITHOUT ever
 * stuffing the whole sentence into keywords.
 */
function heuristicParseFilters(query: string): LeadSearchFilters {
  const q = (query || "").trim();
  if (!q) return {};
  const out: LeadSearchFilters = {};

  // 1) Company. ONLY the high-confidence "<people-noun> at|from <X>" shape. A bare
  //    "at" fires on idioms ("at scale", "at least"); the weak connectives "for"/
  //    "with" capture common nouns ("contacts for review", "people with
  //    experience"), so only the strong company prepositions "at"/"from" are used.
  //    The captured tail is routed: a domain-shaped value → companyDomain; a
  //    generic lowercase industry/category phrase ("tech companies", "law firms")
  //    → a keyword (the niche), NOT a literal company; otherwise → companyName.
  const companyGated = new RegExp(`(?:${PEOPLE_NOUNS})\\s+(?:at|from)\\s+(.+)$`, "i");
  const CATEGORY_TAIL =
    /\b(?:compan(?:y|ies)|firms?|startups?|organi[sz]ations?|businesses?|agenc(?:y|ies)|enterprises?|corporations?|providers?|vendors?|brands?|institutions?|industr(?:y|ies)|equity)\s*$/i;
  const cm = q.match(companyGated);
  if (cm && cm[1]) {
    const tail = cm[1]
      .replace(TRAILING_STOP, "")
      .trim()
      .replace(/^(?:the|a|an)\s+/i, "")
      .replace(/[.,!?;:]+$/g, "")
      .trim();
    const lower = tail.toLowerCase();
    // Don't mistake a US state / country ("...at Texas") for a company.
    if (tail && !US_STATE_NAMES[lower] && !COUNTRY_NAMES[lower]) {
      const categoryNiche = CATEGORY_TAIL.test(tail) ? tail.replace(CATEGORY_TAIL, "").trim() : "";
      if (/^[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}$/i.test(tail)) {
        out.companyDomain = [lower];
      } else if (categoryNiche && !/[A-Z]/.test(categoryNiche)) {
        // All-lowercase generic category ("tech companies") → search the niche as
        // a keyword. A capitalized brand before the category word ("Acme
        // Industries", "General Motors Company") is kept as a real company below.
        out.keywords = [categoryNiche];
      } else {
        out.companyName = [titleCaseCompany(tail)];
      }
    }
  }

  // 2) Job titles + seniority (several may match).
  const titles: string[] = [];
  const seniorities: string[] = [];
  for (const entry of TITLE_LEXICON) {
    if (entry.re.test(q)) {
      for (const t of entry.titles) if (!titles.includes(t)) titles.push(t);
      if (entry.seniority && !seniorities.includes(entry.seniority)) seniorities.push(entry.seniority);
    }
  }
  if (titles.length) out.jobTitle = titles;
  if (seniorities.length) out.seniority = seniorities;

  // 3) US states (longest name first so "north carolina" wins over "carolina").
  const states: string[] = [];
  for (const name of Object.keys(US_STATE_NAMES).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(q)) {
      const canonical = US_STATE_NAMES[name];
      if (!states.includes(canonical)) states.push(canonical);
    }
  }
  if (states.length) out.contactState = states;

  // 4) Countries — only when no US state matched (states are more specific).
  if (!states.length) {
    const countries: string[] = [];
    for (const name of Object.keys(COUNTRY_NAMES).sort((a, b) => b.length - a.length)) {
      if (new RegExp(`\\b${name.replace(/\./g, "\\.").replace(/ /g, "\\s+")}\\b`, "i").test(q)) {
        const canonical = COUNTRY_NAMES[name];
        if (!countries.includes(canonical)) countries.push(canonical);
      }
    }
    if (countries.length) out.contactCountry = countries;
  }

  return out;
}

// Last-resort CORE phrase (NEVER the whole sentence): strips "find/show me/all
// the/<people> at|in|for" scaffolding, leaving the substantive noun phrase as a
// single keyword. Returns "" if nothing meaningful remains.
function corePhrase(query: string): string {
  let s = (query || "").trim().toLowerCase();
  s = s.replace(/^\s*(?:please\s+)?(?:find|get|show|give|list|search|look\s+up|pull|fetch)\s+(?:me\s+)?/i, "");
  s = s.replace(/^\s*(?:all\s+)?(?:the\s+)?(?:of\s+)?/i, "");
  s = s.replace(new RegExp(`\\b(?:${PEOPLE_NOUNS})\\b`, "gi"), " ");
  s = s.replace(/\b(?:at|from|for|with|in|of|located|based|near|around|that|who|which|and|or|the|a|an)\b/gi, " ");
  s = s.replace(/[^\p{L}\p{N}\s&.\-]/gu, " ").replace(/\s+/g, " ").trim();
  return s;
}

// AI natural-language → structured filters. OpenAI (gpt-4o-mini) is the primary
// parser; the deterministic heuristic is a FALLBACK used only when OpenAI is
// unavailable, times out, or returns nothing usable — never a gap-filler over a
// good AI parse (which would inject a wrong company and over-constrain results).
// Critically, NEITHER path ever searches the whole raw sentence as a keyword —
// the failure that made the AI Search box silently return zero results.
export async function parseNaturalLanguageToFilters(query: string): Promise<LeadSearchFilters> {
  const q = (query || "").trim();
  if (!q) return {};

  let ai: LeadSearchFilters | null = null;
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
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    if (!resp) {
      console.warn("[Seamless AI parse] OpenAI timed out (8s) — falling back to heuristic parse.");
    } else {
      ai = sanitizeFilters(JSON.parse(resp.choices[0]?.message?.content ?? "{}"));
    }
  } catch (err: any) {
    console.error("[Seamless AI parse] OpenAI failed — falling back to heuristic parse:", err?.message || err);
  }

  if (ai) {
    // Guard against the model echoing the whole prompt back as a single keyword.
    if (ai.keywords?.some((kw) => kw.trim().toLowerCase() === q.toLowerCase())) delete ai.keywords;
    if (Object.values(ai).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))) return ai;
  }

  // OpenAI unavailable or produced nothing usable → deterministic heuristic.
  const heuristic = heuristicParseFilters(q);
  if (Object.values(heuristic).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))) return heuristic;

  // Last resort: the cleaned CORE phrase (NEVER the full sentence). If even that
  // is empty, return {} so the route replies "couldn't interpret" rather than
  // running a guaranteed-empty search.
  const core = corePhrase(q);
  return core ? { keywords: [core] } : {};
}
