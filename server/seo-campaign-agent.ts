import { db } from "./db";
import {
  seoCampaigns, seoCampaignActions, seoCampaignBlockers, seoContentDrafts,
  seoKeywordRankings, seoKeywords, agentSmsMessages,
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { notifyDraftPending, notifyBlocker, notifyError, sendAgentSms } from "./agent-sms-service";
import { randomUUID } from "crypto";
import { z } from "zod";

const APP_BASE = () => process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY || "";

// ─── Draft deduplication helper ───────────────────────────────────────────────
// Prevents the same draft title from being created twice in a day (e.g. from
// multiple server restarts triggering the daily campaign loop more than once).
async function draftExistsToday(campaignId: string, title: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await db.select({ id: seoContentDrafts.id })
    .from(seoContentDrafts)
    .where(and(
      eq(seoContentDrafts.campaignId, campaignId),
      eq(seoContentDrafts.title, title),
      gte(seoContentDrafts.createdAt, startOfDay)
    ))
    .limit(1);
  return existing.length > 0;
}

async function callClaude(messages: { role: string; content: string }[], system: string, maxTokens = 2000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content?.[0]?.type === "text" ? data.content[0].text : "";
}

// ─── White-Hat Action Types ───────────────────────────────────────────────────

const ALLOWED_ACTION_TYPES = new Set([
  "write_blog_post",
  "on_page_optimization",
  "technical_audit",
  "haro_response",
  "internal_linking",
  "competitor_gap_analysis",
  "directory_submission",
  "guest_post_outreach",
  "request_blocker",
]);

// BLACKLISTED actions are never executed (guardrail)
const BLACKLISTED_ACTION_TYPES = new Set([
  "automated_forum_post",
  "pbn_link",
  "paid_link",
  "thin_content",
  "keyword_stuffing",
  "cloaking",
  "doorway_page",
  "mass_comment",
]);

// ─── Planner Zod Schema (mirrors the attached planner.js spec) ────────────────

const ActionSchema = z.object({
  action_type: z.enum([
    "write_blog_post",
    "on_page_optimization",
    "technical_audit",
    "haro_response",
    "internal_linking",
    "competitor_gap_analysis",
    "directory_submission",
    "guest_post_outreach",
    "request_blocker",
  ]),
  rationale: z.string().min(20),
  expected_impact: z.enum(["low", "medium", "high"]),
  payload: z.record(z.unknown()),
});

const PlanSchema = z.array(ActionSchema).min(1).max(3);

export type PlannedAction = z.infer<typeof ActionSchema>;

// ─── SEO Planner System Prompt (verbatim from spec) ───────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are a senior white-hat SEO strategist working on a single campaign. Your ONLY goal is to improve the target URL's Google ranking for the target keyword through tactics that align with Google's Search Essentials and E-E-A-T guidelines.

You must NEVER recommend:
- Private blog networks (PBNs) or paid link schemes
- Automated forum/comment/social spam
- Thin or mass-generated AI content
- Keyword stuffing, cloaking, or doorway pages
- Any gray-hat or black-hat tactic

Every action must create genuine value for real users. Prioritize content depth, topical authority, technical health, earned links, and internal linking over volume.

Given the campaign state, recent actions and their outcomes, and the current SERP landscape, output a JSON array of 1 to 3 actions to take today. Focus on whatever addresses the biggest gap between our page and the top-ranking competitors.

If you need a resource we don't have (a tool subscription, credentials, human approval), emit a 'request_blocker' action instead of guessing or skipping.

CRITICAL: Respond with ONLY valid JSON matching this schema — no prose, no markdown fences, no commentary:
[
  {
    "action_type": "<one of the allowed types>",
    "rationale": "<why this action, grounded in the data provided — at least 20 chars>",
    "expected_impact": "low" | "medium" | "high",
    "payload": { <action-specific fields> }
  }
]

Payload examples:
- write_blog_post: { "title": "...", "target_keyword": "...", "outline": ["..."], "word_count": 1800, "requires_ymyl_review": true }
- on_page_optimization: { "page_url": "...", "focus_areas": ["title_tag", "meta_description", "h1", "content_gaps"] }
- internal_linking: { "from_urls": ["..."], "to_url": "...", "anchor_text_suggestions": ["..."] }
- competitor_gap_analysis: { "focus": "content_depth" | "keyword_coverage" | "backlinks" }
- haro_response: { "topics": ["E-2 visa", "franchise investment"], "requires_ymyl_review": true }
- guest_post_outreach: { "target_site_types": ["immigration law blogs", "franchise publications"], "requires_approval": true }
- directory_submission: { "requires_approval": true }
- technical_audit: { "focus_areas": ["core_web_vitals", "crawlability", "schema_markup"] }
- request_blocker: { "type": "credentials_needed", "service": "Ahrefs", "reason": "...", "instructions_for_user": "..." }`;

// ─── SERP Types ───────────────────────────────────────────────────────────────

type SerpOrganicResult = {
  position: number;
  title: string;
  link: string;
  snippet?: string;
  displayed_link?: string;
};

type SerpApiResponse = {
  organic_results?: (SerpOrganicResult & { link?: string })[];
  answer_box?: unknown;
  local_results?: unknown;
  knowledge_graph?: unknown;
  inline_videos?: unknown;
  related_questions?: { question: string; snippet: string }[];
  related_searches?: { query: string }[];
};

export type SerpSnapshot = {
  keyword: string;
  checkedAt: string;
  rank: number | null;
  matchedUrl: string | null;
  organicResults: { position: number; title: string; link: string; snippet?: string }[];
  featuredSnippet: unknown | null;
  peopleAlsoAsk: { question: string; snippet: string }[];
  relatedSearches: { query: string }[];
  serpFeatures: {
    hasFeaturedSnippet: boolean;
    hasLocalPack: boolean;
    hasKnowledgeGraph: boolean;
    hasVideoResults: boolean;
  };
};

// ─── URL Normalization (strips protocol, www, trailing slash) ─────────────────

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

// ─── Core SERP fetch — rank + full snapshot in one call ──────────────────────

export async function fetchSerpAndRank(keyword: string, targetUrl: string): Promise<{ rank: number | null; snapshot: SerpSnapshot }> {
  if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY not set");

  const apiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keyword)}&location=United+States&gl=us&hl=en&device=desktop&num=100&api_key=${SERPAPI_KEY}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json() as SerpApiResponse;

  const organic = data.organic_results ?? [];
  const normalizedTarget = normalizeUrl(targetUrl);
  const targetDomain = normalizedTarget.split("/")[0];

  // Domain-level OR exact-URL match — catches any page on the site
  let rank: number | null = null;
  let matchedUrl: string | null = null;
  for (const r of organic) {
    const normalizedResult = normalizeUrl(r.link ?? "");
    if (normalizedResult === normalizedTarget || normalizedResult.startsWith(targetDomain)) {
      rank = r.position;
      matchedUrl = r.link ?? null;
      break;
    }
  }

  const snapshot: SerpSnapshot = {
    keyword,
    checkedAt: new Date().toISOString(),
    rank,
    matchedUrl,
    organicResults: organic.slice(0, 10).map(r => ({
      position: r.position,
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    })),
    featuredSnippet: data.answer_box ?? null,
    peopleAlsoAsk: (data.related_questions ?? []).slice(0, 5),
    relatedSearches: (data.related_searches ?? []).slice(0, 10),
    serpFeatures: {
      hasFeaturedSnippet: !!data.answer_box,
      hasLocalPack: !!data.local_results,
      hasKnowledgeGraph: !!data.knowledge_graph,
      hasVideoResults: !!data.inline_videos,
    },
  };

  return { rank, snapshot };
}

// ─── Campaign rank check — stores snapshot in DB ──────────────────────────────

export async function checkCampaignRank(campaign: typeof seoCampaigns.$inferSelect): Promise<{ rank: number | null; snapshot: SerpSnapshot | null }> {
  if (!SERPAPI_KEY) return { rank: null, snapshot: null };
  try {
    const targetUrl = campaign.targetUrl.startsWith("http")
      ? campaign.targetUrl
      : `newdawnfranchising.com${campaign.targetUrl}`;

    const { rank, snapshot } = await fetchSerpAndRank(campaign.targetKeyword, targetUrl);

    // Ensure a matching seo_keywords row exists (FK requirement) — upsert by campaign ID
    await db.insert(seoKeywords).values({
      id: campaign.id,
      keyword: campaign.targetKeyword,
      domain: "newdawnfranchising.com",
      targetUrl: campaign.targetUrl,
    }).onConflictDoNothing();

    // Store in rank history with full snapshot
    await db.insert(seoKeywordRankings).values({
      keywordId: campaign.id,
      position: rank,
      url: snapshot.matchedUrl,
      serpSnapshot: snapshot as unknown as Record<string, unknown>,
      checkedAt: new Date(),
    });

    // Update campaign — set starting_rank on first successful check
    await db.update(seoCampaigns).set({
      currentRank: rank,
      startingRank: campaign.startingRank ?? rank,
      updatedAt: new Date(),
    }).where(eq(seoCampaigns.id, campaign.id));

    return { rank, snapshot };
  } catch (err) {
    console.error(`[SEO Rank Check] Error for "${campaign.targetKeyword}":`, err);
    return { rank: null, snapshot: null };
  }
}

// ─── Backward-compat helper for executor functions ────────────────────────────

async function getSerpCompetitors(keyword: string): Promise<{ title: string; link: string; position: number }[]> {
  try {
    const { snapshot } = await fetchSerpAndRank(keyword, "newdawnfranchising.com");
    return snapshot.organicResults.map(r => ({ title: r.title, link: r.link, position: r.position }));
  } catch {
    return [];
  }
}

// ─── Get rank history (last 14 days) ─────────────────────────────────────────

async function getRankHistory(campaignId: string): Promise<{ position: number | null; checkedAt: Date }[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return db.select({ position: seoKeywordRankings.position, checkedAt: seoKeywordRankings.checkedAt })
    .from(seoKeywordRankings)
    .where(and(eq(seoKeywordRankings.keywordId, campaignId), gte(seoKeywordRankings.checkedAt, since)))
    .orderBy(desc(seoKeywordRankings.checkedAt));
}

// ─── Get latest SERP snapshot for a campaign ─────────────────────────────────

async function getLatestSnapshot(campaignId: string): Promise<SerpSnapshot | null> {
  const rows = await db.select({ serpSnapshot: seoKeywordRankings.serpSnapshot })
    .from(seoKeywordRankings)
    .where(eq(seoKeywordRankings.keywordId, campaignId))
    .orderBy(desc(seoKeywordRankings.checkedAt))
    .limit(1);
  return (rows[0]?.serpSnapshot as SerpSnapshot) ?? null;
}

// ─── Planner Context Builder (human-readable, not JSON blob) ─────────────────

function buildPlannerMessage(
  campaign: typeof seoCampaigns.$inferSelect,
  rankHistory: { position: number | null; checkedAt: Date }[],
  recentActions: typeof seoCampaignActions.$inferSelect[],
  openBlockers: typeof seoCampaignBlockers.$inferSelect[],
  snapshot: SerpSnapshot | null,
): string {
  const rankTrend = rankHistory
    .slice(0, 14)
    .reverse()
    .map(r => `  ${r.checkedAt.toISOString().slice(0, 10)}: ${r.position ? `#${r.position}` : "not ranking"}`)
    .join("\n") || "  (no history yet)";

  const actionsLog = recentActions
    .slice(0, 10)
    .map(a => {
      const result = a.result as Record<string, unknown> | null;
      const outcome = result?.message ?? a.status;
      return `  - [${a.createdAt.toISOString().slice(0, 10)}] ${a.actionType}: ${outcome}`;
    })
    .join("\n") || "  (none yet)";

  const competitorsList = snapshot?.organicResults?.length
    ? snapshot.organicResults.map(c => `  ${c.position}. ${c.title} — ${c.link}${c.snippet ? `\n     "${c.snippet.slice(0, 100)}..."` : ""}`).join("\n")
    : "  (no SERP data — SerpAPI key may be missing)";

  const paaList = snapshot?.peopleAlsoAsk?.length
    ? snapshot.peopleAlsoAsk.map(q => `  - ${q.question}`).join("\n")
    : "  (none)";

  const relatedSearchesList = snapshot?.relatedSearches?.length
    ? snapshot.relatedSearches.map(r => `  - ${r.query}`).join("\n")
    : "  (none)";

  const serpFeatures = snapshot?.serpFeatures
    ? [
        snapshot.serpFeatures.hasFeaturedSnippet ? "✓ Featured snippet present (consider structured answer content to capture it)" : "✗ No featured snippet (opportunity to create one)",
        snapshot.serpFeatures.hasLocalPack ? "✓ Local pack present (consider local citations and Google Business)" : "",
        snapshot.serpFeatures.hasKnowledgeGraph ? "✓ Knowledge graph present" : "",
        snapshot.serpFeatures.hasVideoResults ? "✓ Video results present (consider adding video content)" : "",
      ].filter(Boolean).join("\n  ") || "  No special SERP features"
    : "  (no SERP feature data)";

  const blockersList = openBlockers.length
    ? openBlockers.map(b => `  - ${b.service ?? b.type}: ${b.reason}`).join("\n")
    : "  (none)";

  return `CAMPAIGN
  Target keyword: "${campaign.targetKeyword}"
  Target URL: newdawnfranchising.com${campaign.targetUrl}
  Goal: rank in top ${campaign.goalRank ?? 10} by ${campaign.deadline ? new Date(campaign.deadline).toISOString().slice(0, 10) : "no deadline"}
  Starting rank: ${campaign.startingRank ? `#${campaign.startingRank}` : "unknown"}
  Current rank: ${campaign.currentRank ? `#${campaign.currentRank}` : "not ranking in top 100"}

RANK HISTORY (last 14 days)
${rankTrend}

RECENT ACTIONS TAKEN
${actionsLog}

CURRENT TOP 10 SERP COMPETITORS
${competitorsList}

PEOPLE ALSO ASK (intent signals)
${paaList}

RELATED SEARCHES (content gap opportunities)
${relatedSearchesList}

SERP FEATURES
  ${serpFeatures}

OPEN BLOCKERS (resources we are waiting on)
${blockersList}

Plan today's 1–3 highest-leverage white-hat actions. Remember: this is a YMYL niche (E-2 visa franchise content), so any content action should include "requires_ymyl_review": true in its payload.`;
}

// ─── Claude Planner with Retry + Zod Validation ───────────────────────────────

async function planActions(
  campaign: typeof seoCampaigns.$inferSelect,
  rankHistory: { position: number | null; checkedAt: Date }[],
  recentActions: typeof seoCampaignActions.$inferSelect[],
  openBlockers: typeof seoCampaignBlockers.$inferSelect[],
  snapshot: SerpSnapshot | null,
): Promise<PlannedAction[]> {
  const userMessage = buildPlannerMessage(campaign, rankHistory, recentActions, openBlockers, snapshot);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callClaude(
        [{ role: "user", content: userMessage }],
        PLANNER_SYSTEM_PROMPT,
        2048,
      );

      // Strip accidental code fences
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      const validated = PlanSchema.parse(parsed);

      // Hard guardrail: drop any blacklisted action types
      return validated.filter(a => !BLACKLISTED_ACTION_TYPES.has(a.action_type));
    } catch (err) {
      lastError = err;
      console.warn(`[SEO Campaign Planner] Attempt ${attempt}/3 failed:`, (err as Error).message);
    }
  }

  console.error("[SEO Campaign Planner] All 3 attempts failed:", lastError);
  return [];
}

// ─── Action Executors ─────────────────────────────────────────────────────────

const BLOG_SYSTEM_PROMPT = `You are an expert content writer creating long-form blog posts for a franchise consulting company. Your writing must demonstrate real expertise, experience, authority, and trust (E-E-A-T) — Google's quality bar for Your-Money-Your-Life content, which franchise and visa topics fall under.

Core principles:
- Write for a real human reader first, search engines second. If a sentence exists only for SEO, cut it.
- Every claim about law, money, or eligibility must be hedged appropriately and recommend consulting a qualified professional. Never state legal conclusions as facts.
- Use specific examples, realistic scenarios, and concrete numbers rather than generic advice.
- Vary sentence length. Short punchy sentences next to longer analytical ones. Never repetitive.
- Include a clear structure: compelling intro that states what the reader will learn, well-organized H2/H3 sections, a practical conclusion with next steps.
- NO keyword stuffing. The target keyword should appear naturally 3–6 times across a 1500+ word post, including once in the title, once in the intro, and ideally in one H2.
- NO filler phrases ("In today's fast-paced world", "In conclusion", "It's important to note").
- NO AI tells ("delve", "navigate the landscape", "leverage", "unlock the power of", em-dash overuse, "it's not just X, it's Y").

Output format: Return ONLY valid JSON with this exact shape, no markdown fences, no commentary:
{
  "title": "<SEO title, 50–60 chars, includes target keyword>",
  "meta_description": "<150–160 chars, compelling, includes target keyword>",
  "slug": "<url-slug-with-hyphens>",
  "body_markdown": "<full article in markdown, 1500+ words, with H2/H3 headings>",
  "internal_link_suggestions": [{"anchor": "...", "target_url_hint": "..."}],
  "external_citations": [{"claim": "...", "source_hint": "..."}],
  "ymyl_disclaimer_included": true
}`;

type BlogDraftJson = {
  title: string;
  meta_description: string;
  slug: string;
  body_markdown: string;
  internal_link_suggestions: { anchor: string; target_url_hint: string }[];
  external_citations: { claim: string; source_hint: string }[];
  ymyl_disclaimer_included: boolean;
};

async function executeBlogPost(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const keyword = (payload.focus_keyword as string) || campaign.targetKeyword;
  const outline = (payload.outline as string[]) || [];
  const wordCount = (payload.word_count as number) || 1800;
  const requiresYmylReview = payload.requires_ymyl_review !== false; // default true

  const userMessage = `Write a blog post for newdawnfranchising.com.

TARGET KEYWORD: "${keyword}"
WORKING TITLE: ${payload.title ? String(payload.title) : "(you choose based on the outline)"}
TARGET WORD COUNT: ${wordCount}
OUTLINE:
${outline.length ? outline.map((o, i) => `  ${i + 1}. ${o}`).join("\n") : "  (you design the structure)"}

CONTEXT:
- Company: New Dawn Franchising, a franchise consulting firm based in El Paso, Texas
- Audience: prospective franchise buyers, including E-2 visa applicants looking at franchises as a path to US business ownership
- Goal: rank for "${keyword}" by being the most useful, trustworthy resource on the topic

REQUIREMENTS:
- Include a YMYL disclaimer near the top: readers should consult a licensed immigration attorney and a franchise consultant before making decisions
- Cite sources where you make factual claims (USCIS, IFA, etc.) — use "source_hint" in the JSON since you cannot browse the web
- Suggest 3–5 internal links to other pages on newdawnfranchising.com that would make sense
- End with a clear, non-pushy call-to-action to book a free consultation at https://calendly.com/dylan-newdawnfranchising

Write the post now and return the JSON.`;

  const raw = await callClaude([{ role: "user", content: userMessage }], BLOG_SYSTEM_PROMPT, 8000);

  // Strip accidental code fences
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const draft: BlogDraftJson = JSON.parse(cleaned);
  const actualWordCount = draft.body_markdown.split(/\s+/).length;

  const [savedDraft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: draft.title,
    bodyMarkdown: draft.body_markdown,
    metaDescription: draft.meta_description,
    targetKeyword: keyword,
    wordCount: actualWordCount,
    contentType: "blog_post",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
    metadata: {
      slug: draft.slug,
      internalLinkSuggestions: draft.internal_link_suggestions,
      externalCitations: draft.external_citations,
      ymylDisclaimerIncluded: draft.ymyl_disclaimer_included,
    } as unknown as Record<string, unknown>,
  }).returning();

  // No blocker needed — notifyDraftPending already sends an SMS with the one-tap approval link.

  return {
    success: true,
    message: `Blog draft "${draft.title}" (${actualWordCount} words, ${draft.internal_link_suggestions.length} internal link suggestions) — awaiting your approval`,
    draftId: savedDraft.id,
  };
}

async function executeInternalLinking(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const pages = [
    { url: "/", title: "Home — New Dawn Franchising" },
    { url: "/franchise", title: "Franchise Opportunity" },
    { url: "/e2-visa", title: "E-2 Visa Requirements" },
    { url: "/territories", title: "Available Texas Territories" },
    { url: "/blog", title: "Blog" },
    { url: "/contact", title: "Contact" },
  ];

  const prompt = `You are an internal linking specialist for newdawnfranchising.com.

Target keyword: "${campaign.targetKeyword}"
Target URL: ${campaign.targetUrl}

Site pages:
${pages.map(p => `- ${p.url}: ${p.title}`).join("\n")}

Analyze which existing pages should add an internal link pointing to the target URL (${campaign.targetUrl}), using anchor text variations for "${campaign.targetKeyword}".

For each recommendation:
1. Which page should add the link
2. Suggested anchor text (use keyword variations, not exact match every time)
3. Suggested placement context (e.g., "In the 2nd paragraph where you mention investment opportunities")
4. Why this link helps (topical relevance, PageRank flow)

Format as a clear Markdown document with actionable edit instructions.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 2000);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `Internal Linking Plan — ${campaign.targetKeyword}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "on_page_diff",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `Internal linking plan created — ${(body.match(/\n##/g) || []).length + 1} page edits recommended`, draftId: draft.id };
}

async function executeOnPageOptimization(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const serpResults = await getSerpCompetitors(campaign.targetKeyword);
  const competitorTitles = serpResults.slice(0, 3).map(r => `"${r.title}" (${r.link})`).join("\n");

  const prompt = `You are an on-page SEO expert analyzing a page on newdawnfranchising.com.

Target keyword: "${campaign.targetKeyword}"
Target URL: ${campaign.targetUrl}
Current rank: ${campaign.currentRank ?? "Not ranking"}
Goal rank: Top ${campaign.goalRank}

Top 3 SERP competitors:
${competitorTitles || "No competitor data available"}

Generate a comprehensive on-page optimization diff/checklist covering:
1. **Title Tag** — current (estimated) vs. recommended (60 chars max, keyword near front)
2. **Meta Description** — recommended (155 chars, includes keyword + CTA)
3. **H1 Tag** — should match intent, include keyword
4. **H2/H3 Structure** — topics missing vs. top competitors
5. **Content Gaps** — topics competitors cover that we likely don't
6. **Internal Links** — what to add on this specific page
7. **Schema Markup** — what JSON-LD schema would help (FAQ, LocalBusiness, etc.)
8. **Image Alt Text** — reminders to include keyword in image alts
9. **URL Structure** — assessment
10. **Word Count Target** — based on competitor averages

Format as a clear, actionable Markdown checklist that a non-technical person can follow.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 2500);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `On-Page Optimization Checklist — ${campaign.targetUrl}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "on_page_diff",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `On-page optimization checklist generated for ${campaign.targetUrl}`, draftId: draft.id };
}

async function executeCompetitorGapAnalysis(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const competitors = await getSerpCompetitors(campaign.targetKeyword);

  const prompt = `You are a competitive SEO analyst for newdawnfranchising.com.

Target keyword: "${campaign.targetKeyword}"
Our site: newdawnfranchising.com
Our current rank: ${campaign.currentRank ?? "Not ranking"}

Top SERP competitors:
${competitors.map(c => `Position ${c.position}: ${c.title} — ${c.link}`).join("\n")}

Perform a comprehensive competitor gap analysis:

1. **Topic Gaps** — What topics do top-ranking pages likely cover that we're missing? (Based on their titles and the keyword intent)
2. **Content Depth** — Estimate average word count of top results; what depth should we target?
3. **Keyword Variations** — List 10 semantic variations and LSI keywords that top pages likely include
4. **Content Format** — What format do top pages use? (Lists, guides, FAQs, etc.)
5. **SERP Features** — What special results appear? (Featured snippets, PAA, local pack)
6. **Quick Wins** — Top 3 actions we can take in the next 2 weeks
7. **Content Calendar** — Suggest 5 supporting article ideas to build topical authority

Format as a strategic Markdown report with clear action items.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 2500);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `Competitor Gap Analysis — ${campaign.targetKeyword}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "on_page_diff",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `Competitor gap analysis complete — report created for review`, draftId: draft.id };
}

async function executeGuestPostOutreach(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const prompt = `You are an outreach specialist for newdawnfranchising.com, a franchise opportunity targeting E-2 visa investors in Texas.

Target keyword: "${campaign.targetKeyword}"

Write 3 personalized guest post outreach email templates for different site types:
1. An immigration law blog/firm website
2. A franchise industry publication or blog
3. An international business / entrepreneur publication

Each email should:
- Feel genuine and researched (not spammy)
- Lead with value (what the guest post will offer their readers)
- Propose a specific article topic that naturally covers "${campaign.targetKeyword}"
- Be under 200 words
- Include a clear ask for a 15-min call or email reply
- Be signed as "Dylan Merideth, New Dawn Franchising"

Max 5 outreach emails per day (human-paced volumes).

Format as Markdown with clear sections for each template.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 2000);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `Guest Post Outreach Templates — ${campaign.targetKeyword}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "outreach_email",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `3 outreach email templates drafted — awaiting your approval before any are sent`, draftId: draft.id };
}

async function executeHaroResponse(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const prompt = `You are drafting expert HARO/journalist responses for Dylan Merideth at New Dawn Franchising (newdawnfranchising.com).

Target keyword context: "${campaign.targetKeyword}"
Dylan's expertise: E-2 visa franchise investments, Texas property management, helping international investors enter the US market

Draft 2 expert pitch responses that Dylan could send to journalists writing about:
1. E-2 visa investment opportunities in the US
2. Franchise opportunities for international investors / immigrants

Each response:
- Opens with credentials (franchise expert, helps investors with E-2 visas)
- Provides 3-5 genuinely valuable, quotable insights
- Is under 300 words
- Does NOT promise specific returns or make legal guarantees
- Ends with Dylan's contact info + website
- Sounds like a real expert, not AI-generated

IMPORTANT: These are drafts only. Dylan must review and send them himself — NEVER auto-submit to journalists.

Format as Markdown.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 1500);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `HARO Expert Response Drafts — ${campaign.targetKeyword}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "haro_response",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `HARO response drafts created — review required before submitting to any journalist`, draftId: draft.id };
}

async function executeDirectorySubmission(
  campaign: typeof seoCampaigns.$inferSelect,
  payload: Record<string, unknown>,
  actionId: string,
): Promise<{ success: boolean; message: string; draftId?: string }> {
  const prompt = `You are an SEO specialist identifying legitimate directory submission opportunities for newdawnfranchising.com.

Business: New Dawn Franchising LLC — Property management franchise for E-2 visa investors, El Paso TX
Target keyword: "${campaign.targetKeyword}"

Identify 10 reputable, niche-relevant directories where listing newdawnfranchising.com would provide genuine value:
- Franchise directories (e.g., Franchise Gator, Franchise Direct, FranConnect)
- Immigration business directories
- Texas business directories
- El Paso / West Texas local business directories
- Property management associations
- International investor platforms

For each directory:
1. Directory name + URL
2. Why it's relevant (niche match, DA estimate)
3. Submission instructions (free vs. paid, manual vs. automated)
4. Expected SEO benefit
5. Priority (High / Medium / Low)

EXCLUDE any link farms, low-quality directories, or paid link schemes.

Note: Each first-time submission to a new directory requires Dylan's approval.

Format as a prioritized Markdown table + submission notes.`;

  const body = await callClaude([{ role: "user", content: prompt }], "", 2000);

  const [draft] = await db.insert(seoContentDrafts).values({
    campaignId: campaign.id,
    actionId,
    title: `Directory Submission Opportunities — ${campaign.targetKeyword}`,
    bodyMarkdown: body,
    metaDescription: null,
    targetKeyword: campaign.targetKeyword,
    wordCount: body.split(/\s+/).length,
    contentType: "on_page_diff",
    status: "awaiting_approval",
    approvalToken: randomUUID(),
  }).returning();

  return { success: true, message: `10 directory submission opportunities identified — each requires your approval before submitting`, draftId: draft.id };
}

async function createBlocker(
  campaign: typeof seoCampaigns.$inferSelect,
  actionId: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  await db.insert(seoCampaignBlockers).values({
    campaignId: campaign.id,
    actionId,
    type: (payload.type as string) || "info_needed",
    service: payload.service as string | undefined,
    reason: (payload.reason as string) || "Agent needs additional resources or approval",
    instructionsForUser: payload.instructions_for_user as string | undefined,
    priority: (payload.priority as string) || "medium",
    status: "open",
  });
  return { success: true, message: `Blocker created: ${payload.reason}` };
}

// ─── End-of-Day Critique (Claude writes retrospective) ────────────────────────

async function critiqueDay(
  campaign: typeof seoCampaigns.$inferSelect,
  actionsToday: typeof seoCampaignActions.$inferSelect[],
  rankHistory: { position: number | null; checkedAt: Date }[],
): Promise<string> {
  const prompt = `You are reviewing today's SEO actions for the campaign targeting "${campaign.targetKeyword}" at ${campaign.targetUrl}.

Current rank: ${campaign.currentRank ?? "Not ranking"}
Starting rank: ${campaign.startingRank ?? "Unknown"}
Rank trend (last 14 days): ${JSON.stringify(rankHistory.slice(0, 14).map(r => r.position))}

Actions taken today:
${actionsToday.map(a => `- ${a.actionType}: ${a.status} — ${JSON.stringify(a.result)}`).join("\n") || "None"}

Write a 3-5 sentence retrospective:
1. What was accomplished today
2. What the rank data suggests about momentum
3. What the top priority should be for tomorrow
4. Any patterns emerging from recent actions

Be concise and actionable. This feeds into tomorrow's planning context.`;

  return callClaude([{ role: "user", content: prompt }], "", 500);
}

// ─── Main Daily Loop ──────────────────────────────────────────────────────────

export async function runCampaignDailyLoop(campaignId: string): Promise<{
  success: boolean;
  steps: { step: string; result: string }[];
  error?: string;
}> {
  const steps: { step: string; result: string }[] = [];

  const [campaign] = await db.select().from(seoCampaigns).where(eq(seoCampaigns.id, campaignId));
  if (!campaign) return { success: false, steps, error: "Campaign not found" };

  // Guardrail: kill switch
  if (campaign.killSwitch) return { success: false, steps: [{ step: "kill_switch", result: "Global kill switch is active — campaign paused" }] };
  if (campaign.status === "paused" || campaign.status === "completed") {
    return { success: false, steps: [{ step: "status_check", result: `Campaign is ${campaign.status}` }] };
  }

  // Step 1: Rank Check + SERP snapshot (one SerpAPI call covers both)
  steps.push({ step: "rank_check", result: "Checking current rank and fetching SERP snapshot..." });
  const { rank, snapshot } = await checkCampaignRank(campaign);
  steps[steps.length - 1].result = rank
    ? `Rank: #${rank} for "${campaign.targetKeyword}"${snapshot?.serpFeatures.hasFeaturedSnippet ? " — Featured snippet present" : ""}`
    : `Not found in top 100 results${snapshot?.serpFeatures.hasFeaturedSnippet ? " — Featured snippet present (opportunity!)" : ""}`;

  // Step 2: Gather context for planner (no separate competitor call — snapshot has it)
  const [rankHistory, recentActions, openBlockers] = await Promise.all([
    getRankHistory(campaignId),
    db.select().from(seoCampaignActions).where(eq(seoCampaignActions.campaignId, campaignId)).orderBy(desc(seoCampaignActions.createdAt)).limit(10),
    db.select().from(seoCampaignBlockers).where(and(eq(seoCampaignBlockers.campaignId, campaignId), eq(seoCampaignBlockers.status, "open"))),
  ]);

  // Fall back to stored snapshot if live call failed
  const plannerSnapshot = snapshot ?? await getLatestSnapshot(campaignId);

  // Step 3: Plan
  steps.push({ step: "plan", result: "Calling Claude to plan today's actions..." });
  let plannedActions: PlannedAction[] = [];
  try {
    plannedActions = await planActions(campaign, rankHistory, recentActions, openBlockers, plannerSnapshot);
    if (plannedActions.length === 0) {
      steps[steps.length - 1].result = "Planner returned no valid actions after 3 attempts — check logs for details";
      return { success: false, steps, error: "Planner failed after retries" };
    }
    steps[steps.length - 1].result = `Claude planned ${plannedActions.length} action(s): ${plannedActions.map(a => `${a.action_type} [${a.expected_impact} impact]`).join(", ")}`;
  } catch (err) {
    steps[steps.length - 1].result = `Planning failed: ${err}`;
    return { success: false, steps, error: "Planning failed" };
  }

  // Step 4: Execute each action
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayActions: typeof seoCampaignActions.$inferSelect[] = [];
  for (const planned of plannedActions) {
    if (!ALLOWED_ACTION_TYPES.has(planned.action_type) || BLACKLISTED_ACTION_TYPES.has(planned.action_type)) {
      steps.push({ step: `execute_${planned.action_type}`, result: `BLOCKED: "${planned.action_type}" is not an allowed action type` });
      continue;
    }

    // Skip if this action type already ran today (dedup guard for server restarts)
    const alreadyRanToday = await db.select({ id: seoCampaignActions.id })
      .from(seoCampaignActions)
      .where(and(
        eq(seoCampaignActions.campaignId, campaignId),
        eq(seoCampaignActions.actionType, planned.action_type),
        gte(seoCampaignActions.createdAt, startOfToday)
      ))
      .limit(1);
    if (alreadyRanToday.length > 0) {
      steps.push({ step: `execute_${planned.action_type}`, result: `Skipped: ${planned.action_type} already ran today` });
      console.log(`[SEO Campaign] Skipping duplicate action: ${planned.action_type} already ran today`);
      continue;
    }

    // Insert action record
    const [actionRecord] = await db.insert(seoCampaignActions).values({
      campaignId,
      actionType: planned.action_type,
      status: "running",
      rationale: planned.rationale,
      expectedImpact: planned.expected_impact,
      payload: planned.payload,
    }).returning();

    steps.push({ step: `execute_${planned.action_type}`, result: `Running ${planned.action_type}...` });

    let result: { success: boolean; message: string; draftId?: string };
    try {
      const fresh = (await db.select().from(seoCampaigns).where(eq(seoCampaigns.id, campaignId)))[0];
      switch (planned.action_type) {
        case "write_blog_post":
          result = await executeBlogPost(fresh, planned.payload, actionRecord.id);
          break;
        case "internal_linking":
          result = await executeInternalLinking(fresh, planned.payload, actionRecord.id);
          break;
        case "on_page_optimization":
          result = await executeOnPageOptimization(fresh, planned.payload, actionRecord.id);
          break;
        case "competitor_gap_analysis":
          result = await executeCompetitorGapAnalysis(fresh, planned.payload, actionRecord.id);
          break;
        case "guest_post_outreach":
          result = await executeGuestPostOutreach(fresh, planned.payload, actionRecord.id);
          break;
        case "haro_response":
          result = await executeHaroResponse(fresh, planned.payload, actionRecord.id);
          break;
        case "directory_submission":
          result = await executeDirectorySubmission(fresh, planned.payload, actionRecord.id);
          break;
        case "technical_audit":
          result = await executeOnPageOptimization(fresh, planned.payload, actionRecord.id); // reuse on-page for now
          break;
        case "request_blocker":
          result = await createBlocker(fresh, actionRecord.id, planned.payload);
          break;
        default:
          // Unknown action types become blockers so nothing silently fails
          result = await createBlocker(fresh, actionRecord.id, {
            type: "info_needed",
            service: "executor",
            reason: `No handler implemented for action type: "${planned.action_type}"`,
            instructions_for_user: `The agent planned this action but it has not been built yet. You can skip it or ask for it to be implemented.`,
            priority: "low",
          });
      }

      // Blocker actions (request_blocker or unknown type fallback) mark as "done" immediately
      const isBlockerResult = result.message.startsWith("Blocker created");
      const newStatus = (planned.action_type === "request_blocker" || isBlockerResult)
        ? "done"
        : (result.success ? "awaiting_approval" : "failed");

      await db.update(seoCampaignActions).set({
        status: newStatus,
        result: { message: result.message, draftId: result.draftId },
        completedAt: new Date(),
      }).where(eq(seoCampaignActions.id, actionRecord.id));

      steps[steps.length - 1].result = result.message;
      todayActions.push({ ...actionRecord, status: newStatus, result: { message: result.message } });

    } catch (err) {
      await db.update(seoCampaignActions).set({
        status: "failed",
        result: { error: String(err) },
        completedAt: new Date(),
      }).where(eq(seoCampaignActions.id, actionRecord.id));
      steps[steps.length - 1].result = `Failed: ${err}`;
    }
  }

  // Step 5: Critique
  steps.push({ step: "critique", result: "Writing end-of-day retrospective..." });
  const freshRankHistory = await getRankHistory(campaignId);
  const freshCampaign = (await db.select().from(seoCampaigns).where(eq(seoCampaigns.id, campaignId)))[0];
  const retrospective = await critiqueDay(freshCampaign, todayActions, freshRankHistory);
  await db.update(seoCampaigns).set({
    lastRunAt: new Date(),
    lastRetrospective: retrospective,
    updatedAt: new Date(),
  }).where(eq(seoCampaigns.id, campaignId));
  steps[steps.length - 1].result = retrospective.slice(0, 200) + (retrospective.length > 200 ? "..." : "");

  // ── SMS Notifications ──────────────────────────────────────────────────────
  try {
    const [newDrafts, newBlockers] = await Promise.all([
      db.select({
        id: seoContentDrafts.id,
        title: seoContentDrafts.title,
        approvalToken: seoContentDrafts.approvalToken,
      }).from(seoContentDrafts)
        .where(and(eq(seoContentDrafts.campaignId, campaignId), eq(seoContentDrafts.status, "awaiting_approval")))
        .orderBy(desc(seoContentDrafts.createdAt)).limit(5),
      db.select({ id: seoCampaignBlockers.id, reason: seoCampaignBlockers.reason, service: seoCampaignBlockers.service }).from(seoCampaignBlockers)
        .where(and(eq(seoCampaignBlockers.campaignId, campaignId), eq(seoCampaignBlockers.status, "open")))
        .orderBy(desc(seoCampaignBlockers.createdAt)).limit(2),
    ]);

    const base = APP_BASE();
    if (newDrafts.length > 0) {
      // Send one SMS per draft with a direct approval link (tap-to-approve)
      for (const d of newDrafts.slice(0, 3)) {
        const approvalUrl = d.approvalToken
          ? `${base}/approve/seo/${d.approvalToken}`
          : `${base}/seo`;
        await notifyDraftPending(
          "seo",
          d.title ?? "SEO Draft",
          approvalUrl,
          `Keyword: "${campaign.targetKeyword}" · Tap the link to preview and approve.`,
        );
        // Small delay so Dylan doesn't get 3 texts simultaneously
        if (newDrafts.indexOf(d) < newDrafts.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (newDrafts.length > 3) {
        await notifyDraftPending("seo", `${newDrafts.length - 3} more draft(s) pending`, `${base}/seo`);
      }
    }

    if (newBlockers.length > 0) {
      for (const b of newBlockers) {
        await notifyBlocker("seo", `${b.service ?? "Service"} blocker`, b.reason ?? "Needs your input");
      }
    }
  } catch (smsErr) {
    console.warn("[SEO Agent SMS]", smsErr);
  }

  return { success: true, steps };
}

// ─── Run all active campaigns (called by daily cron) ─────────────────────────

export async function runAllActiveCampaigns(): Promise<void> {
  // Idempotency: only run the daily loop once per calendar day
  const startOfDayET = new Date(
    new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }) + " 00:00:00"
  );
  const alreadyRan = await db.select({ id: agentSmsMessages.id })
    .from(agentSmsMessages)
    .where(and(
      eq(agentSmsMessages.triggerType, "daily_status"),
      gte(agentSmsMessages.createdAt, startOfDayET)
    ))
    .limit(1);
  if (alreadyRan.length > 0) {
    console.log("[SEO Campaign Agent] Daily status already sent today — skipping duplicate run");
    return;
  }

  const active = await db.select().from(seoCampaigns).where(
    and(eq(seoCampaigns.status, "active"), eq(seoCampaigns.killSwitch, false))
  );
  console.log(`[SEO Campaign Agent] Running daily loop for ${active.length} active campaign(s)`);

  if (active.length === 0) {
    await sendAgentSms("seo",
      `Good morning! SEO Campaign Agent: No active campaigns found. Set one up at /seo to start tracking and ranking.`,
      { triggerType: "daily_status" }
    ).catch(() => {});
    return;
  }

  const summaryLines: string[] = [`Good morning! SEO Campaign Agent ran at 7AM:\n`];

  for (const campaign of active) {
    try {
      const result = await runCampaignDailyLoop(campaign.id);
      console.log(`[SEO Campaign Agent] Campaign "${campaign.targetKeyword}": ${result.success ? "success" : "failed"}`);

      // Build per-campaign summary line
      const rankStep = result.steps.find(s => s.step === "rank_check");
      const rankInfo = rankStep?.result ?? "Rank check skipped";
      const planStep = result.steps.find(s => s.step === "plan");
      const planInfo = planStep?.result ?? "";
      const draftsCreated = result.steps.filter(s => s.step.startsWith("execute_") && s.result.includes("draft")).length;

      summaryLines.push(`📊 "${campaign.targetKeyword}"`);
      summaryLines.push(`   ${rankInfo}`);
      if (planInfo) summaryLines.push(`   ${planInfo.slice(0, 120)}`);
      if (draftsCreated > 0) summaryLines.push(`   ✍️ ${draftsCreated} draft(s) queued for your approval`);
      if (!result.success && result.error) summaryLines.push(`   ⚠️ ${result.error}`);

    } catch (err) {
      console.error(`[SEO Campaign Agent] Error on campaign "${campaign.targetKeyword}":`, err);
      summaryLines.push(`📊 "${campaign.targetKeyword}"`);
      summaryLines.push(`   ❌ Error: ${err instanceof Error ? err.message.slice(0, 100) : "Unknown error"}`);
    }
  }

  // Count pending drafts for CTA
  const pendingDrafts = await db.select({ id: seoContentDrafts.id, approvalToken: seoContentDrafts.approvalToken, title: seoContentDrafts.title })
    .from(seoContentDrafts).where(eq(seoContentDrafts.status, "awaiting_approval"));

  if (pendingDrafts.length > 0) {
    const base = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
    summaryLines.push(`\n📝 ${pendingDrafts.length} draft(s) awaiting approval:`);
    for (const d of pendingDrafts.slice(0, 3)) {
      const url = d.approvalToken ? `${base}/approve/seo/${d.approvalToken}` : `${base}/seo`;
      summaryLines.push(`   "${(d.title ?? "Untitled").slice(0, 55)}"\n   ${url}`);
    }
    if (pendingDrafts.length > 3) summaryLines.push(`   + ${pendingDrafts.length - 3} more at ${base}/seo`);
  } else {
    summaryLines.push(`\n✅ No drafts pending — all clear`);
  }

  await sendAgentSms("seo", summaryLines.join("\n"), { triggerType: "daily_status" }).catch(() => {});
}
