/**
 * contact-upsert.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Shared "add a found prospect into the CRM `contacts` table" logic, used by
 * both the single (`/api/crm/prospects/add-to-contacts`) and bulk
 * (`/api/crm/prospects/add-to-contacts/bulk`) routes so they dedup and score
 * identically.
 *
 * Dedup is by a stable identity — email → personal LinkedIn URL → name+company
 * — because Lead Research results frequently have NO email (reveal costs
 * credits), so email-only dedup would let the same person be inserted on every
 * click. The lookup is shared with `findExistingContact` / `flagExistingContacts`
 * so the "is this already in the CRM?" question is answered the same way whether
 * we're adding a prospect or just flagging search results as already-saved.
 */

import { contacts as contactsTable, crmClients as crmClientsTable } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { calculateLeadScore } from "./lead-scoring";
import type { SeamlessPerson } from "./seamless-service";

export interface ProspectContactInput {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  country?: string | null;
  city?: string | null;
}

const PERSONA_MAP: Record<string, string> = {
  immigration_attorney: "immigration_attorney",
  e2_visa_firm: "immigration_attorney",
  business_broker: "business_broker",
  immigration_consultant: "immigration_consultant",
  franchise_consultant: "franchise_consultant",
  cpa_international: "international_tax_advisor",
  relocation_service: "relocation_consultant",
};

export interface UpsertResult {
  status: "created" | "exists";
  contact: typeof contactsTable.$inferSelect;
}

// Normalize a LinkedIn URL for identity comparison: lowercase, strip protocol,
// "www.", query/hash, and any trailing slash. Returns null for blanks.
function normalizeLinkedIn(url?: string | null): string | null {
  if (!url) return null;
  const u = String(url).trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return u || null;
}

// Only a PERSONAL profile URL (/in/ or /pub/) is a safe dedup identity. Seamless
// sometimes returns a COMPANY LinkedIn page for a person with no personal
// profile; deduping on that would collapse every employee of that company into
// one contact and make genuinely-new people look like they're "already added".
function isPersonalLinkedIn(url?: string | null): boolean {
  const u = normalizeLinkedIn(url);
  return !!u && (u.includes("/in/") || u.includes("/pub/"));
}

// Empty/whitespace company → null, so it matches stored NULL firmNames (an
// empty string and NULL are NOT equal in SQL, which previously let the same
// company-less person be inserted repeatedly).
function normCompany(name?: string | null): string | null {
  const n = (name || "").trim();
  return n || null;
}

// Email is the strongest identity tier; trim + lowercase so casing/whitespace
// variants of the same address (Jane@Firm.com vs jane@firm.com) are one person.
function normEmail(email?: string | null): string | null {
  const e = (email || "").trim().toLowerCase();
  return e || null;
}

function splitFirst(input: ProspectContactInput): { firstName: string; lastName: string } {
  const firstName = input.firstName || (input.fullName || "").split(" ")[0] || "";
  const lastName =
    input.lastName || (input.fullName || "").split(" ").slice(1).join(" ") || "";
  return { firstName, lastName };
}

/**
 * Find an existing CRM contact that matches this prospect by stable identity
 * (email → personal LinkedIn → name+company), or undefined if it's new. This is
 * the single source of truth for "do we already have this person?".
 */
export async function findExistingContact(
  input: ProspectContactInput,
): Promise<typeof contactsTable.$inferSelect | undefined> {
  const { firstName, lastName } = splitFirst(input);
  const email = normEmail(input.email);
  const firmName = normCompany(input.companyName);

  if (email) {
    // Case-insensitive so existing rows stored with different casing still match.
    const [row] = await db
      .select()
      .from(contactsTable)
      .where(sql`lower(${contactsTable.email}) = ${email}`);
    return row;
  }
  if (isPersonalLinkedIn(input.linkedinUrl)) {
    // Compare case-insensitively and ignoring a trailing slash so cosmetic URL
    // variants of the same profile dedup correctly (and matches existing rows,
    // since the stored column — not just the input — is normalized here).
    const target = String(input.linkedinUrl).trim().toLowerCase().replace(/\/+$/, "");
    const [row] = await db
      .select()
      .from(contactsTable)
      .where(sql`lower(trim(trailing '/' from ${contactsTable.linkedinUrl})) = ${target}`);
    return row;
  }
  // Name + company. Need at least a name, or we'd match blank rows.
  if (!firstName && !lastName) return undefined;
  const [row] = await db
    .select()
    .from(contactsTable)
    .where(
      and(
        eq(contactsTable.firstName, firstName),
        eq(contactsTable.lastName, lastName),
        firmName == null
          ? isNull(contactsTable.firmName)
          : eq(contactsTable.firmName, firmName),
      ),
    );
  return row;
}

/**
 * For a batch of prospects, return a boolean per input: true if it's already in
 * the CRM. Used to flag Lead Research results with an "In CRM" badge up-front so
 * already-saved people aren't a surprise when the user tries to add them.
 * Runs sequentially to keep the connection pool calm on large result sets.
 */
export async function flagExistingContacts(
  inputs: ProspectContactInput[],
): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const input of inputs) {
    try {
      out.push(!!(await findExistingContact(input)));
    } catch {
      out.push(false); // best-effort: never block a search on a lookup error
    }
  }
  return out;
}

export interface CrmClientMatchInput {
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
}

/**
 * Find an existing `crm_clients` row matching by a stable identity — email when
 * present, else full name + company. Mirrors the `contacts` dedup so adding a
 * Lead Research prospect "to the CRM" is idempotent: clicking Add twice (or
 * across sessions) returns the existing client instead of inserting a duplicate.
 */
export async function findExistingCrmClient(
  input: CrmClientMatchInput,
): Promise<typeof crmClientsTable.$inferSelect | undefined> {
  const email = (input.email || "").trim().toLowerCase();
  if (email) {
    const [row] = await db
      .select()
      .from(crmClientsTable)
      .where(sql`lower(trim(${crmClientsTable.email})) = ${email}`);
    return row;
  }
  // No email — match on full name + company so credit-less results still dedup.
  const name = (input.fullName || "").trim();
  if (!name) return undefined;
  const company = (input.companyName || "").trim();
  const [row] = await db
    .select()
    .from(crmClientsTable)
    .where(
      and(
        sql`lower(trim(${crmClientsTable.fullName})) = ${name.toLowerCase()}`,
        company
          ? sql`lower(trim(coalesce(${crmClientsTable.companyName}, ''))) = ${company.toLowerCase()}`
          : sql`coalesce(trim(${crmClientsTable.companyName}), '') = ''`,
      ),
    );
  return row;
}

/**
 * Batch version of {@link findExistingCrmClient}: true per input if it's already
 * in the crm_clients pipeline. Used to badge Lead Research results "In CRM".
 */
export async function flagExistingClients(
  inputs: CrmClientMatchInput[],
): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const input of inputs) {
    try {
      out.push(!!(await findExistingCrmClient(input)));
    } catch {
      out.push(false);
    }
  }
  return out;
}

export interface CrmClientUpsertResult {
  status: "created" | "exists";
  client: typeof crmClientsTable.$inferSelect;
}

/**
 * Map a revealed Seamless person → crm_clients enrichment columns: the full raw
 * research payload as JSONB plus the promoted, displayable columns. Mirror of
 * `enrichmentPatch()` in routes.ts — keep the two in sync.
 */
function seamlessEnrichmentPatch(p: SeamlessPerson, now: Date): Record<string, unknown> {
  return {
    enrichmentJson: p.raw ?? null,
    enrichmentSource: "seamless",
    enrichedAt: now,
    email2: p.email2 ?? null,
    email3: p.email3 ?? null,
    emailConfidence: p.emailConfidence ?? null,
    phone2: p.phone2 ?? null,
    phoneType: p.phoneType ?? null,
    seniority: p.seniority ?? null,
    department: p.department ?? null,
    contactCity: p.city ?? null,
    contactState: p.state ?? null,
    companyDomain: p.domain ?? null,
    companyWebsite: p.companyDomainWebsite ?? null,
    companyIndustry: p.companyIndustry ?? null,
    companyStaffCount: p.companyStaffCount ?? null,
    companyStaffRange: p.employeeSizeRange ?? null,
    companyRevenue: p.companyRevenue ?? null,
    companyRevenueExact: p.companyRevenueExact ?? null,
    companyFounded: p.companyFounded ?? null,
    companyType: p.companyType ?? null,
    companyDescription: p.companyDescription ?? null,
    companyLinkedinUrl: p.companyLinkedinUrl ?? null,
    companyFundingTotal: p.companyFundingTotal ?? null,
    companyCity: p.companyCity ?? null,
    companyState: p.companyState ?? null,
    companyCountry: p.companyCountry ?? null,
    timeAtCompany: p.timeAtCompany ?? null,
    startedAtCurrentCompany: p.startedAtCurrentCompany ?? null,
    jobChangeAlert: p.jobChangeAlert ?? null,
    stockTicker: p.stockTicker ?? null,
  };
}

/**
 * Upsert a Seamless person into the `crm_clients` pipeline (the "CRM" tab),
 * persisting the full enrichment payload. Dedups by email → name+company and
 * returns the existing row unchanged when the person is already in the pipeline.
 * Used by the Seamless org-contact auto-sync (server/seamless-org-sync.ts).
 */
function apolloEnrichmentPatch(p: SeamlessPerson, now: Date): Record<string, unknown> {
  return {
    enrichmentJson: p.raw ?? null,
    enrichmentSource: "apollo",
    enrichedAt: now,
    emailConfidence: p.emailConfidence ?? null,
    seniority: p.seniority ?? null,
    department: p.department ?? null,
    contactCity: p.city ?? null,
    contactState: p.state ?? null,
    companyDomain: p.domain ?? null,
    companyIndustry: p.industries?.[0] ?? null,
    companyStaffRange: p.employeeSizeRange ?? null,
    companyRevenue: p.companyRevenue ?? null,
    companyCity: p.companyCity ?? null,
    companyState: p.companyState ?? null,
    companyCountry: p.companyCountry ?? null,
  };
}

/**
 * Upsert an Apollo saved contact into `crm_clients`. Same dedup as Seamless sync.
 */
export async function addCrmClientFromApollo(
  p: SeamlessPerson,
  opts: { leadSource?: string } = {},
): Promise<CrmClientUpsertResult> {
  const fullName = (p.fullName || `${p.firstName} ${p.lastName}`).trim() || "Unknown";
  const companyName = normCompany(p.company);
  const existing = await findExistingCrmClient({ fullName, email: p.email, companyName });
  if (existing) return { status: "exists", client: existing };

  const now = new Date();
  const values = {
    fullName,
    email: normEmail(p.email) || "",
    phone: p.phone || null,
    country: p.country || null,
    leadSource: opts.leadSource || "apollo_sync",
    companyName,
    profession: p.jobTitle || null,
    linkedinUrl: p.linkedinUrl || null,
    status: "new" as const,
    tags: [] as string[],
    ...apolloEnrichmentPatch(p, now),
  };

  const [created] = await db
    .insert(crmClientsTable)
    .values(values as typeof crmClientsTable.$inferInsert)
    .returning();
  if (created) return { status: "created", client: created };

  const raced = await findExistingCrmClient({ fullName, email: p.email, companyName });
  if (raced) return { status: "exists", client: raced };
  throw new Error("addCrmClientFromApollo: insert returned no row and no existing match found");
}

export async function addCrmClientFromSeamless(
  p: SeamlessPerson,
  opts: { leadSource?: string } = {},
): Promise<CrmClientUpsertResult> {
  const fullName = (p.fullName || `${p.firstName} ${p.lastName}`).trim() || "Unknown";
  const companyName = normCompany(p.company);
  const existing = await findExistingCrmClient({ fullName, email: p.email, companyName });
  if (existing) return { status: "exists", client: existing };

  const now = new Date();
  const values = {
    fullName,
    email: normEmail(p.email) || "", // crm_clients.email is NOT NULL — "" when unknown
    phone: p.phone || null,
    country: p.country || null,
    leadSource: opts.leadSource || "seamless_sync",
    companyName,
    profession: p.jobTitle || null,
    linkedinUrl: p.linkedinUrl || null,
    status: "new" as const,
    tags: [] as string[],
    ...seamlessEnrichmentPatch(p, now),
  };

  const [created] = await db
    .insert(crmClientsTable)
    .values(values as typeof crmClientsTable.$inferInsert)
    .returning();
  if (created) return { status: "created", client: created };

  // No unique constraint to conflict on, so this is extremely unlikely — but
  // re-resolve defensively rather than fabricate a client.
  const raced = await findExistingCrmClient({ fullName, email: p.email, companyName });
  if (raced) return { status: "exists", client: raced };
  throw new Error("addCrmClientFromSeamless: insert returned no row and no existing match found");
}

/**
 * Insert a prospect into `contacts`, or return the existing match. Never throws
 * on a duplicate — returns { status: "exists" } so callers can report it.
 */
export async function addProspectContact(
  input: ProspectContactInput,
  category?: string,
  opts: { source?: string } = {},
): Promise<UpsertResult> {
  const existing = await findExistingContact(input);
  if (existing) return { status: "exists", contact: existing };

  const { firstName, lastName } = splitFirst(input);
  const contactData = {
    firstName,
    lastName,
    email: normEmail(input.email),
    phone: input.phone || null,
    firmName: normCompany(input.companyName),
    jobTitle: input.jobTitle || null,
    personaType: PERSONA_MAP[category || ""] || "immigration_attorney",
    linkedinUrl: input.linkedinUrl || null,
    websiteUrl: null,
    status: "new" as const,
    tags: [] as string[],
    notes: input.bio?.slice(0, 300) || null,
    source: opts.source || "Prospect Finder",
    country: input.country || null,
    city: input.city || null,
    gdprNote: null,
    consentSource: null,
    referredByContactId: null,
    possibleDuplicateOf: null,
  };

  const score = calculateLeadScore(contactData, false);
  // onConflictDoNothing guards the UNIQUE-email constraint against a race; if it
  // no-ops we re-read the now-existing row so the caller still gets an id.
  const [created] = await db
    .insert(contactsTable)
    .values({ ...contactData, leadScore: score })
    .onConflictDoNothing()
    .returning();
  if (created) return { status: "created", contact: created };

  // Insert no-op'd (raced on the unique constraint) — re-resolve the row.
  const raced = await findExistingContact(input);
  if (raced) return { status: "exists", contact: raced };
  // Should be unreachable: insert returned no row yet no existing match is
  // findable. Throw rather than fabricate a contact (callers handle the error).
  throw new Error("addProspectContact: insert returned no row and no existing match found");
}
