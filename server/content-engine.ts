import { db } from "./db";
import { contentDrafts, metaSuggestions, contentSuggestions, seoScheduledTasks } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { on, emit } from "./core/event-bus";
import { emailQueue } from "./core/email-queue";
import { notifications } from "./core/notifications";
import { storage } from "./storage";
import { submitToIndexNow } from "./indexnow";

const SITE_URL = "https://newdawnfranchising.com";
const JAMIE_EMAIL = "jamie.greene736@gmail.com";
const FROM_EMAIL = "franchising@newdawnfranchising.com";

async function callOpenAI(prompt: string, system: string, maxTokens = 3000): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) return "";
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || "";
}

const CONTENT_SYSTEM = `You are a professional content writer for New Dawn Franchising — a U.S. property management franchise tailored for E-2 visa investors (minimum $225,000 investment). Your target audience is: E-2 visa investors, immigration attorneys, relocation consultants, and franchise brokers. Write in a clear, professional, authoritative tone. Every article must be practical and rank-ready for SEO. Never use fluff. Always end with a strong CTA directing readers to contact New Dawn Franchising or request the FDD.`;

// ─── Auto Blog Draft Generator ────────────────────────────────────────────────

export async function generateDraftFromKeyword(keyword: string, triggerSource: string): Promise<string | null> {
  console.log(`[ContentEngine] Generating draft for keyword: "${keyword}"`);

  const prompt = `Write a comprehensive, SEO-optimised blog article targeting the keyword: "${keyword}"

Requirements:
- 800–1200 words
- Audience: E-2 visa investors, their immigration attorneys, and business advisors
- Title: under 60 characters, includes the keyword
- Meta description: under 160 characters, compelling and keyword-rich
- Structure: Introduction → 3–4 H2 sections with H3 sub-points where relevant
- Each H2 should be structured for potential featured snippet eligibility (answer a specific question)
- End with a CTA directing readers to contact New Dawn Franchising or request the FDD

Priority content angles:
- E-2 visa qualification requirements and how franchises help
- Substantial investment requirement and how $225K property management satisfies it
- "Direct and control" standard — operational without doing day-to-day work
- El Paso, Texas as a strong E-2 visa market
- E-2 vs EB-5 comparison

Return as JSON with these exact fields:
{
  "title": "...",
  "metaTitle": "...",
  "metaDescription": "...",
  "body": "... full markdown article ...",
  "wordCount": 950
}`;

  try {
    const raw = await callOpenAI(prompt, CONTENT_SYSTEM, 3000);
    const parsed = JSON.parse(raw.replace(/```json\n?|```\n?/g, "").trim());

    const [draft] = await db.insert(contentDrafts).values({
      title: parsed.title || `Article: ${keyword}`,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      body: parsed.body || raw,
      targetKeyword: keyword,
      wordCount: parsed.wordCount || Math.round((parsed.body || raw).split(/\s+/).length),
      status: "draft",
      triggerSource,
    }).returning();

    emit("content:draft:created", {
      draftId: draft.id,
      title: draft.title,
      targetKeyword: keyword,
      triggerSource,
    });

    await notifications.create({
      type: "content_draft_created",
      system: "content_engine",
      title: "New Blog Draft Ready",
      message: `"${draft.title}" — targeted keyword: ${keyword}`,
      actionUrl: "/seo?tab=content",
    });

    console.log(`[ContentEngine] Draft created: "${draft.title}" (${draft.wordCount} words)`);
    return draft.id;
  } catch (err: any) {
    console.error(`[ContentEngine] Failed to generate draft:`, err.message);
    return null;
  }
}

// ─── Meta Description Optimizer ───────────────────────────────────────────────

export async function generateMetaSuggestions(pages: Array<{ url: string; title: string; meta: string; impressions: number; ctr: number }>): Promise<void> {
  const lowCtrPages = pages.filter(p => p.impressions >= 200 && p.ctr < 0.02);
  console.log(`[ContentEngine] Generating meta suggestions for ${lowCtrPages.length} low-CTR pages`);

  for (const page of lowCtrPages.slice(0, 10)) {
    try {
      const prompt = `Generate 3 alternative title tags and 3 alternative meta descriptions for this page:
URL: ${page.url}
Current title: "${page.title}"
Current meta: "${page.meta}"
Current CTR: ${(page.ctr * 100).toFixed(1)}% with ${page.impressions} impressions

Scoring criteria: presence of number, question format, power words (discover, proven, ultimate, complete), keyword placement, character length (title <60 chars, meta <160 chars), click-worthiness for E-2 visa investors or immigration professionals.

Return JSON:
{
  "suggestedTitle": "best single title variant",
  "suggestedMeta": "best single meta description variant"
}`;

      const raw = await callOpenAI(prompt, CONTENT_SYSTEM, 400);
      const parsed = JSON.parse(raw.replace(/```json\n?|```\n?/g, "").trim());

      await db.insert(metaSuggestions).values({
        pageUrl: page.url,
        currentTitle: page.title,
        currentMeta: page.meta,
        suggestedTitle: parsed.suggestedTitle,
        suggestedMeta: parsed.suggestedMeta,
        impressions: page.impressions,
        currentCtr: page.ctr,
        status: "pending",
      });

      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.error(`[ContentEngine] Meta suggestion failed for ${page.url}:`, err.message);
    }
  }
}

// ─── Sitemap Ping ─────────────────────────────────────────────────────────────

export async function pingSitemap(): Promise<{ success: boolean; message: string }> {
  // Google's sitemap-ping endpoint was deprecated and removed in 2024. Notify
  // Bing/Yandex (which support IndexNow) of the site's URLs instead. Google
  // discovers updates via the sitemap submitted in Search Console.
  const staticPaths = [
    "/", "/about", "/team", "/e2-fit", "/process", "/territories",
    "/marketing", "/real-estate", "/blog", "/quiz", "/contact",
  ];
  const urls = staticPaths.map((p) => `${SITE_URL}${p}`);
  try {
    const posts = await storage.getBlogPosts();
    for (const post of posts) urls.push(`${SITE_URL}/blog/${post.slug}`);
  } catch {
    // Blog list is optional; submit the static pages regardless.
  }
  const result = await submitToIndexNow(urls);
  console.log(`[ContentEngine] Sitemap ping (IndexNow): ${result.message}`);
  return { success: result.success, message: result.message };
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

on("seo:task:completed", async (payload) => {
  const taskName = payload.taskName?.toLowerCase() || "";

  if (taskName === "content_gap_analysis" || taskName === "content_gap") {
    const results = payload.results as any;
    const gaps: string[] = Array.isArray(results?.gaps) ? results.gaps :
      Array.isArray(results?.keywords) ? results.keywords : [];
    for (const gap of gaps.slice(0, 3)) {
      const gapStr = typeof gap === "string" ? gap : (gap as any)?.keyword || (gap as any)?.topic || String(gap);
      await generateDraftFromKeyword(gapStr, "content_gap_analysis");
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (taskName === "keyword_trend_report" || taskName === "keyword_trend") {
    const results = payload.results as any;
    const trending: string[] = Array.isArray(results?.trending) ? results.trending :
      Array.isArray(results?.keywords) ? results.keywords : [];
    for (const kw of trending.slice(0, 2)) {
      const kwStr = typeof kw === "string" ? kw : (kw as any)?.keyword || (kw as any)?.topic || String(kw);
      await generateDraftFromKeyword(kwStr, "keyword_trend_report");
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (taskName === "content_performance_review" || taskName === "content_performance") {
    const results = payload.results as any;
    if (Array.isArray(results?.pages)) {
      await generateMetaSuggestions(results.pages);
    }
  }
});

// ─── API route handlers ───────────────────────────────────────────────────────

export async function getContentDrafts() {
  return db.select().from(contentDrafts).orderBy(desc(contentDrafts.createdAt)).limit(50);
}

export async function getMetaSuggestions() {
  return db.select().from(metaSuggestions).orderBy(desc(metaSuggestions.createdAt)).limit(50);
}

export async function approveDraft(id: string): Promise<any> {
  const [draft] = await db.update(contentDrafts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(contentDrafts.id, id))
    .returning();
  return draft;
}

export async function discardDraft(id: string): Promise<void> {
  await db.update(contentDrafts).set({ status: "discarded" }).where(eq(contentDrafts.id, id));
}

export async function updateDraft(id: string, updates: Partial<{ title: string; body: string; metaTitle: string; metaDescription: string; targetKeyword: string }>): Promise<any> {
  const [draft] = await db.update(contentDrafts).set(updates).where(eq(contentDrafts.id, id)).returning();
  return draft;
}

export async function approveMetaSuggestion(id: string): Promise<any> {
  const [s] = await db.update(metaSuggestions)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(metaSuggestions.id, id))
    .returning();
  if (s) await pingSitemap();
  return s;
}

export async function requestDraft(topic: string): Promise<string | null> {
  await db.insert(contentSuggestions).values({ topic, sourceTask: "manual", priority: "high" });
  return generateDraftFromKeyword(topic, "manual");
}
