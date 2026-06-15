/**
 * lead-intelligence.ts
 * ───────────────────────────────────────────────────────────────────────────
 * ICP fit + buying-intent scoring with a human-readable explanation, tuned to
 * New Dawn Franchising's E-2 visa franchise business.
 *
 * This is the "why this matches" layer that turns a flat list of search results
 * into ranked, explained recommendations — the most visible quality jump over a
 * plain keyword search. It is deterministic (no LLM call), so it is fast, free,
 * and explainable, and it runs over results from ANY provider (Seamless /
 * Apollo / Origami) as well as our own CRM rows.
 *
 * Two audiences, per New Dawn's ICP:
 *   • Investors    — HNW individuals from E-2 treaty countries exploring US
 *                    business ownership (Owner/Founder/CEO/Investor titles).
 *   • Partners     — immigration attorneys, visa/relocation consultants, wealth
 *                    managers, business brokers who work with international
 *                    clients (they refer investors for a fee).
 */

// ─── E-2 treaty-country eligibility (drives investor FIT) ────────────────────
// Maintained as lowercase match keys. Mirrors lead-scoring.ts but is broader so
// the search layer recognises the full treaty list, not just the hottest few.
const HIGH_E2_COUNTRIES = new Set([
  "mexico", "colombia", "brazil", "uae", "united arab emirates", "saudi arabia",
  "south korea", "korea", "taiwan", "canada", "israel", "uk", "united kingdom",
  "great britain", "england", "scotland", "wales",
]);

const MEDIUM_E2_COUNTRIES = new Set([
  "japan", "germany", "france", "spain", "italy", "australia", "turkey",
  "philippines", "pakistan", "argentina", "chile", "egypt", "jordan",
  "thailand", "singapore", "ireland", "netherlands", "switzerland", "austria",
  "norway", "sweden", "poland", "czech republic", "ukraine",
]);

// India & China are NOT E-2 treaty countries, but are common secondary targets
// (they explore alternatives / referral partners serve them), so they get a
// small fit nudge rather than zero.
const SECONDARY_COUNTRIES = new Set(["india", "china"]);

// US-based individuals don't need an E-2 — they are NOT investor prospects.
const US_COUNTRY = new Set(["united states", "usa", "us", "u.s.", "u.s.a.", "america"]);

// ─── Title / persona signals ─────────────────────────────────────────────────
const INVESTOR_TITLE_WORDS = [
  "owner", "founder", "co-founder", "cofounder", "ceo", "chief executive",
  "president", "investor", "managing director", "entrepreneur", "proprietor",
  "chairman", "principal", "partner", "director",
];

const PARTNER_TITLE_WORDS = [
  "immigration attorney", "immigration lawyer", "attorney", "lawyer", "esq",
  "solicitor", "barrister", "visa consultant", "immigration consultant",
  "relocation", "migration", "wealth manager", "wealth advisor", "family office",
  "business broker", "financial advisor", "private banker",
];

// ─── Buying-intent keywords (drive INTENT) ───────────────────────────────────
// Weighted: stronger phrases score higher. Matched against title + company +
// keywords + bio/notes text.
const INTENT_SIGNALS: Array<{ re: RegExp; weight: number; label: string }> = [
  { re: /\be-?2\b|treaty investor/i, weight: 35, label: "mentions E-2 / treaty investor visa" },
  { re: /eb-?5/i, weight: 25, label: "mentions EB-5 investor visa" },
  { re: /investor visa|visa candidate|visa applicant/i, weight: 30, label: "investor-visa intent" },
  { re: /relocat|moving to (the )?us|move to america|emigrat/i, weight: 25, label: "relocation intent" },
  { re: /buy (a )?(us )?business|business for sale|acquire a business|turnkey business/i, weight: 25, label: "looking to buy a US business" },
  { re: /expand(ing)? to (the )?us|us expansion|enter(ing)? the us market/i, weight: 20, label: "US market expansion" },
  { re: /exit(ing)?|selling (my|the) business|business sale/i, weight: 15, label: "business exit / liquidity event" },
  { re: /immigration|visa|green card/i, weight: 12, label: "immigration-related" },
  { re: /high[- ]net[- ]worth|hnwi?|family office|investable assets/i, weight: 12, label: "high-net-worth signal" },
  { re: /franchis/i, weight: 10, label: "franchising interest" },
];

export interface ProspectSignals {
  jobTitle?: string | null;
  seniority?: string | null;
  company?: string | null;
  country?: string | null;
  personaType?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  // Free text we can scan for intent: keywords, bio, notes, headline, etc.
  text?: string | null;
}

export type IcpAudience = "investor" | "partner" | "unknown";
export type IcpTier = "hot" | "warm" | "cool" | "low";

export interface ProspectIntel {
  fitScore: number;        // 0-100: how well they match the ICP
  intentScore: number;     // 0-100: strength of buying-intent signals
  composite: number;       // 0-100: blended ranking score
  tier: IcpTier;
  audience: IcpAudience;
  reasons: string[];       // human-readable bullets ("UK-based founder", …)
  explanation: string;     // one-line summary for the UI / the agent
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function hay(s: ProspectSignals): string {
  return [s.jobTitle, s.company, s.text, s.seniority, s.personaType]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

function detectAudience(s: ProspectSignals, blob: string): IcpAudience {
  const persona = (s.personaType || "").toLowerCase();
  if (persona.includes("attorney") || persona.includes("consultant") || persona.includes("advisor") || persona.includes("agent")) {
    return "partner";
  }
  if (PARTNER_TITLE_WORDS.some((w) => blob.includes(w))) return "partner";
  if (INVESTOR_TITLE_WORDS.some((w) => blob.includes(w))) return "investor";
  return "unknown";
}

function countryFit(country: string | null | undefined, audience: IcpAudience, reasons: string[]): number {
  const c = (country || "").trim().toLowerCase();
  if (!c) return 0;
  // For partners, location matters far less (their *clients* are international).
  if (audience === "partner") {
    if (US_COUNTRY.has(c)) { reasons.push("US-based referral partner"); return 8; }
    reasons.push(`based in ${country}`);
    return 6;
  }
  // Investors: treaty-country eligibility is the single biggest fit driver.
  if (US_COUNTRY.has(c)) {
    reasons.push("US-based — not E-2 eligible");
    return -25; // strong negative: US individuals don't need an E-2
  }
  if (HIGH_E2_COUNTRIES.has(c)) { reasons.push(`${country} — strong E-2 treaty country`); return 30; }
  if (MEDIUM_E2_COUNTRIES.has(c)) { reasons.push(`${country} — E-2 treaty country`); return 22; }
  if (SECONDARY_COUNTRIES.has(c)) { reasons.push(`${country} — secondary market`); return 8; }
  reasons.push(`based in ${country}`);
  return 4;
}

/**
 * Score a single prospect against New Dawn's ICP and explain why.
 */
export function scoreProspect(s: ProspectSignals): ProspectIntel {
  const blob = hay(s);
  const reasons: string[] = [];
  const audience = detectAudience(s, blob);

  // ── FIT ──────────────────────────────────────────────────────────────────
  let fit = 0;

  // Title / role match.
  const title = (s.jobTitle || "").toLowerCase();
  if (audience === "partner") {
    const matched = PARTNER_TITLE_WORDS.find((w) => blob.includes(w));
    if (matched) { fit += 28; reasons.push(`referral-partner role (${s.jobTitle || matched})`); }
  } else {
    const matched = INVESTOR_TITLE_WORDS.find((w) => title.includes(w));
    if (matched) {
      const senior = /owner|founder|ceo|chief executive|president|investor|managing director|chairman|principal/.test(title);
      fit += senior ? 30 : 18;
      reasons.push(`decision-maker title (${s.jobTitle})`);
    }
  }

  // Country / treaty eligibility.
  fit += countryFit(s.country, audience, reasons);

  // Reachability (a contactable lead is a better lead).
  if (s.email) { fit += 6; }
  if (s.linkedinUrl) { fit += 3; }
  if (s.phone) { fit += 3; }

  // ── INTENT ─────────────────────────────────────────────────────────────────
  let intent = 0;
  const intentHits: string[] = [];
  for (const sig of INTENT_SIGNALS) {
    if (sig.re.test(blob)) {
      intent += sig.weight;
      intentHits.push(sig.label);
    }
  }
  if (intentHits.length) {
    // Surface the two strongest intent reasons.
    reasons.push(...intentHits.slice(0, 2));
  }

  fit = clamp(fit);
  intent = clamp(intent);

  // Composite favours fit, with intent as a strong multiplier of urgency.
  const composite = clamp(fit * 0.6 + intent * 0.4);

  let tier: IcpTier = "low";
  if (composite >= 70) tier = "hot";
  else if (composite >= 50) tier = "warm";
  else if (composite >= 30) tier = "cool";

  const explanation = buildExplanation(audience, tier, reasons);

  return { fitScore: fit, intentScore: intent, composite, tier, audience, reasons, explanation };
}

function buildExplanation(audience: IcpAudience, tier: IcpTier, reasons: string[]): string {
  const who = audience === "investor" ? "Investor prospect" : audience === "partner" ? "Referral-partner prospect" : "Prospect";
  const top = reasons.slice(0, 3).join("; ");
  const tierLabel = { hot: "🔥 Hot", warm: "Warm", cool: "Cool", low: "Low fit" }[tier];
  return top ? `${tierLabel} ${who.toLowerCase()} — ${top}.` : `${tierLabel} ${who.toLowerCase()}.`;
}

/**
 * Score and rank a list of prospects by composite score (desc). Returns each
 * item paired with its intel; stable for equal scores.
 */
export function rankProspects<T extends ProspectSignals>(items: T[]): Array<{ item: T; intel: ProspectIntel }> {
  return items
    .map((item) => ({ item, intel: scoreProspect(item) }))
    .sort((a, b) => b.intel.composite - a.intel.composite);
}
