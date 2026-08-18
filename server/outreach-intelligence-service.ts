/**
 * Outreach Intelligence Service
 * Daily autonomous lead intelligence for E-2 visa franchise outreach.
 *
 * Daily schedule (via cron in routes.ts):
 *   6:00 AM ET — planDailyIntelligence() → Claude plans the day, saves to DB.
 *     • Autopilot ON (OUTREACH_AUTOPILOT=true, not paused, breaker clear):
 *       auto-approves and executes immediately — no human tap needed; the SMS
 *       becomes an end-of-run report with a pause link.
 *     • Autopilot OFF (or breaker tripped / plan anomalous): sends the SMS
 *       approval link and waits, exactly as before.
 *   On approval  — executeApprovedPlan(planId) → SerpAPI + Seamless + Apollo
 *                  (+ Hunter domain) searches → populates outreach_leads →
 *                  builds + enrolls the day's campaign.
 */

import { db, pool } from "./db";
import { outreachDailyPlans, outreachLeads } from "@shared/schema";
import { eq, and, or, desc, gte, lt, isNull, isNotNull, inArray } from "drizzle-orm";
import { notifyBlocker, sendAgentSms, isRedundantDataVendorBlocker } from "./agent-sms-service";
import { buildDailyCampaignFromLeads, type DiscoveredLeadInput } from "./daily-campaign-service";
import { seamlessFindPeople, type SeamlessPerson } from "./seamless-service";
import { apolloSearchContacts, apolloRevealById } from "./apollo-service";
import { findPeopleAtFirm } from "./lead-email-enrichment";
import { getDeliverabilitySettings } from "./deliverability-settings-service";
import {
  isAutopilotEnabled,
  shouldAutoResume,
  planLooksAnomalous,
  buildPlanExecutedSms,
  MAX_EXECUTION_ATTEMPTS,
} from "./outreach-autopilot-helpers";
import { randomUUID } from "crypto";

// Re-exported for existing importers/tests of the SMS builder.
export { buildPlanExecutedSms, isAutopilotEnabled } from "./outreach-autopilot-helpers";

const APP_BASE = () => process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
const SERPAPI_KEY = process.env.SERPAPI_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

/** Today's date (YYYY-MM-DD) in ET — the outreach system's day boundary.
 *  Plans used to key on the UTC date while campaign names used ET, so an
 *  evening run keyed to "tomorrow"; everything is ET now. */
function etToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Autopilot circuit breaker: pause hands-free enrollment when the trailing
// bounce rate says the domain is in trouble. Overridable via env.
const BREAKER_BOUNCE_PCT = (() => {
  const n = parseFloat(process.env.OUTREACH_BREAKER_BOUNCE_PCT ?? "");
  return Number.isFinite(n) && n > 0 ? n : 4;
})();
const BREAKER_MIN_SAMPLE = (() => {
  const n = parseInt(process.env.OUTREACH_BREAKER_MIN_SAMPLE ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();
const BREAKER_WINDOW = 200; // trailing attempted email sends examined

// Apollo people-search results arrive with emails masked; revealing costs ~1
// credit each. Cap the hands-free daily spend (0 disables reveals entirely).
const APOLLO_REVEAL_BUDGET = (() => {
  const n = parseInt(process.env.APOLLO_DAILY_REVEAL_CREDITS ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 25;
})();

// Delay before a failed execution is retried in-process (restart-safe too: the
// startup catch-up re-enters planDailyIntelligence, which resumes failed plans).
const RETRY_DELAY_MS = 30 * 60 * 1000;

// How many contacts each daily campaign build aims to start with. At the
// observed ~25-35% email-find rate this lands 40-50+ enrollable contacts per
// day (200-250+/week); shortfalls vs today's discoveries are topped up from
// never-campaigned pipeline leads (see the backfill in executeApprovedPlan).
// Override with DAILY_CAMPAIGN_TARGET_CONTACTS.
const DAILY_CAMPAIGN_TARGET = (() => {
  const n = parseInt(process.env.DAILY_CAMPAIGN_TARGET_CONTACTS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 150;
})();

// ─── Claude helper ────────────────────────────────────────────────────────────

async function callClaude(system: string, userMessage: string, maxTokens = 3000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
}

// ─── Planning System Prompt ───────────────────────────────────────────────────

const INTELLIGENCE_SYSTEM_PROMPT = `You are the autonomous outreach intelligence agent for New Dawn Franchising LLC, an E-2 visa property management franchise company based in El Paso, Texas.

CRITICAL CONTEXT — READ THIS FIRST:
New Dawn Franchising sells property management franchises (~$225K investment) that qualify as E-2 Treaty Investor Visa-qualifying investments. The E-2 visa allows treaty-country nationals to invest in a US business and live/work in the US.

YOUR MISSION: Find REFERRAL PARTNERS — professionals who regularly work with wealthy foreign nationals who may be interested in US residency through investment. We are NOT looking for investors directly. We want the attorneys, brokers, advisors, and consultants who INTRODUCE us to those wealthy investors.

Think of it like a real estate agent who gets referrals from mortgage brokers — we need the professional middlemen who can refer their wealthy international clients to us.

IDEAL REFERRAL PARTNER CATEGORIES (these are who we reach out to):
1. Immigration attorneys and law firms — especially those handling E-2, EB-5, or investor visas in E-2 treaty countries or US expat cities
2. Business brokers and M&A advisors — those who facilitate business purchases for international buyers
3. Franchise brokers and franchise consultants — they're already matching investors with franchise opportunities
4. Wealth managers, private bankers, family offices — serving high-net-worth foreign nationals
5. International relocation and global mobility consultants — they help executives/entrepreneurs move countries
6. Chambers of commerce and business associations — Korean, Chinese, Mexican, Indian, Brazilian, etc. expat business communities
7. International real estate agents — those specializing in investment or commercial property for foreign buyers
8. Certified immigration consultants and notaries (in Latin America, these handle visa facilitation)

DO NOT TARGET: Generic CEOs, startup founders, business owners in unrelated industries. These people are potential end-investors, not referral partners — and that's a different outreach strategy entirely.

Key E-2 treaty countries with the strongest referral partner networks:
- Mexico (massive Mexican-American attorney/broker market in Texas, California, Florida)
- South Korea (largest E-2 community; many specialized immigration attorneys)
- Colombia, Brazil, Argentina (growing Latin American investor demand)
- India (strong demand; many immigration attorneys serve Indian HNW clients)
- UAE, Saudi Arabia (Gulf wealth; international relocation consultants)
- UK, Germany, France, Italy (European investor mobility consultants)
- Israel (strong outbound investor community)

TWO SEARCH ANGLES — use both every day:

ANGLE 1 — In-country professionals (most valuable): Find referral partners INSIDE the E-2 treaty country whose clients are wealthy locals wanting a US visa.
  Examples:
  - Mexican immigration attorney in Mexico City who files US E-2 visas for Mexican entrepreneurs → they know exactly who needs this
  - Korean business broker in Seoul who helps clients buy US businesses → natural referral fit
  - Colombian wealth manager in Bogotá serving HNW families who want US options
  - Israeli relocation consultant in Tel Aviv helping tech founders emigrate

ANGLE 2 — US-based firms serving expat communities: US professionals who serve that country's diaspora community already living in or moving to the US.
  Examples:
  - Immigration attorney in Houston/Dallas specializing in E-2 visas for Mexican/Latin American clients
  - Korean-American business association in Los Angeles or New York
  - Indian-American CPA or financial advisor in Dallas serving NRI clients
  - International business broker in Miami serving Latin American buyers

For search queries, make them country and city specific. Good examples:
- "immigration attorney E-2 visa Mexico City" (Angle 1)
- "abogado de inmigracion visa inversionista Ciudad de Mexico" (Angle 1 in Spanish)
- "Korean immigration attorney E-2 visa Seoul" (Angle 1)
- "Korean business broker Houston E-2 visa" (Angle 2)
- "franchise consultant international buyers Dallas" (Angle 2)

IMPORTANT: The system will automatically detect the lead's country and send all outreach in their native language (Spanish, Korean, Portuguese, French, German, Hebrew, Arabic, etc.). So finding a Spanish-speaking attorney in Mexico City is just as easy to handle as finding one in the US — the language is auto-handled.

Think about timing and strategy: What country or category has the most active deal flow right now? Which professional category is most likely to have a wealthy international client looking for US residency today?

AVAILABLE TOOLS (you already have full B2B contact-data coverage — do NOT request more):
- SerpAPI ("serpapi"): Google Search (use for finding specific people, firms, associations, contact info)
- Seamless ("seamless"): B2B lead database with email enrichment (use for finding specific job titles at companies)
- Apollo ("apollo"): structured B2B people search by job title + country — strong coverage of attorneys, brokers, and advisors; the system reveals verified emails for the best matches automatically
- Hunter.io ("hunter"): people-at-a-firm lookup for a KNOWN firm website domain. Only emit a hunter query when you know a specific target firm's real domain; the query MUST be just the bare domain (e.g. "smithimmigrationlaw.com"). If you don't know a real domain, don't emit hunter queries.
- People Data Labs, Proxycurl, Origami: additional email/phone enrichment, applied automatically
- Note: LinkedIn scraping NOT available.

DO NOT emit blockerRequests for B2B contact databases (e.g. ZoomInfo, Apollo, Lusha, Cognism, RocketReach, Sales Navigator, "verified contact data", "B2B database"). The platform already aggregates the equivalent capability via the tools above, so requesting them only creates noise. Only flag a blocker for a genuinely missing, non-overlapping capability (e.g. an approved WhatsApp template, a new-geo compliance clearance, or exhausted Seamless credits that need a top-up). When in doubt, leave blockerRequests empty.

You MUST respond with valid JSON only (no markdown, no explanation outside the JSON):
{
  "planSummary": "2-3 sentence plain-English summary of today's strategy that Dylan will see in an SMS",
  "strategicReasoning": "Detailed explanation of why these categories were chosen today — market timing, recent events, seasonal patterns, gaps in the current pipeline",
  "leadCategories": [
    {
      "category": "immigration_attorney|business_broker|chamber|relocation|wealth_manager|real_estate|franchise_broker|trade_association|other",
      "country": "South Korea",
      "geoFocus": "Seoul — in-country immigration attorneys who file US E-2 visas for Korean clients (Angle 1)",
      "reasoning": "Why this specific segment today",
      "estimatedLeads": 15,
      "priority": "high|medium|low"
    },
    {
      "category": "immigration_attorney",
      "country": "United States",
      "geoFocus": "Houston, TX and Los Angeles, CA — US-based immigration attorneys specializing in E-2 visas for Mexican and Korean clients (Angle 2)",
      "reasoning": "US attorneys who already have the exact client base we need",
      "estimatedLeads": 10,
      "priority": "high"
    }
  ],
  "searchQueries": [
    {
      "query": "immigration attorney E-2 visa Korea Seoul site:linkedin.com OR site:lawfirm.com",
      "source": "serpapi",
      "purpose": "Find Korean immigration attorneys who file E-2 visas for Korean clients (Angle 1)"
    },
    {
      "query": "Korean immigration attorney E-2 visa Houston Texas",
      "source": "serpapi",
      "purpose": "Find US-based attorneys serving Korean expat community in Texas (Angle 2)"
    },
    {
      "query": "abogado inmigracion visa E-2 inversionista Ciudad de Mexico",
      "source": "serpapi",
      "purpose": "Find Mexican immigration attorneys in Spanish — E-2 investor visa specialists (Angle 1)"
    },
    {
      "query": "immigration attorney — South Korea",
      "source": "apollo",
      "purpose": "Structured Apollo search: immigration attorneys in South Korea (Angle 1)"
    }
  ],
  "blockerRequests": [
    {
      "tool": "LinkedIn Sales Navigator",
      "reason": "Would allow precise targeting of immigration attorneys by country and specialty",
      "priority": "high|medium|low",
      "url": "https://business.linkedin.com/sales-solutions"
    }
  ],
  "estimatedLeads": 45
}

VOLUME TARGET — this matters: the pipeline needs 120–180 NEW leads discovered per day. Only ~25-35% of discovered leads yield a deliverable work email after enrichment, and the goal is 100+ emailable contacts entering a campaign every day (500+ per week). Plan wide enough to hit that.

Include 6-10 lead categories, 16-24 search queries, and 0-3 blocker requests. At least 4 of the queries MUST use source "seamless" and at least 3 MUST use source "apollo" (both return real contact records — Seamless with verified emails, Apollo with reveal-able verified emails — so they convert to campaign enrollments at a far higher rate than SerpAPI finds). Spreading queries across independent providers also keeps the day productive when any one provider has an outage or runs out of credits. Be specific and actionable. Vary the queries within a category (different cities, English + local-language phrasings, "firm directory" vs "attorney name" angles) so they don't all return the same results.`;

// ─── Search providers ─────────────────────────────────────────────────────────
// Every provider wrapper returns an `error` string alongside its results so an
// unattended run can distinguish "searched, found nothing" from "provider is
// down / out of credits" — and say so in the report SMS instead of silently
// shipping an empty day.

type PlanPerson = {
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  website?: string;
  location?: string;
  city?: string;
};

async function serpSearch(query: string): Promise<{
  results: { title: string; link: string; snippet: string }[];
  error?: string;
}> {
  if (!SERPAPI_KEY) return { results: [], error: "SERPAPI_KEY not configured" };
  try {
    // Pull a deep 40-result page — one SerpAPI request costs the same credit
    // regardless of num, and only ~25% of extracted leads end up emailable, so
    // every extra organic result widens the funnel for free.
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=40&api_key=${SERPAPI_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return { results: [], error: `SerpAPI HTTP ${res.status}` };
    const data = await res.json() as { organic_results?: { title?: string; link?: string; snippet?: string }[]; error?: string };
    if (data.error) return { results: [], error: `SerpAPI: ${String(data.error).slice(0, 120)}` };
    return {
      results: (data.organic_results ?? []).slice(0, 40).map(r => ({
        title: r.title ?? "",
        link: r.link ?? "",
        snippet: r.snippet ?? "",
      })),
    };
  } catch (e) {
    return { results: [], error: `SerpAPI: ${(e as Error).message.slice(0, 120)}` };
  }
}

/** Map a provider person (Seamless/Apollo shape) to the plan's lead shape. */
function toPlanPerson(p: SeamlessPerson): PlanPerson {
  return {
    name: p.fullName || `${p.firstName} ${p.lastName}`.trim(),
    title: p.jobTitle ?? "",
    company: p.company ?? "",
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    linkedinUrl: p.linkedinUrl ?? undefined,
    website: p.domain ? `https://${p.domain}` : undefined,
    location: [p.city, p.country].filter(Boolean).join(" "),
    city: p.city ?? undefined,
  };
}

async function seamlessSearch(opts: {
  titles?: string[];
  locations?: string[];
  keywords?: string;
  limit?: number;
}): Promise<{ people: PlanPerson[]; error?: string }> {
  if (!process.env.SEAMLESS_API_KEY) return { people: [], error: "SEAMLESS_API_KEY not configured" };
  try {
    // enrich=true runs the research+poll step so emails come back.
    const people = await seamlessFindPeople(
      {
        titles: opts.titles ?? [],
        countries: opts.locations ?? [],
        keywords: opts.keywords,
        limit: Math.min(opts.limit ?? 40, 50),
      },
      { enrich: true },
    );
    return { people: people.map(toPlanPerson).filter((p) => p.name) };
  } catch (e) {
    return { people: [], error: `Seamless: ${(e as Error).message.slice(0, 120)}` };
  }
}

/**
 * Apollo structured people search (free api_search endpoint) + a credit-capped
 * email reveal for the best matches. Search results arrive with emails masked;
 * revealing the top matches turns them into immediately-enrollable contacts,
 * and anyone left unrevealed still flows through the enrichment waterfall via
 * their firm domain.
 */
async function apolloPlanSearch(
  opts: { titles: string[]; countries: string[]; keywords?: string; limit?: number },
  revealBudget: { left: number },
): Promise<{ people: PlanPerson[]; error?: string }> {
  if (!process.env.APOLLO_API_KEY) return { people: [], error: "APOLLO_API_KEY not configured" };
  try {
    const { people, error } = await apolloSearchContacts({
      titles: opts.titles,
      countries: opts.countries,
      keywords: opts.keywords,
      maxResults: Math.min(opts.limit ?? 50, 100),
    });
    if (error) return { people: [], error: `Apollo: ${error.message.slice(0, 120)}` };

    // Reveal emails for masked matches while the daily credit budget lasts.
    const out: SeamlessPerson[] = [];
    for (const p of people) {
      if (!p.email && revealBudget.left > 0 && p.searchResultId?.startsWith("apollo:")) {
        revealBudget.left--;
        const revealed = await apolloRevealById(p.searchResultId.slice("apollo:".length));
        out.push(revealed?.email ? { ...p, ...revealed } : p);
      } else {
        out.push(p);
      }
    }
    return { people: out.map(toPlanPerson).filter((p) => p.name) };
  } catch (e) {
    return { people: [], error: `Apollo: ${(e as Error).message.slice(0, 120)}` };
  }
}

/** Pull a bare firm domain out of a hunter-source query ("smithlaw.com", a URL, …). */
export function domainFromHunterQuery(query: string): string | null {
  const m = (query ?? "").toLowerCase().match(/([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/);
  if (!m) return null;
  return m[0].replace(/^www\./, "");
}

// ─── Extract leads from SerpAPI results ──────────────────────────────────────

async function extractLeadsFromSerp(
  results: { title: string; link: string; snippet: string }[],
  category: string,
  country: string,
): Promise<{ fullName: string; company: string; website?: string; category: string; notes: string }[]> {
  if (!results.length) return [];
  try {
    const prompt = `Extract REFERRAL PARTNER leads from these search results for New Dawn Franchising.

New Dawn sells US property management franchises (~$225K) as an E-2 Treaty Investor Visa pathway. We are looking for REFERRAL PARTNERS — professionals who work with wealthy foreign nationals seeking US residency through investment — NOT investors themselves.

Category we're targeting: ${category} in ${country}

INCLUDE only: immigration attorneys, business brokers, franchise brokers, wealth managers, private bankers, relocation consultants, chamber of commerce executives, international financial advisors. These are professionals who can REFER their wealthy international clients to us.

EXCLUDE: Generic business owners, CEOs of product/tech companies, startup founders, retailers, manufacturers, anyone who isn't in professional services touching immigration, finance, or international mobility.

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.link}`).join("\n\n")}

Return JSON array of leads found (referral partners only):
[{"fullName": "Name or Org Name", "company": "Firm/Company", "website": "URL if found", "notes": "Why they are a strong referral partner for E-2 franchise clients"}]

IMPORTANT — website field: ALWAYS include a website when the search result links to the person's or firm's OWN site (use that result's URL). The website is how we find their work email, so a lead without one usually can't be contacted. Only leave it out when the result is a directory/social page (LinkedIn, Avvo, Yelp, news article) and no firm site is evident.

Return empty array [] if no clear referral partners found. Only return verified names/orgs from the results, do NOT invent.`;

    const raw = await callClaude("", prompt, 2500);
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.map(l => ({ ...l, category })) : [];
  } catch {
    return [];
  }
}

// ─── Autopilot state + safety rails ───────────────────────────────────────────

/** Env master switch + DB pause switch, resolved together. */
export async function getAutopilotState(): Promise<{ enabled: boolean; paused: boolean }> {
  const enabled = isAutopilotEnabled();
  if (!enabled) return { enabled, paused: false };
  try {
    const s = await getDeliverabilitySettings();
    return { enabled, paused: s.outreachAutopilotPaused };
  } catch {
    return { enabled, paused: false };
  }
}

/**
 * Deliverability circuit breaker: trailing bounce rate over the last
 * BREAKER_WINDOW attempted email sends. When tripped, autopilot stops
 * auto-approving plans and falls back to the manual approval link — blind
 * daily sending is the one thing that can genuinely burn the domain.
 * Fails open on a query error (a stats hiccup shouldn't halt lead-gen; the
 * drip processor's own caps/guards still protect the send path).
 */
export async function checkDeliverabilityBreaker(): Promise<{ tripped: boolean; detail: string }> {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS attempted,
              (count(*) FILTER (WHERE status = 'bounced'))::int AS bounced
         FROM (SELECT status FROM drip_sends
                WHERE channel = 'email'
                  AND status IN ('sent','delivered','opened','clicked','replied','bounced','failed')
                ORDER BY created_at DESC
                LIMIT $1) t`,
      [BREAKER_WINDOW],
    );
    const attempted = Number(rows[0]?.attempted ?? 0);
    const bounced = Number(rows[0]?.bounced ?? 0);
    if (attempted < BREAKER_MIN_SAMPLE) {
      return { tripped: false, detail: `only ${attempted} recent sends (min sample ${BREAKER_MIN_SAMPLE})` };
    }
    const pct = (bounced / attempted) * 100;
    if (pct >= BREAKER_BOUNCE_PCT) {
      return {
        tripped: true,
        detail: `bounce rate ${pct.toFixed(1)}% over the last ${attempted} sends (breaker limit ${BREAKER_BOUNCE_PCT}%)`,
      };
    }
    return { tripped: false, detail: `bounce rate ${pct.toFixed(1)}% over ${attempted} sends` };
  } catch (e) {
    console.warn("[OutreachIntel] Breaker check failed (failing open):", (e as Error).message);
    return { tripped: false, detail: "breaker check unavailable" };
  }
}

// ─── Plan Daily Intelligence ──────────────────────────────────────────────────

export async function planDailyIntelligence(): Promise<{ planId: string; approvalUrl: string }> {
  const today = etToday();
  const autopilot = await getAutopilotState();
  const autopilotActive = autopilot.enabled && !autopilot.paused;

  // Autopilot keeps its own queue clean: pending plans from previous days can
  // never be actioned anymore (each day builds fresh), so expire them instead
  // of letting them nag the morning digest forever.
  if (autopilot.enabled) {
    try {
      await db.update(outreachDailyPlans)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(
          eq(outreachDailyPlans.status, "awaiting_approval"),
          lt(outreachDailyPlans.planDate, today),
        ));
    } catch (e) {
      console.warn("[OutreachIntel] Stale-plan expiry failed:", (e as Error).message);
    }
  }

  // Check if we already planned today
  const [existing] = await db.select({
    id: outreachDailyPlans.id,
    status: outreachDailyPlans.status,
    approvalToken: outreachDailyPlans.approvalToken,
    executionAttempts: outreachDailyPlans.executionAttempts,
  }).from(outreachDailyPlans)
    .where(eq(outreachDailyPlans.planDate, today));

  if (existing) {
    const approvalUrl = `${APP_BASE()}/approve/outreach-plan/${existing.approvalToken}`;
    // Resume interrupted autopilot work: a plan stuck in awaiting_approval
    // (flag flipped on after planning / crash before auto-approve), approved
    // (crash mid-execution), or failed with attempts left.
    if (autopilotActive && shouldAutoResume(existing.status, existing.executionAttempts)) {
      console.log(`[OutreachIntel] Autopilot resuming today's plan (status ${existing.status}, attempts ${existing.executionAttempts ?? 0}).`);
      await autoApproveAndExecute(existing.id, approvalUrl);
    } else {
      console.log(`[OutreachIntel] Plan for ${today} already exists (${existing.status}), skipping.`);
    }
    return { planId: existing.id, approvalUrl };
  }

  console.log(`[OutreachIntel] Generating daily intelligence plan for ${today}...`);

  // Get recent pipeline counts so Claude can plan intelligently
  const recentLeads = await db.select({ category: outreachLeads.category })
    .from(outreachLeads)
    .orderBy(desc(outreachLeads.createdAt))
    .limit(100);

  const categoryCounts: Record<string, number> = {};
  for (const l of recentLeads) {
    if (l.category) categoryCounts[l.category] = (categoryCounts[l.category] ?? 0) + 1;
  }

  // Recent plan history so Claude diversifies instead of re-targeting the same
  // country + category + geo it already covered on prior days.
  const recentPlans = await getRecentPlans(7);
  const recentTargetLines: string[] = [];
  for (const p of recentPlans) {
    if (p.planDate === today) continue; // skip an in-progress same-day record
    for (const c of (p.leadCategories ?? [])) {
      recentTargetLines.push(`- ${p.planDate}: ${c.category.replace(/_/g, " ")} · ${c.country}${c.geoFocus ? ` (${c.geoFocus})` : ""}`);
    }
  }
  const recentTargetsBlock = recentTargetLines.length
    ? recentTargetLines.slice(0, 40).join("\n")
    : "- None yet — this is the first plan.";

  const contextMessage = `Today is ${today} (${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}).

Current pipeline composition (last 100 leads):
${Object.entries(categoryCounts).map(([cat, count]) => `- ${cat}: ${count}`).join("\n") || "- Pipeline is empty — any category is welcome"}

ALREADY TARGETED in the last 7 days (category · country · geo) — DO NOT repeat these exact combinations; pick fresh countries, cities, or professional categories so each day explores genuinely new ground:
${recentTargetsBlock}

Based on this context, generate today's outreach intelligence plan. Deliberately DIVERSIFY away from the combinations listed above — rotate to different treaty countries, cities, and partner categories that the recent plans have NOT covered, while still fitting the E-2 referral-partner strategy. Be strategic about what's missing from the pipeline and what's timely today.`;

  const raw = await callClaude(INTELLIGENCE_SYSTEM_PROMPT, contextMessage, 3000);
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();

  let plan: {
    planSummary: string;
    strategicReasoning: string;
    leadCategories: { category: string; country: string; geoFocus: string; reasoning: string; estimatedLeads: number; priority: "high"|"medium"|"low" }[];
    searchQueries: { query: string; source: "serpapi"|"seamless"|"hunter"; purpose: string }[];
    blockerRequests?: { tool: string; reason: string; priority: "high"|"medium"|"low"; url?: string }[];
    estimatedLeads: number;
  };

  try {
    plan = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 300)}`);
  }

  // Drop blocker requests for paid B2B contact databases — the platform already
  // sources & enriches leads (Seamless + Hunter + SerpAPI + PDL + Apollo +
  // Proxycurl), so the agent must not ask Dylan to sign up for ZoomInfo et al.
  if (plan.blockerRequests?.length) {
    const before = plan.blockerRequests.length;
    plan.blockerRequests = plan.blockerRequests.filter(
      b => !isRedundantDataVendorBlocker(b.tool, b.reason, b.url),
    );
    const dropped = before - plan.blockerRequests.length;
    if (dropped > 0) console.log(`[OutreachIntel] Filtered ${dropped} redundant data-vendor blocker request(s).`);
  }

  const token = randomUUID();

  const [record] = await db.insert(outreachDailyPlans).values({
    planDate: today,
    status: "awaiting_approval",
    planSummary: plan.planSummary,
    strategicReasoning: plan.strategicReasoning,
    leadCategories: plan.leadCategories,
    searchQueries: plan.searchQueries ?? [],
    blockerRequests: plan.blockerRequests ?? [],
    approvalToken: token,
    estimatedLeads: plan.estimatedLeads,
    discoveredCount: 0,
  }).returning({ id: outreachDailyPlans.id });

  const planId = record.id;
  const approvalUrl = `${APP_BASE()}/approve/outreach-plan/${token}`;

  // Genuine blockers are worth a text in either mode.
  if ((plan.blockerRequests?.length ?? 0) > 0) {
    for (const b of plan.blockerRequests!.slice(0, 2)) {
      await notifyBlocker(
        "outreach",
        `Access needed: ${b.tool}`,
        `${b.reason}${b.url ? `\n\nSign up: ${b.url}` : ""}`,
      ).catch(() => {});
    }
  }

  // ── Autopilot: approve + execute immediately, no morning tap needed ────────
  // The safety rails that replace the human glance: a plan that looks anomalous
  // or a tripped deliverability breaker falls back to the manual approval link.
  if (autopilotActive) {
    const anomaly = planLooksAnomalous(plan, DAILY_CAMPAIGN_TARGET);
    const breaker = anomaly ? null : await checkDeliverabilityBreaker();
    const holdReason = anomaly
      ? `today's plan looks unusual — ${anomaly}`
      : breaker?.tripped
        ? `the deliverability breaker tripped — ${breaker.detail}`
        : null;

    if (!holdReason) {
      console.log(`[OutreachIntel] Autopilot: plan ${planId} auto-approved, executing now.`);
      await autoApproveAndExecute(planId, approvalUrl);
      return { planId, approvalUrl };
    }

    console.warn(`[OutreachIntel] Autopilot held plan ${planId}: ${holdReason}`);
    await sendAgentSms(
      "outreach",
      `🤖⚠️ Autopilot needs you today: ${holdReason}.\n\nToday's plan was NOT run automatically. Review & approve it here: ${approvalUrl}`,
      { triggerType: "daily_plan" },
    ).catch(e => console.warn("[OutreachIntel] SMS send failed:", e.message));
    return { planId, approvalUrl };
  }

  // ── Manual mode: SMS the approval link, exactly as before ──────────────────
  console.log(`[OutreachIntel] Plan saved (${planId}). Sending approval SMS...`);
  const categoryLines = plan.leadCategories
    .sort((a, b) => (a.priority === "high" ? -1 : 1))
    .slice(0, 3)
    .map(c => `• ${c.country} ${c.category.replace(/_/g, " ")} (~${c.estimatedLeads} leads)`)
    .join("\n");

  const blockerNote = (plan.blockerRequests?.length ?? 0) > 0
    ? `\n\n⚠️ Agent needs ${plan.blockerRequests!.length} tool(s) — see plan for details.`
    : "";

  const pausedNote = autopilot.enabled && autopilot.paused
    ? `\n\n(Autopilot is paused — resume it from this link to go hands-free again.)`
    : "";

  const smsBody = `Good morning! Outreach Agent has today's lead plan ready 🎯\n\n${plan.planSummary}\n\nTop targets:\n${categoryLines}\n\n~${plan.estimatedLeads} leads estimated${blockerNote}${pausedNote}\n\nApprove & execute: ${approvalUrl}`;

  await sendAgentSms("outreach", smsBody, { triggerType: "daily_plan" }).catch(e =>
    console.warn("[OutreachIntel] SMS send failed:", e.message),
  );

  return { planId, approvalUrl };
}

// ─── Autopilot execution (approve → execute → retry once on failure) ─────────

async function autoApproveAndExecute(planId: string, approvalUrl: string): Promise<void> {
  await db.update(outreachDailyPlans)
    .set({ status: "approved", autoApprovedAt: new Date(), updatedAt: new Date() })
    .where(eq(outreachDailyPlans.id, planId));
  await executePlanWithRetry(planId, approvalUrl);
}

/**
 * Run the plan; on failure record the error, retry once after RETRY_DELAY_MS,
 * and only text for help when the retry also fails. A restart between failure
 * and retry is covered too: the startup catch-up re-enters
 * planDailyIntelligence, which resumes failed plans with attempts left.
 */
async function executePlanWithRetry(planId: string, approvalUrl: string): Promise<void> {
  const [row] = await db.select({ attempts: outreachDailyPlans.executionAttempts })
    .from(outreachDailyPlans).where(eq(outreachDailyPlans.id, planId));
  const attempt = (row?.attempts ?? 0) + 1;
  await db.update(outreachDailyPlans)
    .set({ executionAttempts: attempt, updatedAt: new Date() })
    .where(eq(outreachDailyPlans.id, planId));

  try {
    await executeApprovedPlan(planId);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`[OutreachIntel] Execution attempt ${attempt} failed:`, msg);
    await db.update(outreachDailyPlans)
      .set({ status: "failed", lastError: msg.slice(0, 500), updatedAt: new Date() })
      .where(eq(outreachDailyPlans.id, planId));

    if (attempt < MAX_EXECUTION_ATTEMPTS) {
      console.log(`[OutreachIntel] Retrying plan ${planId} in ${Math.round(RETRY_DELAY_MS / 60000)} min...`);
      const timer = setTimeout(() => {
        db.update(outreachDailyPlans)
          .set({ status: "approved", updatedAt: new Date() })
          .where(and(eq(outreachDailyPlans.id, planId), eq(outreachDailyPlans.status, "failed")))
          .then(() => executePlanWithRetry(planId, approvalUrl))
          .catch(err => console.error("[OutreachIntel] Retry failed to start:", (err as Error).message));
      }, RETRY_DELAY_MS);
      timer.unref?.();
    } else {
      await sendAgentSms(
        "outreach",
        `❌ Autopilot: today's lead plan failed ${MAX_EXECUTION_ATTEMPTS} times and needs you.\n\nLast error: ${msg.slice(0, 180)}\n\nPlan: ${approvalUrl}`,
        { triggerType: "daily_plan" },
      ).catch(() => {});
    }
  }
}

// ─── Execute Approved Plan ────────────────────────────────────────────────────

export async function executeApprovedPlan(planId: string): Promise<{ discovered: number; added: number }> {
  const [plan] = await db.select().from(outreachDailyPlans).where(eq(outreachDailyPlans.id, planId));
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "approved") throw new Error(`Plan status is "${plan.status}", not approved`);

  console.log(`[OutreachIntel] Executing plan ${planId} for ${plan.planDate}...`);

  await db.update(outreachDailyPlans).set({ status: "executing", updatedAt: new Date() })
    .where(eq(outreachDailyPlans.id, planId));

  let totalDiscovered = 0;
  let totalAdded = 0;
  const updatedQueries: NonNullable<typeof plan.searchQueries> = [];
  // Newly-added leads this run, carried forward to build the day's list + campaign.
  const discoveredForCampaign: DiscoveredLeadInput[] = [];
  // Distinct provider failures across the run — surfaced in the report SMS so a
  // dead key / drained credit pool is visible the same morning, not weeks later.
  const providerIssues = new Map<string, string>();
  // Shared Apollo email-reveal credit budget for the whole run.
  const apolloReveals = { left: APOLLO_REVEAL_BUDGET };

  // Execute each search query
  for (const query of (plan.searchQueries ?? [])) {
    try {
      let discovered: { fullName: string; company: string; website?: string; category: string; notes: string }[] = [];
      let providerPeople: PlanPerson[] = [];
      let queryCountry: string | undefined;
      let queryError: string | undefined;

      if (query.source === "serpapi") {
        const serp = await serpSearch(query.query);
        queryError = serp.error;
        // Find the matching category for this query
        const matchedCategory = plan.leadCategories[0]; // fallback to first
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase()) ||
          query.query.toLowerCase().includes(c.country.toLowerCase())
        ) ?? matchedCategory;
        queryCountry = cat?.country;
        discovered = await extractLeadsFromSerp(serp.results, cat?.category ?? "other", cat?.country ?? "");
      } else if (query.source === "seamless" || query.source === "apollo") {
        // Parse the query into titles + locations
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase())
        ) ?? plan.leadCategories[0];
        queryCountry = cat?.country;
        const titles = cat ? [cat.category.replace(/_/g, " ")] : ["immigration attorney"];
        // The location filter needs a real country name — geoFocus is a prose
        // sentence ("Seoul — in-country immigration attorneys…") that matches
        // nothing, which silently zeroed out every Seamless query.
        const locations = cat?.country ? [cat.country] : [];
        const r = query.source === "seamless"
          ? await seamlessSearch({ titles, locations, keywords: "E-2 visa", limit: 50 })
          // Apollo: title + country alone — its keyword filter is AND-ed and
          // would narrow most international queries to zero.
          : await apolloPlanSearch({ titles, countries: locations, limit: 50 }, apolloReveals);
        queryError = r.error;
        providerPeople = r.people;
        const label = query.source === "seamless" ? "Seamless" : "Apollo";
        discovered = providerPeople.map(p => ({
          fullName: p.name,
          company: p.company,
          website: p.website,
          category: cat?.category ?? "other",
          notes: `${p.title} — found via ${label} | ${p.location}`,
        }));
      } else if (query.source === "hunter") {
        // People-at-a-firm lookup: the query must carry a real firm domain.
        const domain = domainFromHunterQuery(query.query);
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase())
        ) ?? plan.leadCategories[0];
        queryCountry = cat?.country;
        if (!domain) {
          queryError = "hunter query skipped — no firm domain in query text";
        } else {
          const firmSite = `https://${domain}`;
          const people = await findPeopleAtFirm(firmSite, 10);
          providerPeople = people.map(fp => ({
            name: fp.fullName,
            title: fp.jobTitle ?? "",
            company: domain,
            email: fp.email,
            website: firmSite,
            location: cat?.country ?? "",
          }));
          discovered = providerPeople.map(p => ({
            fullName: p.name,
            company: p.company,
            website: p.website,
            category: cat?.category ?? "other",
            notes: `${p.title} — found via Hunter at ${domain}`,
          }));
        }
      } else {
        queryError = `unknown source "${(query as { source: string }).source}"`;
      }

      if (queryError) providerIssues.set(query.source, queryError);

      // Deduplicate and insert into outreach_leads
      let addedFromQuery = 0;
      for (const lead of discovered) {
        if (!lead.fullName || lead.fullName.length < 3) continue;
        try {
          // Check for duplicate by name + company
          const existing = await db.select({ id: outreachLeads.id })
            .from(outreachLeads)
            .where(and(
              eq(outreachLeads.fullName, lead.fullName),
              eq(outreachLeads.company, lead.company ?? ""),
            ))
            .limit(1);

          if (existing.length > 0) continue;

          const providerMatch = providerPeople.find(a => a.name === lead.fullName);
          await db.insert(outreachLeads).values({
            fullName: lead.fullName,
            company: lead.company ?? "",
            website: lead.website,
            category: lead.category,
            email: providerMatch?.email,
            linkedinUrl: providerMatch?.linkedinUrl,
            notes: `[${query.source.toUpperCase()}] ${lead.notes}`,
            score: 60,
            status: "new",
            // Today's discoveries go straight into today's campaign build below,
            // so stamp them now — the backfill top-up only recycles NULL rows.
            campaignedAt: new Date(),
          });
          addedFromQuery++;
          totalAdded++;
          discoveredForCampaign.push({
            fullName: lead.fullName,
            company: lead.company ?? "",
            email: providerMatch?.email ?? null,
            website: lead.website ?? null,
            linkedinUrl: providerMatch?.linkedinUrl ?? null,
            jobTitle: providerMatch?.title ?? null,
            category: lead.category,
            country: queryCountry ?? null,
            city: providerMatch?.city ?? null,
          });
        } catch {
          // ignore duplicate key errors
        }
      }

      totalDiscovered += discovered.length;
      updatedQueries.push({
        ...query,
        executed: true,
        resultsCount: discovered.length,
        ...(queryError ? { error: queryError } : {}),
      });
      console.log(`[OutreachIntel] Query "${query.query.slice(0, 50)}..." → ${discovered.length} found, ${addedFromQuery} added${queryError ? ` (${queryError})` : ""}`);

      // Small delay between searches
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      const msg = (err as Error).message.slice(0, 160);
      console.warn(`[OutreachIntel] Query failed: ${msg}`);
      providerIssues.set(query.source, `${query.source}: ${msg}`);
      updatedQueries.push({ ...query, executed: true, resultsCount: 0, error: msg });
    }
  }

  await db.update(outreachDailyPlans).set({
    status: "completed",
    discoveredCount: totalAdded,
    searchQueries: updatedQueries,
    executedAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(outreachDailyPlans.id, planId));

  // Top up today's campaign from the standing pipeline: leads discovered on
  // earlier days that never made it into any campaign build (typically because
  // no email could be found back then, or the day's run died before the build).
  // The enrichment waterfall + firm expansion keep improving, so recycling these
  // is the cheapest source of extra emailable contacts — no new searches needed.
  // Each lead is recycled at most once: it gets its campaigned_at stamp here
  // whether or not enrichment succeeds this time.
  let backfilled = 0;
  if (discoveredForCampaign.length < DAILY_CAMPAIGN_TARGET) {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const room = DAILY_CAMPAIGN_TARGET - discoveredForCampaign.length;
      const pool = await db.select().from(outreachLeads)
        .where(and(
          eq(outreachLeads.status, "new"),
          isNull(outreachLeads.campaignedAt),
          gte(outreachLeads.createdAt, cutoff),
          eq(outreachLeads.optedOut, false),
          or(isNotNull(outreachLeads.email), isNotNull(outreachLeads.website)),
        ))
        .orderBy(desc(outreachLeads.score), desc(outreachLeads.createdAt))
        .limit(room);
      if (pool.length > 0) {
        await db.update(outreachLeads)
          .set({ campaignedAt: new Date() })
          .where(inArray(outreachLeads.id, pool.map(l => l.id)));
        for (const l of pool) {
          discoveredForCampaign.push({
            fullName: l.fullName,
            company: l.company ?? "",
            email: l.email ?? null,
            website: l.website ?? null,
            linkedinUrl: l.linkedinUrl ?? null,
            jobTitle: l.title ?? null,
            category: l.category ?? null,
            country: null,
            city: null,
          });
        }
        backfilled = pool.length;
        console.log(`[OutreachIntel] Backfilled ${backfilled} never-campaigned pipeline lead(s) into today's build.`);
      }
    } catch (e) {
      console.warn("[OutreachIntel] Backfill top-up failed (continuing with today's finds):", (e as Error).message);
    }
  }

  // Build the day's custom list + a fresh clone of the Grok 2.0 broker campaign,
  // enrol the list, and set it live. Failure here must NOT lose the saved leads,
  // so it's isolated — the pipeline is already persisted above.
  // Name the list/campaign by the day it actually runs, not the day the plan was
  // drafted — a stale plan approved days later should read as today's campaign.
  // Use ET (not UTC) to match the rest of the outreach system (6AM-ET cron,
  // morning-digest day boundary): an evening-ET approval is still "today" locally
  // even though UTC has already rolled to tomorrow.
  const runDate = etToday();
  let campaign: Awaited<ReturnType<typeof buildDailyCampaignFromLeads>> = null;
  try {
    campaign = await buildDailyCampaignFromLeads({
      planDate: plan.planDate,
      runDate,
      planSummary: plan.planSummary,
      topCategories: (plan.leadCategories ?? []).map(c => c.category),
      leads: discoveredForCampaign,
    });
  } catch (e) {
    console.error("[OutreachIntel] Daily campaign build failed:", (e as Error).message);
    await sendAgentSms(
      "outreach",
      `⚠️ ${totalAdded} leads saved, but today's auto-campaign couldn't be built.\n\nError: ${(e as Error).message.slice(0, 180)}\n\nYou can still enroll them manually: ${APP_BASE()}/crm`,
      { triggerType: "plan_executed" },
    ).catch(() => {});
  }

  // Notify Dylan of results. An autopilot run gets the "no action needed"
  // framing plus the pause link (the approval page carries the pause control);
  // provider outages hit during discovery are called out either way.
  const autopilotRun = !!plan.autoApprovedAt;
  const smsBody = buildPlanExecutedSms({
    base: APP_BASE(),
    why: plan.planSummary || plan.strategicReasoning,
    sourcesSearched: updatedQueries.length,
    profilesFound: totalDiscovered,
    leadsAdded: totalAdded,
    backfilled,
    campaign,
    autopilot: autopilotRun,
    pauseUrl: autopilotRun && plan.approvalToken
      ? `${APP_BASE()}/approve/outreach-plan/${plan.approvalToken}`
      : null,
    providerIssues: [...providerIssues.values()],
  });
  await sendAgentSms("outreach", smsBody, { triggerType: "plan_executed" }).catch(() => {});

  console.log(`[OutreachIntel] Plan ${planId} complete. ${totalAdded} leads added.`);
  return { discovered: totalDiscovered, added: totalAdded };
}

// ─── Get today's plan ─────────────────────────────────────────────────────────

export async function getTodaysPlan() {
  const today = etToday();
  const [plan] = await db.select().from(outreachDailyPlans)
    .where(eq(outreachDailyPlans.planDate, today))
    .orderBy(desc(outreachDailyPlans.createdAt))
    .limit(1);
  return plan ?? null;
}

export async function getRecentPlans(limit = 7) {
  return db.select().from(outreachDailyPlans)
    .orderBy(desc(outreachDailyPlans.createdAt))
    .limit(limit);
}
