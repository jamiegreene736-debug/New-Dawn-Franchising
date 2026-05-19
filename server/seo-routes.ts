import { Router } from "express";
import { db } from "./db";
import {
  seoKeywords, seoKeywordRankings, seoGeneratedContent,
  seoAgentTasks, seoBacklinkOutreach, seoScheduledTasks,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  checkKeywordRanking, researchKeyword, generateSeoContent,
  generateMetaTags, calculateSeoScore, runAgentTask, runSeoBrief,
} from "./seo-service";
import { hunterFindEmail } from "./hunter-service";

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.adminId && !req.session?.isAdmin) return res.status(401).json({ message: "Admin required" });
  next();
}

export function registerSeoRoutes(app: any) {
  // ── Overview ────────────────────────────────────────────────────────────────
  app.get("/api/seo/overview", requireAdmin, async (_req: any, res: any) => {
    try {
      const keywords = await db.select().from(seoKeywords);
      const rankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));
      const recentTasks = await db.select().from(seoAgentTasks).orderBy(desc(seoAgentTasks.createdAt)).limit(10);

      const latestByKeyword = new Map<string, number>();
      for (const r of rankings) {
        if (!latestByKeyword.has(r.keywordId) && r.position) {
          latestByKeyword.set(r.keywordId, r.position);
        }
      }
      const positions = [...latestByKeyword.values()];
      const avgPos = positions.length
        ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length)
        : null;

      const { score } = await calculateSeoScore();

      res.json({
        keywordsTracked: keywords.length,
        avgPosition: avgPos,
        top10Count: positions.filter(p => p <= 10).length,
        top3Count: positions.filter(p => p <= 3).length,
        seoScore: score,
        recentTasks,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to load overview" });
    }
  });

  // ── Keywords ─────────────────────────────────────────────────────────────────
  app.get("/api/seo/keywords", requireAdmin, async (_req: any, res: any) => {
    try {
      const keywords = await db.select().from(seoKeywords).orderBy(desc(seoKeywords.createdAt));
      const rankings = await db.select().from(seoKeywordRankings).orderBy(desc(seoKeywordRankings.checkedAt));

      const latestRanking = new Map<string, { position: number | null; checkedAt: Date; url: string | null }>();
      const prevRanking = new Map<string, number | null>();

      for (const r of rankings) {
        if (!latestRanking.has(r.keywordId)) {
          latestRanking.set(r.keywordId, { position: r.position, checkedAt: r.checkedAt, url: r.url });
        } else if (!prevRanking.has(r.keywordId)) {
          prevRanking.set(r.keywordId, r.position);
        }
      }

      const result = keywords.map(kw => ({
        ...kw,
        currentPosition: latestRanking.get(kw.id)?.position ?? null,
        previousPosition: prevRanking.get(kw.id) ?? null,
        rankingUrl: latestRanking.get(kw.id)?.url ?? null,
        lastChecked: latestRanking.get(kw.id)?.checkedAt ?? null,
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  app.post("/api/seo/keywords", requireAdmin, async (req: any, res: any) => {
    try {
      const { keyword, targetUrl, tags } = req.body as { keyword: string; targetUrl?: string; tags?: string };
      if (!keyword?.trim()) return res.status(400).json({ message: "Keyword is required" });
      const [created] = await db.insert(seoKeywords).values({ keyword: keyword.trim(), targetUrl, tags }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to add keyword" });
    }
  });

  app.delete("/api/seo/keywords/:id", requireAdmin, async (req: any, res: any) => {
    try {
      await db.delete(seoKeywords).where(eq(seoKeywords.id, req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete keyword" });
    }
  });

  // ── Keyword research ─────────────────────────────────────────────────────────
  app.post("/api/seo/keywords/research", requireAdmin, async (req: any, res: any) => {
    try {
      const { keyword } = req.body as { keyword: string };
      if (!keyword?.trim()) return res.status(400).json({ message: "Keyword required" });
      const result = await researchKeyword(keyword.trim());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Research failed" });
    }
  });

  // ── Check a single keyword ranking ──────────────────────────────────────────
  app.post("/api/seo/keywords/:id/check", requireAdmin, async (req: any, res: any) => {
    try {
      const [kw] = await db.select().from(seoKeywords).where(eq(seoKeywords.id, req.params.id));
      if (!kw) return res.status(404).json({ message: "Keyword not found" });
      const { position, url } = await checkKeywordRanking(kw.keyword, kw.domain);
      await db.insert(seoKeywordRankings).values({ keywordId: kw.id, position, url });
      res.json({ position, url, checkedAt: new Date() });
    } catch (err: any) {
      res.status(500).json({ message: "Ranking check failed" });
    }
  });

  // ── Ranking history for a keyword ────────────────────────────────────────────
  app.get("/api/seo/keywords/:id/history", requireAdmin, async (req: any, res: any) => {
    try {
      const history = await db.select()
        .from(seoKeywordRankings)
        .where(eq(seoKeywordRankings.keywordId, req.params.id))
        .orderBy(desc(seoKeywordRankings.checkedAt))
        .limit(30);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // ── SEO Score ────────────────────────────────────────────────────────────────
  app.get("/api/seo/score", requireAdmin, async (_req: any, res: any) => {
    try {
      const result = await calculateSeoScore();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to calculate score" });
    }
  });

  // ── Content ───────────────────────────────────────────────────────────────────
  app.get("/api/seo/content", requireAdmin, async (_req: any, res: any) => {
    try {
      const items = await db.select().from(seoGeneratedContent).orderBy(desc(seoGeneratedContent.createdAt));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.post("/api/seo/content/generate", requireAdmin, async (req: any, res: any) => {
    try {
      const { keyword, secondaryKeywords, tone, wordCount } = req.body;
      if (!keyword?.trim()) return res.status(400).json({ message: "Keyword required" });
      const generated = await generateSeoContent({ keyword, secondaryKeywords, tone, wordCount });
      const [saved] = await db.insert(seoGeneratedContent).values({
        keyword,
        title: generated.title,
        body: generated.body,
        metaDescription: generated.metaDescription,
        wordCount: generated.wordCount,
        status: "draft",
      }).returning();
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Content generation failed" });
    }
  });

  app.post("/api/seo/content/meta-tags", requireAdmin, async (req: any, res: any) => {
    try {
      const { url } = req.body;
      if (!url?.trim()) return res.status(400).json({ message: "URL required" });
      const result = await generateMetaTags(url);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Meta tag generation failed" });
    }
  });

  app.delete("/api/seo/content/:id", requireAdmin, async (req: any, res: any) => {
    try {
      await db.delete(seoGeneratedContent).where(eq(seoGeneratedContent.id, req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // ── Backlink outreach ─────────────────────────────────────────────────────────
  app.get("/api/seo/backlinks/outreach", requireAdmin, async (_req: any, res: any) => {
    try {
      const items = await db.select().from(seoBacklinkOutreach).orderBy(desc(seoBacklinkOutreach.createdAt));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch outreach" });
    }
  });

  app.post("/api/seo/backlinks/outreach", requireAdmin, async (req: any, res: any) => {
    try {
      const { targetSite, targetUrl, contactEmail, notes, emailBody } = req.body;
      if (!targetSite?.trim()) return res.status(400).json({ message: "Target site required" });
      const [created] = await db.insert(seoBacklinkOutreach).values({
        targetSite: targetSite.trim(),
        targetUrl,
        contactEmail,
        notes,
        emailBody,
        status: "not_sent",
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to add outreach" });
    }
  });

  app.patch("/api/seo/backlinks/outreach/:id", requireAdmin, async (req: any, res: any) => {
    try {
      const { status, notes, contactEmail } = req.body;
      const [updated] = await db.update(seoBacklinkOutreach)
        .set({ ...(status && { status }), ...(notes !== undefined && { notes }), ...(contactEmail !== undefined && { contactEmail }) })
        .where(eq(seoBacklinkOutreach.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update outreach" });
    }
  });

  app.delete("/api/seo/backlinks/outreach/:id", requireAdmin, async (req: any, res: any) => {
    try {
      await db.delete(seoBacklinkOutreach).where(eq(seoBacklinkOutreach.id, req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // Find email for outreach target
  app.post("/api/seo/backlinks/find-email", requireAdmin, async (req: any, res: any) => {
    try {
      const { domain, firstName, lastName, company } = req.body;
      if (!domain) return res.status(400).json({ message: "Domain required" });
      const email = await hunterFindEmail(firstName || "", lastName || "", domain);
      res.json({ email });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Email lookup failed" });
    }
  });

  // ── AI Agent ──────────────────────────────────────────────────────────────────
  app.get("/api/seo/agent/tasks", requireAdmin, async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string || "50");
      const tasks = await db.select().from(seoAgentTasks).orderBy(desc(seoAgentTasks.createdAt)).limit(limit);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/seo/agent/run/:taskType", requireAdmin, async (req: any, res: any) => {
    const { taskType } = req.params;
    try {
      // Create a "running" record immediately
      const [task] = await db.insert(seoAgentTasks).values({
        taskType,
        status: "running",
        startedAt: new Date(),
      }).returning();

      // Run asynchronously — respond immediately with pending task
      res.json({ ...task, status: "running" });

      // Execute in background
      runAgentTask(taskType).then(async ({ status, summary }) => {
        await db.update(seoAgentTasks)
          .set({ status, resultSummary: summary, completedAt: new Date() })
          .where(eq(seoAgentTasks.id, task.id));
      }).catch(async (err) => {
        await db.update(seoAgentTasks)
          .set({ status: "failed", errorMessage: err?.message, completedAt: new Date() })
          .where(eq(seoAgentTasks.id, task.id));
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to start task" });
    }
  });

  // ── Manual SEO brief trigger ──────────────────────────────────────────────
  app.post("/api/seo/run/brief", requireAdmin, async (_req: any, res: any) => {
    res.json({ message: "SEO brief sending in background" });
    runSeoBrief().catch(e => console.error("[SEO] Manual brief error:", e));
  });

  // ── Scheduled automation tasks list ──────────────────────────────────────
  app.get("/api/seo/automation/tasks", requireAdmin, async (_req: any, res: any) => {
    const tasks = await db.select().from(seoScheduledTasks).orderBy(seoScheduledTasks.cadence);
    res.json(tasks);
  });

  // ── Run a specific automation task manually ───────────────────────────────
  app.post("/api/seo/automation/run/:key", requireAdmin, async (req: any, res: any) => {
    const { key } = req.params;
    const { runScheduledTaskByKey } = await import("./seo-automation");
    const task = await db.select().from(seoScheduledTasks).where(eq(seoScheduledTasks.taskKey, key));
    if (!task.length) return res.status(404).json({ message: "Task not found" });
    res.json({ message: `Running ${key} in background` });
    runScheduledTaskByKey(key).catch(e => console.error(`[SEO Auto] Manual run ${key}:`, e));
  });

  // ── Toggle a task enabled/disabled ───────────────────────────────────────
  app.patch("/api/seo/automation/tasks/:key", requireAdmin, async (req: any, res: any) => {
    const { key } = req.params;
    const { isEnabled } = req.body;
    await db.update(seoScheduledTasks).set({ isEnabled }).where(eq(seoScheduledTasks.taskKey, key));
    res.json({ success: true });
  });

  // ── Send SEO digest email manually ───────────────────────────────────────
  app.post("/api/seo/automation/digest", requireAdmin, async (_req: any, res: any) => {
    const { sendSeoDigestEmail } = await import("./seo-automation");
    res.json({ message: "Digest sending in background" });
    sendSeoDigestEmail().catch(e => console.error("[SEO] Digest error:", e));
  });
}
