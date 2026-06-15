/**
 * icp-rescore.ts  (Phase 3 — persisted ICP fit + intent scoring)
 * ───────────────────────────────────────────────────────────────────────────
 * Persists ICP fit + buying-intent scores onto CRM contacts (the icp_* columns)
 * by combining lead-intelligence.scoreProspect with the buying-intent signals
 * gathered in Phase 2. Refreshed nightly so the CRM can rank/segment stored
 * contacts by ideal-customer fit — not just at search time — with a recorded
 * "why this matches" explanation.
 */

import { db } from "./db";
import { contacts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scoreProspect, type ProspectIntel } from "./lead-intelligence";
import { getSignalsForContact, getSignalsForContacts, type StoredSignal } from "./lead-signals";

const TYPE_LABEL: Record<string, string> = {
  relocation: "relocation signal",
  visa_research: "visa-research signal",
  business_for_sale: "business-for-sale signal",
  funding: "funding signal",
  hiring: "hiring signal",
  role_change: "role change",
  news: "recent news mention",
  web_intent: "web-intent signal",
  other: "intent signal",
};

function signalsToIntent(signals: StoredSignal[]): Array<{ label: string; weight: number }> {
  return signals.map((s) => ({ label: TYPE_LABEL[s.signalType] ?? "intent signal", weight: s.weight }));
}

function intelFor(c: typeof contacts.$inferSelect, signals: StoredSignal[]): ProspectIntel {
  return scoreProspect({
    jobTitle: c.jobTitle,
    company: c.firmName,
    country: c.country,
    personaType: c.personaType,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    text: [c.jobTitle, c.firmName, c.notes].filter(Boolean).join(" "),
    signals: signalsToIntent(signals),
  });
}

async function persist(contactId: string, intel: ProspectIntel): Promise<void> {
  await db.update(contacts).set({
    icpScore: intel.composite,
    icpFitScore: intel.fitScore,
    icpIntentScore: intel.intentScore,
    icpTier: intel.tier,
    icpAudience: intel.audience,
    icpReasons: intel.reasons,
    icpExplanation: intel.explanation,
    icpScoredAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(contacts.id, contactId));
}

/** Re-score a single contact (e.g. after a new signal lands). */
export async function rescoreContactIcp(contactId: string): Promise<ProspectIntel | null> {
  const [c] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  if (!c) return null;
  const signals = await getSignalsForContact(contactId);
  const intel = intelFor(c, signals);
  await persist(contactId, intel);
  return intel;
}

/** Nightly batch: re-score all contacts using their latest signals. */
export async function rescoreAllContactsIcp(limit = 5000): Promise<{ scored: number }> {
  let scored = 0;
  try {
    const rows = await db.select().from(contacts).limit(limit);
    const sigMap = await getSignalsForContacts(rows.map((r) => r.id));
    for (const c of rows) {
      const intel = intelFor(c, sigMap.get(c.id) ?? []);
      await persist(c.id, intel);
      scored++;
    }
  } catch (err: any) {
    console.error("[icp-rescore] batch error:", err?.message || err);
  }
  console.log(`[icp-rescore] re-scored ${scored} contacts.`);
  return { scored };
}
