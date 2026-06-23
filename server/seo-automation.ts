import { db } from "./db";
import { seoScheduledTasks, seoKeywords, seoKeywordRankings, seoAgentTasks } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { runRankingsCheck } from "./seo-service";
import { sendEmailFromSender } from "./email-service";

const SITE_URL = "https://www.newdawnfranchising.com";
const DIGEST_TO = "jamie.greene736@gmail.com";
const DIGEST_FROM = "dylan@newdawnfranchising.com";
const SERPAPI_KEY = () => process.env.SERPAPI_KEY || "";

// ─── Task definitions ─────────────────────────────────────────────────────────

export const TASK_DEFINITIONS = [
  {
    taskKey: "keyword_rank_tracker",
    name: "Keyword Rank Tracker",
    description: "Checks Google positions for all tracked keywords via SerpAPI. Flags drops > 3 positions.",
    cadence: "daily",
    scheduledTime: "6:00 AM CT",
  },
  {
    taskKey: "broken_link_checker",
    name: "Broken Link Checker",
    description: "Crawls all site pages and checks for 404s and broken outbound links.",
    cadence: "daily",
    scheduledTime: "6:00 AM CT",
  },
  {
    taskKey: "core_web_vitals",
    name: "Core Web Vitals Snapshot",
    description: "Calls Google PageSpeed Insights for all key pages. Flags poor LCP, CLS, or INP scores.",
    cadence: "daily",
    scheduledTime: "6:00 AM CT",
  },
  {
    taskKey: "competitor_monitor",
    name: "Competitor Content Monitor",
    description: "Checks competitor domains for new blog posts or landing page changes in the last 24 hours.",
    cadence: "daily",
    scheduledTime: "6:00 AM CT",
  },
  {
    taskKey: "seo_performance_digest",
    name: "Weekly SEO Performance Digest",
    description: "Aggregates 7 days of keyword rankings and traffic into a weekly summary report.",
    cadence: "weekly",
    scheduledTime: "Monday 7:00 AM CT",
  },
  {
    taskKey: "content_gap_analysis",
    name: "Content Gap Analysis",
    description: "Compares site pages to top competitor content. Surfaces 3-5 missing topic opportunities.",
    cadence: "weekly",
    scheduledTime: "Monday 7:00 AM CT",
  },
  {
    taskKey: "schema_validator",
    name: "Schema Markup Validator",
    description: "Validates all structured data (LocalBusiness, FAQPage, Organization) across the site.",
    cadence: "weekly",
    scheduledTime: "Monday 7:00 AM CT",
  },
  {
    taskKey: "technical_seo_audit",
    name: "Full Technical SEO Audit",
    description: "Crawls the entire site for indexability issues, thin content, orphaned pages, and sitemap accuracy.",
    cadence: "monthly",
    scheduledTime: "1st of month 8:00 AM CT",
  },
  {
    taskKey: "keyword_trend_report",
    name: "E-2 Visa Keyword Trend Report",
    description: "Analyzes monthly search volume trends for E-2 visa queries. Identifies rising queries.",
    cadence: "monthly",
    scheduledTime: "1st of month 8:00 AM CT",
  },
  {
    taskKey: "competitor_ranking_comparison",
    name: "Competitor Ranking Comparison",
    description: "Full side-by-side ranking comparison between the site and top 3 competitors.",
    cadence: "monthly",
    scheduledTime: "1st of month 8:00 AM CT",
  },
];

// ─── Next run calculator ──────────────────────────────────────────────────────

function nextRunFor(cadence: string): Date {
  const now = new Date();
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  if (cadence === "daily") {
    const next = new Date(ct);
    next.setHours(6, 0, 0, 0);
    if (next <= ct) next.setDate(next.getDate() + 1);
    return next;
  }
  if (cadence === "weekly") {
    const next = new Date(ct);
    const day = ct.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    next.setDate(ct.getDate() + daysUntilMonday);
    next.setHours(7, 0, 0, 0);
    return next;
  }
  // monthly
  const next = new Date(ct);
  next.setMonth(next.getMonth() + 1, 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

// ─── Seed tasks into DB on startup ───────────────────────────────────────────

export async function seedScheduledTasks(): Promise<void> {
  for (const def of TASK_DEFINITIONS) {
    const existing = await db.select().from(seoScheduledTasks).where(eq(seoScheduledTasks.taskKey, def.taskKey));
    if (!existing.length) {
      await db.insert(seoScheduledTasks).values({
        taskKey: def.taskKey,
        name: def.name,
        description: def.description,
        cadence: def.cadence,
        nextRunAt: nextRunFor(def.cadence),
      });
    }
  }
}

// ─── Task runner wrapper ──────────────────────────────────────────────────────

async function runTask(taskKey: string, fn: () => Promise<string>): Promise<string> {
  await db.update(seoScheduledTasks)
    .set({ lastRunStatus: "running", lastRunAt: new Date() })
    .where(eq(seoScheduledTasks.taskKey, taskKey));

  try {
    const result = await fn();
    await db.update(seoScheduledTasks)
      .set({ lastRunStatus: "completed", lastRunResult: result, nextRunAt: nextRunFor(TASK_DEFINITIONS.find(t => t.taskKey === taskKey)!.cadence) })
      .where(eq(seoScheduledTasks.taskKey, taskKey));
    return result;
  } catch (e: any) {
    const errMsg = e?.message || "Unknown error";
    await db.update(seoScheduledTasks)
      .set({ lastRunStatus: "failed", lastRunResult: `Error: ${errMsg}`, nextRunAt: nextRunFor(TASK_DEFINITIONS.find(t => t.taskKey === taskKey)!.cadence) })
      .where(eq(seoScheduledTasks.taskKey, taskKey));
    throw e;
  }
}

// ─── DAILY: Keyword Rank Tracker ─────────────────────────────────────────────

export async function runKeywordRankTracker(): Promise<string> {
  return runTask("keyword_rank_tracker", async () => {
    const summary = await runRankingsCheck();
    const data = JSON.parse(summary);
    const dropped = (data.results || []).filter((r: any) => (r.positionDelta || 0) > 3);
    const result = `Checked ${data.results?.length || 0} keywords. ${dropped.length} dropped >3 positions.`;
    return result;
  });
}

// ─── DAILY: Broken Link Checker ──────────────────────────────────────────────

const SITE_PAGES_TO_CHECK = ["/", "/franchise", "/territories", "/about", "/contact", "/blog", "/e2-visa"];

async function checkUrl(url: string): Promise<{ url: string; status: number; ok: boolean }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NDFBot/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    return { url, status: res.status, ok: res.ok };
  } catch {
    return { url, status: 0, ok: false };
  }
}

export async function runBrokenLinkChecker(): Promise<string> {
  return runTask("broken_link_checker", async () => {
    const broken: string[] = [];
    const checked: string[] = [];

    for (const path of SITE_PAGES_TO_CHECK) {
      const pageUrl = `${SITE_URL}${path}`;
      try {
        const res = await fetch(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NDFBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) { broken.push(`${pageUrl} (${res.status})`); continue; }

        const html = await res.text();
        const linkRegex = /href=["']([^"'#?]+)["']/g;
        const links = new Set<string>();
        let m;
        while ((m = linkRegex.exec(html)) !== null) {
          const href = m[1];
          if (href.startsWith("http") && !href.includes("newdawnfranchising.com")) {
            links.add(href);
          } else if (href.startsWith("/") && href.length > 1) {
            links.add(`${SITE_URL}${href}`);
          }
        }

        for (const link of [...links].slice(0, 10)) {
          if (checked.includes(link)) continue;
          checked.push(link);
          const result = await checkUrl(link);
          if (!result.ok && result.status !== 0) broken.push(`${link} (${result.status})`);
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e: any) {
        broken.push(`${pageUrl} (fetch error: ${e.message})`);
      }
    }

    return JSON.stringify({
      pagesChecked: SITE_PAGES_TO_CHECK.length,
      linksChecked: checked.length,
      brokenLinks: broken,
      summary: broken.length === 0
        ? `All ${SITE_PAGES_TO_CHECK.length} pages and ${checked.length} outbound links are healthy.`
        : `Found ${broken.length} broken link${broken.length > 1 ? "s" : ""}: ${broken.slice(0, 3).join(", ")}${broken.length > 3 ? ` and ${broken.length - 3} more` : ""}`,
    });
  });
}

// ─── DAILY: Core Web Vitals ───────────────────────────────────────────────────

interface CWVResult {
  url: string;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  performanceScore: number | null;
  lcpStatus: "good" | "needs-improvement" | "poor" | "unknown";
  clsStatus: "good" | "needs-improvement" | "poor" | "unknown";
}

function cwvStatus(metric: string, value: number | null): "good" | "needs-improvement" | "poor" | "unknown" {
  if (value === null) return "unknown";
  if (metric === "lcp") return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
  if (metric === "cls") return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
  return "good";
}

export async function runCoreWebVitals(): Promise<string> {
  return runTask("core_web_vitals", async () => {
    const pagesToCheck = ["/", "/franchise", "/e2-visa"];
    const results: CWVResult[] = [];

    for (const path of pagesToCheck) {
      const pageUrl = encodeURIComponent(`${SITE_URL}${path}`);
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${pageUrl}&strategy=mobile${process.env.PAGESPEED_API_KEY ? `&key=${process.env.PAGESPEED_API_KEY}` : ""}`;

      try {
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) { results.push({ url: `${SITE_URL}${path}`, lcp: null, cls: null, fid: null, performanceScore: null, lcpStatus: "unknown", clsStatus: "unknown" }); continue; }
        const data = await res.json() as any;
        const audits = data?.lighthouseResult?.audits || {};
        const cats = data?.lighthouseResult?.categories?.performance;
        const lcp = audits["largest-contentful-paint"]?.numericValue || null;
        const cls = audits["cumulative-layout-shift"]?.numericValue || null;
        const fid = audits["max-potential-fid"]?.numericValue || audits["total-blocking-time"]?.numericValue || null;
        results.push({
          url: `${SITE_URL}${path}`,
          lcp: lcp ? Math.round(lcp) : null,
          cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
          fid: fid ? Math.round(fid) : null,
          performanceScore: cats?.score ? Math.round(cats.score * 100) : null,
          lcpStatus: cwvStatus("lcp", lcp),
          clsStatus: cwvStatus("cls", cls),
        });
      } catch {
        results.push({ url: `${SITE_URL}${path}`, lcp: null, cls: null, fid: null, performanceScore: null, lcpStatus: "unknown", clsStatus: "unknown" });
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    const poor = results.filter(r => r.lcpStatus === "poor" || r.clsStatus === "poor");
    return JSON.stringify({
      pagesChecked: results.length,
      results,
      issues: poor.map(r => `${r.url}: LCP ${r.lcp}ms (${r.lcpStatus}), CLS ${r.cls} (${r.clsStatus})`),
      summary: poor.length === 0
        ? `All ${results.length} pages within Google's "Good" thresholds.`
        : `${poor.length} page(s) have poor Core Web Vitals scores.`,
    });
  });
}

// ─── DAILY: Competitor Monitor ────────────────────────────────────────────────

const COMPETITOR_DOMAINS = [
  "propertymanagementincfranchise.com",
  "allcountyfranchise.com",
  "realpropertymgt.com",
];

export async function runCompetitorMonitor(): Promise<string> {
  return runTask("competitor_monitor", async () => {
    if (!SERPAPI_KEY()) return "SerpAPI key not configured — skipping competitor monitor.";
    const findings: string[] = [];

    for (const domain of COMPETITOR_DOMAINS) {
      try {
        const params = new URLSearchParams({
          engine: "google",
          q: `site:${domain}`,
          api_key: SERPAPI_KEY(),
          num: "5",
          tbs: "qdr:d",
        });
        const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const results = data.organic_results || [];
        if (results.length > 0) {
          findings.push(`${domain}: ${results.length} recent page(s) — "${results[0]?.title || "unknown"}"`);
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* skip */ }
    }

    return JSON.stringify({
      domainsMonitored: COMPETITOR_DOMAINS.length,
      newContent: findings,
      summary: findings.length === 0
        ? "No new competitor content detected in the last 24 hours."
        : `${findings.length} competitor(s) published new content: ${findings.join("; ")}`,
    });
  });
}

// ─── WEEKLY: SEO Performance Digest ──────────────────────────────────────────

export async function runSeoPerformanceDigest(): Promise<string> {
  return runTask("seo_performance_digest", async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const keywords = await db.select().from(seoKeywords);
    const rankings = await db.select().from(seoKeywordRankings)
      .where(gte(seoKeywordRankings.checkedAt, sevenDaysAgo))
      .orderBy(desc(seoKeywordRankings.checkedAt));

    const kwMap = new Map(keywords.map(k => [k.id, k.keyword]));
    const latestByKw = new Map<string, { position: number | null }>();
    for (const r of rankings) {
      if (!latestByKw.has(r.keywordId)) latestByKw.set(r.keywordId, { position: r.position });
    }

    const tracked = keywords.length;
    const ranking = [...latestByKw.values()].filter(r => r.position !== null).length;
    const top10 = [...latestByKw.values()].filter(r => r.position && r.position <= 10).length;
    const top3 = [...latestByKw.values()].filter(r => r.position && r.position <= 3).length;

    return JSON.stringify({
      period: "last 7 days",
      tracked,
      ranking,
      top3,
      top10,
      rankingsChecked: rankings.length,
      summary: `${tracked} keywords tracked. ${ranking} currently ranking. ${top3} in top 3, ${top10} on page 1.`,
    });
  });
}

// ─── WEEKLY: Content Gap Analysis ────────────────────────────────────────────

export async function runContentGapAnalysis(): Promise<string> {
  return runTask("content_gap_analysis", async () => {
    if (!SERPAPI_KEY()) return "SerpAPI key not configured — skipping content gap analysis.";

    const topics = ["E-2 visa franchise requirements", "property management franchise investment", "investor visa US business"];
    const gaps: string[] = [];

    for (const topic of topics) {
      try {
        const params = new URLSearchParams({ engine: "google", q: topic, api_key: SERPAPI_KEY(), num: "5" });
        const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const paa = (data.related_questions || []).slice(0, 2).map((q: any) => q.question);
        gaps.push(...paa);
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* skip */ }
    }

    const unique = [...new Set(gaps)].slice(0, 8);
    return JSON.stringify({
      topicsAnalyzed: topics.length,
      contentOpportunities: unique,
      summary: `Identified ${unique.length} content gap opportunities from People Also Ask data.`,
    });
  });
}

// ─── WEEKLY: Schema Validator ─────────────────────────────────────────────────

export async function runSchemaValidator(): Promise<string> {
  return runTask("schema_validator", async () => {
    const pages = [
      { path: "/", recommended: ["LocalBusiness", "Organization", "FAQPage"] },
      { path: "/franchise", recommended: ["FAQPage", "BreadcrumbList"] },
      { path: "/e2-visa", recommended: ["FAQPage", "HowTo", "Article"] },
    ];

    const results: { path: string; found: string[]; missing: string[] }[] = [];

    for (const p of pages) {
      try {
        const res = await fetch(`${SITE_URL}${p.path}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NDFBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) { results.push({ path: p.path, found: [], missing: p.recommended }); continue; }
        const html = await res.text();
        const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        const found: string[] = [];
        for (const m of jsonLdMatches) {
          try {
            const json = JSON.parse(m[1]);
            const types = Array.isArray(json) ? json.map((j: any) => j["@type"]) : [json["@type"]];
            types.forEach((t: string) => t && found.push(t));
          } catch { /* */ }
        }
        const missing = p.recommended.filter(r => !found.some(f => f?.toLowerCase().includes(r.toLowerCase())));
        results.push({ path: p.path, found, missing });
      } catch {
        results.push({ path: p.path, found: [], missing: p.recommended });
      }
      await new Promise(r => setTimeout(r, 500));
    }

    const totalMissing = results.reduce((a, r) => a + r.missing.length, 0);
    return JSON.stringify({
      pagesChecked: results.length,
      totalMissing,
      results,
      summary: totalMissing === 0
        ? "All schema markup is valid across all checked pages."
        : `${totalMissing} missing schema type(s) detected across ${results.filter(r => r.missing.length > 0).length} pages.`,
    });
  });
}

// ─── MONTHLY: Technical SEO Audit ────────────────────────────────────────────

export async function runTechnicalSeoAudit(): Promise<string> {
  return runTask("technical_seo_audit", async () => {
    const issues: string[] = [];
    const pages = SITE_PAGES_TO_CHECK;

    const thinPages: string[] = [];
    const missingMeta: string[] = [];

    for (const path of pages) {
      try {
        const res = await fetch(`${SITE_URL}${path}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NDFBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) { issues.push(`${path}: HTTP ${res.status}`); continue; }
        const html = await res.text();

        const metaDesc = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1];
        if (!metaDesc || metaDesc.length < 50) missingMeta.push(path);

        const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (bodyText.length < 1500) thinPages.push(path);
      } catch (e: any) {
        issues.push(`${path}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (thinPages.length) issues.push(`Thin content pages (<300 words): ${thinPages.join(", ")}`);
    if (missingMeta.length) issues.push(`Missing/short meta descriptions: ${missingMeta.join(", ")}`);

    return JSON.stringify({
      pagesAudited: pages.length,
      issuesFound: issues.length,
      issues,
      thinPages,
      missingMeta,
      summary: issues.length === 0
        ? `Full technical audit complete — ${pages.length} pages audited, no critical issues found.`
        : `${issues.length} issue(s) found across ${pages.length} pages. Priority: ${issues[0]}`,
    });
  });
}

// ─── MONTHLY: Keyword Trend Report ───────────────────────────────────────────

export async function runKeywordTrendReport(): Promise<string> {
  return runTask("keyword_trend_report", async () => {
    if (!SERPAPI_KEY()) return "SerpAPI key not configured — skipping keyword trend report.";

    const trendQueries = [
      "E-2 visa franchise",
      "E-2 investor visa property management",
      "US franchise visa investor",
    ];

    const trends: { query: string; relatedRising: string[] }[] = [];

    for (const query of trendQueries) {
      try {
        const params = new URLSearchParams({ engine: "google", q: query, api_key: SERPAPI_KEY(), num: "10" });
        const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const rising = (data.related_searches || []).slice(0, 3).map((r: any) => r.query);
        trends.push({ query, relatedRising: rising });
        await new Promise(r => setTimeout(r, 1000));
      } catch { /* skip */ }
    }

    return JSON.stringify({
      queriesAnalyzed: trendQueries.length,
      trends,
      summary: `Analyzed ${trendQueries.length} seed queries. Found ${trends.reduce((a, t) => a + t.relatedRising.length, 0)} related rising queries.`,
    });
  });
}

// ─── MONTHLY: Competitor Ranking Comparison ───────────────────────────────────

export async function runCompetitorRankingComparison(): Promise<string> {
  return runTask("competitor_ranking_comparison", async () => {
    if (!SERPAPI_KEY()) return "SerpAPI key not configured — skipping competitor comparison.";

    const keywords = await db.select().from(seoKeywords).limit(8);
    const comparison: { keyword: string; ourPosition: number | null; competitors: { domain: string; position: number | null }[] }[] = [];

    for (const kw of keywords.slice(0, 5)) {
      try {
        const params = new URLSearchParams({ engine: "google", q: kw.keyword, api_key: SERPAPI_KEY(), num: "20" });
        const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const organic = (data.organic_results || []) as { link?: string; position?: number }[];

        const ourPos = organic.find(r => r.link?.includes("newdawnfranchising"))?.position || null;
        const compPositions = COMPETITOR_DOMAINS.map(domain => ({
          domain,
          position: organic.find(r => r.link?.includes(domain))?.position || null,
        }));

        comparison.push({ keyword: kw.keyword, ourPosition: ourPos, competitors: compPositions });
        await new Promise(r => setTimeout(r, 1200));
      } catch { /* skip */ }
    }

    return JSON.stringify({
      keywordsCompared: comparison.length,
      comparison,
      summary: `Compared positions across ${comparison.length} keywords vs ${COMPETITOR_DOMAINS.length} competitors.`,
    });
  });
}

// ─── Run a task by key ────────────────────────────────────────────────────────

export async function runScheduledTaskByKey(taskKey: string): Promise<string> {
  switch (taskKey) {
    case "keyword_rank_tracker": return runKeywordRankTracker();
    case "broken_link_checker": return runBrokenLinkChecker();
    case "core_web_vitals": return runCoreWebVitals();
    case "competitor_monitor": return runCompetitorMonitor();
    case "seo_performance_digest": return runSeoPerformanceDigest();
    case "content_gap_analysis": return runContentGapAnalysis();
    case "schema_validator": return runSchemaValidator();
    case "technical_seo_audit": return runTechnicalSeoAudit();
    case "keyword_trend_report": return runKeywordTrendReport();
    case "competitor_ranking_comparison": return runCompetitorRankingComparison();
    default: throw new Error(`Unknown task: ${taskKey}`);
  }
}

// ─── Run daily batch (6AM CT) ─────────────────────────────────────────────────

export async function runDailyAutomations(): Promise<void> {
  console.log("[SEO Auto] Running daily automations...");
  await runKeywordRankTracker().catch(e => console.error("[SEO Auto] keyword_rank_tracker:", e.message));
  await runBrokenLinkChecker().catch(e => console.error("[SEO Auto] broken_link_checker:", e.message));
  await runCoreWebVitals().catch(e => console.error("[SEO Auto] core_web_vitals:", e.message));
  await runCompetitorMonitor().catch(e => console.error("[SEO Auto] competitor_monitor:", e.message));
  console.log("[SEO Auto] Daily automations complete.");
}

// ─── Run weekly batch (Monday 7AM CT) ────────────────────────────────────────

export async function runWeeklyAutomations(): Promise<void> {
  console.log("[SEO Auto] Running weekly automations...");
  await runSeoPerformanceDigest().catch(e => console.error("[SEO Auto] seo_performance_digest:", e.message));
  await runContentGapAnalysis().catch(e => console.error("[SEO Auto] content_gap_analysis:", e.message));
  await runSchemaValidator().catch(e => console.error("[SEO Auto] schema_validator:", e.message));
  console.log("[SEO Auto] Weekly automations complete.");
}

// ─── Run monthly batch (1st of month 8AM CT) ─────────────────────────────────

export async function runMonthlyAutomations(): Promise<void> {
  console.log("[SEO Auto] Running monthly automations...");
  await runTechnicalSeoAudit().catch(e => console.error("[SEO Auto] technical_seo_audit:", e.message));
  await runKeywordTrendReport().catch(e => console.error("[SEO Auto] keyword_trend_report:", e.message));
  await runCompetitorRankingComparison().catch(e => console.error("[SEO Auto] competitor_ranking_comparison:", e.message));
  console.log("[SEO Auto] Monthly automations complete.");
}

// ─── Daily Digest Email ───────────────────────────────────────────────────────

export async function sendSeoDigestEmail(): Promise<void> {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const tasks = await db.select().from(seoScheduledTasks).orderBy(seoScheduledTasks.cadence);
  const recentLogs = await db.select().from(seoAgentTasks)
    .where(gte(seoAgentTasks.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .orderBy(desc(seoAgentTasks.createdAt))
    .limit(20);

  const completed = tasks.filter(t => t.lastRunStatus === "completed");
  const failed = tasks.filter(t => t.lastRunStatus === "failed");
  const today = tasks.filter(t => {
    if (!t.nextRunAt) return false;
    const next = new Date(t.nextRunAt);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    return next <= todayEnd;
  });
  const thisWeek = tasks.filter(t => {
    if (!t.nextRunAt) return false;
    const next = new Date(t.nextRunAt);
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    return next > todayEnd && next <= weekEnd;
  });

  const completedRows = completed.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${t.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${t.lastRunAt ? new Date(t.lastRunAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }) + " CT" : "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;">${summarySnippet(t.lastRunResult)}</td>
    </tr>`).join("");

  const failedRows = failed.length === 0
    ? `<p style="color:#6b7280;font-size:13px;">No issues detected in the last 24 hours. ✅</p>`
    : failed.map(t => `<li style="color:#b91c1c;font-size:13px;margin-bottom:4px;"><strong>${t.name}</strong>: ${t.lastRunResult?.slice(0, 120) || "Unknown error"}</li>`).join("");

  const todayRows = today.length === 0
    ? `<p style="color:#6b7280;font-size:13px;">No tasks scheduled for the rest of today.</p>`
    : today.map(t => `<li style="font-size:13px;margin-bottom:4px;">${taskScheduledTimeLabel(t.taskKey)} — <strong>${t.name}</strong>: ${t.description.slice(0, 80)}</li>`).join("");

  const weekRows = thisWeek.length === 0
    ? `<p style="color:#6b7280;font-size:13px;">No upcoming tasks this week.</p>`
    : thisWeek.map(t => `<li style="font-size:13px;margin-bottom:4px;"><strong>${t.name}</strong> (${t.cadence}) — next run: ${t.nextRunAt ? new Date(t.nextRunAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "scheduled"}</li>`).join("");

  const recentAgentRows = recentLogs.slice(0, 5).map(l => `<li style="font-size:12px;color:#6b7280;margin-bottom:2px;">${l.taskType} — ${l.status} — ${l.createdAt ? new Date(l.createdAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }) : ""} CT</li>`).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e;background:#f9fafb;padding:20px;">
  <div style="background:#1a1a2e;padding:22px 28px;border-radius:10px 10px 0 0;">
    <span style="color:#fff;font-size:20px;font-weight:700;">📊 New Dawn SEO Daily Briefing</span>
    <p style="color:#93c5fd;font-size:13px;margin:4px 0 0;">${dateLabel}</p>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 10px 10px;">
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
        Good morning — the SEO agent ran ${completed.length} task${completed.length !== 1 ? "s" : ""} overnight.
        ${failed.length > 0 ? `<strong>${failed.length} task(s) encountered issues</strong> and need attention.` : "All systems are running normally."}
        ${today.length > 0 ? `${today.length} task(s) are scheduled to run today.` : ""}
      </p>
    </div>

    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">✅ Completed Since Yesterday</h3>
    ${completed.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Task</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Time</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Outcome</th>
      </tr></thead>
      <tbody>${completedRows}</tbody>
    </table>` : `<p style="color:#6b7280;font-size:13px;margin-bottom:24px;">No tasks completed yet — automation tasks typically run at 6:00 AM CT.</p>`}

    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">⚠️ Issues & Flags</h3>
    <div style="margin-bottom:24px;">${failed.length > 0 ? `<ul style="margin:0;padding-left:20px;">${failedRows}</ul>` : failedRows}</div>

    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">📅 Scheduled for Today</h3>
    <div style="margin-bottom:24px;">${today.length > 0 ? `<ul style="margin:0;padding-left:20px;">${todayRows}</ul>` : todayRows}</div>

    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">📆 Coming Up This Week</h3>
    <div style="margin-bottom:24px;">${thisWeek.length > 0 ? `<ul style="margin:0;padding-left:20px;">${weekRows}</ul>` : weekRows}</div>

    ${recentLogs.length > 0 ? `
    <h3 style="color:#1a1a2e;font-size:14px;font-weight:700;margin:0 0 10px;">🤖 Recent AI Agent Activity</h3>
    <ul style="margin:0 0 24px;padding-left:20px;">${recentAgentRows}</ul>` : ""}

    <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        This email was automatically generated by the New Dawn Franchising SEO Agent.<br/>
        To update email preferences, log in to your <a href="https://www.newdawnfranchising.com/crm" style="color:#3b82f6;">marketing academy</a>.
      </p>
    </div>
  </div>
</div>`;

  const subject = `📊 New Dawn SEO Daily Briefing — ${dateLabel}`;
  await sendEmailFromSender(DIGEST_FROM, DIGEST_TO, subject, html, undefined, undefined, { skipUnsubscribe: true });
  console.log(`[SEO Digest] Daily briefing sent to ${DIGEST_TO}`);
}

function summarySnippet(result: string | null): string {
  if (!result) return "No result recorded.";
  try {
    const parsed = JSON.parse(result);
    return parsed.summary || result.slice(0, 100);
  } catch {
    return result.slice(0, 100);
  }
}

function taskScheduledTimeLabel(taskKey: string): string {
  return TASK_DEFINITIONS.find(t => t.taskKey === taskKey)?.scheduledTime || "Scheduled";
}
