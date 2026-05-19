import { db } from "./db";
import { contacts, contactActivities } from "@shared/schema";
import { eq } from "drizzle-orm";

const HIGH_E2_COUNTRIES = new Set([
  "mexico", "colombia", "brazil", "uae", "united arab emirates",
  "saudi arabia", "south korea", "taiwan", "canada", "israel", "uk",
  "united kingdom", "great britain",
]);

const MEDIUM_E2_COUNTRIES = new Set([
  "china", "india", "germany", "france", "spain", "australia",
]);

export function calculateLeadScore(
  contact: {
    country?: string | null;
    personaType?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    status?: string | null;
  },
  hasEmailOpen: boolean
): number {
  let score = 0;

  const country = (contact.country || "").toLowerCase();
  if (HIGH_E2_COUNTRIES.has(country)) score += 20;
  else if (MEDIUM_E2_COUNTRIES.has(country)) score += 10;

  const persona = contact.personaType || "";
  if (persona === "immigration_attorney") score += 15;
  else if (persona === "immigration_consultant" || persona === "business_migration_agent") score += 10;
  else if (persona === "relocation_consultant" || persona === "international_tax_advisor") score += 5;

  const email = contact.email || "";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (email && emailValid) score += 15;

  if (contact.phone) score += 10;
  if (contact.linkedinUrl) score += 5;

  const status = contact.status || "";
  if (status === "responded" || status === "call_scheduled") score += 10;
  if (status === "bounced" || status === "unsubscribed") score -= 10;

  if (hasEmailOpen) score += 5;

  return Math.max(0, Math.min(100, score));
}

export async function rescoreContact(contactId: string): Promise<number> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  if (!contact) return 0;

  const activities = await db
    .select()
    .from(contactActivities)
    .where(eq(contactActivities.contactId, contactId));

  const hasEmailOpen = activities.some((a) => a.activityType === "email_opened");
  const score = calculateLeadScore(contact, hasEmailOpen);

  await db
    .update(contacts)
    .set({ leadScore: score, updatedAt: new Date() })
    .where(eq(contacts.id, contactId));

  return score;
}
