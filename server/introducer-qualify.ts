/**
 * Introducer (referral-partner) qualification.
 *
 * Daily discovery used to score every lead 60 and enroll on "has an email."
 * This gate keeps people who can actually introduce E-2 clients:
 *   • partner persona (attorney / broker / wealth / relocation / chamber)
 *   • E-2 / investor-visa practice signal, OR a category that is the practice
 *   • seniority (partner / principal / owner) or a firm-level contact
 *   • reachable (email or firm website)
 */

import { scoreProspect } from "./lead-intelligence";

export const PRACTICE_CATEGORIES = new Set([
  "immigration_attorney",
  "business_broker",
  "franchise_broker",
  "wealth_manager",
  "relocation",
  "relocation_consultant",
  "visa_consultant",
  "immigration_consultant",
  "chamber",
  "trade_association",
  "e2_visa_firm",
]);

const E2_PRACTICE_RE =
  /\be-?2\b|treaty investor|investor visa|eb-?5|visa inversionista|투자이민|franchise consultant|business broker|wealth manag|family office|relocation|global mobility/i;

const SENIORITY_RE =
  /\b(managing partner|equity partner|name partner|of counsel|shareholder|principal|founder|co-founder|owner|managing director|managing attorney|practice (group )?chair|practice leader|director|partner)\b/i;

const JUNIOR_RE = /\b(associate|paralegal|assistant|coordinator|intern|student|receptionist|clerk)\b/i;

export interface IntroducerInput {
  fullName?: string | null;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  category?: string | null;
  country?: string | null;
  notes?: string | null;
  namedAccount?: boolean;
}

export interface IntroducerVerdict {
  pass: boolean;
  score: number;
  reasons: string[];
}

export function blobOf(lead: IntroducerInput): string {
  return [lead.fullName, lead.title, lead.company, lead.category, lead.notes, lead.website]
    .filter(Boolean)
    .join(" ");
}

export function hasE2PracticeSignal(lead: IntroducerInput): boolean {
  if (lead.namedAccount) return true;
  const cat = (lead.category || "").toLowerCase();
  if (PRACTICE_CATEGORIES.has(cat)) return true;
  return E2_PRACTICE_RE.test(blobOf(lead));
}

export function looksLikePersonName(name: string | null | undefined): boolean {
  const n = (name || "").trim();
  if (!n || n.length < 3) return false;
  const words = n.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (/\b(llp|llc|inc|law|group|firm|associates|partners|pc|pa)\b/i.test(n)) return false;
  return words.every((w) => /^[\p{L}.'’-]+$/u.test(w));
}

export function hasSeniority(lead: IntroducerInput): boolean {
  if (lead.namedAccount) return true;
  if (!looksLikePersonName(lead.fullName)) return true; // firm-level → expand later
  const title = lead.title || "";
  if (JUNIOR_RE.test(title) && !SENIORITY_RE.test(title)) return false;
  if (SENIORITY_RE.test(title)) return true;
  // Attorneys often omit "Partner" on directory pages; category + practice is enough.
  const cat = (lead.category || "").toLowerCase();
  if (cat.includes("attorney") || cat.includes("consultant") || cat.includes("broker")) {
    return !JUNIOR_RE.test(title);
  }
  return false;
}

export function isReachable(lead: IntroducerInput): boolean {
  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return true;
  if (lead.website && /[a-z0-9-]+\.[a-z]{2,}/i.test(lead.website)) return true;
  return false;
}

export function qualifyIntroducer(lead: IntroducerInput): IntroducerVerdict {
  const reasons: string[] = [];
  const intel = scoreProspect({
    jobTitle: lead.title,
    company: lead.company,
    country: lead.country,
    personaType: lead.category,
    email: lead.email,
    linkedinUrl: lead.linkedinUrl,
    text: blobOf(lead),
  });

  const cat = (lead.category || "").toLowerCase();
  const categoryPartner =
    PRACTICE_CATEGORIES.has(cat) || /attorney|broker|consultant|chamber|wealth/.test(cat);
  const audienceOk = intel.audience === "partner" || categoryPartner;
  if (audienceOk) reasons.push("referral-partner persona");
  else reasons.push(`audience=${intel.audience}`);

  const practice = hasE2PracticeSignal(lead);
  if (practice) reasons.push("E-2 / investor-visa practice signal");
  const senior = hasSeniority(lead);
  if (senior) reasons.push("seniority or firm-level contact");
  const reachable = isReachable(lead);
  if (reachable) reasons.push("email or firm website");
  if (lead.namedAccount) reasons.push("named-account firm");

  const pass =
    audienceOk &&
    practice &&
    senior &&
    reachable &&
    intel.composite >= 25;

  if (!pass) {
    if (!audienceOk) reasons.push("rejected: looks like an end-investor");
    if (!practice) reasons.push("rejected: no E-2 practice signal");
    if (!senior) reasons.push("rejected: junior title");
    if (!reachable) reasons.push("rejected: no email or website");
    if (intel.composite < 25) reasons.push(`rejected: score ${intel.composite} < 25`);
  }

  return { pass, score: intel.composite, reasons };
}

/** First-touch language for a location/country string. */
export function firstTouchLang(location?: string | null, country?: string | null): "en" | "es" | "ko" {
  const blob = `${location ?? ""} ${country ?? ""}`.toLowerCase();
  if (/korea|seoul|부산|서울|busan/.test(blob)) return "ko";
  if (
    /mexico|méxico|colombia|argentina|chile|peru|perú|ecuador|guatemala|spain|españa|venezuela|uruguay|bolivia|panama|panamá|honduras|nicaragua|costa rica|dominican|cdmx|bogot|buenos aires|santiago|madrid|barcelona/.test(
      blob,
    )
  ) {
    return "es";
  }
  return "en";
}
