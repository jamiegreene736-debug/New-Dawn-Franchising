import { db } from "./db";
import { seoKeywords, seoKeywordRankings, seoGeneratedContent, seoAgentTasks, seoBacklinkOutreach, agentSettings } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { sendEmailFromSender } from "./email-service";

const DOMAIN = "newdawnfranchising.com";

// ─── SerpAPI keyword ranking check ──────────────────────────────────────────

export async function checkKeywordRanking(keyword: string, domain = DOMAIN): Promise<{ position: number | null; url: string | null }> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return { position: null, url: null };
  try {
    const params = new URLSearchParams({
      engine: "google",
      q: keyword,
      api_key: apiKey,
      num: "100",
      gl: "us",
      hl: "en",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return { position: null, url: null };
    const data = await res.json() as { organic_results?: { link?: string; position?: number }[] };
    const results = data.organic_results || [];
    for (const r of results) {
      if (r.link && r.link.includes(domain)) {
        return { position: r.position ?? null, url: r.link };
      }
    }
    return { position: null, url: null };
  } catch {
    return { position: null, url: null };
  }
}

// ─── Keyword research via SerpAPI ──────────────────────────────────────────

export interface KeywordResearchResult {
  keyword: string;
  relatedSearches: string[];
  peopleAlsoAsk: string[];
}

export async function researchKeyword(keyword: string): Promise<KeywordResearchResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not configured");
  const params = new URLSearchParams({
    engine: "google",
    q: keyword,
    api_key: apiKey,
    gl: "us",
    hl: "en",
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error("SerpAPI request failed");
  const data = await res.json() as {
    related_searches?: { query: string }[];
    related_questions?: { question: string }[];
  };
  return {
    keyword,
    relatedSearches: (data.related_searches || []).map((r) => r.query).slice(0, 10),
    peopleAlsoAsk: (data.related_questions || []).map((q) => q.question).slice(0, 8),
  };
}

// ─── OpenAI helpers (re-uses existing AI_INTEGRATIONS env vars) ─────────────

async function callOpenAI(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) throw new Error("OpenAI not configured");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.statusText}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ─── AI Content Generation ──────────────────────────────────────────────────

export interface ContentGenerationInput {
  keyword: string;
  secondaryKeywords?: string;
  tone?: string;
  wordCount?: number;
}

export async function generateSeoContent(input: ContentGenerationInput): Promise<{
  title: string;
  metaDescription: string;
  body: string;
  wordCount: number;
}> {
  const { keyword, secondaryKeywords = "", tone = "informational", wordCount = 1000 } = input;
  const prompt = `Write a complete, SEO-optimized blog article for the keyword "${keyword}".
${secondaryKeywords ? `Secondary keywords to include naturally: ${secondaryKeywords}` : ""}
Tone: ${tone}
Target word count: approximately ${wordCount} words.
This article is for New Dawn Franchising — a property management franchise opportunity for E-2 visa investors in Texas.

Format your response as JSON with these exact keys:
{
  "title": "H1 title tag (keyword-optimized, under 60 chars)",
  "metaDescription": "Meta description under 155 characters",
  "body": "Full article body in Markdown format with H2/H3 subheadings, bullet points where appropriate, and an FAQ section at the end"
}

Return ONLY valid JSON, no preamble.`;

  const raw = await callOpenAI(prompt, 3000);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { title: string; metaDescription: string; body: string };
  const wc = parsed.body.split(/\s+/).length;
  return { ...parsed, wordCount: wc };
}

// ─── Meta tag optimizer ─────────────────────────────────────────────────────

export async function generateMetaTags(url: string): Promise<{ title: string; metaDescription: string; suggestions: string[] }> {
  const prompt = `I need optimized meta tags for this URL: ${url}
This is for the New Dawn Franchising website (property management franchise, E-2 visa investors, Texas).

Return JSON:
{
  "title": "Optimized title tag under 60 chars",
  "metaDescription": "Optimized meta description under 155 chars",
  "suggestions": ["3 alternative title suggestions"]
}`;
  const raw = await callOpenAI(prompt, 600);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

// ─── SEO Score calculator ───────────────────────────────────────────────────

export async function calculateSeoScore(): Promise<{
  score: number;
  breakdown: { label: string; score: number; max: number; note: string }[];
}> {
  const keywords = await db.select().from(seoKeywords);
  const rankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));
  const latestRankings = new Map<string, number>();
  for (const r of rankings) {
    if (!latestRankings.has(r.keywordId) && r.position) {
      latestRankings.set(r.keywordId, r.position);
    }
  }

  const positions = [...latestRankings.values()].filter(Boolean);
  const avgPos = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : 50;
  const top10Count = positions.filter(p => p <= 10).length;
  const top3Count = positions.filter(p => p <= 3).length;

  const rankScore = Math.max(0, Math.round(30 - (avgPos - 1) * 0.5));
  const coverageScore = Math.min(20, keywords.length * 2);
  const top3Score = Math.min(20, top3Count * 5);
  const top10Score = Math.min(15, top10Count * 2);
  const contentScore = 15;

  const total = rankScore + coverageScore + top3Score + top10Score + contentScore;

  return {
    score: Math.min(100, total),
    breakdown: [
      { label: "Average Ranking Position", score: rankScore, max: 30, note: `Avg: #${Math.round(avgPos)}` },
      { label: "Keyword Coverage", score: coverageScore, max: 20, note: `${keywords.length} keywords tracked` },
      { label: "Top 3 Rankings", score: top3Score, max: 20, note: `${top3Count} keywords in top 3` },
      { label: "Top 10 Rankings", score: top10Score, max: 15, note: `${top10Count} keywords on page 1` },
      { label: "Content Published", score: contentScore, max: 15, note: "Blog content active" },
    ],
  };
}

// ─── AI Agent task runners ───────────────────────────────────────────────────

async function logTask(taskType: string, status: string, summary?: string, error?: string) {
  await db.insert(seoAgentTasks).values({
    taskType,
    status,
    startedAt: new Date(),
    completedAt: status !== "running" ? new Date() : undefined,
    resultSummary: summary,
    errorMessage: error,
  });
}

export async function runRankingsCheck(): Promise<string> {
  const keywords = await db.select().from(seoKeywords);
  if (!keywords.length) return "No keywords to check";
  let checked = 0, found = 0;
  for (const kw of keywords) {
    const { position, url } = await checkKeywordRanking(kw.keyword, kw.domain);
    await db.insert(seoKeywordRankings).values({ keywordId: kw.id, position, url });
    checked++;
    if (position) found++;
    await new Promise(r => setTimeout(r, 1500));
  }
  return `Checked ${checked} keywords. Found rankings for ${found}. ${checked - found} not in top 100.`;
}

export async function runContentIdeasTask(): Promise<string> {
  const prompt = `Generate 5 high-value SEO blog post ideas for a property management franchise targeting E-2 visa investors in Texas. Each idea should target a specific long-tail keyword. Return as JSON array of objects with "keyword" and "title".`;
  const raw = await callOpenAI(prompt, 600);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const ideas = JSON.parse(cleaned) as { keyword: string; title: string }[];
  return `Generated ${ideas.length} content ideas: ${ideas.map(i => `"${i.title}"`).join(", ")}`;
}

export async function runSeoScoreTask(): Promise<string> {
  const { score, breakdown } = await calculateSeoScore();
  return `Daily SEO score: ${score}/100. ${breakdown.map(b => `${b.label}: ${b.score}/${b.max}`).join(" | ")}`;
}

// ─── Competitor Analysis ─────────────────────────────────────────────────────

export async function runCompetitorAnalysis(): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  const competitorTerms = [
    "E-2 visa franchise opportunity",
    "franchise for E-2 visa investors Texas",
    "buy franchise with E-2 visa USA",
  ];

  const competitorMap = new Map<string, { titles: string[]; positions: number[] }>();

  for (const term of competitorTerms) {
    try {
      const params = new URLSearchParams({ engine: "google", q: term, api_key: apiKey || "", num: "10", gl: "us", hl: "en" });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) continue;
      const data = await res.json() as { organic_results?: { link?: string; title?: string; position?: number }[] };
      for (const r of (data.organic_results || []).slice(0, 8)) {
        if (!r.link) continue;
        try {
          const domain = new URL(r.link).hostname.replace(/^www\./, "");
          if (domain.includes("newdawnfranchising")) continue;
          const existing = competitorMap.get(domain) || { titles: [], positions: [] };
          if (r.title && !existing.titles.includes(r.title)) existing.titles.push(r.title);
          if (r.position) existing.positions.push(r.position);
          competitorMap.set(domain, existing);
        } catch { /* invalid URL */ }
      }
      await new Promise(r => setTimeout(r, 1200));
    } catch { /* SerpAPI error — continue */ }
  }

  const topCompetitors = [...competitorMap.entries()]
    .sort((a, b) => Math.min(...a[1].positions) - Math.min(...b[1].positions))
    .slice(0, 6);

  const competitorList = topCompetitors.map(([domain, data]) =>
    `- ${domain} (best position: #${Math.min(...data.positions)}) — pages: "${data.titles.slice(0, 2).join('", "')}"`
  ).join("\n") || "- No competitors found (SerpAPI may not be configured)";

  const ownKeywords = await db.select().from(seoKeywords);

  const prompt = `You are an SEO strategist for New Dawn Franchising LLC — a property management franchise opportunity for E-2 visa investors in El Paso, Texas.

I ran a Google competitor analysis for the following search terms:
- "E-2 visa franchise opportunity"
- "franchise for E-2 visa investors Texas"
- "buy franchise with E-2 visa USA"

Top competitors found ranking in the results:
${competitorList}

Our currently tracked keywords: ${ownKeywords.map(k => k.keyword).join(", ") || "none set up yet"}

Based on this competitor landscape, please provide a detailed competitor analysis with:
1. **Who our main competitors are** — brief description of each domain/company
2. **What content gaps exist** — what are they ranking for that we're not targeting?
3. **Keyword opportunities** — 5 specific keywords we should target that they rank for
4. **Content strategy recommendations** — 3 specific blog post or page ideas that would help us outrank them
5. **Quick wins** — 2-3 immediate actions we can take this week

Be specific, data-driven, and focused on the E-2 visa franchise niche.`;

  const analysis = await callOpenAI(prompt, 1500);
  return `## Competitor Analysis — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\n\n**Competitors identified:** ${topCompetitors.length > 0 ? topCompetitors.map(([d]) => d).join(", ") : "See analysis below"}\n\n${analysis}`;
}

export async function runAgentTask(taskType: string): Promise<{ status: string; summary: string }> {
  try {
    let summary = "";
    switch (taskType) {
      case "rankings_check":
        summary = await runRankingsCheck();
        break;
      case "content_ideas":
        summary = await runContentIdeasTask();
        break;
      case "seo_score":
        summary = await runSeoScoreTask();
        break;
      case "competitor_spy":
        summary = await runCompetitorAnalysis();
        break;
      default:
        summary = `Task "${taskType}" is not yet implemented.`;
    }
    return { status: "completed", summary };
  } catch (err: any) {
    return { status: "failed", summary: err?.message || "Unknown error" };
  }
}

// ─── Daily SEO Brief ─────────────────────────────────────────────────────────

export async function runSeoBrief(): Promise<boolean> {
  const FROM_EMAIL = "dylan@newdawnfranchising.com";

  // Get approval email from agent settings
  const settingsRows = await db.select().from(agentSettings).limit(1);
  const toEmail = settingsRows[0]?.approvalEmail || FROM_EMAIL;

  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // ── Gather SEO data ──
  const keywords = await db.select().from(seoKeywords).limit(20);
  const recentRankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt)).limit(10);
  const recentTasks = await db.select().from(seoAgentTasks).orderBy(desc(seoAgentTasks.createdAt)).limit(5);
  const backlinkPipeline = await db.select().from(seoBacklinkOutreach).limit(10);
  const recentContent = await db.select().from(seoGeneratedContent).orderBy(desc(seoGeneratedContent.createdAt)).limit(5);

  // ── Build keyword summary ──
  const trackedCount = keywords.length;
  const rankedCount = recentRankings.filter(r => r.position !== null).length;

  // ── AI-generated action items ──
  let aiActions = "";
  try {
    const kwList = keywords.map(k => k.keyword).slice(0, 10).join(", ") || "E-2 visa franchise, franchise investment USA, Texas franchise opportunities";
    const backlogSites = backlinkPipeline.filter(b => b.status === "identified").map(b => b.targetSite).slice(0, 3).join(", ");
    const contentQueue = recentContent.filter(c => c.status === "draft").map(c => c.keyword).slice(0, 3).join(", ");

    const prompt = `You are an SEO strategist for New Dawn Franchising LLC — an El Paso, Texas franchise company targeting E-2 visa investors.

Today is ${dateStr}. Here is the current SEO state:
- Keywords being tracked: ${kwList || "none yet — need to set up tracking"}
- Keywords currently ranking: ${rankedCount} of ${trackedCount} tracked
- Backlink sites in pipeline: ${backlogSites || "none yet"}
- Content drafts in queue: ${contentQueue || "none yet"}

Write exactly 4 specific SEO action items for Dylan to focus on today. Each must:
- Be concrete and actionable (e.g. "Publish a blog post targeting 'E-2 visa franchise requirements' — 800 words, H2s at each requirement, internal link to /territories")
- Be relevant to New Dawn Franchising's niche (E-2 visa investors, Texas franchises, immigration attorneys)
- Be completable in under 2 hours

Format as a plain numbered list (1. ... 2. ... 3. ... 4. ...). No intro, no outro. Just the 4 items.`;

    aiActions = await callOpenAI(prompt, 600);
  } catch {
    aiActions = `1. Add 5 target keywords to the SEO tracker (e.g. "E-2 visa franchise Texas", "buy franchise E-2 visa", "franchise investment visa USA")
2. Write one 800-word blog post targeting "E-2 visa franchise requirements" and publish it to the blog
3. Reach out to 3 immigration law blogs for guest post or backlink opportunities — add them to the outreach tracker
4. Update your Google Business Profile with new photos and a post about available Texas territories`;
  }

  // ── Build backlink section HTML ──
  let backlinkHtml = "";
  const activeBacklinks = backlinkPipeline.filter(b => ["identified", "outreach_sent"].includes(b.status)).slice(0, 5);
  if (activeBacklinks.length > 0) {
    backlinkHtml = `<h3 style="color:#1a2a4a;margin:20px 0 8px;">🔗 BACKLINK PIPELINE (${activeBacklinks.length} active)</h3>`;
    for (const b of activeBacklinks) {
      const statusColor = b.status === "outreach_sent" ? "#f59e0b" : "#6b7280";
      backlinkHtml += `<div style="background:#f9fafb;border-left:3px solid ${statusColor};padding:8px 12px;margin:4px 0;font-size:13px;border-radius:0 4px 4px 0;">
        <strong>${b.targetSite}</strong> — <span style="color:${statusColor};text-transform:uppercase;font-size:11px;">${b.status.replace("_", " ")}</span>
        ${b.contactEmail ? `<br/><span style="color:#9ca3af;">${b.contactEmail}</span>` : ""}
      </div>`;
    }
  } else {
    backlinkHtml = `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px 14px;font-size:13px;color:#92400e;margin:12px 0;">
      No backlink targets in pipeline yet. Add sites using the SEO → Backlinks tab.
    </div>`;
  }

  // ── Build keyword section HTML ──
  let keywordHtml = "";
  if (keywords.length === 0) {
    keywordHtml = `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px 14px;font-size:13px;color:#92400e;margin:12px 0;">
      No keywords tracked yet. Go to SEO → Keywords to add your target terms.
    </div>`;
  } else {
    keywordHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:#f3f4f6;"><th style="padding:6px 10px;text-align:left;">Keyword</th><th style="padding:6px 10px;text-align:left;">Position</th></tr>`;
    for (const kw of keywords.slice(0, 8)) {
      const ranking = recentRankings.find(r => r.keywordId === kw.id);
      const pos = ranking?.position;
      const posStr = pos ? `#${pos}` : "Not ranking";
      const posColor = pos ? (pos <= 3 ? "#16a34a" : pos <= 10 ? "#ca8a04" : "#6b7280") : "#ef4444";
      keywordHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 10px;">${kw.keyword}</td>
        <td style="padding:6px 10px;color:${posColor};font-weight:600;">${posStr}</td>
      </tr>`;
    }
    keywordHtml += "</table>";
  }

  // ── Build action items HTML ──
  const actionLines = aiActions.split("\n").filter(l => l.trim().match(/^\d+\./));
  let actionsHtml = "";
  for (const line of actionLines) {
    actionsHtml += `<div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:10px 14px;margin:6px 0;border-radius:0 4px 4px 0;font-size:13px;color:#1a1a2e;">${line}</div>`;
  }
  if (!actionsHtml) actionsHtml = `<p style="color:#6b7280;font-size:13px;">${aiActions}</p>`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e;">
  <div style="background:#0f4c81;padding:20px 28px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:18px;font-weight:700;">🔍 NDF SEO Agent</span>
    <span style="color:#93c5fd;font-size:14px;margin-left:12px;">Daily SEO Brief</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;color:#374151;">Hi Jamie,</p>
    <p style="margin:0 0 20px;color:#374151;">Here's your SEO snapshot for <strong>${dateStr}</strong> — keyword rankings, backlink pipeline, and today's recommended actions.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;margin:0 0 20px;display:flex;gap:20px;">
      <span style="font-size:13px;color:#1e40af;"><strong>${trackedCount}</strong> keywords tracked</span>
      <span style="font-size:13px;color:#1e40af;">·</span>
      <span style="font-size:13px;color:#1e40af;"><strong>${rankedCount}</strong> currently ranking</span>
      <span style="font-size:13px;color:#1e40af;">·</span>
      <span style="font-size:13px;color:#1e40af;"><strong>${backlinkPipeline.length}</strong> backlink targets</span>
    </div>

    <h3 style="color:#0f4c81;margin:20px 0 8px;">📈 KEYWORD RANKINGS</h3>
    ${keywordHtml}

    ${backlinkHtml}

    <h3 style="color:#0f4c81;margin:20px 0 8px;">✅ TODAY'S RECOMMENDED SEO ACTIONS</h3>
    ${actionsHtml}

    ${recentTasks.length > 0 ? `
    <h3 style="color:#0f4c81;margin:20px 0 8px;">🤖 RECENT AI TASKS</h3>
    ${recentTasks.map(t => `<div style="font-size:12px;color:#6b7280;padding:4px 0;border-bottom:1px solid #f3f4f6;">${t.taskType} — <span style="color:${t.status === "completed" ? "#16a34a" : "#ef4444"};">${t.status}</span>${t.resultSummary ? `<br/>${t.resultSummary.substring(0, 120)}…` : ""}</div>`).join("")}
    ` : ""}

    <p style="font-size:13px;color:#9ca3af;margin:20px 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">
      View full SEO Command Center: <a href="https://www.newdawnfranchising.com/seo" style="color:#0f4c81;">newdawnfranchising.com/seo</a><br/>
      This brief is sent every morning at 9 AM ET.
    </p>
  </div>
</div>`;

  const subject = `NDF SEO Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
  await sendEmailFromSender(FROM_EMAIL, toEmail, subject, html);
  console.log(`[SEO Agent] Daily brief sent to ${toEmail}`);
  return true;
}
