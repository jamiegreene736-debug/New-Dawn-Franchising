/**
 * Outreach Intelligence Service
 * Daily autonomous lead intelligence for E-2 visa franchise outreach.
 *
 * Daily schedule (via cron in routes.ts):
 *   6:00 AM ET — planDailyIntelligence() → Claude plans the day, saves to DB, sends SMS approval link
 *   On approval  — executeApprovedPlan(planId) → SerpAPI + Seamless searches → populates outreach_leads
 */

import { db } from "./db";
import { outreachDailyPlans, outreachLeads } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { notifyBlocker, sendAgentSms, isRedundantDataVendorBlocker } from "./agent-sms-service";
import { buildDailyCampaignFromLeads, type DiscoveredLeadInput, type DailyCampaignResult } from "./daily-campaign-service";
import { seamlessFindPeople } from "./seamless-service";
import { randomUUID } from "crypto";

const APP_BASE = () => process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
const SERPAPI_KEY = process.env.SERPAPI_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

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
- SerpAPI: Google Search (use for finding specific people, firms, associations, contact info)
- Seamless: B2B lead database with email enrichment (use for finding specific job titles at companies)
- Hunter.io: Email finder for domains
- People Data Labs, Apollo, Proxycurl, Origami: additional contact discovery + email/phone enrichment, applied automatically
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

Include 4-6 lead categories, 8-12 search queries, and 0-3 blocker requests. Be specific and actionable. Vary the queries within a category (different cities, English + local-language phrasings, "firm directory" vs "attorney name" angles) so they don't all return the same results.`;

// ─── SerpAPI Web Search ───────────────────────────────────────────────────────

async function serpSearch(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
  if (!SERPAPI_KEY) return [];
  try {
    // Pull a full 20-result page — the old 8-result cap left most of each
    // query's candidates on the table (a SerpAPI call costs the same either way).
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=20&api_key=${SERPAPI_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { organic_results?: { title?: string; link?: string; snippet?: string }[] };
    return (data.organic_results ?? []).slice(0, 20).map(r => ({
      title: r.title ?? "",
      link: r.link ?? "",
      snippet: r.snippet ?? "",
    }));
  } catch {
    return [];
  }
}

// ─── Seamless.AI People Search ──────────────────────────────────────────────

async function seamlessSearch(opts: {
  titles?: string[];
  locations?: string[];
  keywords?: string;
  limit?: number;
}): Promise<{ name: string; title: string; company: string; email?: string; linkedinUrl?: string; location?: string; city?: string }[]> {
  if (!process.env.SEAMLESS_API_KEY) return [];
  // enrich=true runs the research+poll step so emails come back.
  const people = await seamlessFindPeople(
    {
      titles: opts.titles ?? [],
      countries: opts.locations ?? [],
      keywords: opts.keywords,
      limit: Math.min(opts.limit ?? 20, 25),
    },
    { enrich: true },
  );
  return people
    .map((p) => ({
      name: p.fullName || `${p.firstName} ${p.lastName}`.trim(),
      title: p.jobTitle ?? "",
      company: p.company ?? "",
      email: p.email ?? undefined,
      linkedinUrl: p.linkedinUrl ?? undefined,
      location: [p.city, p.country].filter(Boolean).join(" "),
      city: p.city ?? undefined,
    }))
    .filter((p) => p.name);
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

// ─── Plan Daily Intelligence ──────────────────────────────────────────────────

export async function planDailyIntelligence(): Promise<{ planId: string; approvalUrl: string }> {
  const today = new Date().toISOString().split("T")[0];

  // Check if we already planned today
  const [existing] = await db.select({
    id: outreachDailyPlans.id,
    status: outreachDailyPlans.status,
    approvalToken: outreachDailyPlans.approvalToken,
  }).from(outreachDailyPlans)
    .where(eq(outreachDailyPlans.planDate, today));

  if (existing) {
    console.log(`[OutreachIntel] Plan for ${today} already exists (${existing.status}), skipping.`);
    const approvalUrl = `${APP_BASE()}/approve/outreach-plan/${existing.approvalToken}`;
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

  const contextMessage = `Today is ${today} (${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}).

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

  console.log(`[OutreachIntel] Plan saved (${planId}). Sending SMS...`);

  // SMS to Dylan
  const categoryLines = plan.leadCategories
    .sort((a, b) => (a.priority === "high" ? -1 : 1))
    .slice(0, 3)
    .map(c => `• ${c.country} ${c.category.replace(/_/g, " ")} (~${c.estimatedLeads} leads)`)
    .join("\n");

  const blockerNote = (plan.blockerRequests?.length ?? 0) > 0
    ? `\n\n⚠️ Agent needs ${plan.blockerRequests!.length} tool(s) — see plan for details.`
    : "";

  const smsBody = `Good morning! Outreach Agent has today's lead plan ready 🎯\n\n${plan.planSummary}\n\nTop targets:\n${categoryLines}\n\n~${plan.estimatedLeads} leads estimated${blockerNote}\n\nApprove & execute: ${approvalUrl}`;

  await sendAgentSms("outreach", smsBody, { triggerType: "daily_plan" }).catch(e =>
    console.warn("[OutreachIntel] SMS send failed:", e.message),
  );

  // If there are blockers, send a separate notification
  if ((plan.blockerRequests?.length ?? 0) > 0) {
    for (const b of plan.blockerRequests!.slice(0, 2)) {
      await notifyBlocker(
        "outreach",
        `Access needed: ${b.tool}`,
        `${b.reason}${b.url ? `\n\nSign up: ${b.url}` : ""}`,
      ).catch(() => {});
    }
  }

  return { planId, approvalUrl };
}

// ─── Completion SMS builder ───────────────────────────────────────────────────

/**
 * Build the "Today's lead plan executed!" summary SMS. Pure + exported so the
 * exact operator-facing text can be asserted in tests. It surfaces WHY the leads
 * were chosen, the contacts-vs-enrolled breakdown (so "0 enrolled" is never a
 * silent failure), and the no-duplicate guarantee.
 */
export function buildPlanExecutedSms(opts: {
  base: string;
  why?: string | null;
  sourcesSearched: number;
  profilesFound: number;
  leadsAdded: number;
  campaign: DailyCampaignResult | null;
}): string {
  const { base, campaign } = opts;
  const why = (opts.why ?? "").trim();
  const whyLine = why ? `\n\n🧭 Why these leads: ${why.slice(0, 320)}` : "";

  let campaignLine = "";
  if (campaign) {
    const parts: string[] = [];
    parts.push(`\n\n🎯 Campaign "${campaign.campaignName}" is LIVE.`);
    const enrichNote = campaign.emailsEnriched
      ? ` (${campaign.emailsEnriched} work emails found` +
        `${campaign.firmPeopleAdded ? `, incl. ${campaign.firmPeopleAdded} people discovered at firms` : ""})`
      : "";
    parts.push(
      `List "${campaign.listName}" — ${campaign.contactsAdded} contacts, ${campaign.enrolled} enrolled${enrichNote}.`,
    );
    // Always explain the gap between contacts and enrollments so "0 enrolled"
    // never looks like a silent failure.
    const skips: string[] = [];
    if (campaign.skippedNoEmail) skips.push(`${campaign.skippedNoEmail} no email`);
    if (campaign.skippedDuplicate) skips.push(`${campaign.skippedDuplicate} already contacted`);
    if (campaign.skippedUndeliverable) skips.push(`${campaign.skippedUndeliverable} undeliverable`);
    if (campaign.enrolled === 0) {
      parts.push(
        `⚠️ 0 enrolled${skips.length ? ` — ${skips.join(", ")}` : ""}. ` +
          `Add or verify emails on those contacts in the CRM to start sending.`,
      );
    } else if (skips.length) {
      parts.push(`(skipped ${skips.join(", ")})`);
    }
    // Dedup reassurance — the user asked to know duplicate research is prevented.
    parts.push(
      `🔁 No-duplicate system is active: anyone already in a campaign is skipped, and today's plan was ` +
        `steered away from the last 7 days of targets so the same people/segments aren't researched twice.`,
    );
    parts.push(`Track it: ${base}/crm`);
    campaignLine = parts.join("\n");
  }

  return (
    `✅ Today's lead plan executed!${whyLine}\n\n` +
    `Searched ${opts.sourcesSearched} sources → found ${opts.profilesFound} profiles → ` +
    `added ${opts.leadsAdded} new leads to your pipeline.${campaignLine}\n\n` +
    `View pipeline: ${base}/agent`
  );
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

  // Execute each search query
  for (const query of (plan.searchQueries ?? [])) {
    try {
      let discovered: { fullName: string; company: string; website?: string; category: string; notes: string }[] = [];
      let seamlessLeads: { name: string; title: string; company: string; email?: string; linkedinUrl?: string; location?: string; city?: string }[] = [];
      let queryCountry: string | undefined;

      if (query.source === "serpapi") {
        const results = await serpSearch(query.query);
        // Find the matching category for this query
        const matchedCategory = plan.leadCategories[0]; // fallback to first
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase()) ||
          query.query.toLowerCase().includes(c.country.toLowerCase())
        ) ?? matchedCategory;
        queryCountry = cat?.country;
        discovered = await extractLeadsFromSerp(results, cat?.category ?? "other", cat?.country ?? "");
      } else if (query.source === "seamless") {
        // Parse Seamless query into titles + locations
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase())
        ) ?? plan.leadCategories[0];
        queryCountry = cat?.country;
        const titles = cat ? [cat.category.replace(/_/g, " ")] : ["immigration attorney"];
        // The location filter needs a real country name — geoFocus is a prose
        // sentence ("Seoul — in-country immigration attorneys…") that matches
        // nothing, which silently zeroed out every Seamless query.
        const locations = cat?.country ? [cat.country] : [];
        seamlessLeads = await seamlessSearch({ titles, locations, keywords: "E-2 visa", limit: 25 });
        discovered = seamlessLeads.map(p => ({
          fullName: p.name,
          company: p.company,
          website: undefined,
          category: cat?.category ?? "other",
          notes: `${p.title} — found via Seamless | ${p.location}`,
        }));
      }

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

          const seamlessMatch = seamlessLeads.find(a => a.name === lead.fullName);
          await db.insert(outreachLeads).values({
            fullName: lead.fullName,
            company: lead.company ?? "",
            website: lead.website,
            category: lead.category,
            email: seamlessMatch?.email,
            linkedinUrl: seamlessMatch?.linkedinUrl,
            notes: `[${query.source.toUpperCase()}] ${lead.notes}`,
            score: 60,
            status: "new",
          });
          addedFromQuery++;
          totalAdded++;
          discoveredForCampaign.push({
            fullName: lead.fullName,
            company: lead.company ?? "",
            email: seamlessMatch?.email ?? null,
            website: lead.website ?? null,
            linkedinUrl: seamlessMatch?.linkedinUrl ?? null,
            jobTitle: seamlessMatch?.title ?? null,
            category: lead.category,
            country: queryCountry ?? null,
            city: seamlessMatch?.city ?? null,
          });
        } catch {
          // ignore duplicate key errors
        }
      }

      totalDiscovered += discovered.length;
      updatedQueries.push({ ...query, executed: true, resultsCount: discovered.length });
      console.log(`[OutreachIntel] Query "${query.query.slice(0, 50)}..." → ${discovered.length} found, ${addedFromQuery} added`);

      // Small delay between searches
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.warn(`[OutreachIntel] Query failed: ${(err as Error).message}`);
      updatedQueries.push({ ...query, executed: true, resultsCount: 0 });
    }
  }

  await db.update(outreachDailyPlans).set({
    status: "completed",
    discoveredCount: totalAdded,
    searchQueries: updatedQueries,
    executedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(outreachDailyPlans.id, planId));

  // Build the day's custom list + a fresh clone of the Grok 2.0 broker campaign,
  // enrol the list, and set it live. Failure here must NOT lose the saved leads,
  // so it's isolated — the pipeline is already persisted above.
  // Name the list/campaign by the day it actually runs, not the day the plan was
  // drafted — a stale plan approved days later should read as today's campaign.
  // Use ET (not UTC) to match the rest of the outreach system (6AM-ET cron,
  // morning-digest day boundary): an evening-ET approval is still "today" locally
  // even though UTC has already rolled to tomorrow. en-CA gives YYYY-MM-DD.
  const runDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
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

  // Notify Dylan of results.
  const smsBody = buildPlanExecutedSms({
    base: APP_BASE(),
    why: plan.planSummary || plan.strategicReasoning,
    sourcesSearched: updatedQueries.length,
    profilesFound: totalDiscovered,
    leadsAdded: totalAdded,
    campaign,
  });
  await sendAgentSms("outreach", smsBody, { triggerType: "plan_executed" }).catch(() => {});

  console.log(`[OutreachIntel] Plan ${planId} complete. ${totalAdded} leads added.`);
  return { discovered: totalDiscovered, added: totalAdded };
}

// ─── Get today's plan ─────────────────────────────────────────────────────────

export async function getTodaysPlan() {
  const today = new Date().toISOString().split("T")[0];
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
