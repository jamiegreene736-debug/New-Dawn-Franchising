/**
 * contact-upsert.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Shared "add a found prospect into the CRM `contacts` table" logic, used by
 * both the single (`/api/crm/prospects/add-to-contacts`) and bulk
 * (`/api/crm/prospects/add-to-contacts/bulk`) routes so they dedup and score
 * identically.
 *
 * Dedup is by a stable identity — email → LinkedIn URL → name+company — because
 * Lead Research results frequently have NO email (reveal costs credits), so
 * email-only dedup would let the same person be inserted on every click.
 */

import { contacts as contactsTable } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { calculateLeadScore } from "./lead-scoring";

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

/**
 * Insert a prospect into `contacts`, or return the existing match. Never throws
 * on a duplicate — returns { status: "exists" } so callers can report it.
 */
export async function addProspectContact(
  input: ProspectContactInput,
  category?: string,
): Promise<UpsertResult> {
  const firstName = input.firstName || (input.fullName || "").split(" ")[0] || "";
  const lastName =
    input.lastName || (input.fullName || "").split(" ").slice(1).join(" ") || "";
  const email = input.email || null;
  const linkedinUrl = input.linkedinUrl || null;
  const firmName = input.companyName || null;

  // Dedup on a stable identity (email → LinkedIn → name+company).
  let existing: typeof contactsTable.$inferSelect | undefined;
  if (email) {
    [existing] = await db.select().from(contactsTable).where(eq(contactsTable.email, email));
  } else if (linkedinUrl) {
    [existing] = await db.select().from(contactsTable).where(eq(contactsTable.linkedinUrl, linkedinUrl));
  } else {
    [existing] = await db
      .select()
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.firstName, firstName),
          eq(contactsTable.lastName, lastName),
          eq(contactsTable.firmName, firmName ?? ""),
        ),
      );
  }
  if (existing) return { status: "exists", contact: existing };

  const contactData = {
    firstName,
    lastName,
    email,
    phone: input.phone || null,
    firmName,
    jobTitle: input.jobTitle || null,
    personaType: PERSONA_MAP[category || ""] || "immigration_attorney",
    linkedinUrl,
    websiteUrl: null,
    status: "new" as const,
    tags: [] as string[],
    notes: input.bio?.slice(0, 300) || null,
    source: "Prospect Finder",
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

  if (email) {
    const [raced] = await db.select().from(contactsTable).where(eq(contactsTable.email, email));
    if (raced) return { status: "exists", contact: raced };
  }
  // Extremely unlikely: insert no-op without a findable row. Surface as exists.
  return { status: "exists", contact: existing as typeof contactsTable.$inferSelect };
}
