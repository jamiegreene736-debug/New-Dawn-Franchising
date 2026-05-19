import { Router } from "express";
import { db } from "./db";
import {
  seoCampaigns, seoCampaignActions, seoCampaignBlockers, seoContentDrafts,
} from "@shared/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { runCampaignDailyLoop, runAllActiveCampaigns } from "./seo-campaign-agent";
import { requireAdmin } from "./seo-routes";

const router = Router();

// ─── Campaigns CRUD ───────────────────────────────────────────────────────────

router.get("/", requireAdmin, async (req, res) => {
  try {
    const campaigns = await db.select().from(seoCampaigns).orderBy(desc(seoCampaigns.createdAt));
    // Attach counts
    const enriched = await Promise.all(campaigns.map(async (c) => {
      const [{ openBlockers }] = await db.select({ openBlockers: count() })
        .from(seoCampaignBlockers)
        .where(and(eq(seoCampaignBlockers.campaignId, c.id), eq(seoCampaignBlockers.status, "open")));
      const [{ pendingDrafts }] = await db.select({ pendingDrafts: count() })
        .from(seoContentDrafts)
        .where(and(eq(seoContentDrafts.campaignId, c.id), eq(seoContentDrafts.status, "awaiting_approval")));
      const [{ totalActions }] = await db.select({ totalActions: count() })
        .from(seoCampaignActions)
        .where(eq(seoCampaignActions.campaignId, c.id));
      return { ...c, openBlockers: Number(openBlockers), pendingDrafts: Number(pendingDrafts), totalActions: Number(totalActions) };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { targetKeyword, targetUrl, goalRank, deadline, monthlyBudgetCap } = req.body;
    if (!targetKeyword || !targetUrl) return res.status(400).json({ error: "targetKeyword and targetUrl required" });
    const [campaign] = await db.insert(seoCampaigns).values({
      targetKeyword,
      targetUrl,
      goalRank: goalRank || 10,
      deadline: deadline ? new Date(deadline) : null,
      monthlyBudgetCap: monthlyBudgetCap || 0,
      status: "active",
    }).returning();
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const [campaign] = await db.select().from(seoCampaigns).where(eq(seoCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ error: "Not found" });
    const [actions, blockers, drafts] = await Promise.all([
      db.select().from(seoCampaignActions).where(eq(seoCampaignActions.campaignId, campaign.id)).orderBy(desc(seoCampaignActions.createdAt)).limit(50),
      db.select().from(seoCampaignBlockers).where(eq(seoCampaignBlockers.campaignId, campaign.id)).orderBy(desc(seoCampaignBlockers.createdAt)),
      db.select().from(seoContentDrafts).where(eq(seoContentDrafts.campaignId, campaign.id)).orderBy(desc(seoContentDrafts.createdAt)),
    ]);
    res.json({ campaign, actions, blockers, drafts });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { status, goalRank, deadline, monthlyBudgetCap, autoPublish, killSwitch } = req.body;
    const [updated] = await db.update(seoCampaigns).set({
      ...(status !== undefined && { status }),
      ...(goalRank !== undefined && { goalRank }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(monthlyBudgetCap !== undefined && { monthlyBudgetCap }),
      ...(autoPublish !== undefined && { autoPublish }),
      ...(killSwitch !== undefined && { killSwitch }),
      updatedAt: new Date(),
    }).where(eq(seoCampaigns.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(seoCampaigns).where(eq(seoCampaigns.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Run daily loop on-demand ─────────────────────────────────────────────────

router.post("/:id/run", requireAdmin, async (req, res) => {
  try {
    const [campaign] = await db.select().from(seoCampaigns).where(eq(seoCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ error: "Not found" });
    const result = await runCampaignDailyLoop(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Run all active campaigns (admin manual trigger) ──────────────────────────
router.post("/run-all", requireAdmin, async (req, res) => {
  try {
    runAllActiveCampaigns().catch((e: any) =>
      console.error("[SEO Campaign Routes] run-all error:", e.message)
    );
    res.json({ ok: true, message: "SEO Campaign Agent triggered — check logs and SMS for results." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Blockers ─────────────────────────────────────────────────────────────────

router.get("/blockers/all", requireAdmin, async (req, res) => {
  try {
    const blockers = await db.select().from(seoCampaignBlockers).orderBy(desc(seoCampaignBlockers.createdAt));
    res.json(blockers);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/blockers/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body; // open | resolved | skipped
    if (!status) return res.status(400).json({ error: "status required" });
    const [updated] = await db.update(seoCampaignBlockers).set({
      status,
      resolvedAt: status !== "open" ? new Date() : null,
    }).where(eq(seoCampaignBlockers.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Content Drafts ───────────────────────────────────────────────────────────

router.get("/drafts/all", requireAdmin, async (req, res) => {
  try {
    const drafts = await db.select().from(seoContentDrafts).orderBy(desc(seoContentDrafts.createdAt));
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/drafts/:id", requireAdmin, async (req, res) => {
  try {
    const { status, reviewNotes, publishedUrl } = req.body;
    const [updated] = await db.update(seoContentDrafts).set({
      ...(status !== undefined && { status }),
      ...(reviewNotes !== undefined && { reviewNotes }),
      ...(publishedUrl !== undefined && { publishedUrl }),
      updatedAt: new Date(),
    }).where(eq(seoContentDrafts.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Global Kill Switch ───────────────────────────────────────────────────────

router.post("/kill-switch", requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    await db.update(seoCampaigns).set({ killSwitch: !!enabled, updatedAt: new Date() });
    res.json({ success: true, killSwitch: !!enabled });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
