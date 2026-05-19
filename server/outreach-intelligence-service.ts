/**
 * Outreach Intelligence Service
 * Daily autonomous lead intelligence for E-2 visa franchise outreach.
 *
 * Daily schedule (via cron in routes.ts):
 *   6:00 AM ET — planDailyIntelligence() → Claude plans the day, saves to DB, sends SMS approval link
 *   On approval  — executeApprovedPlan(planId) → SerpAPI + Apollo searches → populates outreach_leads
 */

import { db } from "./db";
import { outreachDailyPlans, outreachLeads } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { notifyBlocker, sendAgentSms } from "./agent-sms-service";
import { randomUUID } from "crypto";

const APP_BASE = () => process.env.APP_BASE_URL ?? "https://newdawnfranchising.replit.app";
const SERPAPI_KEY = process.env.SERPAPI_KEY ?? "";
const APOLLO_API_KEY = process.env.APOLLO_API_KEY ?? "";
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
New Dawn Franchising sells property management franchises (~$250K investment) that qualify as E-2 Treaty Investor Visa-qualifying investments. The E-2 visa allows treaty-country nationals to invest in a US business and live/work in the US.

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

AVAILABLE TOOLS:
- SerpAPI: Google Search (use for finding specific people, firms, associations, contact info)
- Apollo: B2B lead database with email enrichment (use for finding specific job titles at companies)
- Hunter.io: Email finder for domains
- Note: LinkedIn scraping NOT available. If needed, flag as a blocker request.

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

Include 3-5 lead categories, 5-8 search queries, and 0-3 blocker requests. Be specific and actionable.`;

// ─── SerpAPI Web Search ───────────────────────────────────────────────────────

async function serpSearch(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
  if (!SERPAPI_KEY) return [];
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${SERPAPI_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { organic_results?: { title?: string; link?: string; snippet?: string }[] };
    return (data.organic_results ?? []).slice(0, 8).map(r => ({
      title: r.title ?? "",
      link: r.link ?? "",
      snippet: r.snippet ?? "",
    }));
  } catch {
    return [];
  }
}

// ─── Apollo People Search ─────────────────────────────────────────────────────

async function apolloSearch(opts: {
  titles?: string[];
  locations?: string[];
  keywords?: string;
  limit?: number;
}): Promise<{ name: string; title: string; company: string; email?: string; linkedinUrl?: string; location?: string }[]> {
  if (!APOLLO_API_KEY) return [];
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
      body: JSON.stringify({
        page: 1,
        per_page: Math.min(opts.limit ?? 20, 25),
        person_titles: opts.titles ?? [],
        person_locations: opts.locations ?? [],
        q_keywords: opts.keywords ?? "",
        contact_email_status: ["verified", "likely to engage"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { people?: Record<string, unknown>[] };
    return (data.people ?? []).map((p: Record<string, unknown>) => ({
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      title: (p.title as string) ?? "",
      company: ((p.organization as Record<string, unknown>)?.name as string) ?? "",
      email: (p.email as string) ?? undefined,
      linkedinUrl: (p.linkedin_url as string) ?? undefined,
      location: `${p.city ?? ""} ${p.country ?? ""}`.trim(),
    })).filter(p => p.name);
  } catch {
    return [];
  }
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

New Dawn sells US property management franchises (~$250K) as an E-2 Treaty Investor Visa pathway. We are looking for REFERRAL PARTNERS — professionals who work with wealthy foreign nationals seeking US residency through investment — NOT investors themselves.

Category we're targeting: ${category} in ${country}

INCLUDE only: immigration attorneys, business brokers, franchise brokers, wealth managers, private bankers, relocation consultants, chamber of commerce executives, international financial advisors. These are professionals who can REFER their wealthy international clients to us.

EXCLUDE: Generic business owners, CEOs of product/tech companies, startup founders, retailers, manufacturers, anyone who isn't in professional services touching immigration, finance, or international mobility.

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.link}`).join("\n\n")}

Return JSON array of leads found (referral partners only):
[{"fullName": "Name or Org Name", "company": "Firm/Company", "website": "URL if found", "notes": "Why they are a strong referral partner for E-2 franchise clients"}]

Return empty array [] if no clear referral partners found. Only return verified names/orgs from the results, do NOT invent.`;

    const raw = await callClaude("", prompt, 1500);
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

  const contextMessage = `Today is ${today} (${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}).

Current pipeline composition (last 100 leads):
${Object.entries(categoryCounts).map(([cat, count]) => `- ${cat}: ${count}`).join("\n") || "- Pipeline is empty — any category is welcome"}

Based on this context, generate today's outreach intelligence plan. Be strategic about what's missing from the pipeline and what's timely today.`;

  const raw = await callClaude(INTELLIGENCE_SYSTEM_PROMPT, contextMessage, 3000);
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();

  let plan: {
    planSummary: string;
    strategicReasoning: string;
    leadCategories: { category: string; country: string; geoFocus: string; reasoning: string; estimatedLeads: number; priority: "high"|"medium"|"low" }[];
    searchQueries: { query: string; source: "serpapi"|"apollo"|"hunter"; purpose: string }[];
    blockerRequests?: { tool: string; reason: string; priority: "high"|"medium"|"low"; url?: string }[];
    estimatedLeads: number;
  };

  try {
    plan = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 300)}`);
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

  // Execute each search query
  for (const query of (plan.searchQueries ?? [])) {
    try {
      let discovered: { fullName: string; company: string; website?: string; category: string; notes: string }[] = [];
      let apolloLeads: { name: string; title: string; company: string; email?: string; linkedinUrl?: string; location?: string }[] = [];

      if (query.source === "serpapi") {
        const results = await serpSearch(query.query);
        // Find the matching category for this query
        const matchedCategory = plan.leadCategories[0]; // fallback to first
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase()) ||
          query.query.toLowerCase().includes(c.country.toLowerCase())
        ) ?? matchedCategory;
        discovered = await extractLeadsFromSerp(results, cat?.category ?? "other", cat?.country ?? "");
      } else if (query.source === "apollo") {
        // Parse Apollo query into titles + locations
        const cat = plan.leadCategories.find(c =>
          query.purpose.toLowerCase().includes(c.country.toLowerCase())
        ) ?? plan.leadCategories[0];
        const titles = cat ? [cat.category.replace(/_/g, " ")] : ["immigration attorney"];
        const locations = cat ? [cat.geoFocus] : [];
        apolloLeads = await apolloSearch({ titles, locations, keywords: "E-2 visa", limit: 20 });
        discovered = apolloLeads.map(p => ({
          fullName: p.name,
          company: p.company,
          website: undefined,
          category: cat?.category ?? "other",
          notes: `${p.title} — found via Apollo | ${p.location}`,
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

          const apolloMatch = apolloLeads.find(a => a.name === lead.fullName);
          await db.insert(outreachLeads).values({
            fullName: lead.fullName,
            company: lead.company ?? "",
            website: lead.website,
            category: lead.category,
            email: apolloMatch?.email,
            linkedinUrl: apolloMatch?.linkedinUrl,
            notes: `[${query.source.toUpperCase()}] ${lead.notes}`,
            score: 60,
            status: "new",
          });
          addedFromQuery++;
          totalAdded++;
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

  // Notify Dylan of results
  await sendAgentSms(
    "outreach",
    `✅ Today's lead plan executed!\n\nSearched ${updatedQueries.length} sources → found ${totalDiscovered} profiles → added ${totalAdded} new leads to your pipeline.\n\nView pipeline: ${APP_BASE()}/agent`,
    { triggerType: "plan_executed" },
  ).catch(() => {});

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
