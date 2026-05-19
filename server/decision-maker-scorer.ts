export interface ContactForScoring {
  jobTitle?: string | null;
  seniority?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  emailConfidence?: number;
  phone?: string | null;
  phoneType?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  e2ViaBio?: boolean;
  internationalBio?: boolean;
  ailaNumber?: boolean;
  googleRating?: number | null;
}

export interface ScoreBreakdown {
  titleScore: number;
  reachabilityScore: number;
  relevanceScore: number;
  total: number;
  tier: "hot" | "warm" | "cold" | "unqualified";
  tierLabel: string;
  tierEmoji: string;
}

const TITLE_SCORES: [RegExp, number][] = [
  [/owner|founder|co-?founder|principal/i, 40],
  [/managing partner|managing attorney|managing director/i, 35],
  [/partner|director|vice president|vp|head of/i, 28],
  [/senior attorney|senior consultant|senior advisor|senior partner/i, 22],
  [/attorney|lawyer|consultant|advisor|associate|cpa|broker/i, 12],
  [/paralegal|assistant|coordinator|staff|receptionist|admin/i, 4],
];

export function calculateDecisionMakerScore(contact: ContactForScoring): ScoreBreakdown {
  let titleScore = 0;
  let reachabilityScore = 0;
  let relevanceScore = 0;

  // ── Title / Seniority Score (max 40) ──────────────────────────────────────
  const title = ((contact.jobTitle || "") + " " + (contact.seniority || "")).toLowerCase();
  if (title.trim()) {
    for (const [pattern, points] of TITLE_SCORES) {
      if (pattern.test(title)) {
        titleScore = points;
        break;
      }
    }
    if (titleScore === 0) titleScore = 4; // Found a person, just unknown title
  }

  // ── Reachability Score (max 35) ────────────────────────────────────────────
  if (contact.email) {
    const conf = contact.emailConfidence || 0;
    const verified = contact.emailVerified;
    if (verified || conf >= 85) reachabilityScore += 15;
    else if (conf >= 70) reachabilityScore += 10;
    else reachabilityScore += 5;
  }
  if (contact.phone) {
    if (contact.phoneType === "mobile") reachabilityScore += 12;
    else if (contact.phoneType === "landline" || contact.phoneType === "voip") reachabilityScore += 3;
    else reachabilityScore += 8; // Unknown type — assume mobile
  }
  if (contact.linkedinUrl) reachabilityScore += 5;

  reachabilityScore = Math.min(35, reachabilityScore);

  // ── Relevance Score (max 25) ───────────────────────────────────────────────
  if (contact.e2ViaBio) relevanceScore += 15;
  if (contact.internationalBio) relevanceScore += 8;
  if (contact.googleRating && contact.googleRating >= 4) relevanceScore += 3;
  if (contact.ailaNumber) relevanceScore += 4;

  relevanceScore = Math.min(25, relevanceScore);

  const total = Math.min(100, titleScore + reachabilityScore + relevanceScore);

  let tier: "hot" | "warm" | "cold" | "unqualified";
  let tierLabel: string;
  let tierEmoji: string;

  if (total >= 55) { tier = "hot"; tierLabel = "Hot Lead"; tierEmoji = "🟢"; }
  else if (total >= 28) { tier = "warm"; tierLabel = "Warm Lead"; tierEmoji = "🟡"; }
  else if (total >= 12) { tier = "cold"; tierLabel = "Cold Lead"; tierEmoji = "🟠"; }
  else { tier = "unqualified"; tierLabel = "Unqualified"; tierEmoji = "⚪"; }

  return { titleScore, reachabilityScore, relevanceScore, total, tier, tierLabel, tierEmoji };
}
