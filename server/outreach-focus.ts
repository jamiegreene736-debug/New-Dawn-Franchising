/**
 * Daily outreach focus.
 *
 * Default is US immigration attorneys — the people who actually file E-2
 * petitions. Set OUTREACH_FOCUS=all to restore the old mix (in-country
 * brokers, wealth managers, treaty-country attorneys).
 */
import { allNamedAccounts, type NamedAccount } from "./named-accounts";

export type OutreachFocus = "us_immigration_attorneys" | "all";

export function getOutreachFocus(env: NodeJS.ProcessEnv = process.env): OutreachFocus {
  const raw = (env.OUTREACH_FOCUS ?? "us_immigration_attorneys").trim().toLowerCase();
  if (raw === "off" || raw === "all" || raw === "none" || raw === "false" || raw === "0") {
    return "all";
  }
  return "us_immigration_attorneys";
}

export function isUsImmigrationFocus(env: NodeJS.ProcessEnv = process.env): boolean {
  return getOutreachFocus(env) === "us_immigration_attorneys";
}

/** Rotate these metros so each day is a fresh US city, not "United States" again. */
export const US_IMMIGRATION_CITIES = [
  "Houston",
  "Dallas",
  "Austin",
  "Miami",
  "Los Angeles",
  "New York",
  "Chicago",
  "Atlanta",
  "San Francisco",
  "Washington DC",
  "Phoenix",
  "Seattle",
  "Denver",
  "Boston",
  "Orlando",
  "San Diego",
  "Philadelphia",
  "Charlotte",
];

const NON_US_GEO_RE =
  /\b(mexico city|ciudad de mexico|seoul|busan|bogot|buenos aires|s[aã]o paulo|tel aviv|dubai|london|paris|frankfurt|madrid|tokyo|mumbai|shanghai|canada|united kingdom|south korea|colombia|argentina|brazil|israel|uae|saudi)\b/i;

const US_COUNTRY_RE = /\b(united states|u\.?s\.?a\.?|u\.s\.)\b/i;

const US_STATE_RE =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)\b/i;

const US_STATE_ABBR_RE =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)\b/;

const US_CITY_RE = new RegExp(
  `\\b(${US_IMMIGRATION_CITIES.map((c) => c.replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "i",
);

const IMMIGRATION_PERSONA_RE =
  /immigration (attorney|lawyer|law|counsel)|visa attorney|investor visa|treaty investor|\be-?2\b|abogado de inmigraci[oó]n/i;

export function isUsLocation(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ").trim();
  if (!blob) return false;
  if (NON_US_GEO_RE.test(blob) && !US_COUNTRY_RE.test(blob)) return false;
  if (US_COUNTRY_RE.test(blob)) return true;
  if (/^(united states|usa|us)$/i.test(blob)) return true;
  if (US_STATE_RE.test(blob) || US_STATE_ABBR_RE.test(blob)) return true;
  if (US_CITY_RE.test(blob)) return true;
  return false;
}

export function isImmigrationAttorneyPersona(...parts: Array<string | null | undefined>): boolean {
  const blob = parts.filter(Boolean).join(" ");
  const cat = (parts[0] || "").toLowerCase();
  if (cat === "immigration_attorney" || cat.includes("immigration")) return true;
  return IMMIGRATION_PERSONA_RE.test(blob);
}

export function isUsImmigrationAttorney(lead: {
  category?: string | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  title?: string | null;
  company?: string | null;
  notes?: string | null;
}): boolean {
  return (
    isUsLocation(lead.country, lead.city, lead.location, lead.notes) &&
    isImmigrationAttorneyPersona(lead.category, lead.title, lead.company, lead.notes)
  );
}

export function isUsImmigrationQuery(query: string, purpose = ""): boolean {
  const blob = `${query} ${purpose}`;
  if (NON_US_GEO_RE.test(blob) && !US_COUNTRY_RE.test(blob) && !US_CITY_RE.test(blob)) return false;
  if (/wealth manager|franchise broker|business broker|family office|chamber of commerce/i.test(blob)
    && !IMMIGRATION_PERSONA_RE.test(blob)) {
    return false;
  }
  return isUsLocation(blob) && isImmigrationAttorneyPersona("immigration_attorney", blob);
}

export function namedAccountsForUsImmigration(limit = 12): NamedAccount[] {
  const all = allNamedAccounts().filter(
    (a) => a.country === "United States" && a.category === "immigration_attorney",
  );
  return all.slice(0, limit);
}

export function citiesUsedInPlans(lines: string[]): string[] {
  const used: string[] = [];
  const blob = lines.join("\n");
  for (const city of US_IMMIGRATION_CITIES) {
    if (new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i").test(blob)) used.push(city);
  }
  return used;
}

export function pickUsCities(recentUsed: string[], count = 5): string[] {
  const used = new Set(recentUsed.map((c) => c.toLowerCase()));
  const fresh = US_IMMIGRATION_CITIES.filter((c) => !used.has(c.toLowerCase()));
  const pool = fresh.length >= count ? fresh : US_IMMIGRATION_CITIES;
  return pool.slice(0, count);
}

export type FocusCategory = {
  category: string;
  country: string;
  geoFocus: string;
  reasoning: string;
  estimatedLeads: number;
  priority: "high" | "medium" | "low";
};

export type FocusQuery = { query: string; source: "serpapi" | "apollo" | "hunter"; purpose: string };

export function applyUsImmigrationFocusToPlan<T extends {
  planSummary?: string;
  leadCategories?: FocusCategory[];
  searchQueries?: FocusQuery[];
}>(plan: T, recentTargetLines: string[] = []): T {
  const cities = pickUsCities(citiesUsedInPlans(recentTargetLines), 5);
  const fromModel = (plan.leadCategories ?? []).filter((c) =>
    isUsLocation(c.country, c.geoFocus) && isImmigrationAttorneyPersona(c.category, c.geoFocus),
  );
  const leadCategories: FocusCategory[] = (fromModel.length >= 3 ? fromModel : cities.map((city, i) => ({
    category: "immigration_attorney",
    country: "United States",
    geoFocus: `${city} — US immigration attorneys who file E-2 / investor visas`,
    reasoning: "Focus locked to US immigration attorneys (the lawyers who file the petition).",
    estimatedLeads: 8,
    priority: (i === 0 ? "high" : "medium") as "high" | "medium",
  }))).map((c) => ({
    ...c,
    category: "immigration_attorney",
    country: "United States",
  }));

  const kept = (plan.searchQueries ?? []).filter((q) =>
    q.source === "hunter" || isUsImmigrationQuery(q.query, q.purpose),
  );
  const extras: FocusQuery[] = [];
  const apolloTitles = [
    "immigration attorney — United States",
    "E-2 visa attorney — United States",
    "investor visa attorney — United States",
    "treaty investor attorney — United States",
  ];
  for (const city of cities) {
    extras.push({
      query: `immigration attorney E-2 visa ${city}`,
      source: "serpapi",
      purpose: `US immigration attorneys in ${city} who file E-2 / investor visas`,
    });
  }
  for (let i = 0; i < apolloTitles.length; i++) {
    extras.push({
      query: apolloTitles[i],
      source: "apollo",
      purpose: `Structured Apollo search: ${apolloTitles[i].split(" — ")[0]} in ${cities[i % cities.length]}, United States`,
    });
  }
  const seen = new Set(kept.map((q) => q.query.toLowerCase()));
  const searchQueries = [...kept];
  for (const q of extras) {
    if (seen.has(q.query.toLowerCase()) && q.source !== "apollo") continue;
    if (q.source === "apollo" && searchQueries.filter((x) => x.source === "apollo").length >= 4) continue;
    if (searchQueries.length >= 14) break;
    searchQueries.push(q);
    seen.add(q.query.toLowerCase());
  }

  return {
    ...plan,
    planSummary: plan.planSummary?.includes("US immigration")
      ? plan.planSummary
      : `US immigration attorneys only — ${cities.slice(0, 3).join(", ")} and nearby metros. E-2 petition counsel who can introduce clients that still need a qualifying business.`,
    leadCategories,
    searchQueries,
  };
}

export const US_IMMIGRATION_FOCUS_PROMPT = `

FOCUS OVERRIDE — TODAY THIS IS MANDATORY:
Target ONLY United States immigration attorneys (people who file E-2 / treaty-investor / investor-visa petitions). Do NOT plan for wealth managers, business brokers, franchise brokers, chambers, relocation consultants, or attorneys outside the US. Do NOT use Angle 1 (in-country Mexico/Korea/etc.). Vary US cities so we are not repeating the same metro as the last 7 days. All leadCategories must be category "immigration_attorney" and country "United States". All search queries must name a US city or "United States" plus immigration/E-2 language. First-touch copy is English.
`;
