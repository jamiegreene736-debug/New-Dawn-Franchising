/**
 * Named-account list — E-2 introducer firms we already know are in-market.
 * Apollo/Hunter should fill people AT these firms instead of spraying
 * "immigration attorney + country."
 *
 * Seed is a curated public-directory set. Discoveries from signals and
 * lookalikes append at runtime via rememberNamedAccount().
 */

export interface NamedAccount {
  name: string;
  domain: string;
  country: string;
  category: string;
  city?: string;
}

/** Public E-2 / investor-visa / franchise-consultant / diaspora firms. */
export const NAMED_ACCOUNT_SEED: NamedAccount[] = [
  // US — investor-visa / corporate immigration
  { name: "Fragomen", domain: "fragomen.com", country: "United States", category: "immigration_attorney", city: "New York" },
  { name: "Berry Appleman & Leiden", domain: "bal.com", country: "United States", category: "immigration_attorney", city: "San Francisco" },
  { name: "Klasko Immigration Law Partners", domain: "klaskolaw.com", country: "United States", category: "immigration_attorney", city: "Philadelphia" },
  { name: "Murthy Law Firm", domain: "murthy.com", country: "United States", category: "immigration_attorney", city: "Baltimore" },
  { name: "Foster LLP", domain: "fosterglobal.com", country: "United States", category: "immigration_attorney", city: "Houston" },
  { name: "Siskind Susser", domain: "visalaw.com", country: "United States", category: "immigration_attorney", city: "Memphis" },
  { name: "Reddy Neumann Brown PC", domain: "rnlawgroup.com", country: "United States", category: "immigration_attorney", city: "Houston" },
  { name: "Wolfsdorf Rosenthal", domain: "wolfsdorf.com", country: "United States", category: "immigration_attorney", city: "Los Angeles" },
  { name: "WR Immigration", domain: "wrimmigration.com", country: "United States", category: "immigration_attorney", city: "Los Angeles" },
  { name: "Corporate Immigration Partners", domain: "cipimmigration.com", country: "United States", category: "immigration_attorney" },
  { name: "Visa Law Group", domain: "visalawgroup.com", country: "United States", category: "immigration_attorney" },
  { name: "Graham Adair", domain: "grahamadair.com", country: "United States", category: "immigration_attorney" },
  { name: "Chugh LLP", domain: "chugh.com", country: "United States", category: "immigration_attorney", city: "Los Angeles" },
  { name: "Jewell Stewart Pratt", domain: "jsplegal.com", country: "United States", category: "immigration_attorney" },
  { name: "Davies & Associates", domain: "usimmigrationadvisor.com", country: "United States", category: "immigration_attorney" },
  { name: "Colombo & Hurd", domain: "colombohurdlaw.com", country: "United States", category: "immigration_attorney", city: "Orlando" },
  { name: "Sandra C. McCormack Law", domain: "mccormackvisa.com", country: "United States", category: "immigration_attorney" },
  { name: "Ashoori Law", domain: "ashoorilaw.com", country: "United States", category: "immigration_attorney" },
  { name: "Zhang & Associates", domain: "hooyou.com", country: "United States", category: "immigration_attorney", city: "Houston" },
  { name: "Chen Immigration Law Associates", domain: "wegreened.com", country: "United States", category: "immigration_attorney" },
  { name: "Ellis Porter", domain: "ellisporter.com", country: "United States", category: "immigration_attorney" },
  { name: "ImmiGreat Law", domain: "immigreatlaw.com", country: "United States", category: "immigration_attorney" },
  { name: "VisaNation", domain: "visanation.com", country: "United States", category: "immigration_attorney" },
  { name: "Manifest Law", domain: "manifestlaw.com", country: "United States", category: "immigration_attorney" },
  { name: "Boundless Immigration", domain: "boundless.com", country: "United States", category: "immigration_consultant" },
  { name: "CitizenPath", domain: "citizenpath.com", country: "United States", category: "immigration_consultant" },

  // E-2 franchise / investor-business specialists
  { name: "VisaFranchise", domain: "visafranchise.com", country: "United States", category: "franchise_broker" },
  { name: "E2VisaJobs", domain: "e2visajobs.com", country: "United States", category: "visa_consultant" },
  { name: "InvestVisa", domain: "investvisa.com", country: "United States", category: "visa_consultant" },

  // Franchise consultants / brokers (international buyers)
  { name: "FranNet", domain: "frannet.com", country: "United States", category: "franchise_broker" },
  { name: "IFPG", domain: "ifpg.org", country: "United States", category: "franchise_broker" },
  { name: "The Entrepreneur's Source", domain: "entrepreneursource.com", country: "United States", category: "franchise_broker" },
  { name: "Transworld Business Advisors", domain: "tworld.com", country: "United States", category: "business_broker" },
  { name: "Sunbelt Business Brokers", domain: "sunbeltnetwork.com", country: "United States", category: "business_broker" },
  { name: "VR Business Brokers", domain: "vrbusinessbrokers.com", country: "United States", category: "business_broker" },
  { name: "IBAglobal", domain: "ibaglobal.com", country: "United States", category: "business_broker" },
  { name: "FranChoice", domain: "franchoice.com", country: "United States", category: "franchise_broker" },
  { name: "Franchise Direct", domain: "franchisedirect.com", country: "United States", category: "franchise_broker" },

  // Mexico / LatAm
  { name: "Gonzalez Calvillo", domain: "gcsc.com.mx", country: "Mexico", category: "immigration_attorney", city: "Mexico City" },
  { name: "Basham Ringe y Correa", domain: "basham.com.mx", country: "Mexico", category: "immigration_attorney", city: "Mexico City" },
  { name: "Santamarina y Steta", domain: "s-s.mx", country: "Mexico", category: "immigration_attorney", city: "Mexico City" },
  { name: "Creel Garcia-Cuellar", domain: "creel.mx", country: "Mexico", category: "immigration_attorney", city: "Mexico City" },
  { name: "Cacheaux Cavazos & Newton", domain: "ccn-law.com", country: "Mexico", category: "immigration_attorney", city: "Mexico City" },
  { name: "Haynes Boone Mexico", domain: "haynesboone.com", country: "Mexico", category: "immigration_attorney" },
  { name: "Visas Mexico", domain: "visasmexico.com", country: "Mexico", category: "visa_consultant", city: "Mexico City" },
  { name: "ImmiMexico", domain: "immimexico.com", country: "Mexico", category: "visa_consultant" },
  { name: "Posse Herrera Ruiz", domain: "phrlegal.com", country: "Colombia", category: "immigration_attorney", city: "Bogotá" },
  { name: "Brigard Urrutia", domain: "bu.com.co", country: "Colombia", category: "immigration_attorney", city: "Bogotá" },
  { name: "Lewin & Wills", domain: "lewinywills.com", country: "Colombia", category: "immigration_attorney", city: "Bogotá" },
  { name: "Marval O'Farrell Mairal", domain: "marval.com", country: "Argentina", category: "immigration_attorney", city: "Buenos Aires" },
  { name: "Demarest Advogados", domain: "demarest.com.br", country: "Brazil", category: "immigration_attorney", city: "São Paulo" },
  { name: "TozziniFreire", domain: "tozzinifreire.com.br", country: "Brazil", category: "immigration_attorney", city: "São Paulo" },

  // Korea
  { name: "Kim & Chang", domain: "kimchang.com", country: "South Korea", category: "immigration_attorney", city: "Seoul" },
  { name: "Lee & Ko", domain: "leeko.com", country: "South Korea", category: "immigration_attorney", city: "Seoul" },
  { name: "Bae Kim & Lee", domain: "bkl.co.kr", country: "South Korea", category: "immigration_attorney", city: "Seoul" },
  { name: "Yulchon", domain: "yulchon.com", country: "South Korea", category: "immigration_attorney", city: "Seoul" },
  { name: "Shin & Kim", domain: "shinkim.com", country: "South Korea", category: "immigration_attorney", city: "Seoul" },
  { name: "Korean American Lawyers Association of Greater New York", domain: "kalagny.org", country: "United States", category: "chamber", city: "New York" },

  // Gulf / Israel / Europe mobility
  { name: "Hadef & Partners", domain: "hadefpartners.com", country: "UAE", category: "immigration_attorney", city: "Dubai" },
  { name: "Al Tamimi & Company", domain: "tamimi.com", country: "UAE", category: "immigration_attorney", city: "Dubai" },
  { name: "BSA Ahmad Bin Hezeem", domain: "bsabh.com", country: "UAE", category: "immigration_attorney", city: "Dubai" },
  { name: "Herzog Fox & Neeman", domain: "herzoglaw.co.il", country: "Israel", category: "immigration_attorney", city: "Tel Aviv" },
  { name: "Goldfarb Seligman", domain: "goldfarb.com", country: "Israel", category: "immigration_attorney", city: "Tel Aviv" },
  { name: "Mishcon de Reya", domain: "mishcon.com", country: "United Kingdom", category: "immigration_attorney", city: "London" },
  { name: "Kingsley Napley", domain: "kingsleynapley.co.uk", country: "United Kingdom", category: "immigration_attorney", city: "London" },
  { name: "Laura Devine Immigration", domain: "lauradevine.com", country: "United Kingdom", category: "immigration_attorney", city: "London" },
  { name: "Fragomen UK", domain: "fragomen.com", country: "United Kingdom", category: "immigration_attorney", city: "London" },

  // Diaspora chambers / associations
  { name: "Korean American Chamber of Commerce of LA", domain: "kacc.la", country: "United States", category: "chamber", city: "Los Angeles" },
  { name: "Houston Hispanic Chamber of Commerce", domain: "houstonhispanicchamber.com", country: "United States", category: "chamber", city: "Houston" },
  { name: "US-Mexico Chamber of Commerce", domain: "usmcoc.org", country: "United States", category: "chamber" },
  { name: "World Trade Center El Paso", domain: "wtcelpaso.com", country: "United States", category: "chamber", city: "El Paso" },
  { name: "Greater Miami Chamber of Commerce", domain: "miamichamber.com", country: "United States", category: "chamber", city: "Miami" },
];

const extra = new Map<string, NamedAccount>();

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/);
  if (!m) return null;
  return m[0].replace(/^www\./, "");
}

export function rememberNamedAccount(account: NamedAccount): NamedAccount {
  const domain = normalizeDomain(account.domain);
  if (!domain) return account;
  const row = { ...account, domain };
  extra.set(domain, row);
  return row;
}

export function allNamedAccounts(): NamedAccount[] {
  const byDomain = new Map<string, NamedAccount>();
  for (const a of NAMED_ACCOUNT_SEED) {
    const d = normalizeDomain(a.domain);
    if (d) byDomain.set(d, { ...a, domain: d });
  }
  for (const [d, a] of extra) byDomain.set(d, a);
  return [...byDomain.values()];
}

export function isNamedAccountDomain(websiteOrDomain: string | null | undefined): boolean {
  const d = normalizeDomain(websiteOrDomain);
  if (!d) return false;
  return allNamedAccounts().some((a) => a.domain === d);
}

/** Pick firms for today's countries (plus a few US Angle-2 firms). */
export function namedAccountsForCountries(countries: string[], limit = 12): NamedAccount[] {
  const want = new Set(countries.map((c) => c.toLowerCase().trim()));
  const all = allNamedAccounts();
  const matched = all.filter((a) => want.has(a.country.toLowerCase()));
  const usAngle2 = want.has("united states") || want.has("usa")
    ? []
    : all.filter((a) => a.country === "United States").slice(0, 4);
  const picked = [...matched, ...usAngle2];
  const seen = new Set<string>();
  const out: NamedAccount[] = [];
  for (const a of picked) {
    if (seen.has(a.domain)) continue;
    seen.add(a.domain);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

export function hunterQueriesForAccounts(
  accounts: NamedAccount[],
): { query: string; source: "hunter"; purpose: string }[] {
  return accounts.map((a) => ({
    query: a.domain,
    source: "hunter" as const,
    purpose: `Named-account people at ${a.name} (${a.country})`,
  }));
}
