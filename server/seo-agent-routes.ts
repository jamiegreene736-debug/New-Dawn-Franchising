import { Router } from "express";
import { db } from "./db";
import {
  seoKeywords, seoKeywordRankings, seoGeneratedContent, seoAgentTasks, seoBacklinkOutreach,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  checkKeywordRanking, researchKeyword, generateSeoContent, calculateSeoScore,
  runRankingsCheck, runCompetitorAnalysis,
} from "./seo-service";
import { hunterFindEmail } from "./hunter-service";
import { requireAdmin } from "./seo-routes";

const router = Router();

// ─── OpenAI streaming helper ──────────────────────────────────────────────────

const OPENAI_BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_KEY = () => process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

// ─── SEO Agent System Prompt ──────────────────────────────────────────────────

const SEO_SYSTEM_PROMPT = `You are the SEO AI Agent for New Dawn Franchising LLC (newdawnfranchising.com). You are a proactive, data-driven SEO expert who helps manage and improve the website's search rankings, content strategy, and backlink profile.

**About the business:** New Dawn Franchising is a property management franchise opportunity in Texas targeting E-2 visa investors from abroad (primarily from Mexico, the Middle East, and Asia). Key services: resident placement, maintenance coordination, and property management. Main markets: El Paso TX, West Texas.

**Your capabilities — call tools using this exact JSON format on its own line:**
\`{"tool":"get_seo_overview"}\`
\`{"tool":"get_keywords"}\`
\`{"tool":"check_rankings","args":{"keyword_id":"all"}}\`  or a specific keyword ID
\`{"tool":"research_keywords","args":{"topic":"E-2 visa franchise Texas"}}\`
\`{"tool":"add_keyword","args":{"keyword":"e2 visa franchise opportunity","target_url":"/franchise"}}\`
\`{"tool":"generate_content","args":{"keyword":"E-2 visa property management Texas","secondary_keywords":"franchise investment usa","word_count":1000,"tone":"informational"}}\`
\`{"tool":"get_backlinks"}\`
\`{"tool":"find_backlink_email","args":{"domain":"immigrationattorney.com","name":"John Smith"}}\`
\`{"tool":"update_backlink_status","args":{"id":"<id>","status":"won","notes":"They agreed to link"}}\`  status: not_sent|sent|replied|won|lost
\`{"tool":"get_content_history"}\`
\`{"tool":"run_seo_score"}\`
\`{"tool":"competitor_analysis"}\`
\`{"tool":"analyze_website"}\`  — crawls newdawnfranchising.com pages, reads content, and identifies SEO gaps
\`{"tool":"find_keywords"}\`  — researches best keyword opportunities using SerpAPI and AI
\`{"tool":"rank_report"}\`  — full ranking report: position, ranking URL, estimated monthly traffic, CTR, position changes for all tracked keywords
\`{"tool":"keyword_traffic","args":{"keyword":"e2 visa franchise texas"}}\`  — estimate monthly search volume + traffic projections at positions 1, 3, 5, 10
\`{"tool":"keyword_difficulty","args":{"keyword":"property management franchise"}}\`  — analyze SERP competition, difficulty score 1-100, time to rank estimate, AI assessment
\`{"tool":"long_tail_keywords","args":{"seed":"e2 visa franchise"}}\`  — find 20+ long-tail variations via autocomplete + related searches + PAA
\`{"tool":"serp_features","args":{"keyword":"e2 visa investor franchise"}}\`  — detect featured snippets, People Also Ask, local pack, ads, knowledge graph, videos
\`{"tool":"featured_snippet_opportunities"}\`  — scan all tracked keywords for featured snippet gaps and opportunities to win position 0
\`{"tool":"page_coverage"}\`  — show which pages rank for which keywords, find orphan keywords, detect cannibalization risks
\`{"tool":"schema_audit"}\`  — check if our pages have JSON-LD structured data, find missing schemas, generate ready-to-paste schema code

**Rules:**
- Always fetch current data before giving advice — don't guess rankings
- When asked to generate content, confirm the keyword then produce it
- Be specific and actionable — give exact keyword suggestions, exact anchor text, etc.
- When backlink outreach is won, celebrate it and note the SEO impact
- Rankings take time — set realistic expectations (3-6 months for new content)
- Target keywords: E-2 visa, franchise Texas, property management El Paso, immigration investor franchise, etc.
- Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;

// ─── Tool implementations ─────────────────────────────────────────────────────

async function execGetOverview(): Promise<string> {
  const keywords = await db.select().from(seoKeywords);
  const rankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));
  const latestByKeyword = new Map<string, number | null>();
  for (const r of rankings) {
    if (!latestByKeyword.has(r.keywordId)) {
      latestByKeyword.set(r.keywordId, r.position);
    }
  }
  const positions = [...latestByKeyword.values()].filter((p): p is number => p !== null);
  const avgPos = positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : null;
  const top10 = positions.filter(p => p <= 10).length;
  const top3 = positions.filter(p => p <= 3).length;
  const notRanking = keywords.length - latestByKeyword.size;
  const { score } = await calculateSeoScore();
  return JSON.stringify({
    seoScore: score,
    keywordsTracked: keywords.length,
    keywordsRanking: latestByKeyword.size,
    keywordsNotFound: notRanking,
    avgPosition: avgPos,
    top10Count: top10,
    top3Count: top3,
  });
}

async function execGetKeywords(): Promise<string> {
  const keywords = await db.select().from(seoKeywords).orderBy(desc(seoKeywords.createdAt));
  const rankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));
  const latestRanking = new Map<string, { position: number | null; url: string | null; checkedAt: Date }>();
  for (const r of rankings) {
    if (!latestRanking.has(r.keywordId)) {
      latestRanking.set(r.keywordId, { position: r.position, url: r.url, checkedAt: r.checkedAt! });
    }
  }
  const result = keywords.map(kw => {
    const rank = latestRanking.get(kw.id);
    return {
      id: kw.id,
      keyword: kw.keyword,
      targetUrl: kw.targetUrl,
      position: rank?.position ?? null,
      url: rank?.url ?? null,
      lastChecked: rank?.checkedAt?.toISOString() ?? null,
    };
  });
  return JSON.stringify(result);
}

async function execCheckRankings(args: { keyword_id?: string }): Promise<string> {
  if (args.keyword_id && args.keyword_id !== "all") {
    const kw = await db.select().from(seoKeywords).where(eq(seoKeywords.id, args.keyword_id));
    if (!kw.length) return JSON.stringify({ error: "Keyword not found" });
    const { position, url } = await checkKeywordRanking(kw[0].keyword, kw[0].domain);
    if (position !== null) {
      await db.insert(seoKeywordRankings).values({ keywordId: kw[0].id, position, url });
    }
    return JSON.stringify({ keyword: kw[0].keyword, position, url });
  }
  // Check all
  const summary = await runRankingsCheck();
  return JSON.stringify({ summary });
}

async function execResearchKeywords(args: { topic: string }): Promise<string> {
  const result = await researchKeyword(args.topic);
  return JSON.stringify(result);
}

async function execAddKeyword(args: { keyword: string; target_url?: string }): Promise<string> {
  const [kw] = await db.insert(seoKeywords).values({
    keyword: args.keyword,
    targetUrl: args.target_url || null,
    domain: "newdawnfranchising.com",
  }).returning();
  return JSON.stringify({ success: true, id: kw.id, keyword: kw.keyword });
}

async function execGenerateContent(args: {
  keyword: string;
  secondary_keywords?: string;
  word_count?: number;
  tone?: string;
}): Promise<string> {
  const result = await generateSeoContent({
    keyword: args.keyword,
    secondaryKeywords: args.secondary_keywords,
    wordCount: args.word_count || 1000,
    tone: args.tone || "informational",
  });
  await db.insert(seoGeneratedContent).values({
    keyword: args.keyword,
    title: result.title,
    metaDescription: result.metaDescription,
    body: result.body,
    wordCount: result.wordCount,
  });
  return JSON.stringify({ success: true, title: result.title, metaDescription: result.metaDescription, wordCount: result.wordCount, bodyPreview: result.body.slice(0, 300) + "..." });
}

async function execGetBacklinks(): Promise<string> {
  const backlinks = await db.select().from(seoBacklinkOutreach).orderBy(desc(seoBacklinkOutreach.createdAt));
  return JSON.stringify(backlinks.map(b => ({
    id: b.id,
    targetSite: b.targetSite,
    targetUrl: b.targetUrl,
    contactEmail: b.contactEmail,
    status: b.status,
    notes: b.notes,
    createdAt: b.createdAt,
  })));
}

async function execFindBacklinkEmail(args: { domain: string; name?: string }): Promise<string> {
  try {
    const email = await hunterFindEmail(args.domain, args.name || "", "");
    return JSON.stringify({ domain: args.domain, email: email || null, found: !!email });
  } catch (e: any) {
    return JSON.stringify({ domain: args.domain, email: null, found: false, error: e.message });
  }
}

async function execUpdateBacklinkStatus(args: { id: string; status: string; notes?: string }): Promise<string> {
  await db.update(seoBacklinkOutreach)
    .set({ status: args.status as any, notes: args.notes || undefined })
    .where(eq(seoBacklinkOutreach.id, args.id));
  return JSON.stringify({ success: true, id: args.id, status: args.status });
}

async function execGetContentHistory(): Promise<string> {
  const content = await db.select().from(seoGeneratedContent).orderBy(desc(seoGeneratedContent.createdAt)).limit(20);
  return JSON.stringify(content.map(c => ({
    id: c.id,
    keyword: c.keyword,
    title: c.title,
    metaDescription: c.metaDescription,
    wordCount: c.wordCount,
    createdAt: c.createdAt,
  })));
}

async function execRunSeoScore(): Promise<string> {
  const { score, breakdown } = await calculateSeoScore();
  return JSON.stringify({ score, breakdown });
}

// ─── Website Analyzer ────────────────────────────────────────────────────────

const SITE_PAGES = [
  { path: "/", label: "Homepage" },
  { path: "/franchise", label: "Franchise Opportunity" },
  { path: "/territories", label: "Territories" },
  { path: "/about", label: "About" },
  { path: "/contact", label: "Contact" },
  { path: "/blog", label: "Blog" },
  { path: "/e2-visa", label: "E-2 Visa Info" },
];

async function fetchPageContent(url: string): Promise<{ title: string; h1: string; h2s: string[]; text: string; metaDesc: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { title: "", h1: "", h2s: [], text: "", metaDesc: "" };
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";

    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const metaDesc = metaMatch?.[1]?.trim() || "";

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match?.[1]?.replace(/<[^>]+>/g, "").trim() || "";

    const h2Matches = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)];
    const h2s = h2Matches.map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 6);

    // Extract text content — strip scripts, styles, tags
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch?.[1] || html;
    const text = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);

    return { title, h1, h2s, text, metaDesc };
  } catch {
    return { title: "", h1: "", h2s: [], text: "", metaDesc: "" };
  }
}

async function execAnalyzeWebsite(): Promise<string> {
  const baseUrl = "https://newdawnfranchising.com";
  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

  // Crawl all key pages in parallel
  const pageResults = await Promise.all(
    SITE_PAGES.map(async (p) => {
      const content = await fetchPageContent(`${baseUrl}${p.path}`);
      return { ...p, ...content };
    })
  );

  const successfulPages = pageResults.filter(p => p.title || p.h1 || p.text);

  // Build a structured summary for OpenAI
  const pageSummary = successfulPages.map(p => `
### ${p.label} (${p.path})
- **Title tag:** ${p.title || "MISSING"}
- **Meta description:** ${p.metaDesc || "MISSING"}
- **H1:** ${p.h1 || "MISSING"}
- **H2 headings:** ${p.h2s.length ? p.h2s.join(" | ") : "None found"}
- **Content excerpt:** ${p.text.slice(0, 400)}`).join("\n");

  // Get currently tracked keywords
  const trackedKeywords = await db.select().from(seoKeywords);

  const prompt = `You are an expert SEO auditor. I've crawled the following pages of newdawnfranchising.com — a property management franchise for E-2 visa investors in Texas. Here is what each page contains:

${pageSummary}

Currently tracked keywords: ${trackedKeywords.map(k => k.keyword).join(", ") || "None yet"}

Please provide a thorough SEO website analysis covering:

## 1. On-Page SEO Audit
For each page, flag any missing or weak: title tags, meta descriptions, H1s, H2 structure.

## 2. Keyword Opportunities Found
Based on the actual content, list 10 specific keywords this site should be targeting but isn't. Format each as:
- **Keyword** | Why it fits | Suggested page to target it on

## 3. Content Gaps
What pages or topics are completely missing that competitors likely have?

## 4. Quick Wins (do this week)
3 specific, immediate fixes that will have the biggest SEO impact.

## 5. Priority Keywords to Add to Tracker
List exactly 8 keywords (with target URLs) ready to copy into the tracker, in order of priority.

Be specific and reference the actual page content you saw. Don't give generic advice.`;

  const res = await fetch(`${openaiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2500, temperature: 0.4 }),
  });

  if (!res.ok) throw new Error("OpenAI error during website analysis");
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const analysis = data.choices?.[0]?.message?.content?.trim() || "Analysis failed";

  const crawledSummary = `Pages crawled: ${successfulPages.length}/${SITE_PAGES.length} (${successfulPages.map(p => p.label).join(", ")})`;

  return JSON.stringify({
    pagesAnalyzed: successfulPages.length,
    crawledSummary,
    analysis,
  });
}

// ─── Best Keyword Finder ──────────────────────────────────────────────────────

async function execFindBestKeywords(): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

  // Seed topics covering the full niche
  const seedTopics = [
    "E-2 visa franchise opportunity",
    "property management franchise Texas",
    "franchise for foreign investors USA",
    "E-2 visa business investment",
    "property management El Paso Texas",
    "buy a franchise with visa",
  ];

  const allKeywords = new Set<string>();
  const relatedSearches: string[] = [];
  const peopleAlsoAsk: string[] = [];

  for (const topic of seedTopics.slice(0, 4)) {
    try {
      const params = new URLSearchParams({
        engine: "google",
        q: topic,
        api_key: apiKey || "",
        gl: "us",
        hl: "en",
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) continue;
      const data = await res.json() as {
        related_searches?: { query: string }[];
        related_questions?: { question: string }[];
      };
      (data.related_searches || []).forEach(r => {
        allKeywords.add(r.query.toLowerCase());
        relatedSearches.push(r.query);
      });
      (data.related_questions || []).forEach(q => {
        allKeywords.add(q.question.toLowerCase());
        peopleAlsoAsk.push(q.question);
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch { /* continue */ }
  }

  // Get keywords we're already tracking
  const trackedKeywords = await db.select().from(seoKeywords);
  const trackedSet = new Set(trackedKeywords.map(k => k.keyword.toLowerCase()));

  const uniqueKeywords = [...allKeywords].filter(k => !trackedSet.has(k));

  const prompt = `You are an SEO specialist for New Dawn Franchising LLC — a property management franchise opportunity for E-2 visa investors in Texas (El Paso / West Texas). 

The business helps foreign nationals (mostly from Mexico, Middle East, Asia) get their E-2 investor visa through a proven franchise model. Services include: resident placement, maintenance coordination, property management.

I ran keyword research and found these related searches and questions from Google:

**Related searches found:**
${relatedSearches.slice(0, 30).map((k, i) => `${i + 1}. ${k}`).join("\n")}

**People Also Ask:**
${peopleAlsoAsk.slice(0, 20).map((k, i) => `${i + 1}. ${k}`).join("\n")}

**Already tracking:** ${trackedKeywords.map(k => k.keyword).join(", ") || "None yet"}

Based on all of this, identify the **top 15 best keywords** for this business to target. For each keyword provide:
- The exact keyword phrase
- Estimated intent (commercial/informational/navigational)
- Recommended target page (e.g., /franchise, /e2-visa, new blog post)
- Why it's a high-value opportunity
- Priority score (1-10)

Focus on: high purchase intent, realistic ranking difficulty for a newer site, tight niche match (E-2 visa + franchise + Texas).

Format as a numbered list. After the list, give 3 "content cluster" ideas that could earn multiple rankings at once.`;

  const res = await fetch(`${openaiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2000, temperature: 0.4 }),
  });

  if (!res.ok) throw new Error("OpenAI error during keyword research");
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const recommendations = data.choices?.[0]?.message?.content?.trim() || "";

  return JSON.stringify({
    seedTopicsSearched: seedTopics.length,
    rawKeywordsFound: allKeywords.size,
    newOpportunities: uniqueKeywords.length,
    recommendations,
  });
}

async function execCompetitorAnalysis(): Promise<string> {
  try {
    const analysis = await runCompetitorAnalysis();
    // Also save to task log
    await db.insert(seoAgentTasks).values({
      taskType: "competitor_spy",
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      resultSummary: analysis,
    });
    return JSON.stringify({ success: true, analysis });
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// ─── CTR Curve (industry standard averages) ───────────────────────────────────

const CTR_CURVE: Record<number, number> = {
  1: 0.317, 2: 0.247, 3: 0.187, 4: 0.136, 5: 0.099,
  6: 0.082, 7: 0.064, 8: 0.051, 9: 0.040, 10: 0.031,
};

function estimateCtr(position: number | null): number {
  if (!position) return 0.005;
  if (position <= 10) return CTR_CURVE[position] || 0.031;
  if (position <= 20) return 0.012;
  return 0.005;
}

// Heuristic volume estimation from SERP signals
function estimateSearchVolume(keyword: string, totalResults: number, hasAds: boolean): number {
  const words = keyword.split(" ").length;
  let base = words <= 2 ? 5000 : words <= 3 ? 1200 : words <= 4 ? 400 : 120;
  if (hasAds) base *= 1.8;
  if (keyword.toLowerCase().includes("e-2") || keyword.toLowerCase().includes("e2 visa")) base *= 0.7;
  return Math.round(base);
}

// ─── Rank Report ──────────────────────────────────────────────────────────────

async function execRankReport(): Promise<string> {
  const keywords = await db.select().from(seoKeywords);
  const allRankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));

  const latestRanking = new Map<string, { position: number | null; url: string | null; checkedAt: Date }>();
  const prevRanking = new Map<string, number | null>();

  for (const r of allRankings) {
    if (!latestRanking.has(r.keywordId)) {
      latestRanking.set(r.keywordId, { position: r.position, url: r.url, checkedAt: r.checkedAt! });
    } else if (!prevRanking.has(r.keywordId)) {
      prevRanking.set(r.keywordId, r.position);
    }
  }

  const rows = keywords.map(kw => {
    const latest = latestRanking.get(kw.id);
    const prev = prevRanking.get(kw.id);
    const position = latest?.position ?? null;
    const ctr = estimateCtr(position);
    const estVolume = estimateSearchVolume(kw.keyword, 1000000, false);
    const estMonthlyTraffic = position ? Math.round(estVolume * ctr) : 0;
    const positionChange = (position !== null && prev != null) ? (prev as number) - position : null; // positive = improved

    return {
      keyword: kw.keyword,
      targetUrl: kw.targetUrl,
      position,
      rankingUrl: latest?.url || null,
      lastChecked: latest?.checkedAt?.toISOString().slice(0, 10) || "never",
      estimatedMonthlyVolume: estVolume,
      estimatedMonthlyTraffic: estMonthlyTraffic,
      ctr: position ? `${(ctr * 100).toFixed(1)}%` : "not ranking",
      positionChange, // null=first check, positive=improved, negative=dropped
      status: !position ? "not_ranking" : position <= 3 ? "top3" : position <= 10 ? "page1" : position <= 20 ? "page2" : "buried",
    };
  });

  const totalEstTraffic = rows.reduce((a, r) => a + r.estimatedMonthlyTraffic, 0);
  const notRanking = rows.filter(r => !r.position).length;
  const improved = rows.filter(r => (r.positionChange || 0) > 0).length;
  const dropped = rows.filter(r => (r.positionChange || 0) < 0).length;

  return JSON.stringify({
    summary: { totalKeywords: rows.length, totalEstMonthlyTraffic: totalEstTraffic, notRanking, improved, dropped },
    keywords: rows,
  });
}

// ─── Keyword Traffic Estimator ────────────────────────────────────────────────

async function execKeywordTraffic(args: { keyword: string }): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  let totalResults = 10000000;
  let hasAds = false;

  if (apiKey) {
    try {
      const params = new URLSearchParams({ engine: "google", q: args.keyword, api_key: apiKey, num: "10", gl: "us" });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (res.ok) {
        const data = await res.json() as {
          search_information?: { total_results?: number };
          ads?: unknown[];
          organic_results?: { link?: string; position?: number }[];
        };
        totalResults = data.search_information?.total_results || 10000000;
        hasAds = !!(data.ads?.length);
      }
    } catch { /* use defaults */ }
  }

  // Check if we currently rank
  const kw = await db.select().from(seoKeywords);
  const matchedKw = kw.find(k => k.keyword.toLowerCase() === args.keyword.toLowerCase());
  let currentPosition: number | null = null;
  let rankingUrl: string | null = null;

  if (matchedKw) {
    const ranking = await db.select().from(seoKeywordRankings)
      .where(eq(seoKeywordRankings.keywordId, matchedKw.id))
      .orderBy(desc(seoKeywordRankings.checkedAt))
      .limit(1);
    currentPosition = ranking[0]?.position || null;
    rankingUrl = ranking[0]?.url || null;
  }

  const estVolume = estimateSearchVolume(args.keyword, totalResults, hasAds);

  const projections = [1, 3, 5, 10].map(pos => ({
    position: pos,
    ctr: `${(estimateCtr(pos) * 100).toFixed(1)}%`,
    estimatedMonthlyVisitors: Math.round(estVolume * estimateCtr(pos)),
    estimatedAnnualVisitors: Math.round(estVolume * estimateCtr(pos) * 12),
  }));

  return JSON.stringify({
    keyword: args.keyword,
    currentPosition,
    rankingUrl,
    estimatedSearchVolume: estVolume,
    totalResults,
    hasAds,
    intentSignal: hasAds ? "commercial" : "informational",
    currentMonthlyTraffic: currentPosition ? Math.round(estVolume * estimateCtr(currentPosition)) : 0,
    trafficProjections: projections,
    note: "Search volume is estimated using SERP competition data. Actual volume may vary.",
  });
}

// ─── Keyword Difficulty ───────────────────────────────────────────────────────

async function execKeywordDifficulty(args: { keyword: string }): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return JSON.stringify({ error: "SERPAPI_KEY not configured" });

  const params = new URLSearchParams({ engine: "google", q: args.keyword, api_key: apiKey, num: "10", gl: "us" });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) return JSON.stringify({ error: "SerpAPI request failed" });

  const data = await res.json() as {
    ads?: unknown[];
    organic_results?: { link?: string; title?: string; position?: number; snippet?: string }[];
    featured_snippet?: { title?: string; snippet?: string; link?: string };
  };

  const organic = data.organic_results || [];
  const topDomains = organic.slice(0, 10).map(r => {
    let domain = "";
    try { domain = new URL(r.link || "").hostname.replace(/^www\./, ""); } catch { /* */ }
    const isAuthority = /wikipedia|forbes|entrepreneur|nolo|uscis\.gov|dol\.gov|sba\.gov|investopedia|nytimes|wsj/.test(domain);
    const isMedium = /franchise|visa|immigration|attorney|lawyer/.test(domain);
    return { domain, position: r.position, isAuthority, isMedium };
  });

  const authorityCount = topDomains.filter(d => d.isAuthority).length;
  const hasFeaturedSnippet = !!data.featured_snippet;
  const hasAds = !!(data.ads?.length);

  // Difficulty scoring
  let difficultyScore = 30; // base
  difficultyScore += authorityCount * 8;
  if (hasFeaturedSnippet) difficultyScore += 10;
  if (hasAds) difficultyScore += 12;
  if (args.keyword.split(" ").length <= 2) difficultyScore += 15;
  if (args.keyword.split(" ").length >= 5) difficultyScore -= 10;
  difficultyScore = Math.min(95, Math.max(10, difficultyScore));

  const difficultyLabel = difficultyScore <= 30 ? "Easy" : difficultyScore <= 50 ? "Medium" : difficultyScore <= 70 ? "Hard" : "Very Hard";
  const timeToRank = difficultyScore <= 30 ? "1-3 months" : difficultyScore <= 50 ? "3-6 months" : difficultyScore <= 70 ? "6-12 months" : "12-24+ months";

  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

  const aiRes = await fetch(`${openaiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `For the keyword "${args.keyword}", the top 10 Google results are from: ${topDomains.map(d => d.domain).join(", ")}. Difficulty score: ${difficultyScore}/100 (${difficultyLabel}). In 2-3 sentences, give a realistic assessment of New Dawn Franchising's chance to rank for this keyword, and one specific tactic to break in. Be direct and honest.` }],
      max_tokens: 150,
    }),
  });
  const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
  const aiAssessment = aiData.choices?.[0]?.message?.content?.trim() || "";

  return JSON.stringify({
    keyword: args.keyword,
    difficultyScore,
    difficultyLabel,
    timeToRank,
    hasFeaturedSnippet,
    hasAds,
    top10Domains: topDomains.map(d => d.domain),
    authorityDomainsInTop10: authorityCount,
    aiAssessment,
  });
}

// ─── Long-tail Keyword Finder ─────────────────────────────────────────────────

async function execLongTailKeywords(args: { seed: string }): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  const longTails = new Map<string, { source: string }>();

  if (apiKey) {
    // Method 1: Autocomplete
    try {
      const acParams = new URLSearchParams({ engine: "google_autocomplete", q: args.seed, api_key: apiKey, gl: "us" });
      const acRes = await fetch(`https://serpapi.com/search.json?${acParams}`);
      if (acRes.ok) {
        const acData = await acRes.json() as { suggestions?: { value: string }[] };
        (acData.suggestions || []).forEach(s => longTails.set(s.value.toLowerCase(), { source: "autocomplete" }));
      }
    } catch { /* */ }

    // Method 2: Regular SERP for related + PAA
    await new Promise(r => setTimeout(r, 800));
    try {
      const serpParams = new URLSearchParams({ engine: "google", q: args.seed, api_key: apiKey, num: "10", gl: "us" });
      const serpRes = await fetch(`https://serpapi.com/search.json?${serpParams}`);
      if (serpRes.ok) {
        const serpData = await serpRes.json() as {
          related_searches?: { query: string }[];
          related_questions?: { question: string }[];
        };
        (serpData.related_searches || []).forEach(r => longTails.set(r.query.toLowerCase(), { source: "related_searches" }));
        (serpData.related_questions || []).forEach(q => longTails.set(q.question.toLowerCase(), { source: "people_also_ask" }));
      }
    } catch { /* */ }

    // Method 3: "for" and "near" modifier searches
    await new Promise(r => setTimeout(r, 800));
    try {
      const modifiedQuery = `${args.seed} for`;
      const modParams = new URLSearchParams({ engine: "google_autocomplete", q: modifiedQuery, api_key: apiKey, gl: "us" });
      const modRes = await fetch(`https://serpapi.com/search.json?${modParams}`);
      if (modRes.ok) {
        const modData = await modRes.json() as { suggestions?: { value: string }[] };
        (modData.suggestions || []).forEach(s => longTails.set(s.value.toLowerCase(), { source: "modifier_autocomplete" }));
      }
    } catch { /* */ }
  }

  const tracked = await db.select().from(seoKeywords);
  const trackedSet = new Set(tracked.map(k => k.keyword.toLowerCase()));

  const results = [...longTails.entries()]
    .filter(([kw]) => kw !== args.seed.toLowerCase() && kw.length > 5)
    .map(([kw, meta]) => ({
      keyword: kw,
      wordCount: kw.split(" ").length,
      source: meta.source,
      alreadyTracking: trackedSet.has(kw),
      estimatedDifficulty: kw.split(" ").length >= 4 ? "Easy" : kw.split(" ").length === 3 ? "Medium" : "Hard",
      estimatedVolume: estimateSearchVolume(kw, 1000000, false),
    }))
    .sort((a, b) => b.wordCount - a.wordCount); // longer = more specific = easier

  return JSON.stringify({
    seed: args.seed,
    totalFound: results.length,
    newOpportunities: results.filter(r => !r.alreadyTracking).length,
    keywords: results.slice(0, 25),
  });
}

// ─── SERP Features Checker ────────────────────────────────────────────────────

async function execSerpFeatures(args: { keyword: string }): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return JSON.stringify({ error: "SERPAPI_KEY not configured" });

  const params = new URLSearchParams({ engine: "google", q: args.keyword, api_key: apiKey, num: "10", gl: "us", hl: "en" });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) return JSON.stringify({ error: "SerpAPI request failed" });

  const data = await res.json() as {
    ads?: { title?: string; link?: string }[];
    organic_results?: { link?: string; title?: string; position?: number }[];
    featured_snippet?: { title?: string; snippet?: string; link?: string; type?: string };
    related_questions?: { question: string; snippet?: string; link?: string }[];
    local_results?: { title?: string }[];
    knowledge_graph?: { title?: string; type?: string };
    shopping_results?: unknown[];
    inline_videos?: unknown[];
    inline_images?: unknown[];
    top_stories?: unknown[];
  };

  const hasFeaturedSnippet = !!data.featured_snippet;
  const snippetHolder = data.featured_snippet?.link ? (() => { try { return new URL(data.featured_snippet!.link!).hostname.replace(/^www\./, ""); } catch { return data.featured_snippet?.link; } })() : null;
  const isOurSnippet = snippetHolder?.includes("newdawnfranchising") || false;

  return JSON.stringify({
    keyword: args.keyword,
    features: {
      featuredSnippet: hasFeaturedSnippet ? {
        hasIt: true,
        currentHolder: snippetHolder,
        isOurs: isOurSnippet,
        snippetType: data.featured_snippet?.type || "paragraph",
        opportunity: !isOurSnippet ? "We can win this — answer the question better than the current holder" : "We own this! Maintain it.",
      } : { hasIt: false, opportunity: "No featured snippet yet — first to answer wins position 0" },
      peopleAlsoAsk: {
        hasIt: !!(data.related_questions?.length),
        count: data.related_questions?.length || 0,
        questions: (data.related_questions || []).slice(0, 5).map(q => q.question),
      },
      localPack: {
        hasIt: !!(data.local_results?.length),
        businesses: (data.local_results || []).slice(0, 3).map(l => l.title),
      },
      paidAds: {
        hasIt: !!(data.ads?.length),
        count: data.ads?.length || 0,
        signal: data.ads?.length ? "Commercial intent — high value keyword" : "Low commercial intent",
      },
      knowledgeGraph: { hasIt: !!data.knowledge_graph, entity: data.knowledge_graph?.title },
      shoppingResults: { hasIt: !!(data.shopping_results?.length) },
      videoResults: { hasIt: !!(data.inline_videos?.length) },
      topStories: { hasIt: !!(data.top_stories?.length) },
    },
    actionableInsights: [
      hasFeaturedSnippet && !isOurSnippet ? `🎯 Featured snippet is owned by ${snippetHolder}. Create a page that directly answers: "${args.keyword}" in 40-60 words with a header tag.` : null,
      data.related_questions?.length ? `❓ ${data.related_questions.length} "People Also Ask" questions detected. Answer each on your page for multiple SERP appearances.` : null,
      data.local_results?.length ? `📍 Local pack active — ensure your Google Business Profile is optimized for this search.` : null,
      data.ads?.length ? `💰 ${data.ads.length} ads running — this is a high-value commercial keyword. Target it.` : null,
    ].filter(Boolean),
  });
}

// ─── Featured Snippet Opportunities ──────────────────────────────────────────

async function execFeaturedSnippetOpportunities(): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return JSON.stringify({ error: "SERPAPI_KEY not configured" });

  const keywords = await db.select().from(seoKeywords).limit(15);
  if (!keywords.length) return JSON.stringify({ error: "No keywords tracked yet. Add keywords first." });

  const opportunities: {
    keyword: string;
    hasFeaturedSnippet: boolean;
    currentHolder: string | null;
    snippetType: string;
    ourPosition: number | null;
    opportunity: string;
    howToWin: string;
  }[] = [];

  for (const kw of keywords.slice(0, 10)) {
    try {
      const params = new URLSearchParams({ engine: "google", q: kw.keyword, api_key: apiKey, num: "10", gl: "us" });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) continue;
      const data = await res.json() as {
        featured_snippet?: { link?: string; type?: string };
        organic_results?: { link?: string; position?: number }[];
      };

      const hasFeaturedSnippet = !!data.featured_snippet;
      let currentHolder: string | null = null;
      if (data.featured_snippet?.link) {
        try { currentHolder = new URL(data.featured_snippet.link).hostname.replace(/^www\./, ""); } catch { /* */ }
      }

      const ourResult = (data.organic_results || []).find(r => r.link?.includes("newdawnfranchising"));
      const ourPosition = ourResult?.position || null;

      const opportunity = !hasFeaturedSnippet ? "Open — no snippet yet" :
        currentHolder?.includes("newdawnfranchising") ? "We own it!" : `Taken by ${currentHolder}`;

      const howToWin = !hasFeaturedSnippet ?
        `Write a direct 50-word answer to "${kw.keyword}" in an H2 section` :
        !currentHolder?.includes("newdawnfranchising") ?
          "Create a more structured answer — use definition format (paragraph) or numbered list, 40-60 words" :
          "Maintain current content quality and freshness";

      opportunities.push({
        keyword: kw.keyword,
        hasFeaturedSnippet,
        currentHolder,
        snippetType: data.featured_snippet?.type || "none",
        ourPosition,
        opportunity,
        howToWin,
      });

      await new Promise(r => setTimeout(r, 1000));
    } catch { /* skip */ }
  }

  const open = opportunities.filter(o => !o.hasFeaturedSnippet).length;
  const ours = opportunities.filter(o => o.currentHolder?.includes("newdawnfranchising")).length;
  const stolen = opportunities.filter(o => o.hasFeaturedSnippet && !o.currentHolder?.includes("newdawnfranchising")).length;

  return JSON.stringify({
    summary: { checked: opportunities.length, openOpportunities: open, weOwn: ours, canSteal: stolen },
    opportunities,
  });
}

// ─── Page Coverage Report ─────────────────────────────────────────────────────

async function execPageCoverage(): Promise<string> {
  const keywords = await db.select().from(seoKeywords);
  const allRankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));

  const latestRanking = new Map<string, { position: number | null; url: string | null }>();
  for (const r of allRankings) {
    if (!latestRanking.has(r.keywordId)) {
      latestRanking.set(r.keywordId, { position: r.position, url: r.url });
    }
  }

  // Group keywords by ranking page
  const pageMap = new Map<string, { keywords: string[]; positions: (number | null)[] }>();
  let orphanKeywords: string[] = []; // keywords not pointing to any tracked URL

  for (const kw of keywords) {
    const ranking = latestRanking.get(kw.id);
    const rankUrl = ranking?.url;
    const targetUrl = kw.targetUrl;
    const pageKey = rankUrl || targetUrl || "unranked";

    if (!rankUrl && !targetUrl) {
      orphanKeywords.push(kw.keyword);
      continue;
    }

    const existing = pageMap.get(pageKey) || { keywords: [], positions: [] };
    existing.keywords.push(kw.keyword);
    existing.positions.push(ranking?.position || null);
    pageMap.set(pageKey, existing);
  }

  const pages = [...pageMap.entries()].map(([url, data]) => ({
    url,
    keywordCount: data.keywords.length,
    keywords: data.keywords,
    avgPosition: data.positions.filter(Boolean).length ?
      Math.round(data.positions.filter((p): p is number => p !== null).reduce((a, b) => a + b, 0) / data.positions.filter(Boolean).length) : null,
    rankingCount: data.positions.filter(p => p !== null).length,
    totalEstTraffic: data.positions.reduce<number>((total, pos, i) => {
      const vol = estimateSearchVolume(data.keywords[i], 1000000, false);
      return total + (pos ? Math.round(vol * estimateCtr(pos)) : 0);
    }, 0),
  })).sort((a, b) => (b.totalEstTraffic as number) - (a.totalEstTraffic as number));

  // Cannibalization: pages targeting same keyword
  const cannibalizationRisk = keywords
    .filter(kw => {
      const matchingPages = [...pageMap.entries()].filter(([, data]) => data.keywords.includes(kw.keyword));
      return matchingPages.length > 1;
    })
    .map(kw => kw.keyword);

  return JSON.stringify({
    summary: {
      totalPages: pages.length,
      totalKeywords: keywords.length,
      orphanKeywords: orphanKeywords.length,
      cannibalizationRisks: cannibalizationRisk.length,
    },
    pages,
    orphanKeywords,
    cannibalizationRisks: cannibalizationRisk,
  });
}

// ─── Schema Audit ─────────────────────────────────────────────────────────────

async function execSchemaAudit(): Promise<string> {
  const baseUrl = "https://newdawnfranchising.com";
  const pages = [
    { path: "/", label: "Homepage", recommendedSchema: ["LocalBusiness", "Organization", "FAQPage"] },
    { path: "/franchise", label: "Franchise Opportunity", recommendedSchema: ["Product", "FAQPage", "BreadcrumbList"] },
    { path: "/e2-visa", label: "E-2 Visa Info", recommendedSchema: ["FAQPage", "HowTo", "Article"] },
    { path: "/territories", label: "Territories", recommendedSchema: ["Place", "Service", "BreadcrumbList"] },
    { path: "/blog", label: "Blog Index", recommendedSchema: ["Blog", "BreadcrumbList"] },
  ];

  const results = await Promise.all(pages.map(async (p) => {
    try {
      const res = await fetch(`${baseUrl}${p.path}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SchemaBot/1.0)" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return { ...p, schemasFound: [], missing: p.recommendedSchema, error: null };
      const html = await res.text();

      // Find all JSON-LD blocks
      const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      const schemasFound: string[] = [];

      for (const match of jsonLdMatches) {
        try {
          const json = JSON.parse(match[1]);
          const types = Array.isArray(json) ? json.map((j: any) => j["@type"]) : [json["@type"]];
          types.forEach((t: string) => t && schemasFound.push(t));
        } catch { /* skip */ }
      }

      const missing = p.recommendedSchema.filter(r => !schemasFound.some(f => f.toLowerCase().includes(r.toLowerCase())));

      return { ...p, schemasFound, missing, error: null };
    } catch (e: any) {
      return { ...p, schemasFound: [], missing: p.recommendedSchema, error: e.message };
    }
  }));

  const totalMissing = results.reduce((a, r) => a + r.missing.length, 0);
  const openaiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

  // Generate the highest-priority schema implementation
  const priorityPage = results.find(r => r.missing.length > 0);
  let schemaExample = "";
  if (priorityPage?.missing[0]) {
    const exRes = await fetch(`${openaiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Write a complete, ready-to-paste JSON-LD schema for ${priorityPage.missing[0]} for this business: New Dawn Franchising LLC, property management franchise for E-2 visa investors in El Paso Texas, website: https://newdawnfranchising.com, phone: (915) 123-4567. Return only the <script type="application/ld+json">...</script> block.` }],
        max_tokens: 500,
      }),
    });
    if (exRes.ok) {
      const exData = await exRes.json() as { choices?: { message?: { content?: string } }[] };
      schemaExample = exData.choices?.[0]?.message?.content?.trim() || "";
    }
  }

  return JSON.stringify({
    summary: { pagesChecked: results.length, totalSchemasFound: results.reduce((a, r) => a + r.schemasFound.length, 0), totalMissing },
    pages: results.map(r => ({
      label: r.label,
      path: r.path,
      schemasFound: r.schemasFound,
      missing: r.missing,
      score: `${r.schemasFound.length}/${r.schemasFound.length + r.missing.length}`,
    })),
    topPriorityFix: priorityPage ? `Add ${priorityPage.missing[0]} schema to ${priorityPage.label}` : "All schemas present",
    schemaExample,
  });
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

async function dispatchTool(tool: string, args: Record<string, any> = {}): Promise<string> {
  switch (tool) {
    case "get_seo_overview": return await execGetOverview();
    case "get_keywords": return await execGetKeywords();
    case "check_rankings": return await execCheckRankings(args);
    case "research_keywords": return await execResearchKeywords(args as { topic: string });
    case "add_keyword": return await execAddKeyword(args as { keyword: string; target_url?: string });
    case "generate_content": return await execGenerateContent(args as any);
    case "get_backlinks": return await execGetBacklinks();
    case "find_backlink_email": return await execFindBacklinkEmail(args as { domain: string; name?: string });
    case "update_backlink_status": return await execUpdateBacklinkStatus(args as { id: string; status: string; notes?: string });
    case "get_content_history": return await execGetContentHistory();
    case "run_seo_score": return await execRunSeoScore();
    case "competitor_analysis": return await execCompetitorAnalysis();
    case "analyze_website": return await execAnalyzeWebsite();
    case "find_keywords":
    case "find_best_keywords": return await execFindBestKeywords();
    case "rank_report": return await execRankReport();
    case "keyword_traffic":
    case "estimate_traffic": return await execKeywordTraffic(args as { keyword: string });
    case "keyword_difficulty":
    case "difficulty": return await execKeywordDifficulty(args as { keyword: string });
    case "long_tail_keywords":
    case "long_tail": return await execLongTailKeywords(args as { seed: string });
    case "serp_features":
    case "serp_analysis": return await execSerpFeatures(args as { keyword: string });
    case "featured_snippet_opportunities":
    case "featured_snippets": return await execFeaturedSnippetOpportunities();
    case "page_coverage":
    case "page_report": return await execPageCoverage();
    case "schema_audit": return await execSchemaAudit();
    default: return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

// ─── Parse tool call from text ────────────────────────────────────────────────

function parseToolCall(text: string): { tool: string; args: Record<string, any> } | null {
  // Walk the text finding balanced JSON objects that contain "tool"
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 1;
    let j = i + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    if (depth !== 0) continue;
    const candidate = text.slice(i, j);
    if (!candidate.includes('"tool"')) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.tool === "string") {
        return { tool: parsed.tool, args: parsed.args || {} };
      }
    } catch { /* not valid JSON, keep scanning */ }
  }
  return null;
}

// ─── Streaming chat endpoint ──────────────────────────────────────────────────

router.post("/chat/stream", requireAdmin, async (req: any, res: any) => {
  const { messages = [] } = req.body as { messages: { role: string; content: string }[] };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const history: { role: string; content: string }[] = [
    { role: "system", content: SEO_SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const MAX_ROUNDS = 5;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Non-streaming call to detect tool use
      const decisionRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY()}` },
        body: JSON.stringify({ model: "gpt-4o", messages: history, max_tokens: 2000, temperature: 0.5 }),
      });
      if (!decisionRes.ok) throw new Error(`OpenAI error: ${decisionRes.statusText}`);
      const decisionData = await decisionRes.json() as { choices?: { message?: { content?: string } }[] };
      const assistantText = decisionData.choices?.[0]?.message?.content || "";

      const toolCall = parseToolCall(assistantText);
      if (toolCall) {
        // Let the UI know a tool is running
        send({ type: "tool_start", tool: toolCall.tool, args: toolCall.args });

        let result: string;
        try {
          result = await dispatchTool(toolCall.tool, toolCall.args);
        } catch (e: any) {
          result = JSON.stringify({ error: e.message });
        }

        send({ type: "tool_end", tool: toolCall.tool, result: result.slice(0, 500) });

        // Append tool exchange to history and loop
        history.push({ role: "assistant", content: assistantText });
        history.push({ role: "user", content: `[Tool result for ${toolCall.tool}]: ${result}` });
        continue;
      }

      // No tool call — stream the final response
      const streamRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY()}` },
        body: JSON.stringify({ model: "gpt-4o", messages: history, max_tokens: 2000, temperature: 0.7, stream: true }),
      });
      if (!streamRes.ok) throw new Error(`Stream error: ${streamRes.statusText}`);

      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream body");

      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw) as { choices?: { delta?: { content?: string } }[] };
            const token = parsed.choices?.[0]?.delta?.content || "";
            if (token) {
              fullResponse += token;
              send({ type: "token", content: token });
            }
          } catch { /* skip malformed */ }
        }
      }

      send({ type: "done" });
      res.end();
      return;
    }
    send({ type: "done" });
    res.end();
  } catch (e: any) {
    send({ type: "error", message: e.message });
    res.end();
  }
});

export default router;
