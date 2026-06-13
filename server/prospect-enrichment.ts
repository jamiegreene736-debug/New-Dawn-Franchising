import { scrapeTeamPage, type ScrapedPerson } from "./website-scraper";
import { seamlessSearchByDomain, seamlessSearchByCompanyName, seamlessMatchPerson } from "./seamless-service";
import { hunterFindEmail, hunterDomainPattern, buildEmailFromPattern } from "./hunter-service";
import { calculateDecisionMakerScore } from "./decision-maker-scorer";
import { searchProspects, searchByFreeQuery } from "./prospect-search";
import { verifyEmailBatch } from "./zerobounce-service";
import { lookupPhoneBatch, validateAddressFormat } from "./twilio-lookup";
import { findAllPeopleAtCompany, type FoundPerson } from "./people-finder";
import { createLazyOpenAIClient } from "./openai-client";

const openai = createLazyOpenAIClient();

export interface EnrichedContact {
  id: string; // temporary local ID for UI
  companyId: string;
  companyName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  seniority: string;
  email: string | null;
  emailVerified: boolean;
  emailConfidence: number;
  emailStatus: string;
  phone: string | null;
  phoneType: string | null;
  whatsappEligible: boolean;
  linkedinUrl: string | null;
  bio: string | null;
  sources: string[];
  decisionMakerScore: number;
  scoreBreakdown: {
    titleScore: number;
    reachabilityScore: number;
    relevanceScore: number;
    total: number;
    tier: string;
    tierLabel: string;
    tierEmoji: string;
  };
  e2ViaBio: boolean;
  internationalBio: boolean;
  ailaNumber: boolean;
  address: string | null;        // home/office address from Whitepages enrichment
  searchResultId?: string | null; // Seamless searchResultId (for reveal-on-demand)
  revealed?: boolean;             // true once email/phone have been revealed (credits spent)
  industries?: string[] | null;  // company industries from Seamless search
  employeeSizeRange?: string | null; // company headcount band from Seamless search
  department?: string | null;    // contact department from Seamless search
  companyRevenue?: string | null; // company revenue band from Seamless search
  companyType?: string | null;   // Public / Private from Seamless search
  companyLocation?: string | null; // company HQ city/state/country from Seamless search
  website?: string | null;       // company website (derived from domain)
  timeAtCompany?: string | null;           // human-readable tenure at current company (Seamless)
  startedAtCurrentCompany?: string | null; // ISO date the contact started at the company (Seamless)
}

export interface EnrichedCompany {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  address: string | null;
  addressValidity: "valid" | "partial" | "international" | "invalid" | "unknown";
  phone: string | null;
  googleRating: number | null;
  googleReviews: number | null;
  source: string;
  contacts: EnrichedContact[];
  enrichmentStatus: "complete" | "partial" | "no_contacts";
  searchCategory: string;
  searchLocation: string;
  description?: string | null;
}

let contactCounter = 0;
function makeId() { return `ec_${++contactCounter}_${Date.now()}`; }

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch { return null; }
}

// Known generic/role-based words that are NOT real person names.
// If either the first name or last name is one of these, discard the contact.
const GENERIC_NAME_WORDS = new Set([
  // Role/dept words
  "visa", "card", "info", "contact", "admin", "support", "hello", "help",
  "sales", "team", "office", "service", "services", "mail", "email",
  "noreply", "no-reply", "newsletter", "billing", "legal", "accounting",
  "marketing", "press", "media", "pr", "hr", "recruiter", "recruiting",
  "consulting", "group", "partners", "law", "firm", "associates", "llc",
  "inc", "corp", "co", "company", "center", "centre", "management",
  "immigration", "attorney", "attorneys", "franchise", "franchising",
  // Job title words that appear capitalized but are not name parts
  "founding", "managing", "senior", "junior", "associate", "principal",
  "partner", "director", "executive", "chief", "officer", "president",
  "vice", "general", "counsel", "specialist", "strategist", "broker",
  // Common English words confused for names
  "explained", "own", "by", "and", "or", "the", "for", "your", "our",
  "all", "more", "how", "why", "what", "when", "where",
  // Brand names
  "burger", "hortons", "starbucks", "subway", "dunkin", "king",
  // Geographic regions (appear when Hunter guesses names from email local-parts like "easterneurope@")
  "eastern", "western", "northern", "southern", "central", "global",
  "europe", "european", "asia", "asian", "africa", "african",
  "americas", "pacific", "atlantic", "caribbean", "middle",
  "north", "south", "east", "west",
  // Software/product names that appear as Hunter alias guesses (e.g. "microsoftteams@")
  "microsoft", "teams", "slack", "zoom", "webex", "skype", "workspace",
  "google", "apple", "oracle", "salesforce", "hubspot", "stripe",
  // Email action aliases (e.g. "joiningglobevisa@", "careers@")
  "joining", "join", "career", "careers", "apply", "applying", "applied",
  "welcome", "onboarding", "hire", "hiring", "jobs", "alerts", "notifications",
  "enquiry", "enquiries", "inquiry", "inquiries", "feedback", "general",
  "events", "news", "updates", "hello", "hey", "hi",
]);

/**
 * Returns true only if firstName + lastName together look like a plausible real human name.
 * Rejects: missing parts, single-char names, generic words, digits, special chars.
 */
function isLikelyRealPersonName(firstName: string, lastName: string): boolean {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();

  // Both parts must be present
  if (!f || !l) return false;

  // Each part must be at least 2 characters
  if (f.length < 2 || l.length < 2) return false;

  // Only allow letters, hyphens, apostrophes, spaces (for compound names)
  const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ'\-\s]+$/;
  if (!namePattern.test(f) || !namePattern.test(l)) return false;

  // First letter of each part should be capitalized (or we capitalize it)
  // Allow names that start with a capital or are all-caps (e.g. JUAN)
  // Reject all-lowercase names from Apollo (usually garbage)
  if (f === f.toLowerCase() && f.length > 2) return false;
  if (l === l.toLowerCase() && l.length > 2) return false;

  // Reject if either word is a known generic term
  if (GENERIC_NAME_WORDS.has(f.toLowerCase())) return false;
  if (GENERIC_NAME_WORDS.has(l.toLowerCase())) return false;

  // Reject suspiciously long name parts (likely descriptions, not names)
  if (f.length > 25 || l.length > 25) return false;

  // Reject if full name only has 1 unique word (e.g. "John John")
  if (f.toLowerCase() === l.toLowerCase()) return false;

  return true;
}

function mergePeople(
  scraped: ScrapedPerson[],
  seamlessResults: Awaited<ReturnType<typeof seamlessSearchByDomain>>
): Array<{
  fullName: string; firstName: string; lastName: string;
  jobTitle: string | null; seniority: string;
  email: string | null; emailConfidence: number;
  phone: string | null; linkedinUrl: string | null;
  bio: string | null; e2ViaBio: boolean; internationalBio: boolean;
  sources: string[];
}> {
  const people = new Map<string, ReturnType<typeof mergePeople>[0]>();

  for (const p of scraped) {
    if (!isLikelyRealPersonName(p.firstName, p.lastName)) continue;
    const key = p.fullName.toLowerCase().replace(/\s+/g, "");
    people.set(key, {
      fullName: p.fullName, firstName: p.firstName, lastName: p.lastName,
      jobTitle: p.jobTitle, seniority: p.seniority,
      email: p.email, emailConfidence: p.email ? 60 : 0,
      phone: p.phone, linkedinUrl: p.linkedinUrl,
      bio: p.bio, e2ViaBio: p.e2ViaBio, internationalBio: p.internationalBio,
      sources: ["website"],
    });
  }

  for (const a of seamlessResults) {
    // Skip Seamless contacts with fake/generic/pattern-derived names
    if (!isLikelyRealPersonName(a.firstName, a.lastName)) continue;

    const fullName = `${a.firstName} ${a.lastName}`.trim();
    const key = fullName.toLowerCase().replace(/\s+/g, "");
    const existing = people.get(key);
    if (existing) {
      if (!existing.email && a.email) { existing.email = a.email; existing.emailConfidence = a.emailConfidence; }
      if (!existing.phone && a.phone) existing.phone = a.phone;
      if (!existing.linkedinUrl && a.linkedinUrl) existing.linkedinUrl = a.linkedinUrl;
      if (!existing.jobTitle && a.jobTitle) existing.jobTitle = a.jobTitle;
      if (!existing.sources.includes("seamless")) existing.sources.push("seamless");
    } else {
      people.set(key, {
        fullName, firstName: a.firstName, lastName: a.lastName,
        jobTitle: a.jobTitle, seniority: a.seniority || "associate",
        email: a.email, emailConfidence: a.emailConfidence,
        phone: a.phone, linkedinUrl: a.linkedinUrl,
        bio: null, e2ViaBio: false, internationalBio: false,
        sources: ["seamless"],
      });
    }
  }

  return [...people.values()];
}

async function enrichCompany(
  serpResult: { name: string; website: string | null; phone: string | null; address: string | null; source: string; sourceUrl: string | null; snippet?: string | null },
  category: string,
  location: string,
  hunterPatterns: Map<string, string | null>,
  seamlessFirst = false
): Promise<EnrichedCompany> {
  const companyId = makeId();
  const domain = extractDomain(serpResult.website);

  let people: ReturnType<typeof mergePeople> = [];

  if (seamlessFirst) {
    // ── Seamless-first strategy (used for "By Company URL") ────────────────
    // Try Seamless domain search first — it finds real people by domain
    const seamlessResults = domain ? await seamlessSearchByDomain(domain, 10) : [];

    if (seamlessResults.length >= 2) {
      // Seamless found enough people — skip website scraping entirely
      people = mergePeople([], seamlessResults);
    } else {
      // Seamless came up thin — run website scraping AND company-name fallback in parallel
      const [scraped, seamlessByName] = await Promise.all([
        serpResult.website ? scrapeTeamPage(serpResult.website) : Promise.resolve([]),
        seamlessSearchByCompanyName(serpResult.name, domain, 8),
      ]);
      people = mergePeople(scraped, [...seamlessResults, ...seamlessByName]);
    }

    // If still empty, try Seamless company-name alone
    if (people.length === 0 && domain) {
      const byName = await seamlessSearchByCompanyName(serpResult.name, domain, 8);
      people = mergePeople([], byName);
    }
  } else {
    // ── Standard strategy (used for "By Category & Location") ─────────────
    // Run website scraping and Seamless in parallel for speed
    const [scraped, seamlessResults] = await Promise.all([
      serpResult.website ? scrapeTeamPage(serpResult.website) : Promise.resolve([]),
      domain ? seamlessSearchByDomain(domain, 8) : Promise.resolve([]),
    ]);
    people = mergePeople(scraped, seamlessResults);

    // Fallback: Seamless company-name search
    if (people.length === 0) {
      const fallbackResults = await seamlessSearchByCompanyName(serpResult.name, domain, 6);
      if (fallbackResults.length > 0) {
        people = mergePeople([], fallbackResults);
      }
    }
  }

  // Phase 5b: Hunter email finding for scraped people who have no email (max 3 calls per company)
  if (domain) {
    let pattern = hunterPatterns.get(domain);
    if (pattern === undefined) {
      pattern = await hunterDomainPattern(domain);
      hunterPatterns.set(domain, pattern);
    }

    let hunterCalls = 0;
    for (const person of people) {
      if (!person.email && person.firstName && person.lastName) {
        if (hunterCalls < 3) {
          const hunterResult = await hunterFindEmail(person.firstName, person.lastName, domain);
          hunterCalls++;
          if (hunterResult) {
            person.email = hunterResult.email;
            person.emailConfidence = hunterResult.confidence;
            if (!person.sources.includes("hunter")) person.sources.push("hunter");
          } else if (pattern) {
            person.email = buildEmailFromPattern(person.firstName, person.lastName, domain, pattern);
            person.emailConfidence = 55;
            if (!person.sources.includes("hunter_pattern")) person.sources.push("hunter_pattern");
          }
        } else if (pattern) {
          // Use pattern only (no API call) for remaining people
          person.email = buildEmailFromPattern(person.firstName, person.lastName, domain, pattern);
          person.emailConfidence = 50;
          if (!person.sources.includes("hunter_pattern")) person.sources.push("hunter_pattern");
        }
      }
    }
  }

  // Phase 6: Cross-reference emails (ZeroBounce) and phones (Twilio Lookup) concurrently
  const emailsToVerify = [...new Set(people.map((p) => p.email).filter(Boolean) as string[])];
  const phonesToLookup = [...new Set(people.map((p) => p.phone).filter(Boolean) as string[])];

  const [emailResults, phoneResults] = await Promise.all([
    verifyEmailBatch(emailsToVerify, 4),
    lookupPhoneBatch(phonesToLookup, 3),
  ]);

  // Validate company-level address format (no external API needed)
  const addressValidity = validateAddressFormat(serpResult.address);

  // Score each contact using validated data
  const contacts: EnrichedContact[] = people.map((p) => {
    const zbResult = p.email ? emailResults.get(p.email) : undefined;
    const twResult = p.phone ? phoneResults.get(p.phone) : undefined;

    const emailVerified = zbResult ? zbResult.safe : false;
    const emailStatus = zbResult ? zbResult.status : (p.email ? "unverified" : "not_found");
    const phoneType = twResult ? twResult.type : null;
    const whatsappEligible = !!(twResult?.valid && (twResult.type === "mobile" || twResult.type === "voip"));

    // Boost confidence for ZeroBounce-verified emails
    let adjustedConfidence = p.emailConfidence;
    if (zbResult?.status === "valid") adjustedConfidence = Math.min(100, adjustedConfidence + 15);
    else if (zbResult?.status === "invalid") adjustedConfidence = Math.max(0, adjustedConfidence - 40);
    else if (zbResult?.status === "catch-all") adjustedConfidence = Math.min(95, adjustedConfidence + 5);

    const score = calculateDecisionMakerScore({
      jobTitle: p.jobTitle,
      seniority: p.seniority,
      email: p.email,
      emailVerified,
      emailConfidence: adjustedConfidence,
      phone: p.phone,
      phoneType,
      linkedinUrl: p.linkedinUrl,
      bio: p.bio,
      e2ViaBio: p.e2ViaBio,
      internationalBio: p.internationalBio,
    });

    const sources = [...p.sources];
    if (zbResult && zbResult.status !== "unverified") sources.push(`zb:${zbResult.status}`);
    if (twResult && twResult.type !== "unverified") sources.push(`twilio:${twResult.type}`);

    return {
      id: makeId(),
      companyId,
      companyName: serpResult.name,
      fullName: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
      jobTitle: p.jobTitle,
      seniority: p.seniority,
      email: p.email,
      emailVerified,
      emailConfidence: adjustedConfidence,
      emailStatus,
      phone: twResult?.nationalFormat || p.phone,
      phoneType,
      whatsappEligible,
      linkedinUrl: p.linkedinUrl,
      bio: p.bio,
      sources,
      decisionMakerScore: score.total,
      scoreBreakdown: score,
      e2ViaBio: p.e2ViaBio,
      internationalBio: p.internationalBio,
      ailaNumber: false,
      address: (p as unknown as { address?: string | null }).address ?? null,
    };
  });

  // Drop truly useless contacts (score < 10 — no title, no email, no phone, no linkedin)
  const qualifiedContacts = contacts.filter(c => c.decisionMakerScore >= 10);

  // Sort by decision maker score
  qualifiedContacts.sort((a, b) => b.decisionMakerScore - a.decisionMakerScore);

  return {
    id: companyId,
    name: serpResult.name,
    domain,
    website: serpResult.website,
    address: serpResult.address,
    addressValidity,
    phone: serpResult.phone,
    googleRating: null,
    googleReviews: null,
    source: serpResult.source,
    contacts: qualifiedContacts,
    enrichmentStatus: qualifiedContacts.length > 0 ? "complete" : "no_contacts",
    searchCategory: category,
    searchLocation: location,
    description: serpResult.snippet || null,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function runEnrichmentSearch(
  category: string,
  location: string
): Promise<{ companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number }> {
  // Hard 50-second overall deadline
  const deadline = Date.now() + 50_000;

  // Phase 1: SerpAPI search for companies (max 10 results)
  const serpResults = (await withTimeout(
    searchProspects(category, location),
    12_000,
    []
  )).slice(0, 10);

  const hunterPatterns = new Map<string, string | null>();
  const companies: EnrichedCompany[] = [];

  // Enrich companies in batches of 3, stop if we're near the deadline
  const BATCH = 3;
  for (let i = 0; i < serpResults.length; i += BATCH) {
    if (Date.now() > deadline - 5_000) break; // stop 5s before deadline

    const batch = serpResults.slice(i, i + BATCH);
    const timeLeft = deadline - Date.now();
    const perCompanyMs = Math.min(12_000, Math.floor(timeLeft / batch.length));

    const enriched = await Promise.allSettled(
      batch.map((r) =>
        withTimeout(
          enrichCompany(r, category, location, hunterPatterns),
          perCompanyMs,
          {
            id: `ec_timeout_${Date.now()}`,
            name: r.name,
            domain: null,
            website: r.website,
            address: r.address,
            addressValidity: "unknown" as const,
            phone: r.phone,
            googleRating: null,
            googleReviews: null,
            source: r.source,
            contacts: [],
            enrichmentStatus: "no_contacts" as const,
            searchCategory: category,
            searchLocation: location,
            description: r.snippet || null,
          } satisfies EnrichedCompany
        )
      )
    );
    for (const result of enriched) {
      if (result.status === "fulfilled") companies.push(result.value);
    }
  }

  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const enrichedCount = companies.filter((c) => c.contacts.length > 0).length;

  return { companies, totalContacts, enrichedCount };
}

export async function enrichSingleCompany(
  website: string,
  name: string,
  customCategory: string,
  customLocation: string
): Promise<{ companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number }> {
  let normalizedUrl = website.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = "https://" + normalizedUrl;
  try {
    const u = new URL(normalizedUrl);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k => u.searchParams.delete(k));
    normalizedUrl = u.toString().replace(/\?$/, "");
  } catch { /* keep as-is */ }

  const domain = extractDomain(normalizedUrl);
  const domainFallbackName = domain
    ? domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : normalizedUrl;
  const companyId = makeId();
  const cat = customCategory.trim() || "Custom";
  const loc = customLocation.trim() || "Global";

  // ── Step 1: Fetch page metadata first to get the real company name ─────────
  // The page <title> is far more reliable than guessing from the domain prefix.
  // e.g. domain="altbanc.us" → title="Merchant Cash Advance Debt Relief | Altbanc"
  // Titles can be "Tagline | Brand" OR "Brand | Tagline" so we pick intelligently.
  const pageInfo = await withTimeout(fetchPageDescription(normalizedUrl), 6_000, { title: "", description: "" });

  // Extract the brand name segment from the page title.
  // Strategy: split on separators → find the segment whose text overlaps with the
  // domain root (e.g. "altbanc" matches "Altbanc") → fallback to the shortest segment,
  // because brand names are shorter than taglines.
  const titleCompanyName = (() => {
    if (!pageInfo.title) return "";
    const domainRoot = domain ? domain.split(".")[0].toLowerCase().replace(/-/g, "") : "";
    const segments = pageInfo.title
      .split(/\s*[|•–—]\s*|\s+[-\/]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 80);
    if (segments.length === 1) return segments[0];
    // Prefer the segment whose normalised text overlaps with the domain root
    const domainMatch = segments.find(s => {
      const sNorm = s.toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
      return sNorm.includes(domainRoot) || domainRoot.includes(sNorm);
    });
    if (domainMatch) return domainMatch.slice(0, 80);
    // Fallback: shortest segment is most likely the brand name
    return segments.reduce((a, b) => a.length <= b.length ? a : b).slice(0, 80);
  })();

  const companyName = name.trim() || titleCompanyName || domainFallbackName;

  // ── Step 2: Multi-source people discovery using the correct company name ───
  const foundPeople = await withTimeout(findAllPeopleAtCompany(normalizedUrl, companyName), 55_000, []);

  // ── Convert FoundPerson → EnrichedContact ──────────────────────────────────
  // people-finder already ran Twilio validation + country-based WhatsApp probability;
  // we use those results directly instead of re-running a second Twilio batch.
  const contacts: EnrichedContact[] = foundPeople.map(p => {
    const phoneType = p.phoneType || null;
    // WhatsApp eligible: Twilio confirmed mobile/voip, OR phone exists + country prob ≥70%
    const whatsappEligible = p.whatsappEligible ||
      (!!p.phone && (p.whatsappProbability || 0) >= 70);

    const score = calculateDecisionMakerScore({
      jobTitle: p.jobTitle,
      seniority: p.seniority || "associate",
      email: p.email,
      emailVerified: p.emailVerified,
      emailConfidence: p.emailConfidence,
      phone: p.phone,
      phoneType,
      linkedinUrl: p.linkedinUrl,
      bio: p.bio,
      e2ViaBio: p.e2ViaBio,
      internationalBio: p.internationalBio,
    });

    const sources = [...p.sources];
    // Twilio phone type is already embedded in sources by people-finder (e.g. "twilio:mobile")
    // No second lookup needed here.

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
      phoneType,
      whatsappEligible,
      linkedinUrl: p.linkedinUrl,
      bio: p.bio,
      sources,
      decisionMakerScore: score.total,
      scoreBreakdown: score,
      e2ViaBio: p.e2ViaBio,
      internationalBio: p.internationalBio,
      ailaNumber: false,
      address: p.address ?? null,
    };
  });

  // Drop truly useless contacts (score < 10)
  const qualifiedContacts = contacts.filter(c => c.decisionMakerScore >= 10);
  qualifiedContacts.sort((a, b) => b.decisionMakerScore - a.decisionMakerScore);

  const company: EnrichedCompany = {
    id: companyId,
    name: companyName,
    domain,
    website: normalizedUrl,
    address: null,
    addressValidity: "unknown",
    phone: null,
    googleRating: null,
    googleReviews: null,
    source: "manual",
    contacts: qualifiedContacts,
    enrichmentStatus: qualifiedContacts.length > 0 ? "complete" : "no_contacts",
    searchCategory: cat,
    searchLocation: loc,
    description: pageInfo.description || null,
  };

  return {
    companies: [company],
    totalContacts: qualifiedContacts.length,
    enrichedCount: qualifiedContacts.length > 0 ? 1 : 0,
  };
}

async function fetchPageDescription(url: string): Promise<{ title: string; description: string }> {
  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    const res = await fetch(normalized, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    if (!res.ok) return { title: "", description: "" };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i)
      || html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+property=["']og:description["']/i);
    const bodyText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    return {
      title: titleMatch?.[1]?.trim() ?? "",
      description: metaDescMatch?.[1]?.trim() || ogDescMatch?.[1]?.trim() || bodyText,
    };
  } catch {
    return { title: "", description: "" };
  }
}

export async function findSimilarCompanies(
  referenceUrl: string,
  customCategory: string,
): Promise<{ companies: EnrichedCompany[]; totalContacts: number; enrichedCount: number; searchQueries: string[] }> {
  // Normalize URL
  let url = referenceUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const referenceDomain = extractDomain(url);

  // Step 1: Scrape reference company's homepage
  const pageInfo = await withTimeout(fetchPageDescription(url), 8000, { title: "", description: "" });
  const context = `Company title: "${pageInfo.title}"\nDescription: "${pageInfo.description}"`.slice(0, 900);

  // Step 2: Ask OpenAI to generate discovery search queries (15s hard timeout)
  let searchQueries: string[] = [];
  try {
    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a B2B prospecting expert. Given information about a company, generate 3 Google search queries that would find OTHER similar companies (competitors or companies in the same niche). 
Return ONLY a JSON array of 3 strings. Each query should be specific (7-12 words), focused on finding websites of similar businesses. Do NOT include the reference company's own name or domain. Vary the angle: one should target the core service, one the audience, one the geography or niche.
Example output: ["franchise consultant E-2 visa investors USA", "international franchise advisory firm investor visa", "franchise broker services for foreign investors"]`,
          },
          {
            role: "user",
            content: context,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      15_000,
      null
    );
    if (response) {
      const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
      const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
      if (Array.isArray(parsed)) searchQueries = parsed.slice(0, 3).filter(q => typeof q === "string");
    }
  } catch (err) {
    console.error("OpenAI query generation failed:", err);
  }

  // Fallback queries if OpenAI fails
  if (searchQueries.length === 0) {
    const domain = referenceDomain ?? "company";
    searchQueries = [
      `${pageInfo.title || domain} similar companies`,
      `companies like ${domain} services`,
    ];
  }

  // Step 3: Run SerpAPI queries and collect unique companies (dedup by domain)
  const allResults = new Map<string, { name: string; website: string | null; phone: string | null; address: string | null; source: string; sourceUrl: string | null; snippet?: string | null }>();

  for (const q of searchQueries) {
    const results = await withTimeout(searchByFreeQuery(q, 8), 10000, []);
    for (const r of results) {
      const domain = extractDomain(r.website);
      if (!domain) continue;
      if (domain === referenceDomain) continue; // skip the reference company itself
      if (!allResults.has(domain)) {
        allResults.set(domain, {
          name: r.name, website: r.website, phone: r.phone, address: r.address,
          source: r.source, sourceUrl: r.sourceUrl,
          snippet: r.snippet || null,
        });
      }
    }
  }

  const serpResults = [...allResults.values()].slice(0, 12);

  // Step 4: Enrich all found companies
  const category = customCategory.trim() || "Similar Companies";
  const deadline = Date.now() + 55_000;
  const hunterPatterns = new Map<string, string | null>();
  const companies: EnrichedCompany[] = [];

  const BATCH = 3;
  for (let i = 0; i < serpResults.length; i += BATCH) {
    if (Date.now() > deadline - 5_000) break;
    const batch = serpResults.slice(i, i + BATCH);
    const timeLeft = deadline - Date.now();
    const perCompanyMs = Math.min(12_000, Math.floor(timeLeft / batch.length));

    const enriched = await Promise.allSettled(
      batch.map((r) =>
        withTimeout(
          enrichCompany(r, category, "Global", hunterPatterns),
          perCompanyMs,
          {
            id: `ec_timeout_${Date.now()}`,
            name: r.name,
            domain: extractDomain(r.website),
            website: r.website,
            address: r.address,
            addressValidity: "unknown" as const,
            phone: r.phone,
            googleRating: null,
            googleReviews: null,
            source: r.source,
            contacts: [],
            enrichmentStatus: "no_contacts" as const,
            searchCategory: category,
            searchLocation: "Global",
            description: r.snippet || null,
          } satisfies EnrichedCompany
        )
      )
    );
    for (const result of enriched) {
      if (result.status === "fulfilled") companies.push(result.value);
    }
  }

  const totalContacts = companies.reduce((sum, c) => sum + c.contacts.length, 0);
  const enrichedCount = companies.filter((c) => c.contacts.length > 0).length;

  return { companies, totalContacts, enrichedCount, searchQueries };
}

export function getEnrichmentApiStatus() {
  return {
    seamless: !!process.env.SEAMLESS_API_KEY,
    apollo: !!process.env.APOLLO_API_KEY,
    origami: !!process.env.ORIGAMI_API_KEY,
    hunter: !!process.env.HUNTER_API_KEY,
    zerobounce: !!process.env.ZEROBOUNCE_API_KEY,
    proxycurl: !!process.env.PROXYCURL_API_KEY,
    whitepages: !!process.env.WHITEPAGES_API_KEY,
    pdl: !!process.env.PEOPLE_DATA_LABS_API_KEY,
  };
}
