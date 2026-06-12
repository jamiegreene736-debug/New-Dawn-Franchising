/**
 * people-finder.ts
 * Multi-source people discovery engine for "By Company URL" enrichment.
 * Aggregates Seamless.AI, Hunter domain search, SerpAPI (LinkedIn/ZoomInfo/Crunchbase/BBB),
 * People Data Labs, OpenCorporates, website scraping, and email permutation.
 */

import { scrapeTeamPage } from "./website-scraper";
import { hunterFindEmail, hunterDomainPattern, buildEmailFromPattern } from "./hunter-service";
import { verifyEmailBatch } from "./zerobounce-service";
import { lookupPhoneBatch, type PhoneType } from "./twilio-lookup";
import { fetchPeopleFromPdl, enrichGapsViaPdl, pdlLevelToSeniority, type PdlPerson } from "./pdl-service";
import { enrichPeopleFromWhitepages } from "./whitepages-service";
import { seamlessFindPeople, seamlessEnrichByIdentity, type SeamlessPerson } from "./seamless-service";

const HUNTER_BASE = "https://api.hunter.io/v2";
const SERPAPI_BASE = "https://serpapi.com/search.json";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface FoundPerson {
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string | null;
  seniority: string | null;
  email: string | null;
  emailConfidence: number;
  emailVerified: boolean;
  emailStatus: string;
  phone: string | null;
  phoneVerified: boolean;
  phoneType: PhoneType;
  whatsappEligible: boolean;
  whatsappProbability: number;   // 0–100 — estimated chance they're on WhatsApp
  linkedinUrl: string | null;
  bio: string | null;
  country: string | null;        // person's country (from Apollo or website)
  address?: string | null;       // street address found via Whitepages enrichment
  sources: string[];             // which sources found this person
  sourceCount: number;           // number of independent sources
  confidence: "confirmed" | "high" | "medium" | "low";
  e2ViaBio: boolean;
  internationalBio: boolean;
}

/** Default phone meta fields for new FoundPerson objects */
const DEFAULT_PHONE_META = {
  phoneVerified: false as boolean,
  phoneType: "unverified" as PhoneType,
  whatsappEligible: false as boolean,
  whatsappProbability: 0 as number,
};

// ─── WhatsApp country probability table ──────────────────────────────────────
// Research-backed WhatsApp penetration rates by country (% of mobile users).
// Sources: Statista 2024, We Are Social 2024, Meta internal estimates.
// High-probability countries match E-2 visa investor source markets.
const WHATSAPP_COUNTRY_PROB: Record<string, number> = {
  // Latin America — extremely high adoption
  "mexico": 92, "brasil": 95, "brazil": 95, "colombia": 91, "argentina": 90,
  "peru": 88, "chile": 87, "venezuela": 90, "ecuador": 89, "bolivia": 85,
  "uruguay": 82, "paraguay": 80, "costa rica": 84, "panama": 83, "guatemala": 82,
  "honduras": 80, "el salvador": 81, "nicaragua": 79, "cuba": 75, "dominican republic": 83,
  "puerto rico": 78,
  // Middle East & North Africa — very high
  "saudi arabia": 87, "uae": 88, "united arab emirates": 88, "israel": 89,
  "turkey": 82, "egypt": 84, "jordan": 85, "kuwait": 85, "bahrain": 84,
  "qatar": 85, "oman": 83, "lebanon": 86, "iraq": 80, "morocco": 86, "tunisia": 82,
  "algeria": 81, "libya": 75,
  // South & Southeast Asia
  "india": 81, "indonesia": 87, "pakistan": 82, "bangladesh": 76,
  "philippines": 79, "malaysia": 85, "singapore": 78, "myanmar": 72,
  "sri lanka": 74, "nepal": 70, "cambodia": 72, "thailand": 52,
  // Europe — moderate to high
  "germany": 72, "france": 66, "italy": 80, "spain": 85, "portugal": 86,
  "netherlands": 68, "belgium": 65, "switzerland": 71, "austria": 68,
  "poland": 62, "czech republic": 58, "hungary": 63, "romania": 70,
  "bulgaria": 65, "greece": 78, "croatia": 70, "serbia": 68,
  "ukraine": 78, "russia": 40,
  // Africa
  "nigeria": 88, "kenya": 86, "south africa": 82, "ghana": 84, "ethiopia": 75,
  "tanzania": 80, "uganda": 78, "rwanda": 76, "senegal": 80, "cameroon": 78,
  // East Asia — lower WhatsApp (dominated by WeChat/LINE/KakaoTalk)
  "china": 8, "japan": 30, "south korea": 28, "korea": 28, "taiwan": 35,
  // English-speaking countries
  "united states": 25, "usa": 25, "canada": 28, "united kingdom": 52, "uk": 52,
  "australia": 35, "new zealand": 33, "ireland": 60,
};

/**
 * Returns WhatsApp probability (0–100) for a given country string.
 * Normalises to lowercase and tries both exact and partial matches.
 */
function whatsappProbForCountry(country: string | null | undefined): number {
  if (!country) return 0;
  const lc = country.toLowerCase().trim();
  if (WHATSAPP_COUNTRY_PROB[lc] !== undefined) return WHATSAPP_COUNTRY_PROB[lc];
  // Try partial match (e.g. "United States of America" → "united states")
  for (const [key, prob] of Object.entries(WHATSAPP_COUNTRY_PROB)) {
    if (lc.includes(key) || key.includes(lc)) return prob;
  }
  return 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(website: string): string | null {
  try { return new URL(website).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** Simple Levenshtein-based fuzzy match — returns true if similarity ≥ threshold */
function isSameName(a: string, b: string, threshold = 0.75): boolean {
  const na = a.toLowerCase().replace(/[^a-z]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z]/g, "");
  if (na === nb) return true;
  if (Math.abs(na.length - nb.length) > 4) return false;
  // Levenshtein distance
  const m = na.length, n = nb.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = na[i - 1] === nb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const similarity = 1 - dp[m][n] / Math.max(m, n);
  return similarity >= threshold;
}

/** Merge key: normalised full name */
function mergeKey(firstName: string, lastName: string): string {
  return `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, "");
}

/** Map Seamless/other seniority strings to our levels */
function normalizeSeniority(raw: string | null): string {
  if (!raw) return "associate";
  const r = raw.toLowerCase();
  if (["owner", "founder"].some(x => r.includes(x))) return "owner";
  if (["partner", "principal"].some(x => r.includes(x))) return "partner";
  if (["c_suite", "c-suite", "vp", "vice_president"].some(x => r.includes(x))) return "director";
  if (["director", "head"].some(x => r.includes(x))) return "director";
  if (["manager", "senior"].some(x => r.includes(x))) return "senior";
  return "associate";
}

/** Assign overall confidence tier */
function scoreConfidence(p: { sources: string[]; emailVerified: boolean; email: string | null }): FoundPerson["confidence"] {
  const directSources = p.sources.filter(s => ["seamless", "hunter_domain"].includes(s)).length;
  if (p.emailVerified && p.sources.length >= 3) return "confirmed";
  if (directSources >= 2) return "confirmed";
  if (directSources >= 1 && p.email) return "high";
  if (p.sources.length >= 2 && p.email) return "high";
  if (p.email) return "medium";
  return "low";
}

// Known words that cannot be a person's first or last name
const NOT_NAME = new Set([
  "about","apply","book","browse","build","buy","call","check","choose","click","close",
  "connect","contact","continue","create","discover","download","enter","explore","find",
  "follow","get","give","go","help","join","know","learn","leave","login","make","meet",
  "navigate","need","open","pay","plan","process","reach","read","receive","register",
  "request","review","save","schedule","search","see","send","share","show","sign","start",
  "stay","submit","subscribe","take","try","understand","unlock","update","use","view",
  "visit","watch","work","write","all","any","both","each","every","few","its","many",
  "more","most","my","no","none","our","several","some","that","the","their","these",
  "this","those","what","which","who","your","best","better","big","free","full","great",
  "high","new","next","other","real","right","top","about","answers","apply","blog",
  "business","card","cases","client","clients","company","conditions","contact","content",
  "details","documents","eligibility","experts","faqs","firm","forms","franchise","home",
  "how","immigration","info","information","inquiry","investors","law","lawyers","more",
  "news","offices","options","page","partners","people","policy","portal","press","privacy",
  "process","professionals","questions","resources","reviews","rights","services","site",
  "solutions","staff","steps","support","team","terms","today","topics","updates","visa",
  "visas","way","why","works","always","commonly","frequently","generally","just","never",
  "now","often","only","quickly","recently","simply","typically","usually","when","where",
  "while","associate","attorney","broker","chief","consultant","counsel","director",
  "executive","founding","general","junior","legal","licensed","managing","member",
  "officer","paralegal","partner","president","principal","senior","specialist","strategist",
  "vice","manager","coordinator","analyst","recruiter","developer","engineer","technician",
  "representative","assistant","burger","hortons","starbucks","subway","dunkin","king",
  "queen","prince","princess","house","white","black","federal","state","national","global",
  "american","united","supreme","district","court","congress","investment","investments",
  "solutions","capital","asset","assets","fund","funds","wealth","advisory","advisors",
  "holdings","ventures","properties","realty","estate",
  // Geographic / place words
  "road","street","avenue","boulevard","lane","drive","court","place","way","beach",
  "key","island","park","lake","river","valley","mountain","city","town","village",
  "county","metro","north","south","east","west","central","downtown","uptown",
  // Phrases / event words
  "upcoming","webinar","fractional","leadership","collaborate","opportunities",
  "reboot","runway","innovation","informatics","intuitive","careers","public",
  "deliver","hiring","without","working","persona","pizza","frontier","concepts",
  "golden","lincoln","miami","conch","san","los","las","new","york","francisco",
  // Brand / company suffix words
  "america","americas","group","international","worldwide","global","inc","corp","llc",
  // Geographic regions — appear as Hunter alias guesses (e.g. "easterneurope@", "northamerica@")
  "eastern","western","northern","southern","central","global",
  "europe","european","asia","asian","africa","african",
  "americas","pacific","atlantic","caribbean","middle",
  // Software/product names — appear when Hunter guesses from aliases like "microsoftteams@"
  "microsoft","teams","slack","zoom","webex","skype","workspace",
  "google","apple","oracle","salesforce","hubspot",
  // Email action aliases — "joiningglobevisa@", "careers@", etc.
  "joining","career","careers","apply","applying","applied",
  "welcome","onboarding","hire","hiring","jobs","alerts","notifications",
  "enquiry","enquiries","inquiry","inquiries","feedback","events",
  // Major cities and countries often capitalised in snippets
  "toronto","montreal","vancouver","calgary","ottawa","london","paris","dubai",
  "mexico","canada","australia","germany","france","spain","italy","china","india",
  "japan","korea","brazil","argentina","colombia","chile","peru","turkey","israel",
  "chicago","houston","dallas","boston","seattle","denver","atlanta","phoenix",
  "portland","detroit","nashville","charlotte","minneapolis","tampa","orlando",
  "washington","angeles","diego","antonio","francisco","jose","austin","raleigh",
  "columbia","columbia","ontario","alberta","quebec","british","ontario","alberta",
  // Common non-name English words that capitalise at sentence start
  "attract","foreign","gain","grow","scale","drive","boost","power","launch",
  "capture","generate","convert","optimize","leverage","acquire","retain","expand",
  "achieve","increase","improve","reduce","maximize","minimize","accelerate",
  "transform","disrupt","innovate","empower","enable","simplify","streamline",
  // UI / contact / media labels
  "phone","number","email","profile","picture","photo","image","link","itunes",
  "contact","address","location","map","form","button","menu","nature","gifts",
  "flag","icon","icons","banner","graphic","logo","avatar","thumbnail",
  "tech","technology","digital","virtual","hybrid","remote","corporate",
  // US visa category names (immigration firms use these as headings)
  "cultural","exchange","extraordinary","ability","treaty","trader","specialty",
  "occupation","occupations","border","reunification","green","cards","card",
  "visitor","visitors","investor","investors","intracompany","transferee","unskilled",
  "religious","videos","moving","based",
  // Canadian provinces / immigration terms
  "manitoba","saskatchewan","brunswick","newfoundland","labrador","territories",
  "territory","nunavut","yukon","atlantic","provincial","express","entry","draw",
  "draws","pilot","skilled","worker","nominee","humanitarian","compassionate",
  "citizenship","residency","permit","renewal","waiver","waivers",
  // Crunchbase / ZoomInfo / data-table labels
  "founded","status","held","financing","percentage","acquired","average","seed",
  "series","rounds","revenue","employees","industries","categories","headquarters",
  "ownership","publicly","privately","listed","unlisted","verified","unverified",
  "stage","early","growth","late","pre-seed","post-ipo","private","public",
  // Website feature / section words
  "program","tracker","timeline","application","dashboard","portal","centre","center",
  "checklist","wizard","intake","questionnaire","assessment","evaluation","process",
  "british","programme","pathway","pathway","stream","stream",
  // Tech / product names that appear capitalised
  "network","agency","interactive","analytics","validation","migration","management",
  "alias","strategic","customer","human","product","data","case","family","enterprise",
  "platform","solution","service","software","system","infrastructure","architecture",
  "framework","module","integration","automation","workflow","pipeline","database",
  // Generic descriptors
  "homebrew","related","similar","comparable","notable","prominent","leading","top",
  "certified","accredited","licensed","registered","appointed","designated",
  // Common English prepositions / conjunctions / articles (often capitalised at sentence start)
  "for","at","by","of","in","on","to","an","and","or","but","yet","so","nor",
  "as","if","up","off","out","per","via","pro","non","the","a","is","are","was",
  // Gendered nouns / collective nouns that look like names
  "man","men","woman","women","girl","boy","person","people","kings","queens","lords",
  "duke","earl","baron","sir","dame","lady","lord","mr","mrs","ms","dr","prof",
  // Months / days (appear capitalised in snippets)
  "january","february","march","april","may","june","july","august","september",
  "october","november","december","monday","tuesday","wednesday","thursday","friday",
  "saturday","sunday",
  // Street / address abbreviations (appear in BBB and general snippets)
  "rd","st","ave","blvd","ln","ct","dr","pl","sq","hwy","pkwy","fwy","ste",
  "street","avenue","boulevard","court","place","lane","drive","highway",
  "suite","floor","building","unit","apt",
  // Common tree/plant names used in street names
  "spruce","maple","oak","pine","elm","cedar","birch","walnut","chestnut",
  "ash","willow","cherry","poplar","magnolia","cypress","sycamore",
  // Common US city street name words
  "monroe","lincoln","washington","jefferson","franklin","madison","adams",
  "jackson","hamilton","liberty","independence","commerce","industrial",
  // Common nouns that appear capitalised in articles / press releases
  "congrats","congratulations","replay","value","reality","weekly","meetup",
  "meetups","immersive","arts","presentation","training","technical","education",
  "acquisitions","according","announcement","analysis","series","episode",
  "report","study","survey","review","overview","summary","guide","whitepaper",
  // VR / tech / gaming terms that could appear capitalised in snippets
  "virtual","augmented","mixed","extended","holographic","simulation",
  "gameplay","storyline","narrative","character","player","user","users",
  "platform","headset","device","hardware","software","content","media",
  // Consumer / gerund words that appear as section headings
  "consumer","consumers","protecting","seeking","serving","providing","helping",
  "fighting","winning","supporting","defending","representing","recovering",
  "navigating","ensuring","offering","delivering","achieving","pursuing",
  "handling","resolving","obtaining","securing","creating","building",
  "growing","scaling","launching","mystic","guide","tips","advice","overview",
  "explained","defined","basics","fundamentals",
  // Legal practice area / personal injury words (appear as headings on law firm websites)
  "injury","injuries","settlement","settlements","defective","negligence",
  "lawsuit","lawsuits","claim","claims","damages","liability","accident",
  "accidents","malpractice","discrimination","harassment","wrongful",
  "employment","workplace","criminal","divorce","custody","property",
  "intellectual","trademark","copyright","patent","litigation","arbitration",
  "mediation","bankruptcy","probate","trusts","taxation","environmental",
  "construction","product","products","recall","recalls","victim","victims",
  // Common English words that appear capitalised at line/sentence start
  "the","this","that","these","those","there","their","they","them","then",
  "here","have","has","had","was","were","will","would","could","should",
  "also","with","from","into","onto","over","under","about","after","before",
  "through","during","without","within","between","among","across","along",
  // Financial-services / MCA tagline words (e.g. "Refinance your existing merchant
  // cash advance debt into manageable monthly payments" produces fragments like
  // "Merchant Cash", "Advance Debt", "Aligned Incentives" that look like names)
  "merchant","cash","advance","debt","relief","aligned","incentives","refinance",
  "refinanced","refinancing","manageable","monthly","payment","payments","loan",
  "loans","lender","lenders","lending","factoring","payday","installment",
  "underwriting","collateral","principal","interest","mortgage","mortgages",
  "credit","creditor","debtor","balance","balances","liquidity","working",
  "receivable","receivables","payable","payables","invoice","invoices",
  "transaction","transactions","deposit","deposits","withdrawal","withdrawals",
]);

// Title keywords required for general-source name extraction
const TITLE_KEYWORDS = new Set([
  "owner","founder","co-founder","partner","managing","director","ceo","president",
  "attorney","lawyer","counsel","consultant","advisor","broker","agent","specialist",
  "officer","executive","principal","manager","coordinator","analyst","associate",
  "head","chief","vice","vp","cto","coo","cfo","cmo","staff","paralegal",
]);

function isValidNameWord(word: string): boolean {
  if (!word || word.length < 2 || word.length > 25) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'\-]+$/.test(word)) return false;
  if (NOT_NAME.has(word.toLowerCase())) return false;
  if (word === word.toLowerCase() && word.length > 2) return false;
  return true;
}

function isValidPerson(firstName: string, lastName: string): boolean {
  return isValidNameWord(firstName) && isValidNameWord(lastName)
    && firstName.toLowerCase() !== lastName.toLowerCase();
}

// Lowercase nobiliary / linking particles allowed inside a multi-word surname
// (e.g. "Christoph von Pohlot", "Marc de la Cruz", "Ali bin Hassan")
const NAME_PARTICLE = "(?:von|van|de|der|den|da|du|le|la|di|del|della|dos|das|af|al|el|bin|ibn|ben|ter|ten|vom|zum|zur|y|i|of)";
// Title regex that allows interior lowercase particles before the final capitalised word
const NAME_TITLE_RE = new RegExp(
  `^([A-Z][a-zÀ-ÖØ-öø-ÿ'-]+(?:\\s+(?:${NAME_PARTICLE}|[A-Z][a-zÀ-ÖØ-öø-ÿ'-]+))*\\s+[A-Z][a-zÀ-ÖØ-öø-ÿ'-]+)\\s*[-–|]`
);
const NAME_TITLE_RE_WITH_TITLE = new RegExp(
  `^([A-Z][a-zÀ-ÖØ-öø-ÿ'-]+(?:\\s+(?:${NAME_PARTICLE}|[A-Z][a-zÀ-ÖØ-öø-ÿ'-]+))*\\s+[A-Z][a-zÀ-ÖØ-öø-ÿ'-]+)\\s*[-–]\\s*([^|]+?)(?:\\s*[-–]\\s*[^|]+)?\\s*\\|`
);

// ─── Source 1: Seamless.AI (domain + company search, with enrichment) ───────

async function fetchFromSeamless(domain: string, companyName: string): Promise<FoundPerson[]> {
  if (!process.env.SEAMLESS_API_KEY) return [];
  const results: FoundPerson[] = [];
  const seen = new Set<string>();

  const addSeamlessResult = (p: SeamlessPerson, source = "seamless") => {
    const firstName = (p.firstName || "").trim();
    const lastName = (p.lastName || "").trim();
    if (!isValidPerson(firstName, lastName)) return;
    const emailRaw = (p.email || "").trim();
    if (emailRaw && isRoleAliasEmail(emailRaw)) return;

    // Quality gate: require an email, a LinkedIn URL, or a known decision-maker
    // title word — otherwise skip the record as likely bad data.
    const hasEmail = !!emailRaw;
    const hasLinkedIn = !!(p.linkedinUrl || "").trim();
    const titleStr = (p.jobTitle || "").toLowerCase();
    const titleHasKeyword = [...TITLE_KEYWORDS].some(k => titleStr.includes(k));
    if (!hasEmail && !hasLinkedIn && !titleHasKeyword) return;

    const key = mergeKey(firstName, lastName);
    if (seen.has(key)) return;
    seen.add(key);
    const country = (p.country || "").trim() || null;
    results.push({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      jobTitle: p.jobTitle,
      seniority: normalizeSeniority(p.seniority),
      email: p.email,
      emailConfidence: p.emailConfidence,
      emailVerified: p.emailVerified,
      emailStatus: p.emailStatus,
      phone: p.phone,
      ...DEFAULT_PHONE_META,
      whatsappProbability: whatsappProbForCountry(country),
      linkedinUrl: p.linkedinUrl,
      bio: null,
      country,
      sources: [source],
      sourceCount: 1,
      confidence: "medium",
      e2ViaBio: false,
      internationalBio: false,
    });
  };

  // Two passes:
  //  • Domain search for decision-makers, ENRICHED (research+poll) so emails and
  //    phones come back — this is the high-value pass.
  //  • Company-name search, search-only (no credits) — Hunter / email-permutation
  //    fill in emails downstream. Keeps credit usage to one research batch/company.
  const decisionMakers = ["C-Level", "VP", "Director", "Owner", "Partner", "Manager"];
  const [byDomain, byName] = await Promise.all([
    seamlessFindPeople(
      { companyDomains: [domain], seniorities: decisionMakers, limit: 25 },
      { enrich: true },
    ),
    companyName
      ? seamlessFindPeople({ companyName, companyDomains: [domain], limit: 25 })
      : Promise.resolve([] as SeamlessPerson[]),
  ]);
  byDomain.forEach(p => addSeamlessResult(p));
  byName.forEach(p => addSeamlessResult(p, "seamless_name"));

  return results;
}

// ─── Source 1d: Proxycurl — LinkedIn company employee lookup ─────────────────
// Proxycurl resolves a company domain → LinkedIn company page → employee list.
// This is especially powerful for finding founders/owners who use unusual titles
// and who are invisible to Apollo's seniority-filter searches.
// API docs: https://nubela.co/proxycurl/docs#company-api-employee-listing-endpoint
//
// Credit cost: 1 credit per person returned (we limit to 25 max).

interface ProxycurlPerson {
  profile_url?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  occupation?: string;  // their current job title as listed on LinkedIn
}

async function fetchFromProxycurl(domain: string): Promise<FoundPerson[]> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return [];

  const results: FoundPerson[] = [];
  const seen = new Set<string>();

  try {
    // Step 1: Resolve domain → LinkedIn company URL via Company Profile Endpoint
    const companyRes = await fetch(
      `https://nubela.co/proxycurl/api/linkedin/company?` +
      `company_domain=${encodeURIComponent(domain)}&use_cache=if-present`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!companyRes.ok) {
      console.warn(`[Proxycurl] Company lookup failed for ${domain}: ${companyRes.status}`);
      return [];
    }

    const companyData = await companyRes.json() as {
      linkedin_internal_id?: string;
      universal_name_id?: string;
      profile_pic_url?: string;
    };

    // Step 2: Get employee list — filter for decision-maker roles
    // We use the company domain directly (Proxycurl accepts domain for employee search too)
    const employeeRes = await fetch(
      `https://nubela.co/proxycurl/api/linkedin/company/employees/?` +
      `company_domain=${encodeURIComponent(domain)}` +
      `&enrich_profiles=skip` +  // cheaper — we only need names/titles/URLs
      `&role_search=owner%20OR%20founder%20OR%20CEO%20OR%20principal%20OR%20managing%20partner%20OR%20director%20OR%20attorney%20OR%20president` +
      `&page_size=25` +
      `&use_cache=if-present`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!employeeRes.ok) {
      console.warn(`[Proxycurl] Employee listing failed for ${domain}: ${employeeRes.status}`);
      return [];
    }

    const employeeData = await employeeRes.json() as {
      employees?: ProxycurlPerson[];
      next_page?: string;
    };

    const employees = employeeData.employees || [];
    console.log(`[Proxycurl] Found ${employees.length} employees for ${domain}`);

    for (const emp of employees) {
      // Name: Proxycurl may give first_name+last_name or just name
      let firstName = String(emp.first_name || "").trim();
      let lastName = String(emp.last_name || "").trim();

      if ((!firstName || !lastName) && emp.name) {
        const parts = emp.name.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts[parts.length - 1];
        }
      }

      if (!isValidPerson(firstName, lastName)) continue;
      const key = mergeKey(firstName, lastName);
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        jobTitle: emp.occupation ? sanitizeJobTitle(emp.occupation) : null,
        seniority: normalizeSeniority(emp.occupation || null),
        email: null,           // not returned in skip-enrich mode — enriched later
        emailConfidence: 0,
        emailVerified: false,
        emailStatus: "not_found",
        phone: null,
        ...DEFAULT_PHONE_META,
        whatsappProbability: 0,
        linkedinUrl: emp.profile_url || null,
        bio: null,
        country: null,
        sources: ["proxycurl"],
        sourceCount: 1,
        confidence: "medium",
        e2ViaBio: false,
        internationalBio: false,
      });
    }
  } catch (err) {
    console.warn(`[Proxycurl] Error for ${domain}:`, (err as Error).message);
  }

  return results;
}

// ─── Source 1c: RDAP/WHOIS domain registration lookup (FREE, no API key) ────
// For small businesses, the domain registrant is often the owner/founder.
// RDAP is the modern replacement for WHOIS, available via rdap.org (free public API).

async function fetchFromRdap(domain: string): Promise<FoundPerson[]> {
  const results: FoundPerson[] = [];
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { "Accept": "application/rdap+json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      entities?: Array<{
        vcardArray?: unknown[];
        roles?: string[];
        entities?: Array<{ vcardArray?: unknown[] }>;
      }>;
    };

    const extractVcard = (vcardArray: unknown[]): { name: string | null; email: string | null } => {
      if (!Array.isArray(vcardArray) || vcardArray.length < 2) return { name: null, email: null };
      const fields = vcardArray[1] as unknown[][];
      let name: string | null = null, email: string | null = null;
      for (const field of fields) {
        if (!Array.isArray(field) || field.length < 4) continue;
        const type = String(field[0] || "").toLowerCase();
        const value = String(field[3] || "").trim();
        if (type === "fn" && value && !name) name = value;
        if (type === "email" && value && !email) email = value;
      }
      return { name, email };
    };

    const entities = data.entities || [];
    for (const entity of entities) {
      // Registrant is the owner — skip technical/administrative contacts
      const roles = entity.roles || [];
      if (!roles.includes("registrant") && !roles.includes("administrative")) continue;

      const vcard = entity.vcardArray;
      const nested = entity.entities || [];
      const toCheck = [vcard, ...nested.map(e => e.vcardArray)].filter(Boolean);

      for (const v of toCheck) {
        if (!v) continue;
        const { name, email: vEmail } = extractVcard(v as unknown[]);
        if (!name) continue;

        // RDAP often returns org names like "Domains By Proxy" — skip privacy proxies
        const lc = name.toLowerCase();
        if (["proxy", "privacy", "redacted", "whois", "guard", "protect", "domain", "domains", "private"].some(w => lc.includes(w))) continue;

        // Split into first/last name (handles "First Last" and "Last, First")
        let firstName = "", lastName = "";
        if (name.includes(",")) {
          const parts = name.split(",").map(s => s.trim());
          lastName = parts[0]; firstName = parts[1] || "";
        } else {
          const parts = name.trim().split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }

        if (!isValidPerson(firstName, lastName)) continue;
        const key = mergeKey(firstName, lastName);
        if (results.some(r => mergeKey(r.firstName, r.lastName) === key)) continue;

        const emailClean = vEmail && !isRoleAliasEmail(vEmail) ? vEmail : null;
        results.push({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          jobTitle: "Domain Registrant",
          seniority: "owner",
          email: emailClean,
          emailConfidence: emailClean ? 65 : 0,
          emailVerified: false,
          emailStatus: emailClean ? "unverified" : "not_found",
          phone: null,
          ...DEFAULT_PHONE_META,
          linkedinUrl: null,
          bio: null,
          country: null,
          sources: ["rdap"],
          sourceCount: 1,
          confidence: "medium",
          e2ViaBio: false,
          internationalBio: false,
        });
      }
    }
  } catch { /* ignore */ }

  return results;
}

// ─── Source 2: Hunter domain search (returns ALL emails for a domain) ────────

interface HunterEmail {
  value?: string;
  type?: string;
  confidence?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
  phone_number?: string;
  verification?: { status?: string };
}

// Words that, when found in an email's local part, indicate it is a role alias — not a real person.
const ROLE_LOCAL_WORDS = new Set([
  "info","contact","admin","support","hello","help","sales","team","office",
  "service","services","mail","email","noreply","noreply","newsletter","billing",
  "legal","accounting","marketing","press","media","pr","hr","recruiting","recruiter",
  "consulting","group","partners","general","welcome","onboarding","careers","career",
  "jobs","job","apply","applying","applied","hire","hiring","alerts","notifications",
  "enquiry","enquiries","inquiry","inquiries","feedback","events","news","updates",
  "eastern","western","northern","southern","europe","european","asia","asian",
  "africa","african","americas","pacific","atlantic","caribbean","global","international",
  "microsoft","teams","slack","zoom","webex","skype","workspace","google","apple",
  "oracle","salesforce","hubspot","joining","joined","connect","connections",
  // Generic business / financial product aliases (e.g. merchant@altbanc.us)
  "merchant","merchants","payments","billing","invoicing","collections","disputes",
  "compliance","operations","ops","finance","accounts","payroll","tax","taxes",
]);

/** Returns true if the email local-part looks like a role alias or system address, not a real person. */
function isRoleAliasEmail(email: string): boolean {
  const local = email.split("@")[0].toLowerCase().replace(/[._+\-]/g, "");
  if (ROLE_LOCAL_WORDS.has(local)) return true;
  // Check if the local part is fully explained by concatenating 1-2 known role words
  for (const w of ROLE_LOCAL_WORDS) {
    if (local === w) return true;
    if (local.startsWith(w) && local.length > w.length) {
      const rest = local.slice(w.length);
      if (ROLE_LOCAL_WORDS.has(rest) || rest.length <= 2) return true;
    }
    if (local.endsWith(w) && local.length > w.length) {
      const prefix = local.slice(0, local.length - w.length);
      if (ROLE_LOCAL_WORDS.has(prefix) || prefix.length <= 2) return true;
    }
  }
  return false;
}

async function fetchFromHunterDomain(domain: string): Promise<FoundPerson[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return [];

  const results: FoundPerson[] = [];
  const seen = new Set<string>();

  try {
    // Hunter domain search — returns up to 100 emails per page
    for (let page = 1; page <= 3; page++) {
      const params = new URLSearchParams({
        domain,
        api_key: apiKey,
        limit: "100",
        offset: String((page - 1) * 100),
      });
      const res = await fetch(`${HUNTER_BASE}/domain-search?${params}`);
      if (!res.ok) break;
      const json = await res.json() as { data?: { emails?: HunterEmail[]; pattern?: string } };
      const emails = json.data?.emails || [];
      if (emails.length === 0) break;

      for (const e of emails) {
        const email = String(e.value || "").trim();
        const firstName = String(e.first_name || "").trim();
        const lastName = String(e.last_name || "").trim();
        if (!email || !firstName || !lastName) continue;
        if (isRoleAliasEmail(email)) continue;          // ← reject aliases before name check
        if (!isValidPerson(firstName, lastName)) continue;

        const key = mergeKey(firstName, lastName);
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          jobTitle: String(e.position || "") || null,
          seniority: null,
          email,
          emailConfidence: Number(e.confidence || 60),
          emailVerified: e.verification?.status === "valid",
          emailStatus: e.verification?.status || "unverified",
          phone: String(e.phone_number || "") || null,
          ...DEFAULT_PHONE_META,
          linkedinUrl: String(e.linkedin || "") || null,
          bio: null,
          country: null,
          sources: ["hunter_domain"],
          sourceCount: 1,
          confidence: "medium",
          e2ViaBio: false,
          internationalBio: false,
        });
      }

      if (emails.length < 100) break; // last page
    }
  } catch { /* ignore */ }

  return results;
}

// ─── Shared title validation ──────────────────────────────────────────────────

const TITLE_VALID_WORDS = new Set([
  "owner","founder","cofounder","co-founder","partner","principal","managing","director",
  "attorney","lawyer","counsel","consultant","advisor","broker","agent","specialist",
  "officer","executive","president","manager","coordinator","analyst","associate",
  "head","chief","vice","vp","cto","coo","cfo","cmo","staff","paralegal","recruiter",
  "engineer","developer","technician","representative","assistant","intern","fellow",
  // Additional common roles
  "entrepreneur","cpa","accountant","notary","mediator","strategist","researcher",
  "operations","marketing","sales","finance","legal",
  "immigration attorney","senior attorney","managing attorney","general counsel",
  "senior partner","managing partner","founding partner","senior associate",
]);

// Company-name suffixes that indicate a title field actually contains a firm name
const COMPANY_SUFFIX_RE = /\b(?:llc|llp|inc|ltd|corp|co\.|p\.c\.|p\.a\.|group|firm|associates|partners|& associates|and associates)\b/i;

function sanitizeJobTitle(title: string | null): string | null {
  if (!title) return null;
  const lc = title.toLowerCase().trim();
  // Reject if it contains a company suffix — it's a firm name, not a job title
  if (COMPANY_SUFFIX_RE.test(lc)) return null;
  // Exact match (e.g. title IS "CEO")
  if (TITLE_VALID_WORDS.has(lc)) return title.slice(0, 80);
  // Whole-word match (prevents "Associates" matching "associate")
  const hasValidWord = [...TITLE_VALID_WORDS].some(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lc);
  });
  if (hasValidWord) return title.slice(0, 80);
  return null;
}

// ─── Source 3: SerpAPI multi-query people discovery ──────────────────────────

const NAME_RE = /\b([A-Z][a-z]{1,20}(?:[-'][A-Z][a-z]{1,15})?)\s+([A-Z][a-z]{1,20}(?:[-'][A-Z][a-z]{1,15})?)\b/g;

interface SerpNameHit {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: string;
}

function extractNamesFromSnippet(text: string, source: string): SerpNameHit[] {
  const hits: SerpNameHit[] = [];
  const seen = new Set<string>();
  NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_RE.exec(text)) !== null) {
    const fn = m[1], ln = m[2];
    if (!isValidPerson(fn, ln)) continue;
    const key = mergeKey(fn, ln);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ firstName: fn, lastName: ln, jobTitle: null, linkedinUrl: null, source });
  }
  return hits;
}

async function serpApiSearch(query: string, num = 10): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ engine: "google", q: query, api_key: apiKey, num: String(num) });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];
    const json = await res.json() as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (json.organic_results || []).map(r => ({
      title: String(r.title || ""),
      link: String(r.link || ""),
      snippet: String(r.snippet || ""),
    }));
  } catch { return []; }
}

async function fetchFromSerpApi(domain: string, companyName: string): Promise<FoundPerson[]> {
  // Strip "www." for cleaner queries; also derive short name (first word) for broader matches
  const shortName = companyName.split(/\s+/)[0];
  const cleanDomain = domain.replace(/^www\./, "");

  const queries = [
    // LinkedIn: by company name — current employees who list the company
    { q: `site:linkedin.com/in "${companyName}"`, src: "serp_linkedin" },
    // LinkedIn: by domain URL — founders/owners whose profile links to the site
    { q: `site:linkedin.com/in "${cleanDomain}"`, src: "serp_linkedin" },
    // LinkedIn: founder/owner/principal keyword sweep — catches people who use titles
    //           like "Founder & CEO" that don't appear in seniority-tagged searches
    { q: `site:linkedin.com/in "${companyName}" founder OR owner OR principal OR "managing partner" OR president OR CEO`, src: "serp_linkedin" },
    // LinkedIn: short name sweep — catches profiles that abbreviate the company name
    ...(shortName.length >= 4 && shortName !== companyName
      ? [{ q: `site:linkedin.com/in "${shortName}" president OR CEO OR owner OR founder`, src: "serp_linkedin" }]
      : []),
    // ZoomInfo: individual person pages (format: "Name - Title - Company | ZoomInfo")
    { q: `site:zoominfo.com/p "${companyName}"`, src: "serp_zoominfo" },
    // ZoomInfo: by domain — catches orgs with alternate display names
    { q: `site:zoominfo.com "${cleanDomain}"`, src: "serp_zoominfo" },
    // BBB: many small businesses list owners here; BBB pages name the principal
    { q: `site:bbb.org "${companyName}" president OR owner OR principal OR CEO OR "managing member"`, src: "serp_general" },
    // General: news / press releases / about pages mentioning the company + role
    { q: `"${companyName}" founder OR owner OR attorney OR "managing partner" OR CEO OR president`, src: "serp_general" },
    // Press releases: business wire, PR newswire, Globe Newswire often name executives
    { q: `"${companyName}" site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com`, src: "serp_general" },
    // Team/About page: Google-indexed team pages often list the owner even when
    //                  they're invisible on LinkedIn or Apollo
    { q: `"${companyName}" "our team" OR "about us" OR "meet the team" OR "leadership"`, src: "serp_team" },
    // Direct site search: executives listed on the company's own domain
    { q: `site:${cleanDomain} team OR about OR leadership OR staff OR "meet"`, src: "serp_team" },
  ];

  const all = await Promise.all(queries.map(({ q, src }) =>
    serpApiSearch(q, 10).then(results => ({ results, src }))
  ));

  const nameHits: SerpNameHit[] = [];
  const seen = new Set<string>();

  for (const { results, src } of all) {
    for (const r of results) {
      const combined = `${r.title} ${r.snippet}`;

      // LinkedIn: title is often "Name - Title at Company | LinkedIn"
      if (src === "serp_linkedin" && r.link.includes("linkedin.com/in/")) {
        const titleMatch = r.title.match(NAME_TITLE_RE);
        if (titleMatch) {
          const parts = titleMatch[1].trim().split(/\s+/);
          if (parts.length >= 2) {
            const fn = parts[0], ln = parts[parts.length - 1];
            if (isValidPerson(fn, ln)) {
              const key = mergeKey(fn, ln);
              if (!seen.has(key)) {
                // Validate: the snippet must reference the target company or domain
                const combinedLc = `${r.title} ${r.snippet}`.toLowerCase();
                const mentionsTarget = combinedLc.includes(companyName.toLowerCase()) || combinedLc.includes(domain);
                if (!mentionsTarget) continue; // skip people not associated with this company

                // Extra check: if title says "at/@ [Company]" or ", [Company]" and that company
                // clearly differs from the target, this person is a false positive
                // (they merely mentioned the target in their snippet, e.g. as a client or past employer)
                // Match "at Company", "@ Company", ", Company" — case-insensitive so "@ unbox vr" is caught
                const employerMatch = r.title.match(
                  /(?:\bat\s+|@\s*|,\s+)([A-Za-z][A-Za-z0-9 &'.-]{2,40}?)(?:\s*\||\s*[-–]|$)/i
                );
                if (employerMatch) {
                  const empCompany = employerMatch[1].trim().toLowerCase();
                  const targetLc = companyName.toLowerCase();
                  // Allow if employer company name overlaps with the target name or domain
                  const empMatchesTarget = empCompany.includes(targetLc) || targetLc.includes(empCompany)
                    || empCompany.includes(domain)
                    // Also allow if they share 2+ significant words
                    || targetLc.split(/\s+/).filter(w => w.length > 3).some(w => empCompany.includes(w));
                  if (!empMatchesTarget) continue; // clearly a different employer → skip
                }
                seen.add(key);
                // Extract job title: keep only the part before the first " | "
                const afterName = r.title.replace(titleMatch[0], "");
                const titlePart = afterName.split("|")[0].replace(/\s*[-–]\s*.+$/, "").trim();
                nameHits.push({ firstName: fn, lastName: ln, jobTitle: sanitizeJobTitle(titlePart) || null, linkedinUrl: r.link, source: src });
              }
            }
          }
        }
      }

      // ZoomInfo: individual person pages — "First Last - Job Title - Company | ZoomInfo.com"
      // Also handles: "First Last - Job Title | ZoomInfo.com"
      if (src === "serp_zoominfo" && (r.link.includes("zoominfo.com/p/") || r.link.includes("zoominfo.com"))) {
        // ZoomInfo person page titles: "Name - Title - Company | ZoomInfo"
        const zm = r.title.match(NAME_TITLE_RE_WITH_TITLE);
        if (zm) {
          const namePart = zm[1].trim();
          const titlePart = zm[2].trim();
          const parts = namePart.split(/\s+/);
          if (parts.length >= 2) {
            const fn = parts[0], ln = parts[parts.length - 1];
            if (isValidPerson(fn, ln)) {
              // Validate: the company mentioned in snippet should match
              const combinedLc = `${r.title} ${r.snippet}`.toLowerCase();
              const mentionsTarget = combinedLc.includes(companyName.toLowerCase()) || combinedLc.includes(domain);
              if (mentionsTarget) {
                const key = mergeKey(fn, ln);
                if (!seen.has(key)) {
                  seen.add(key);
                  nameHits.push({
                    firstName: fn,
                    lastName: ln,
                    jobTitle: sanitizeJobTitle(titlePart) || null,
                    linkedinUrl: null,
                    source: src,
                  });
                }
              }
            }
          }
        }
      }

      // General & Team page: strict pattern — only accept names that appear immediately next to a title word.
      // Pattern A: "Title Name" e.g. "CEO John Smith" or "attorney John Smith"
      // Pattern B: "Name, Title" e.g. "John Smith, CEO" or "John Smith, founder"
      // Pattern C: "Name is [the] Title" e.g. "John Smith is the founder"
      // This eliminates false positives from product names, section headers, addresses, etc.
      // serp_team uses the same strict extraction — team pages list names near titles which
      // makes them very reliable, but we still guard against header words and placeholders.
      if (src === "serp_general" || src === "serp_team") {
        const combinedLc = combined.toLowerCase();
        for (const hit of extractNamesFromSnippet(combined, src)) {
          const fullName = `${hit.firstName} ${hit.lastName}`;
          const fullNameEsc = fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const titleAlts = [...TITLE_KEYWORDS].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

          // Pattern A: title immediately before name (0-3 filler words allowed)
          const patA = new RegExp(`\\b(?:${titleAlts})\\b(?:\\s+\\w+){0,3}\\s+${fullNameEsc}`, "i");
          // Pattern B: name followed by comma + title
          const patB = new RegExp(`${fullNameEsc}\\s*,\\s*(?:the\\s+)?\\b(?:${titleAlts})\\b`, "i");
          // Pattern C: name + "is [a/the] title"
          const patC = new RegExp(`${fullNameEsc}\\s+is\\s+(?:a\\s+|an\\s+|the\\s+)?\\b(?:${titleAlts})\\b`, "i");

          if (!patA.test(combined) && !patB.test(combined) && !patC.test(combined)) continue;

          // Must also mention the target company somewhere in combined
          if (!combinedLc.includes(companyName.toLowerCase()) && !combinedLc.includes(domain)) continue;

          const key = mergeKey(hit.firstName, hit.lastName);
          if (!seen.has(key)) {
            seen.add(key);
            nameHits.push(hit);
          }
        }
      }
    }
  }

  return nameHits.map(h => ({
    firstName: h.firstName,
    lastName: h.lastName,
    fullName: `${h.firstName} ${h.lastName}`,
    jobTitle: h.jobTitle,
    seniority: null,
    email: null,
    emailConfidence: 0,
    emailVerified: false,
    emailStatus: "not_found",
    phone: null,
    ...DEFAULT_PHONE_META,
    linkedinUrl: h.linkedinUrl,
    bio: null,
    country: null,
    sources: [h.source],
    sourceCount: 1,
    confidence: "low" as const,
    e2ViaBio: false,
    internationalBio: false,
  }));
}

// ─── Source 4: OpenCorporates (free, no API key) ─────────────────────────────

interface OCOfficer {
  name?: string;
  position?: string;
}

async function fetchFromOpenCorporates(companyName: string): Promise<FoundPerson[]> {
  const results: FoundPerson[] = [];
  try {
    const params = new URLSearchParams({ q: companyName, jurisdiction_code: "us" });
    const res = await fetch(`https://api.opencorporates.com/v0.4/companies/search?${params}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { results?: { companies?: Array<{ company?: { officers_url?: string } }> } };
    const companies = json.results?.companies?.slice(0, 3) || [];

    for (const { company } of companies) {
      if (!company?.officers_url) continue;
      const orRes = await fetch(`${company.officers_url}?api_token=&per_page=50`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!orRes.ok) continue;
      const orJson = await orRes.json() as { results?: { officers?: Array<{ officer?: OCOfficer }> } };
      const officers = orJson.results?.officers || [];

      for (const { officer } of officers) {
        if (!officer?.name) continue;
        const parts = officer.name.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        if (!isValidPerson(firstName, lastName)) continue;
        results.push({
          firstName,
          lastName,
          fullName: officer.name.trim(),
          jobTitle: officer.position || null,
          seniority: normalizeSeniority(officer.position || null),
          email: null,
          emailConfidence: 0,
          emailVerified: false,
          emailStatus: "not_found",
          phone: null,
          ...DEFAULT_PHONE_META,
          linkedinUrl: null,
          bio: null,
          country: null,
          sources: ["opencorporates"],
          sourceCount: 1,
          confidence: "low",
          e2ViaBio: false,
          internationalBio: false,
        });
      }
    }
  } catch { /* ignore */ }
  return results;
}

// ─── Source 5: Website scraper ────────────────────────────────────────────────

async function fetchFromWebsite(website: string): Promise<FoundPerson[]> {
  const scraped = await scrapeTeamPage(website);
  return scraped.map(p => ({
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    jobTitle: sanitizeJobTitle(p.jobTitle),
    seniority: p.seniority,
    email: p.email,
    emailConfidence: p.email ? 60 : 0,
    emailVerified: false,
    emailStatus: p.email ? "unverified" : "not_found",
    phone: p.phone,
    ...DEFAULT_PHONE_META,
    linkedinUrl: p.linkedinUrl,
    bio: p.bio,
    country: null,
    sources: ["website"],
    sourceCount: 1,
    confidence: "low" as const,
    e2ViaBio: p.e2ViaBio,
    internationalBio: p.internationalBio,
  }));
}

// ─── Entity resolution: merge all sources ────────────────────────────────────

function mergePeople(allSources: FoundPerson[][]): FoundPerson[] {
  const merged = new Map<string, FoundPerson>();

  for (const source of allSources) {
    for (const person of source) {
      const key = mergeKey(person.firstName, person.lastName);

      // Find if we already have a fuzzy match
      let matchKey = key;
      let existing: FoundPerson | undefined;

      for (const [k, p] of merged.entries()) {
        if (k === key || isSameName(person.fullName, p.fullName)) {
          matchKey = k;
          existing = p;
          break;
        }
      }

      if (!existing) {
        merged.set(key, { ...person });
      } else {
        // Merge data — prefer best quality for each field
        if (!existing.email && person.email) {
          existing.email = person.email;
          existing.emailConfidence = person.emailConfidence;
          existing.emailVerified = person.emailVerified;
          existing.emailStatus = person.emailStatus;
        } else if (person.email && person.emailConfidence > existing.emailConfidence) {
          existing.email = person.email;
          existing.emailConfidence = person.emailConfidence;
          existing.emailVerified = person.emailVerified;
          existing.emailStatus = person.emailStatus;
        }
        if (!existing.phone && person.phone) {
          existing.phone = person.phone;
          existing.phoneVerified = person.phoneVerified;
          existing.phoneType = person.phoneType;
          existing.whatsappEligible = person.whatsappEligible;
          existing.whatsappProbability = person.whatsappProbability;
        }
        if (!existing.country && person.country) {
          existing.country = person.country;
          // If we just learned the country, update WhatsApp probability if still at default
          if (existing.whatsappProbability === 0) {
            existing.whatsappProbability = whatsappProbForCountry(person.country);
          }
        }
        if (!existing.linkedinUrl && person.linkedinUrl) existing.linkedinUrl = person.linkedinUrl;
        if (!existing.jobTitle && person.jobTitle) existing.jobTitle = person.jobTitle;
        if (!existing.bio && person.bio) existing.bio = person.bio;
        if (person.e2ViaBio) existing.e2ViaBio = true;
        if (person.internationalBio) existing.internationalBio = true;
        // Merge sources (deduplicated)
        for (const s of person.sources) {
          if (!existing.sources.includes(s)) existing.sources.push(s);
        }
        existing.sourceCount = new Set(existing.sources.map(s => s.split("_")[0])).size;
      }
    }
  }

  return [...merged.values()];
}

// ─── Email enrichment: Hunter + permutation ──────────────────────────────────

const EMAIL_PATTERNS = [
  (f: string, l: string) => `${f}.${l}`,         // john.smith
  (f: string, l: string) => `${f}${l}`,           // johnsmith
  (f: string, l: string) => `${f[0]}${l}`,        // jsmith
  (f: string, l: string) => `${f[0]}.${l}`,       // j.smith
  (f: string, l: string) => `${f}`,               // john
  (f: string, l: string) => `${f}${l[0]}`,        // johns
  (f: string, l: string) => `${l}.${f}`,         // smith.john
  (f: string, l: string) => `${l}${f[0]}`,        // smithj
  (f: string, l: string) => `${f[0]}${l[0]}`,    // js (initials — rare but valid)
  (f: string, l: string) => `${f}-${l}`,          // john-smith (European style)
];

async function enrichEmails(people: FoundPerson[], domain: string): Promise<void> {
  // Get the domain pattern once
  const apiKey = process.env.HUNTER_API_KEY;
  let domainPattern: string | null = null;
  if (apiKey) {
    try {
      const params = new URLSearchParams({ domain, api_key: apiKey });
      const res = await fetch(`${HUNTER_BASE}/domain-search?${params}`);
      if (res.ok) {
        const json = await res.json() as { data?: { pattern?: string } };
        domainPattern = json.data?.pattern || null;
      }
    } catch { /* ignore */ }
  }

  // For people without emails, try Hunter email-finder (max 10 per company)
  let hunterCalls = 0;
  const peopleNeedingEmail = people.filter(p => !p.email);

  for (const person of peopleNeedingEmail) {
    if (hunterCalls < 10 && apiKey) {
      try {
        const params = new URLSearchParams({
          domain,
          first_name: person.firstName,
          last_name: person.lastName,
          api_key: apiKey,
        });
        const res = await fetch(`${HUNTER_BASE}/email-finder?${params}`);
        if (res.ok) {
          const json = await res.json() as { data?: { email?: string; confidence?: number; status?: string } };
          if (json.data?.email && Number(json.data.confidence || 0) >= 60) {
            person.email = json.data.email;
            person.emailConfidence = Number(json.data.confidence);
            person.emailStatus = json.data.status || "unverified";
            if (!person.sources.includes("hunter")) person.sources.push("hunter");
          }
        }
        hunterCalls++;
      } catch { /* ignore */ }
    }

    // If still no email and we have a pattern, use pattern
    if (!person.email && domainPattern) {
      person.email = buildEmailFromPattern(person.firstName, person.lastName, domain, domainPattern);
      person.emailConfidence = 50;
      person.emailStatus = "pattern";
      if (!person.sources.includes("hunter_pattern")) person.sources.push("hunter_pattern");
    }

    // If still no email, generate the top 3 permutation candidates for bulk verification
    if (!person.email) {
      const f = person.firstName.toLowerCase();
      const l = person.lastName.toLowerCase();
      // Top 3 patterns (most common formats) — verified in bulk, best wins
      const topCandidates = EMAIL_PATTERNS.slice(0, 3).map(fn => `${fn(f, l)}@${domain}`);
      (person as { _emailCandidates?: string[] })._emailCandidates = topCandidates;
    }
  }

  // Collect all emails to verify (existing unverified + permutation candidates)
  const emailsToVerify: string[] = [];
  for (const p of people) {
    if (p.email && !p.emailVerified) emailsToVerify.push(p.email);
    const candidates = (p as { _emailCandidates?: string[] })._emailCandidates;
    if (candidates) emailsToVerify.push(...candidates);
  }

  if (emailsToVerify.length === 0) return;

  // Bulk verify with ZeroBounce (up to 50 unique emails, 8 concurrent requests)
  const zbResults = await verifyEmailBatch([...new Set(emailsToVerify)].slice(0, 50), 8);

  for (const p of people) {
    // Update verification status for existing emails
    if (p.email) {
      const zbr = zbResults.get(p.email);
      if (zbr) {
        p.emailVerified = zbr.safe;
        p.emailStatus = zbr.status;
        if (zbr.status === "valid") p.emailConfidence = Math.min(100, p.emailConfidence + 15);
        else if (zbr.status === "invalid") {
          p.emailConfidence = Math.max(0, p.emailConfidence - 40);
          if (!zbr.safe) p.email = null; // clear invalid emails
        }
      }
    }

    // Pick the best verified permutation candidate
    const candidates = (p as { _emailCandidates?: string[] })._emailCandidates;
    if (candidates && !p.email) {
      for (const candidate of candidates) {
        const zbr = zbResults.get(candidate);
        if (zbr?.safe && zbr.status === "valid") {
          p.email = candidate;
          p.emailConfidence = 85;
          p.emailVerified = true;
          p.emailStatus = "valid";
          if (!p.sources.includes("permutation_verified")) p.sources.push("permutation_verified");
          break;
        }
      }
    }
    delete (p as { _emailCandidates?: string[] })._emailCandidates;
  }
}

// ─── Phone enrichment ─────────────────────────────────────────────────────────

/**
 * Improved multi-format phone regex: catches US, international (+country code),
 * and compact international numbers (e.g. UAE +971 5x xxx xxxx, India +91 9x).
 */
const INTL_PHONE_RE =
  /(?:\+|00)?(?:\d{1,3}[\s.\-]?)?(?:\(?\d{1,4}\)?[\s.\-]?)(?:\d[\s.\-]?){6,12}\d/g;

export function extractPhoneFromText(text: string): string | null {
  const matches = text.match(INTL_PHONE_RE);
  if (!matches) return null;
  // Prefer numbers that look fully-formed (≥10 digits) and start with + (international)
  const intl = matches.find(m => m.startsWith("+") && m.replace(/\D/g, "").length >= 10);
  if (intl) return intl.trim();
  const us = matches.find(m => m.replace(/\D/g, "").length >= 10);
  return us ? us.trim() : null;
}

/**
 * Use SerpAPI to look up a direct phone number for a named person at a company.
 * Searches Google for `"First Last" "Company Name" phone` and extracts from snippets.
 * Capped at 5 people per company to avoid excessive API usage.
 */
async function searchPersonPhoneViaSerpApi(
  people: FoundPerson[],
  companyName: string
): Promise<void> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return;

  const phoneless = people.filter(p => !p.phone).slice(0, 5);

  for (const person of phoneless) {
    try {
      const q = `"${person.fullName}" "${companyName}" phone contact`;
      const params = new URLSearchParams({ engine: "google", q, api_key: apiKey, num: "5" });
      const res = await fetch(`${SERPAPI_BASE}?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const json = await res.json() as {
        organic_results?: Array<{ snippet?: string; title?: string }>;
        knowledge_graph?: { phone?: string };
      };

      // Try knowledge graph phone first
      const kgPhone = json.knowledge_graph?.phone;
      if (kgPhone) {
        const stripped = kgPhone.replace(/\D/g, "");
        if (stripped.length >= 7) {
          person.phone = kgPhone.trim();
          if (!person.sources.includes("serp_phone")) person.sources.push("serp_phone");
          continue;
        }
      }

      // Search snippets for phone numbers
      const snippets = (json.organic_results || []).map(r => `${r.title || ""} ${r.snippet || ""}`).join(" ");
      const found = extractPhoneFromText(snippets);
      if (found) {
        person.phone = found;
        if (!person.sources.includes("serp_phone")) person.sources.push("serp_phone");
      }
    } catch { /* ignore */ }
  }
}

/**
 * Run Twilio Lookup on every person with a phone number.
 * Validates the number, determines mobile/landline/VoIP, and marks WhatsApp eligibility.
 * WhatsApp works on mobile and VoIP lines.
 */
async function enrichPhonesWithTwilio(people: FoundPerson[]): Promise<void> {
  const phonePeople = people.filter(p => !!p.phone);
  if (!phonePeople.length) return;

  const phones = phonePeople.map(p => p.phone as string);
  const results = await lookupPhoneBatch([...new Set(phones)], 3);

  for (const person of phonePeople) {
    const r = results.get(person.phone!);
    if (!r) continue;
    if (r.nationalFormat) person.phone = r.nationalFormat;   // formatted version
    person.phoneVerified = r.valid;
    person.phoneType = r.type;
    const twilioEligible = r.valid && (r.type === "mobile" || r.type === "voip");
    // WhatsApp-eligible if Twilio says mobile/voip OR if country-based probability is high (≥70%)
    const countryProb = person.whatsappProbability || whatsappProbForCountry(person.country);
    person.whatsappEligible = twilioEligible || (r.valid && countryProb >= 70);
    person.whatsappProbability = Math.max(
      countryProb,
      twilioEligible ? 75 : (r.valid ? 40 : 0)
    );
  }
}

/**
 * Apply country-based WhatsApp probability to people who have a phone but no Twilio result.
 * This handles people where Twilio lookup was skipped (e.g. due to batching caps).
 */
function applyCountryWhatsapp(people: FoundPerson[]): void {
  for (const person of people) {
    if (person.whatsappProbability > 0) continue; // already scored
    const prob = whatsappProbForCountry(person.country);
    if (prob > 0) {
      person.whatsappProbability = prob;
      // If they have a phone and the country has high WA adoption, mark eligible
      if (person.phone && prob >= 70) person.whatsappEligible = true;
    }
  }
}

/**
 * Combined phone enrichment: SerpAPI search for phoneless people → Twilio validation.
 */
async function enrichPhonesPhase(people: FoundPerson[], companyName: string): Promise<void> {
  await searchPersonPhoneViaSerpApi(people, companyName);
  await enrichPhonesWithTwilio(people);
}

// ─── Phase 4.7: Whitepages Pro enrichment ─────────────────────────────────────
// Delegated to server/whitepages-service.ts (enrichPeopleFromWhitepages).
// Now passes email when available for much higher match precision.
// Only runs for US / unknown-country people. Capped at 10 lookups by default.


// ─── Source PDL: People Data Labs people search ──────────────────────────────
// Called in Phase 1 alongside Apollo/Hunter. PDL returns verified work emails
// and is especially strong for international contacts.

function pdlPersonToFoundPerson(p: PdlPerson): FoundPerson | null {
  const firstName = String(p.first_name || "").trim();
  const lastName  = String(p.last_name || "").trim();
  if (!firstName || !lastName) return null;
  if (!isValidPerson(firstName, lastName)) return null;

  const email = p.work_email || p.personal_emails?.[0] || null;
  const phone = p.mobile_phone || p.phone_numbers?.[0] || null;

  return {
    firstName,
    lastName,
    fullName: p.full_name || `${firstName} ${lastName}`,
    jobTitle: sanitizeJobTitle(p.job_title || null),
    seniority: pdlLevelToSeniority(p.job_title_levels),
    email,
    emailConfidence: email ? 85 : 0,  // PDL work emails are high-confidence
    emailVerified: false,
    emailStatus: email ? "unverified" : "not_found",
    phone,
    ...DEFAULT_PHONE_META,
    linkedinUrl: p.linkedin_url
      ? (p.linkedin_url.startsWith("http") ? p.linkedin_url : `https://${p.linkedin_url}`)
      : null,
    bio: p.bio || p.summary || null,
    country: p.location_country || null,
    address: null,
    sources: ["pdl"],
    sourceCount: 1,
    confidence: email ? "high" : "low",
    e2ViaBio: false,
    internationalBio: !!(p.location_country && !["us", "usa", "united states"].includes((p.location_country || "").toLowerCase())),
  };
}

async function fetchFromPdl(domain: string): Promise<FoundPerson[]> {
  try {
    const raw = await fetchPeopleFromPdl(domain, 25);
    const results: FoundPerson[] = [];
    const seen = new Set<string>();

    for (const p of raw) {
      const person = pdlPersonToFoundPerson(p);
      if (!person) continue;
      const key = mergeKey(person.firstName, person.lastName);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(person);
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Phase 4.8: PDL gap enrichment ───────────────────────────────────────────
// Runs after the main merge pass. For any person still missing email + LinkedIn,
// asks PDL to enrich them by name + domain. Caps at 10 lookups.

async function enrichGapsFromPdl(people: FoundPerson[], domain: string): Promise<void> {
  try {
    const enriched = await enrichGapsViaPdl(people, domain);
    if (enriched.size === 0) return;

    for (const person of people) {
      const key = `${person.firstName.toLowerCase()}|${person.lastName.toLowerCase()}`;
      const pdlData = enriched.get(key);
      if (!pdlData) continue;

      // Fill email gap
      if (!person.email) {
        const email = pdlData.work_email || pdlData.personal_emails?.[0] || null;
        if (email) {
          person.email = email;
          person.emailConfidence = 80;
          person.emailStatus = "unverified";
          if (!person.sources.includes("pdl")) person.sources.push("pdl");
        }
      }

      // Fill LinkedIn gap
      if (!person.linkedinUrl && pdlData.linkedin_url) {
        person.linkedinUrl = pdlData.linkedin_url.startsWith("http")
          ? pdlData.linkedin_url
          : `https://${pdlData.linkedin_url}`;
        if (!person.sources.includes("pdl")) person.sources.push("pdl");
      }

      // Fill phone gap
      if (!person.phone) {
        const phone = pdlData.mobile_phone || pdlData.phone_numbers?.[0] || null;
        if (phone) {
          person.phone = phone;
          if (!person.sources.includes("pdl")) person.sources.push("pdl");
        }
      }

      // Fill country gap (useful for WhatsApp probability)
      if (!person.country && pdlData.location_country) {
        person.country = pdlData.location_country;
      }
    }
  } catch { /* ignore — PDL enrichment is best-effort */ }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function findAllPeopleAtCompany(
  website: string,
  companyName: string
): Promise<FoundPerson[]> {
  const domain = extractDomain(website);
  if (!domain) return [];

  // Phase 1: Fetch from all sources in parallel
  // seamless:    domain + company search (enriched) — decision-makers with emails/phones
  // proxycurl:   LinkedIn company employee list — best for finding founders/owners with unusual titles
  // rdap:        free WHOIS successor — domain registrant is often the founder/owner
  // pdl:         People Data Labs — strong international coverage + direct work emails
  const [
    seamlessResults, proxycurlResults, rdapResults,
    hunterResults, serpResults, ocResults, websiteResults, pdlResults,
  ] = await Promise.all([
    fetchFromSeamless(domain, companyName),
    fetchFromProxycurl(domain),
    fetchFromRdap(domain),
    fetchFromHunterDomain(domain),
    fetchFromSerpApi(domain, companyName),
    fetchFromOpenCorporates(companyName),
    fetchFromWebsite(website),
    fetchFromPdl(domain),
  ]);

  // Phase 2: Merge and deduplicate
  const merged = mergePeople([
    seamlessResults, proxycurlResults, rdapResults,
    hunterResults, serpResults, ocResults, websiteResults, pdlResults,
  ]);

  // Filter — must pass name validation
  let valid = merged.filter(p => isValidPerson(p.firstName, p.lastName));

  // Phase 2.25: Remove reversed-name duplicates (e.g. "Niren Michael" vs "Michael Niren").
  // Keep the person with more sources; merge sources onto the winner.
  {
    const fullNameMap = new Map<string, FoundPerson>();
    for (const p of valid) fullNameMap.set(p.fullName.toLowerCase(), p);

    valid = valid.filter(p => {
      const reversed = `${p.lastName} ${p.firstName}`.toLowerCase();
      const twin = fullNameMap.get(reversed);
      if (!twin || twin === p) return true; // no reversed twin
      // Keep the one with more sources (break tie by keeping alphabetically first)
      if (p.sourceCount > twin.sourceCount) {
        // I'm the winner — absorb twin's sources
        twin.sources.forEach(s => { if (!p.sources.includes(s)) p.sources.push(s); });
        p.sourceCount = new Set(p.sources.map(s => s.split("_")[0])).size;
        fullNameMap.delete(reversed); // prevent twin from being processed as winner too
        return true;
      }
      return false; // I'm the loser — drop me
    });
  }

  // Phase 2.5: Remove false aliases — a person found ONLY from the website (no
  // independent external source) whose email pattern collides with a better-sourced
  // person with the same last name is almost certainly a scraping artefact.
  const externalSources = new Set(["seamless", "seamless_name", "proxycurl", "hunter_domain", "hunter", "serp_linkedin", "serp_zoominfo", "serp_team", "rdap", "pdl"]);
  const hasExternalSource = (p: FoundPerson) => p.sources.some(s => externalSources.has(s));

  // Build a map of (last name → best-sourced person) for collision detection
  const lastNameMap = new Map<string, FoundPerson>();
  for (const p of valid) {
    if (!hasExternalSource(p)) continue; // skip website-only for the anchor map
    const ln = p.lastName.toLowerCase();
    const existing = lastNameMap.get(ln);
    if (!existing || p.sourceCount > existing.sourceCount) lastNameMap.set(ln, p);
  }

  valid = valid.filter(p => {
    if (hasExternalSource(p)) return true; // always keep externally sourced
    // Website-only person: check if their last name is already claimed by someone stronger
    const anchor = lastNameMap.get(p.lastName.toLowerCase());
    if (!anchor) return true; // no conflict — keep
    // If same first initial (likely a scraping confusion like "Joe" vs "Jack"), drop it
    if (p.firstName[0].toLowerCase() === anchor.firstName[0].toLowerCase()) {
      return false;
    }
    // Different initial but same last name — keep (e.g., a sibling or spouse on the team)
    return true;
  });

  // Phase 3: Email enrichment (Hunter + permutation + ZeroBounce)
  await enrichEmails(valid, domain);

  // Phase 3.5: Email-collision dedup — when two contacts share the same email
  // address (common with pattern-generated emails like jfindaro@ for "Jack" and "Joe"),
  // keep the one that is more credible (more diverse sources, or has LinkedIn).
  {
    const emailMap = new Map<string, FoundPerson>();
    for (const p of valid) {
      if (!p.email) continue;
      const existing = emailMap.get(p.email.toLowerCase());
      if (!existing) {
        emailMap.set(p.email.toLowerCase(), p);
        continue;
      }
      // Two people share the same email — pick the winner
      const pHasLinkedIn = p.sources.some(s => s.startsWith("serp_linkedin") || s === "hunter_domain");
      const eHasLinkedIn = existing.sources.some(s => s.startsWith("serp_linkedin") || s === "hunter_domain");
      const pScore = (pHasLinkedIn ? 10 : 0) + p.sourceCount;
      const eScore = (eHasLinkedIn ? 10 : 0) + existing.sourceCount;
      if (pScore > eScore) {
        // Merge loser's sources into winner then replace
        existing.sources.forEach(s => { if (!p.sources.includes(s)) p.sources.push(s); });
        emailMap.set(p.email.toLowerCase(), p);
      } else {
        // Keep existing winner — absorb current person's sources
        p.sources.forEach(s => { if (!existing.sources.includes(s)) existing.sources.push(s); });
      }
    }
    // Rebuild valid list: keep only the winner for each email, plus anyone with no email
    const winners = new Set(emailMap.values());
    valid = valid.filter(p => !p.email || winners.has(p));
  }

  // Phase 4: Finalize confidence scores and source counts
  for (const p of valid) {
    p.sourceCount = new Set(p.sources.map(s => s.split("_")[0])).size;
    p.confidence = scoreConfidence(p);
  }

  // Phase 4.5: Phone enrichment — SerpAPI search for phoneless people, Twilio validation
  await enrichPhonesPhase(valid, companyName);

  // Phase 4.7: Whitepages Pro — fill missing phones + addresses for US-based people
  // Now email-aware: passes email to Whitepages for much higher match precision
  await enrichPeopleFromWhitepages(valid);

  // Phase 4.8: PDL gap enrichment — fill missing emails/LinkedIn/phone for any
  // contacts still lacking them (especially international people)
  await enrichGapsFromPdl(valid, domain);

  // Phase 4.6: Country-based WhatsApp probability for anyone not yet scored
  // (catches people where Twilio lookup was skipped due to batching caps,
  //  or where phone was found after Twilio ran, or where country is known but no phone)
  applyCountryWhatsapp(valid);

  // Phase 5: Sort — confirmed > high > medium > low, then by sourceCount
  const tier = { confirmed: 4, high: 3, medium: 2, low: 1 };
  valid.sort((a, b) => {
    const td = (tier[b.confidence] || 0) - (tier[a.confidence] || 0);
    if (td !== 0) return td;
    return b.sourceCount - a.sourceCount;
  });

  return valid;
}

// ─── Manual Contact Seeding ───────────────────────────────────────────────────
// Targeted enrichment when you already know who you're looking for.
// Runs Seamless search + identity research, Hunter email-finder,
// SerpAPI LinkedIn/phone sweep, Whitepages, and ZeroBounce against a
// specific name + company — and returns a single enriched FoundPerson.

export async function seedContactEnrichment(
  firstName: string,
  lastName: string,
  company: string,
  website: string,   // can be "" if unknown
): Promise<FoundPerson | null> {
  const domain = website ? extractDomain(website) : null;
  const fullName = `${firstName} ${lastName}`;

  // Accumulate all found data into this object
  let result: FoundPerson = {
    firstName, lastName, fullName,
    jobTitle: null, seniority: null,
    email: null, emailConfidence: 0, emailVerified: false, emailStatus: "not_found",
    phone: null, ...DEFAULT_PHONE_META,
    linkedinUrl: null, bio: null, country: null, address: null,
    sources: [], sourceCount: 0,
    confidence: "low", e2ViaBio: false, internationalBio: false,
  };

  const addSource = (s: string) => { if (!result.sources.includes(s)) result.sources.push(s); };

  // ── Step 1: Seamless — identity research + name/company search ───────────────
  if (process.env.SEAMLESS_API_KEY) {
    try {
      // First, identity research (name + domain/company/LinkedIn) to unlock a
      // verified email + phone directly.
      const enriched = await seamlessEnrichByIdentity([
        {
          contactName: fullName,
          companyName: company || undefined,
          domain: domain || undefined,
          liProfileUrl: result.linkedinUrl || undefined,
        },
      ]);
      let match: SeamlessPerson | undefined = enriched.find(p =>
        isSameName(p.firstName.toLowerCase(), firstName.toLowerCase()) &&
        isSameName(p.lastName.toLowerCase(), lastName.toLowerCase())
      ) || enriched[0];

      // Fallback: search by name + company (enriched) if identity research is empty.
      if (!match) {
        const found = await seamlessFindPeople(
          {
            fullName,
            companyName: company || undefined,
            companyDomains: domain ? [domain] : undefined,
            limit: 5,
          },
          { enrich: true },
        );
        match = found.find(p =>
          isSameName(p.firstName.toLowerCase(), firstName.toLowerCase()) &&
          isSameName(p.lastName.toLowerCase(), lastName.toLowerCase())
        ) || found[0];
      }

      if (match) {
        if (!result.jobTitle) result.jobTitle = match.jobTitle;
        if (!result.seniority) result.seniority = normalizeSeniority(match.seniority);
        if (!result.email && match.email) {
          result.email = match.email;
          result.emailConfidence = match.emailConfidence || 75;
          result.emailVerified = match.emailVerified;
          result.emailStatus = match.emailStatus;
        }
        if (!result.phone && match.phone) result.phone = match.phone;
        if (!result.linkedinUrl && match.linkedinUrl) result.linkedinUrl = match.linkedinUrl;
        if (!result.country && match.country) result.country = match.country;
        addSource("seamless");
      }
    } catch { /* ignore */ }
  }

  // ── Step 3: Hunter email-finder (name + domain) ─────────────────────────────
  if (domain && !result.email) {
    try {
      const hunterResult = await hunterFindEmail(firstName, lastName, domain);
      if (hunterResult) {
        result.email = hunterResult.email;
        result.emailConfidence = hunterResult.confidence;
        result.emailVerified = hunterResult.status === "valid";
        result.emailStatus = hunterResult.status || "unverified";
        addSource("hunter");
      }
    } catch { /* ignore */ }
  }

  // ── Step 4: SerpAPI — LinkedIn URL + phone scraping ─────────────────────────
  const serpKey = process.env.SERPAPI_KEY;
  if (serpKey) {
    // 4a: broad name+company search for phone snippets and bio clues
    try {
      const q = `"${fullName}" "${company}"`;
      const params = new URLSearchParams({ engine: "google", q, api_key: serpKey, num: "8" });
      const r = await fetch(`${SERPAPI_BASE}?${params}`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) {
        const json = await r.json() as {
          organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
          knowledge_graph?: { phone?: string };
        };
        // Phone from knowledge graph
        if (!result.phone) {
          const kgPhone = json.knowledge_graph?.phone;
          if (kgPhone) { const s = kgPhone.replace(/\D/g, ""); if (s.length >= 7) result.phone = kgPhone.trim(); }
        }
        // Phone from snippets
        if (!result.phone) {
          const snippets = (json.organic_results || []).map(x => `${x.title || ""} ${x.snippet || ""}`).join(" ");
          const found = extractPhoneFromText(snippets);
          if (found) result.phone = found;
        }
        // LinkedIn URL from organic results
        if (!result.linkedinUrl) {
          const liResult = (json.organic_results || []).find(x => x.link?.includes("linkedin.com/in/"));
          if (liResult?.link) result.linkedinUrl = liResult.link.split("?")[0];
        }
        if ((json.organic_results || []).length) addSource("serp_name");
      }
    } catch { /* ignore */ }

    // 4b: targeted LinkedIn search
    if (!result.linkedinUrl) {
      try {
        const q = `site:linkedin.com/in "${fullName}" "${company}"`;
        const params = new URLSearchParams({ engine: "google", q, api_key: serpKey, num: "3" });
        const r = await fetch(`${SERPAPI_BASE}?${params}`, { signal: AbortSignal.timeout(6_000) });
        if (r.ok) {
          const json = await r.json() as { organic_results?: Array<{ link?: string }> };
          const li = (json.organic_results || []).find(x => x.link?.includes("linkedin.com/in/"));
          if (li?.link) {
            result.linkedinUrl = li.link.split("?")[0];
            addSource("serp_linkedin");
          }
        }
      } catch { /* ignore */ }
    }
  }

  // If no data found at all — return null
  if (!result.email && !result.phone && !result.linkedinUrl && !result.jobTitle) {
    return result.sources.length ? result : null;
  }

  // ── Step 5: ZeroBounce email verification ────────────────────────────────────
  if (result.email && !result.emailVerified) {
    try {
      const { verifyEmail } = await import("./zerobounce-service");
      const zb = await verifyEmail(result.email);
      if (zb.status !== "unverified") {
        result.emailVerified = zb.status === "valid";
        result.emailStatus = zb.status;
        if (zb.status === "valid") result.emailConfidence = Math.max(result.emailConfidence, 90);
      }
    } catch { /* ignore */ }
  }

  // ── Step 6: Whitepages — phone + address (US-only) ───────────────────────────
  try {
    const { whitePageslookup } = await import("./whitepages-service");
    const wp = await whitePageslookup({
      firstName, lastName,
      email: result.email || undefined,
    });
    if (wp.found) {
      if (!result.phone && wp.phone) result.phone = wp.phone;
      if (!result.address && wp.address) result.address = wp.address;
      addSource("whitepages");
    }
  } catch { /* ignore */ }

  // ── Step 7: Finalise ─────────────────────────────────────────────────────────
  result.sourceCount = new Set(result.sources.map(s => s.split("_")[0])).size;
  result.confidence = scoreConfidence(result);

  // e2ViaBio / internationalBio detection from bio
  if (result.bio) {
    const bioLc = result.bio.toLowerCase();
    result.e2ViaBio = /e-?2|treaty investor|immigration|visa/.test(bioLc);
    result.internationalBio = /international|global|cross.border|multinational/.test(bioLc);
  }

  return result;
}
