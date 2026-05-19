import * as cheerio from "cheerio";

const TEAM_PATHS = [
  "/team", "/about", "/about-us", "/attorneys", "/staff", "/partners",
  "/our-team", "/people", "/professionals", "/meet-the-team", "/leadership",
  "/lawyers", "/consultants", "/who-we-are", "/founders", "/management",
  "/executive-team", "/management-team", "/our-story", "/meet-us",
  "/firm", "/the-firm", "/our-firm", "/bios", "/bio", "/biography",
];

const TITLE_KEYWORDS = [
  "owner", "founder", "co-founder", "cofounder", "partner", "managing partner",
  "principal", "managing attorney", "senior attorney", "director",
  "associate", "consultant", "advisor", "attorney", "lawyer",
  "cpa", "broker", "agent", "president", "ceo", "chief executive",
  "vice president", "head of", "coordinator", "specialist", "manager",
  "immigration", "counsel", "paralegal", "analyst", "strategist",
  "entrepreneur", "investor", "executive", "officer", "managing director",
];

const SENIORITY_MAP: Record<string, string> = {
  owner: "owner", founder: "owner", "co-founder": "owner", cofounder: "owner",
  partner: "partner", "managing partner": "partner", principal: "partner",
  "managing attorney": "partner", president: "owner", ceo: "owner",
  "chief executive": "owner", "managing director": "owner",
  director: "director", "senior director": "director", "vice president": "director",
  "senior attorney": "senior", "senior consultant": "senior", "senior advisor": "senior",
  attorney: "associate", associate: "associate", consultant: "associate", advisor: "associate",
  paralegal: "staff", assistant: "staff", coordinator: "staff", staff: "staff",
};

export interface ScrapedPerson {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  seniority: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  e2ViaBio: boolean;
  internationalBio: boolean;
  source: "website";
}

function extractEmails(text: string): string[] {
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  return [...new Set((text.match(emailRegex) || []).filter(e => !e.includes("example.com") && !e.includes("youremail")))];
}

function extractPhones(text: string): string[] {
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  return [...new Set(text.match(phoneRegex) || [])];
}

function extractLinkedIn(text: string): string | null {
  const liRegex = /https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/;
  const match = text.match(liRegex);
  return match ? match[0] : null;
}

function detectSeniority(title: string): string {
  const t = title.toLowerCase();
  for (const [kw, level] of Object.entries(SENIORITY_MAP)) {
    if (t.includes(kw)) return level;
  }
  return "associate";
}

function hasE2Content(text: string): boolean {
  return /e-?2\s*visa|e2\s*visa|investor\s*visa|eb-?5/i.test(text);
}

function hasInternationalContent(text: string): boolean {
  return /international|foreign national|cross.?border|global client/i.test(text);
}

/**
 * Comprehensive set of words that appear capitalized in headings/links
 * but are NOT valid parts of a human name.
 */
const NOT_A_NAME_WORD = new Set([
  // Common action verbs
  "about", "apply", "book", "browse", "build", "buy", "call", "check", "choose",
  "click", "close", "connect", "contact", "continue", "create", "discover",
  "download", "enter", "explore", "find", "follow", "get", "give", "go", "help",
  "join", "know", "learn", "leave", "login", "make", "meet", "navigate",
  "need", "open", "pay", "plan", "process", "reach", "read", "receive",
  "register", "request", "review", "save", "schedule", "search", "see",
  "send", "share", "show", "sign", "start", "stay", "submit", "subscribe",
  "take", "try", "understand", "unlock", "update", "use", "view", "visit",
  "watch", "work", "write",
  // Pronouns / determiners
  "all", "any", "both", "each", "every", "few", "its", "many", "more",
  "most", "my", "no", "none", "our", "several", "some", "that", "the",
  "their", "these", "this", "those", "what", "which", "who", "your",
  // Common adjectives
  "best", "better", "big", "certified", "common", "complete", "dedicated",
  "different", "easy", "effective", "experienced", "expert", "free", "full",
  "great", "high", "important", "international", "latest", "leading",
  "local", "long", "main", "new", "next", "official", "other", "premier",
  "professional", "proven", "ready", "real", "right", "simple", "small",
  "special", "strong", "top", "trusted", "unique", "wide",
  // Common nouns (page sections / UI labels)
  "about", "account", "advice", "answers", "apply", "areas", "articles",
  "attorney", "attorneys", "blog", "business", "card", "cases", "center",
  "client", "clients", "company", "conditions", "consultants", "contact",
  "content", "details", "directory", "documents", "eligibility", "experts",
  "faqs", "firm", "forms", "franchise", "frequently", "guidelines", "home",
  "how", "immigration", "info", "information", "inquiry", "investors",
  "issues", "law", "lawyers", "menu", "more", "navigation", "news", "offices",
  "options", "page", "partners", "pathto", "people", "policy", "portal",
  "press", "privacy", "process", "professionals", "questions", "resources",
  "reviews", "rights", "services", "site", "solutions", "staff", "steps",
  "support", "team", "terms", "today", "topics", "updates", "visa", "visas",
  "way", "why", "works",
  // Adverbs
  "always", "commonly", "frequently", "generally", "here", "how", "just",
  "never", "now", "often", "only", "quickly", "recently", "simply",
  "typically", "usually", "when", "where", "while", "why",
  // Job title words that can appear capitalized but are NOT name parts
  "associate", "attorney", "broker", "chief", "consultant", "counsel",
  "director", "executive", "founding", "general", "junior", "legal",
  "licensed", "managing", "member", "officer", "paralegal", "partner",
  "president", "principal", "senior", "specialist", "strategist",
  "vice", "counsel", "lawyer",
  // Legal practice area / injury words (appear as headings on law firm sites)
  "injury", "injuries", "settlement", "settlements", "defective", "negligence",
  "lawsuit", "lawsuits", "claim", "claims", "damages", "liability", "accident",
  "accidents", "malpractice", "discrimination", "harassment", "wrongful",
  "personal", "employment", "workplace", "criminal", "divorce", "custody",
  "property", "intellectual", "trademark", "copyright", "patent",
  "corporate", "litigation", "arbitration", "mediation", "bankruptcy",
  "estate", "probate", "trust", "taxation", "environmental", "construction",

  // Common franchise/brand nouns
  "burger", "hortons", "starbucks", "subway", "dunkin",
  "king", "queen", "prince", "princess",
  // Institutions / places that appear capitalized
  "house", "white", "black", "federal", "state", "national", "global",
  "american", "united", "supreme", "district", "court", "congress",
  // Business / finance words
  "investment", "investments", "solutions", "capital", "asset", "assets",
  "fund", "funds", "wealth", "advisory", "advisors", "holdings",
  "ventures", "ventures", "properties", "realty", "estate",
  // Job-related words that can appear as capitalized nouns
  "manager", "coordinator", "analyst", "recruiter", "developer",
  "engineer", "technician", "representative", "assistant",
  // Website feature / section / product words
  "tracker", "timeline", "application", "program", "programme", "pathway",
  "checklist", "dashboard", "wizard", "intake", "portal", "centre",
  "stream", "module", "platform", "suite", "hub", "tool",
  // Canadian / geographic words appearing in immigration website headings
  "british", "columbia", "ontario", "alberta", "quebec", "provincial",
  "federal", "canadian", "immigrant", "migration", "permanent",
  // Common phrase-starters that capitalise in headings
  "case", "family", "related", "similar", "average", "percentage",
  "founded", "status", "held", "publicly", "privately", "ownership",
  "financing", "revenue", "employee", "category", "industry", "stage",
  "seed", "series", "growth", "early", "late", "acquisition",
  // Generic nouns used as headings
  "network", "alias", "strategic", "customer", "human", "product",
  "data", "enterprise", "infrastructure", "integration", "automation",
  "validation", "migration", "pipeline", "database", "architect",
  // Cities / countries common in immigration website headers
  "toronto", "vancouver", "montreal", "ottawa", "calgary",
  "chicago", "houston", "dallas", "boston", "seattle", "denver",
  "london", "paris", "dubai", "australia", "germany", "india",
  // Canadian provinces and territories (common in Canadian immigration websites)
  "manitoba", "saskatchewan", "brunswick", "newfoundland", "labrador",
  "territories", "territory", "nunavut", "yukon", "alberta", "ontario",
  "columbia", "quebec", "provincial", "federal", "atlantic",
  // Immigration program / category words that appear as headings
  "express", "entry", "draw", "draws", "pilot", "stream", "pathway",
  "skilled", "worker", "workers", "nominee", "nominees", "provincial",
  "entrepreneur", "entrepreneurs", "humanitarian", "compassionate",
  "citizenship", "citzenship", "residency", "permit", "permits",
  "renewal", "renewals", "waiver", "waivers",
  // Common UI / page-structure words that appear capitalised in 2-word combos
  "phone", "number", "email", "profile", "picture", "photo", "image", "link",
  "contact", "address", "location", "map", "form", "button", "menu",
  "calculator", "checker", "estimator", "finder", "locator",
  // Common immigration form / document words
  "assessment", "assessments", "evaluation", "consultation",
  "document", "documents", "application", "applications",
  "market", "markets", "impact", "does", "ways", "types",
  "immigrate", "migration", "migrate",
  // US visa category / immigration program name words
  "cultural", "exchange", "extraordinary", "ability", "treaty", "trader",
  "specialty", "occupation", "occupations", "border", "reunification",
  "green", "cards", "card", "videos", "moving", "based",
  "visitor", "visitors", "investor", "investors", "intracompany",
  "transferee", "transferees", "religious", "workers", "unskilled",
  // Image / media labels
  "flag", "icon", "icons", "banner", "graphic", "logo", "image",
  "photo", "picture", "avatar", "thumbnail",
  // Generic descriptor words often used as headings on websites
  "tech", "technology", "digital", "virtual", "hybrid", "remote",
  "corporate", "commercial", "residential", "industrial",
  "premium", "standard", "basic", "advanced", "professional",
  "ultimate", "essential", "complete", "comprehensive",
  // Common English pronouns / articles / prepositions that slip through
  "us", "we", "our", "it", "is", "its", "the", "and", "for", "with",
  // Recruitment / HR words
  "hire", "hiring", "recruitment", "career", "careers", "jobs", "job",
  "vacancy", "vacancies", "apply", "position",
  // Newsletter / CTA labels
  "newsletter", "subscribe", "updates", "news", "latest", "learn",
  "more", "read", "sign", "register", "join", "download",
  // Government / legal status words
  "non", "selection", "selections", "notice", "notices", "regulation",
  "regulations", "section", "article", "amendment", "clause",
  // Generic compass / location qualifiers
  "north", "south", "east", "west", "central", "greater",
  // Street / address abbreviations (appear in contact sections and footers)
  "rd", "st", "ave", "blvd", "ln", "ct", "dr", "pl", "sq", "hwy", "pkwy", "ste",
  "street", "avenue", "boulevard", "court", "lane", "drive", "highway", "suite",
  // Common tree names used in street names
  "spruce", "maple", "oak", "pine", "elm", "cedar", "birch", "walnut", "chestnut",
  "ash", "willow", "cherry", "poplar", "magnolia", "cypress", "sycamore",
  // Common English words capitalised at line/sentence start in body text
  "congrats", "congratulations", "replay", "value", "weekly",
  "meetup", "meetups", "immersive", "presentation", "technical",
  "acquisitions", "according", "episode", "series", "report", "study",
  // Consumer / general-public words
  "consumer", "consumers", "protecting", "seeking", "serving",
  "providing", "helping", "fighting", "winning", "supporting",
  "defending", "representing", "recovering", "navigating",
  // Gerunds and present-participles that masquerade as names in headings
  "ensuring", "offering", "delivering", "achieving", "pursuing",
  "managing", "handling", "resolving", "obtaining", "securing",
  "creating", "building", "growing", "scaling", "launching",
  // Words that appear in related/suggested content headings
  "mystic", "seeking", "guide", "tips", "advice", "overview",
  "explained", "defined", "basics", "fundamentals", "essentials",
  // Numbers / ordinal words
  "first", "second", "third", "fourth", "fifth", "sixth",
  "top", "best", "worst", "most", "least", "many", "few",
]);

/**
 * Returns true only if a word could plausibly be part of a human name.
 * Must be 2-25 chars, letters only, not a known non-name word.
 */
function isValidNameWord(word: string): boolean {
  if (!word || word.length < 2 || word.length > 25) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-]+$/.test(word)) return false;
  if (NOT_A_NAME_WORD.has(word.toLowerCase())) return false;
  // Reject all-lowercase (real names start with capital in headings)
  if (word === word.toLowerCase() && word.length > 2) return false;
  return true;
}

// Regex for a plausible capitalized full name (First [Middle] Last)
const NAME_RE = /\b([A-Z][a-z]{1,20}(?:[-'][A-Z][a-z]{1,15})?)\s+([A-Z][a-z]{1,20}(?:[-'][A-Z][a-z]{1,15})?(?:\s+[A-Z][a-z]{1,15})?)\b/g;

function extractNamesFromText(text: string): Array<{ firstName: string; lastName: string; fullName: string }> {
  const results: Array<{ firstName: string; lastName: string; fullName: string }> = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(text)) !== null) {
    const firstName = m[1].trim();
    const lastName = m[2].trim().split(" ").slice(-1)[0]; // take last word as surname
    const fullName = `${firstName} ${lastName}`.trim();

    if (seen.has(fullName)) continue;

    // Both parts must pass name-word validation
    if (!isValidNameWord(firstName)) continue;
    if (!isValidNameWord(lastName)) continue;

    // First and last must be different words
    if (firstName.toLowerCase() === lastName.toLowerCase()) continue;

    seen.add(fullName);
    results.push({ firstName, lastName, fullName });
  }
  return results;
}

function isSkippableHeading(text: string): boolean {
  const lc = text.toLowerCase().trim();
  // Too long or too short to be a person name
  if (lc.length > 60 || lc.length < 4) return true;
  // Pure navigation / section headings
  const sectionPhrases = [
    "our team", "meet the team", "about us", "contact us", "privacy policy",
    "terms of", "all rights", "learn more", "read more", "get in touch",
    "call now", "send us", "our firm", "law firm", "who we are",
    "leadership team", "management team", "our people", "our attorneys",
    "meet our team", "the team", "why choose", "how we", "what we",
    "our services", "practice areas", "free consultation", "schedule",
    "get started", "request info", "sign up", "log in", "frequently asked",
    "questions and", "apply now", "learn about", "find out", "contact us",
    "build your", "start your", "grow your", "your path",
  ];
  return sectionPhrases.some(p => lc.includes(p));
}

/**
 * Primary extraction pass: structured scrape using heading context.
 * ONLY accepts a person if a job title can be found in nearby text.
 */
function extractPeopleFromHeadings(html: string): ScrapedPerson[] {
  const $ = cheerio.load(html);
  const results: ScrapedPerson[] = [];
  const seen = new Set<string>();

  $("h1, h2, h3").each((_, el) => {
    const headingText = $(el).text().trim();
    if (isSkippableHeading(headingText)) return;

    const names = extractNamesFromText(headingText);
    if (names.length === 0) return;

    // Look at surrounding context for title + contact info
    const $parent = $(el).parent();
    const contextText = $parent.text().trim().slice(0, 600);

    // Also check next 2 siblings
    const sibText = [$(el).next(), $(el).next().next()]
      .map(s => s.text().trim())
      .join(" ")
      .slice(0, 200);

    const fullContext = contextText + " " + sibText;
    const ctxLc = fullContext.toLowerCase();

    for (const { firstName, lastName, fullName } of names) {
      if (seen.has(fullName)) continue;

      // REQUIRE a job title to be present — no title = not a person entry
      let jobTitle: string | null = null;
      for (const kw of TITLE_KEYWORDS) {
        if (ctxLc.includes(kw)) {
          const titleMatch = new RegExp(`[^.\\n]{0,30}${kw}[^.\\n]{0,30}`, "i").exec(fullContext);
          if (titleMatch) {
            jobTitle = titleMatch[0].trim().replace(/^[,|·\-–—\s]+/, "").slice(0, 80);
            break;
          }
        }
      }

      if (!jobTitle) continue; // Skip if no job title found near the name

      seen.add(fullName);
      results.push({
        fullName,
        firstName,
        lastName,
        jobTitle,
        seniority: detectSeniority(jobTitle),
        email: extractEmails(fullContext)[0] || null,
        phone: extractPhones(fullContext)[0] || null,
        linkedinUrl: extractLinkedIn(fullContext),
        bio: contextText.slice(0, 300),
        e2ViaBio: hasE2Content(contextText),
        internationalBio: hasInternationalContent(contextText),
        source: "website",
      });
    }
  });

  return results;
}

/**
 * Secondary extraction pass: scan all text-containing elements.
 * Very strict — requires both a name AND a title in the same block.
 */
function extractPeopleFromBodyText(html: string): ScrapedPerson[] {
  const $ = cheerio.load(html);
  const results: ScrapedPerson[] = [];
  const seen = new Set<string>();

  $("body").find("p, div, article, section").each((_, el) => {
    // Skip nav, header, footer, sidebar elements — they contain menus not person bios
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || "";
    const cls = ($(el).attr("class") || "").toLowerCase();
    const id  = ($(el).attr("id") || "").toLowerCase();
    if (["nav","header","footer","aside"].includes(tag)) return;
    if (/nav|menu|sidebar|footer|header|breadcrumb|widget/.test(cls + id)) return;

    const text = $(el).text().trim();
    // Minimum 80 chars — rules out 1-3 word navigation labels
    if (text.length < 80 || text.length > 800) return;

    const lc = text.toLowerCase();
    // Must contain a title keyword
    const hasTitleKeyword = TITLE_KEYWORDS.some(kw => lc.includes(kw));
    if (!hasTitleKeyword) return;

    const names = extractNamesFromText(text);
    for (const { firstName, lastName, fullName } of names) {
      if (seen.has(fullName)) continue;

      let jobTitle: string | null = null;
      for (const kw of TITLE_KEYWORDS) {
        if (lc.includes(kw)) {
          const titleMatch = new RegExp(`[^.\\n]{0,30}${kw}[^.\\n]{0,30}`, "i").exec(text);
          if (titleMatch) {
            jobTitle = titleMatch[0].trim().replace(/^[,|·\-–—\s]+/, "").slice(0, 80);
            break;
          }
        }
      }

      if (!jobTitle) continue; // Require title context here too

      seen.add(fullName);
      results.push({
        fullName,
        firstName,
        lastName,
        jobTitle,
        seniority: detectSeniority(jobTitle),
        email: extractEmails(text)[0] || null,
        phone: extractPhones(text)[0] || null,
        linkedinUrl: extractLinkedIn(text),
        bio: text.slice(0, 300),
        e2ViaBio: hasE2Content(text),
        internationalBio: hasInternationalContent(text),
        source: "website",
      });
    }
  });

  return results.slice(0, 15);
}

/**
 * Extract from JSON-LD structured data — most reliable when present.
 * Handles @type: Person, Attorney, Employee and org member/employee arrays.
 */
function extractFromStructuredData(html: string): ScrapedPerson[] {
  const $ = cheerio.load(html);
  const results: ScrapedPerson[] = [];
  const seen = new Set<string>();

  const PERSON_TYPES = new Set(["Person","Attorney","Physician","Employee","MedicalBusiness"]);

  const addPerson = (p: Record<string, unknown>) => {
    const fullName = String(p.name || "").trim();
    if (!fullName || fullName.split(/\s+/).length < 2) return;
    const parts = fullName.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    if (!isValidNameWord(firstName)) return;
    if (!isValidNameWord(lastName.split(" ").pop() || lastName)) return;
    if (seen.has(fullName.toLowerCase())) return;
    seen.add(fullName.toLowerCase());
    const jobTitleRaw = String(p.jobTitle || p.jobName || p.position || "").trim();
    const jobTitle = (jobTitleRaw && TITLE_KEYWORDS.some(kw => jobTitleRaw.toLowerCase().includes(kw)))
      ? jobTitleRaw.slice(0, 80) : null;
    const sameAs = Array.isArray(p.sameAs) ? (p.sameAs as string[]).find(u => u.includes("linkedin")) : String(p.sameAs || "");
    results.push({
      fullName,
      firstName,
      lastName,
      jobTitle,
      seniority: jobTitle ? detectSeniority(jobTitle) : "associate",
      email: String(p.email || "").replace(/^mailto:/, "") || null,
      phone: String(p.telephone || "").replace(/^tel:/, "") || null,
      linkedinUrl: sameAs?.includes("linkedin") ? sameAs : null,
      bio: String(p.description || "").slice(0, 300) || null,
      e2ViaBio: false,
      internationalBio: false,
      source: "website",
    });
  };

  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const type = String((entry as Record<string, unknown>)["@type"] || "");
        if (PERSON_TYPES.has(type)) {
          addPerson(entry as Record<string, unknown>);
        } else {
          // Extract from member/employee/founder arrays
          for (const field of ["member","employee","founder","alumni","knowsAbout"]) {
            const arr = (entry as Record<string, unknown>)[field];
            if (Array.isArray(arr)) {
              arr.filter((m: unknown) => PERSON_TYPES.has(String((m as Record<string,unknown>)["@type"] || "")))
                 .forEach(m => addPerson(m as Record<string, unknown>));
            }
          }
        }
      }
    } catch { /* ignore bad JSON */ }
  });

  // Also check HTML microdata (itemprop="name" within itemtype containing "Person")
  $("[itemtype]").each((_, el) => {
    const itemtype = $(el).attr("itemtype") || "";
    if (!itemtype.toLowerCase().includes("person") && !itemtype.toLowerCase().includes("attorney")) return;
    const name = $(el).find("[itemprop='name']").first().text().trim()
      || $(el).find("[itemprop='givenName'], [itemprop='familyName']").map((_, n) => $(n).text().trim()).get().join(" ");
    if (!name) return;
    const jobTitle = $(el).find("[itemprop='jobTitle']").first().text().trim() || null;
    const email = $(el).find("[itemprop='email']").first().text().replace(/^mailto:/, "").trim() || null;
    const phone = $(el).find("[itemprop='telephone']").first().text().replace(/^tel:/, "").trim() || null;
    addPerson({ name, jobTitle, email, telephone: phone } as Record<string, unknown>);
  });

  return results;
}

async function fetchPage(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function parsePeopleFromPage(html: string): ScrapedPerson[] {
  // Try structured data first (most reliable when present)
  const structured = extractFromStructuredData(html);
  if (structured.length > 0) return structured;

  // Then try heading-based extraction (requires title context)
  const headingPeople = extractPeopleFromHeadings(html);
  if (headingPeople.length > 0) return headingPeople;

  // Fall back to full body text scan (also requires title context)
  return extractPeopleFromBodyText(html);
}

function extractDomain(website: string): string | null {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getBaseUrl(website: string): string {
  try {
    const u = new URL(website);
    return `${u.protocol}//${u.host}`;
  } catch {
    return website;
  }
}

export async function scrapeTeamPage(websiteRaw: string): Promise<ScrapedPerson[]> {
  let website = websiteRaw;
  try {
    const u = new URL(websiteRaw);
    ["utm_source","utm_medium","utm_campaign","utm_id","utm_term","utm_content","gclid","fbclid"].forEach(p => u.searchParams.delete(p));
    website = u.toString().replace(/\?$/, "");
  } catch { /* keep original */ }

  const domain = extractDomain(website);
  if (!domain) return [];
  const base = getBaseUrl(website);

  // Fetch homepage to find team/about links
  const homepage = await fetchPage(base);
  if (!homepage) return [];

  const $ = cheerio.load(homepage);

  // Collect team/about page links found on homepage
  const teamUrls: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const full = href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`;
    if (full.includes(domain) && TEAM_PATHS.some(p => href.toLowerCase().includes(p))) {
      if (!teamUrls.includes(full)) teamUrls.push(full);
    }
  });

  // Add standard paths as fallbacks
  for (const path of TEAM_PATHS) {
    const url = `${base}${path}`;
    if (!teamUrls.includes(url)) teamUrls.push(url);
    if (teamUrls.length >= 12) break;
  }

  let allPeople: ScrapedPerson[] = [];

  for (const url of teamUrls.slice(0, 8)) {
    const html = await fetchPage(url);
    if (!html) continue;
    const people = parsePeopleFromPage(html);
    if (people.length > 0) {
      allPeople = people;
      break;
    }
  }

  // Last resort: parse the homepage itself
  if (allPeople.length === 0) {
    allPeople = parsePeopleFromPage(homepage);
  }

  return allPeople;
}

export function extractEmailsFromPage(html: string): string[] {
  const text = cheerio.load(html).text();
  return extractEmails(text);
}

export async function scrapeUrl(url: string): Promise<ScrapedPerson[]> {
  const html = await fetchPage(url);
  if (!html) return [];
  return parsePeopleFromPage(html);
}
