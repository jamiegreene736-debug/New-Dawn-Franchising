import { Router } from "express";
import { db } from "./db";
import { partnerLeads, partnerSequenceEvents } from "@shared/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import {
  initializePartnerSequence,
  pausePartnerSequence,
  cancelPartnerSequence,
  processPartnerSequence,
} from "./partner-sequence-service";
import { z } from "zod";

const router = Router();

const AUDIENCE_TYPES = [
  "immigration_attorney",
  "wealth_manager",
  "business_advisor",
  "e2_consultant",
  "immigration_consultant",
  "other",
] as const;

const createLeadSchema = z.object({
  fullName: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  mailingAddress: z.string().optional(),
  linkedinUrl: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  audienceType: z.enum(AUDIENCE_TYPES).default("other"),
  spanishFlag: z.boolean().default(false),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.string().optional(),
  linkedinConnected: z.boolean().optional(),
  score: z.number().optional(),
});

// ─── List leads ───────────────────────────────────────────────────────────────

router.get("/leads", async (req, res) => {
  try {
    const { q, status, audienceType, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.select().from(partnerLeads);

    const conditions: any[] = [];
    if (q) {
      conditions.push(or(
        ilike(partnerLeads.fullName, `%${q}%`),
        ilike(partnerLeads.company, `%${q}%`),
        ilike(partnerLeads.email, `%${q}%`),
      ));
    }
    if (status) conditions.push(eq(partnerLeads.status, status));
    if (audienceType) conditions.push(eq(partnerLeads.audienceType, audienceType));

    const leads = await db.select().from(partnerLeads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(partnerLeads.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(partnerLeads)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({ leads, total: Number(countResult.count), page: parseInt(page) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get single lead + timeline ───────────────────────────────────────────────

router.get("/leads/:id", async (req, res) => {
  try {
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, req.params.id)).limit(1);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const events = await db.select().from(partnerSequenceEvents)
      .where(eq(partnerSequenceEvents.leadId, lead.id))
      .orderBy(partnerSequenceEvents.day, partnerSequenceEvents.scheduledAt);

    res.json({ lead, events });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Create lead ──────────────────────────────────────────────────────────────

router.post("/leads", async (req, res) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const [lead] = await db.insert(partnerLeads).values({
      ...data,
      email: data.email || null,
    }).returning();
    res.status(201).json(lead);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: err.message });
  }
});

// ─── Update lead ──────────────────────────────────────────────────────────────

router.patch("/leads/:id", async (req, res) => {
  try {
    const data = updateLeadSchema.parse(req.body);
    const [lead] = await db.update(partnerLeads)
      .set({ ...data, email: data.email || null } as any)
      .where(eq(partnerLeads.id, req.params.id))
      .returning();
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: err.message });
  }
});

// ─── Delete lead ──────────────────────────────────────────────────────────────

router.delete("/leads/:id", async (req, res) => {
  try {
    await db.delete(partnerSequenceEvents).where(eq(partnerSequenceEvents.leadId, req.params.id));
    await db.delete(partnerLeads).where(eq(partnerLeads.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Initialize / start sequence ─────────────────────────────────────────────

router.post("/leads/:id/initialize", async (req, res) => {
  try {
    await initializePartnerSequence(req.params.id);
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, req.params.id)).limit(1);
    const events = await db.select().from(partnerSequenceEvents)
      .where(eq(partnerSequenceEvents.leadId, req.params.id))
      .orderBy(partnerSequenceEvents.scheduledAt);
    res.json({ lead, events, message: "Sequence initialized" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Pause sequence ───────────────────────────────────────────────────────────

router.post("/leads/:id/pause", async (req, res) => {
  try {
    const { reason = "Manually paused" } = req.body;
    await pausePartnerSequence(req.params.id, reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Cancel / remove sequence ─────────────────────────────────────────────────

router.post("/leads/:id/cancel", async (req, res) => {
  try {
    const { reason = "Manually cancelled" } = req.body;
    await cancelPartnerSequence(req.params.id, reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Mark LinkedIn connected ──────────────────────────────────────────────────

router.post("/leads/:id/linkedin-connected", async (req, res) => {
  try {
    await db.update(partnerLeads)
      .set({ linkedinConnected: true })
      .where(eq(partnerLeads.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Mark replied ─────────────────────────────────────────────────────────────

router.post("/leads/:id/replied", async (req, res) => {
  try {
    await pausePartnerSequence(req.params.id, "Lead replied — handed to Dylan");
    await db.update(partnerLeads)
      .set({ status: "replied" })
      .where(eq(partnerLeads.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Bulk import leads ────────────────────────────────────────────────────────

router.post("/leads/bulk", async (req, res) => {
  try {
    const { leads: rawLeads, autoStart = false } = req.body as {
      leads: z.infer<typeof createLeadSchema>[];
      autoStart?: boolean;
    };

    const validated = rawLeads.map(l => createLeadSchema.parse(l));
    const inserted = await db.insert(partnerLeads)
      .values(validated.map(l => ({ ...l, email: l.email || null })))
      .returning();

    if (autoStart) {
      for (const lead of inserted) {
        await initializePartnerSequence(lead.id).catch(e =>
          console.error(`[PartnerRoutes] Auto-init failed for ${lead.id}:`, e.message)
        );
      }
    }

    res.status(201).json({ inserted: inserted.length, leads: inserted });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
    res.status(500).json({ message: err.message });
  }
});

// ─── Manual sequence processor trigger (admin only) ──────────────────────────

router.post("/process", async (req, res) => {
  try {
    await processPartnerSequence();
    res.json({ success: true, message: "Partner sequence processed" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Stats summary ────────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const byStatus = await db.select({
      status: partnerLeads.status,
      count: sql<number>`count(*)`,
    }).from(partnerLeads).groupBy(partnerLeads.status);

    const byAudience = await db.select({
      audienceType: partnerLeads.audienceType,
      count: sql<number>`count(*)`,
    }).from(partnerLeads).groupBy(partnerLeads.audienceType);

    const [total] = await db.select({ count: sql<number>`count(*)` }).from(partnerLeads);
    const [active] = await db.select({ count: sql<number>`count(*)` }).from(partnerLeads)
      .where(eq(partnerLeads.status, "active"));
    const [replied] = await db.select({ count: sql<number>`count(*)` }).from(partnerLeads)
      .where(eq(partnerLeads.status, "replied"));

    res.json({
      total: Number(total.count),
      active: Number(active.count),
      replied: Number(replied.count),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, Number(r.count)])),
      byAudience: Object.fromEntries(byAudience.map(r => [r.audienceType, Number(r.count)])),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
