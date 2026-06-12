/**
 * People Data Labs (PDL) enrichment service
 * Docs: https://docs.peopledatalabs.com/docs/person-enrichment-api
 *
 * Two entry points used here:
 *   1. Person Enrichment  — enrich a single person by name + company domain
 *   2. Company Enrichment — find employees at a domain (PDL "identify" + bulk person search)
 *
 * PDL is especially strong for international contacts (EU, APAC, LATAM) where
 * Seamless.AI's coverage tends to drop off.
 */

const PDL_BASE = "https://api.peopledatalabs.com/v5";

function pdlApiKey(): string | null {
  return process.env.PEOPLE_DATA_LABS_API_KEY || null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdlPerson {
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  job_title_levels?: string[];  // e.g. ["owner","c_suite","vp","director","manager","senior"]
  job_company_name?: string;
  job_company_website?: string;
  linkedin_url?: string;
  work_email?: string;
  personal_emails?: string[];
  mobile_phone?: string;
  phone_numbers?: string[];
  location_country?: string;
  location_locality?: string;
  location_region?: string;
  bio?: string;
  skills?: string[];
  industry?: string;
  summary?: string;
}

interface PdlEnrichResponse {
  status?: number;
  data?: PdlPerson;
  likelihood?: number;
  error?: { type?: string; message?: string };
}

interface PdlSearchResponse {
  status?: number;
  data?: PdlPerson[];
  total?: number;
  error?: { type?: string; message?: string };
}

// ─── Seniority normaliser ────────────────────────────────────────────────────

export function pdlLevelToSeniority(levels: string[] | undefined): string {
  if (!levels || !levels.length) return "associate";
  const l = levels.map(x => x.toLowerCase());
  if (l.some(x => ["owner", "founder"].includes(x))) return "owner";
  if (l.some(x => ["c_suite", "partner"].includes(x))) return "partner";
  if (l.some(x => ["vp", "director"].includes(x))) return "director";
  if (l.some(x => ["manager", "senior"].includes(x))) return "senior";
  return "associate";
}

// ─── Person Enrichment ────────────────────────────────────────────────────────
/**
 * Enrich a single person by name + company domain.
 * Returns null if PDL key is missing or no match (likelihood < 4).
 */
export async function enrichPersonViaPdl(
  firstName: string,
  lastName: string,
  companyDomain: string
): Promise<PdlPerson | null> {
  const apiKey = pdlApiKey();
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      company: companyDomain,
      min_likelihood: "4",
      required: "emails",
      pretty: "false",
    });

    const res = await fetch(`${PDL_BASE}/person/enrich?${params}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) return null;
    const json = await res.json() as PdlEnrichResponse;
    if (!json.data || (json.likelihood ?? 0) < 4) return null;
    return json.data;
  } catch {
    return null;
  }
}

// ─── Company People Search ────────────────────────────────────────────────────
/**
 * Fetch up to `limit` people at a given company domain from PDL.
 * Uses the Person Search endpoint with a company website filter.
 * PDL shines here for international contacts.
 */
export async function fetchPeopleFromPdl(
  domain: string,
  limit = 25
): Promise<PdlPerson[]> {
  const apiKey = pdlApiKey();
  if (!apiKey) return [];

  try {
    const body = {
      query: {
        bool: {
          must: [
            { term: { job_company_website: domain } },
            { exists: { field: "work_email" } },
          ],
          should: [
            { terms: { job_title_levels: ["owner", "c_suite", "partner", "vp", "director", "manager"] } },
          ],
          minimum_should_match: 0,
        },
      },
      size: limit,
      dataset: "all",
    };

    const res = await fetch(`${PDL_BASE}/person/search`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];
    const json = await res.json() as PdlSearchResponse;
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ─── Bulk enrichment: fill gaps in already-found people ─────────────────────
/**
 * For people who are missing an email AND/OR LinkedIn, try PDL person enrich.
 * Caps at 10 lookups per search run to stay inside credit budget.
 */
export async function enrichGapsViaPdl(
  people: Array<{
    firstName: string;
    lastName: string;
    email: string | null;
    linkedinUrl: string | null;
    phone: string | null;
    country: string | null;
  }>,
  domain: string
): Promise<Map<string, PdlPerson>> {
  const results = new Map<string, PdlPerson>();
  if (!pdlApiKey()) return results;

  // Prioritise: no email AND no LinkedIn first (biggest gaps), cap at 10
  const priority = [
    ...people.filter(p => !p.email && !p.linkedinUrl),
    ...people.filter(p => !p.email && p.linkedinUrl),
    ...people.filter(p => p.email && !p.linkedinUrl),
  ];

  const seen = new Set<string>();
  const queue: typeof priority = [];
  for (const p of priority) {
    const key = `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      queue.push(p);
    }
    if (queue.length >= 10) break;
  }

  await Promise.all(queue.map(async (person) => {
    const enriched = await enrichPersonViaPdl(person.firstName, person.lastName, domain);
    if (enriched) {
      const key = `${person.firstName.toLowerCase()}|${person.lastName.toLowerCase()}`;
      results.set(key, enriched);
    }
  }));

  return results;
}
