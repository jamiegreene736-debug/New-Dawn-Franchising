import { db } from "./db";
import { contacts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { calculateLeadScore } from "./lead-scoring";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

let lastRunStats = {
  lastRun: null as string | null,
  imported: 0,
  skipped: 0,
  total: 0,
};

function getKey(): string | null {
  return process.env.APOLLO_API_KEY || null;
}

export async function apolloSearch(params: {
  titles?: string[];
  locations?: string[];
  keywords?: string;
  page?: number;
}): Promise<{ imported: number; skipped: number; total: number; error?: string }> {
  const apiKey = getKey();
  if (!apiKey) {
    return { imported: 0, skipped: 0, total: 0, error: "APOLLO_API_KEY not configured" };
  }

  try {
    const body: Record<string, unknown> = {
      per_page: 25,
      page: params.page || 1,
    };
    if (params.titles?.length) body.person_titles = params.titles;
    if (params.locations?.length) body.person_locations = params.locations;
    if (params.keywords) body.q_keywords = params.keywords;

    const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { imported: 0, skipped: 0, total: 0, error: `Apollo API error: ${res.status} ${text}` };
    }

    const data = await res.json() as { people?: Record<string, unknown>[] };
    const people = data.people || [];

    let imported = 0;
    let skipped = 0;

    for (const person of people) {
      const email = (person.email as string) || null;

      if (email) {
        const [existing] = await db.select().from(contacts).where(eq(contacts.email, email));
        if (existing) {
          skipped++;
          continue;
        }
      }

      const firstName = (person.first_name as string) || "";
      const lastName = (person.last_name as string) || "";
      const firmName = (person.organization_name as string) || (person.company as string) || null;
      const country = (person.country as string) || null;
      const city = (person.city as string) || null;
      const linkedinUrl = (person.linkedin_url as string) || null;

      let personaType = "immigration_attorney";
      const title = ((person.title as string) || "").toLowerCase();
      if (title.includes("consultant")) personaType = "immigration_consultant";
      else if (title.includes("migration")) personaType = "business_migration_agent";
      else if (title.includes("relocation")) personaType = "relocation_consultant";
      else if (title.includes("tax")) personaType = "international_tax_advisor";

      const contactData = {
        firstName,
        lastName,
        email,
        phone: null,
        firmName,
        jobTitle: (person.title as string) || null,
        personaType,
        country,
        city,
        source: "Apollo",
        linkedinUrl,
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

      await db.insert(contacts).values({ ...contactData, leadScore: score });
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

export function getApolloStatus() {
  return {
    ...lastRunStats,
    configured: !!getKey(),
  };
}

// ─── Prospect Enrichment Functions ────────────────────────────────────────────

export interface ApolloPersonResult {
  firstName: string;
  lastName: string;
  email: string | null;
  emailConfidence: number;
  phone: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  seniority: string | null;
}

export async function apolloMatchPerson(
  firstName: string,
  lastName: string,
  domain: string
): Promise<ApolloPersonResult | null> {
  const apiKey = getKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        organization_domain: domain,
        reveal_phone_number: true,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { person?: Record<string, unknown> };
    const p = json.person;
    if (!p) return null;
    return {
      firstName: String(p.first_name || firstName),
      lastName: String(p.last_name || lastName),
      email: String(p.email || "") || null,
      emailConfidence: p.email_status === "verified" ? 95 : 70,
      phone: ((p.phone_numbers as unknown[])?.[0] as string) || null,
      linkedinUrl: String(p.linkedin_url || "") || null,
      jobTitle: String(p.title || "") || null,
      seniority: String(p.seniority || "") || null,
    };
  } catch { return null; }
}

export async function apolloSearchByDomain(
  domain: string,
  maxContacts = 8
): Promise<ApolloPersonResult[]> {
  const apiKey = getKey();
  if (!apiKey) return [];

  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        organization_domains: [domain],
        person_seniorities: ["owner", "founder", "c_suite", "partner", "vp", "director", "manager"],
        per_page: maxContacts,
        page: 1,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json() as { people?: Record<string, unknown>[] };
    return (json.people || []).map((p) => ({
      firstName: String(p.first_name || ""),
      lastName: String(p.last_name || ""),
      email: String(p.email || "") || null,
      emailConfidence: p.email_status === "verified" ? 95 : 70,
      phone: ((p.phone_numbers as unknown[])?.[0] as string) || null,
      linkedinUrl: String(p.linkedin_url || "") || null,
      jobTitle: String(p.title || "") || null,
      seniority: String(p.seniority || "") || null,
    }));
  } catch { return []; }
}

/**
 * Fallback: search Apollo for people at a company using the company name as a
 * keyword when the domain search returns no usable contacts.  Casts a wide
 * seniority net so founders/partners/etc. aren't missed.
 */
export async function apolloSearchByCompanyName(
  companyName: string,
  domain: string | null,
  maxContacts = 6
): Promise<ApolloPersonResult[]> {
  const apiKey = getKey();
  if (!apiKey) return [];

  try {
    const body: Record<string, unknown> = {
      q_organization_name: companyName,
      person_seniorities: ["owner", "founder", "c_suite", "partner", "vp", "director", "manager", "senior"],
      per_page: maxContacts,
      page: 1,
    };
    if (domain) body.organization_domains = [domain];

    const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const json = await res.json() as { people?: Record<string, unknown>[] };
    return (json.people || []).map((p) => ({
      firstName: String(p.first_name || ""),
      lastName: String(p.last_name || ""),
      email: String(p.email || "") || null,
      emailConfidence: p.email_status === "verified" ? 95 : 70,
      phone: ((p.phone_numbers as unknown[])?.[0] as string) || null,
      linkedinUrl: String(p.linkedin_url || "") || null,
      jobTitle: String(p.title || "") || null,
      seniority: String(p.seniority || "") || null,
    }));
  } catch { return []; }
}
