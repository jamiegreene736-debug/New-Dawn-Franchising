import { Router, Request, Response } from "express";
import { db } from "./db";
import { heygenVideos, heygenSettings, heygenScriptTemplates, agentLeads } from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  generateVideoScript, submitVideoToHeygen, pollVideoStatus, listHeygenAvatars,
  listHeygenVoices, createVideoRecord, startVideoGeneration, sendVideo,
  recommendChannel, getHeygenStats, getHeygenSettings, DEMO_MODE,
} from "./heygen-service";

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any)?.adminId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await getHeygenSettings();
    return res.json({ ...settings, demoMode: DEMO_MODE });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.patch("/settings", requireAdmin, async (req, res) => {
  const { avatarId, voiceId, defaultChannel, speakingSpeed, bgColour, dailyVideoLimit, autoHotLeads, autoTouch3, autoPostCall } = req.body;
  try {
    await db.insert(heygenSettings).values({ id: 1, avatarId: avatarId ?? "", voiceId: voiceId ?? "" })
      .onConflictDoUpdate({ target: heygenSettings.id, set: {
        avatarId: avatarId ?? "", voiceId: voiceId ?? "", defaultChannel: defaultChannel ?? "email",
        speakingSpeed: speakingSpeed ?? 1.0, bgColour: bgColour ?? "#ffffff",
        dailyVideoLimit: dailyVideoLimit ?? 5, autoHotLeads: autoHotLeads ?? true,
        autoTouch3: autoTouch3 ?? true, autoPostCall: autoPostCall ?? true,
        updatedAt: new Date(),
      }});
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Avatar & Voice Lists ─────────────────────────────────────────────────────

router.get("/avatars", requireAdmin, async (req, res) => {
  try {
    const avatars = await listHeygenAvatars();
    return res.json(avatars);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get("/voices", requireAdmin, async (req, res) => {
  try {
    const voices = await listHeygenVoices();
    return res.json(voices);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Script Generation ────────────────────────────────────────────────────────

router.post("/generate-script", requireAdmin, async (req, res) => {
  const { leadId, touchType } = req.body;
  if (!leadId) return res.status(400).json({ error: "leadId required" });
  try {
    const leads = await db.select().from(agentLeads).where(eq(agentLeads.id, leadId)).limit(1);
    const lead = leads[0];
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const result = await generateVideoScript({
      firstName: lead.firstName, company: lead.company, country: lead.country,
      aiScore: lead.aiScore, researchDossier: lead.researchDossier, sequenceStage: lead.sequenceStage,
    }, touchType ?? "first_contact");
    const channel = recommendChannel({ email: lead.email, phone: lead.phone, country: lead.country, sequenceStage: lead.sequenceStage });
    return res.json({ ...result, recommendedChannel: channel, wordCount: result.script.split(/\s+/).length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Video Generation ─────────────────────────────────────────────────────────

router.post("/generate", requireAdmin, async (req, res) => {
  const { leadId, script, subjectLine, deliveryChannel, scriptTemplateId } = req.body;
  if (!leadId || !script) return res.status(400).json({ error: "leadId and script required" });

  try {
    const leads = await db.select().from(agentLeads).where(eq(agentLeads.id, leadId)).limit(1);
    const lead = leads[0];
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const channel = deliveryChannel ?? recommendChannel({ email: lead.email, phone: lead.phone, country: lead.country, sequenceStage: lead.sequenceStage });
    const videoId = await createVideoRecord({
      leadId, leadName: `${lead.firstName} ${lead.lastName}`.trim(),
      leadEmail: lead.email ?? undefined, leadPhone: lead.phone ?? undefined,
      script, subjectLine, deliveryChannel: channel, scriptTemplateId,
    });

    // Start rendering async — don't block the response
    startVideoGeneration(videoId).catch(e => console.error("[HeyGen] Background render error:", e.message));

    return res.json({ ok: true, videoId, status: "rendering", estimatedSecs: DEMO_MODE ? 3 : 180 });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Poll Video Status ────────────────────────────────────────────────────────

router.get("/videos/:id/status", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.id, String(req.params.id))).limit(1);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const video = rows[0];

    // If rendering and has a HeyGen ID, poll live
    if (video.status === "rendering" && video.heygenVideoId) {
      try {
        const live = await pollVideoStatus(video.heygenVideoId);
        if (live.status === "completed") {
          await db.update(heygenVideos).set({
            status: "completed", videoUrl: live.videoUrl, thumbnailUrl: live.thumbnailUrl,
            renderCompletedAt: new Date(),
            renderDurationSec: video.renderStartedAt
              ? Math.round((Date.now() - new Date(video.renderStartedAt).getTime()) / 1000) : null,
            updatedAt: new Date(),
          }).where(eq(heygenVideos.id, video.id));
          const updated = await db.select().from(heygenVideos).where(eq(heygenVideos.id, String(req.params.id))).limit(1);
          return res.json(updated[0]);
        } else if (live.status === "failed") {
          await db.update(heygenVideos).set({ status: "failed", updatedAt: new Date() }).where(eq(heygenVideos.id, video.id));
        }
      } catch {}
    }
    return res.json(video);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Send Video ───────────────────────────────────────────────────────────────

router.post("/videos/:id/send", requireAdmin, async (req, res) => {
  try {
    await sendVideo(String(req.params.id));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Update channel before sending ───────────────────────────────────────────

router.patch("/videos/:id", requireAdmin, async (req, res) => {
  const { deliveryChannel, script, subjectLine } = req.body;
  try {
    const updates: any = { updatedAt: new Date() };
    if (deliveryChannel) updates.deliveryChannel = deliveryChannel;
    if (script) updates.script = script;
    if (subjectLine) updates.subjectLine = subjectLine;
    await db.update(heygenVideos).set(updates).where(eq(heygenVideos.id, String(req.params.id)));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Resend video ─────────────────────────────────────────────────────────────

router.post("/videos/:id/resend", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.id, String(req.params.id))).limit(1);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const original = rows[0];
    // Create a fresh record with new tracking token
    const appBase = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
    const [newRow] = await db.insert(heygenVideos).values({
      leadId: original.leadId, leadName: original.leadName, leadEmail: original.leadEmail,
      leadPhone: original.leadPhone, script: original.script, subjectLine: original.subjectLine,
      deliveryChannel: original.deliveryChannel, heygenVideoId: original.heygenVideoId,
      status: original.status, videoUrl: original.videoUrl, thumbnailUrl: original.thumbnailUrl,
      deliveryStatus: "not_sent",
    }).returning();
    const trackingUrl = `${appBase}/v/${newRow.trackingToken}`;
    await db.update(heygenVideos).set({ trackingUrl }).where(eq(heygenVideos.id, newRow.id));
    await sendVideo(newRow.id);
    return res.json({ ok: true, newVideoId: newRow.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Get Videos for Lead ──────────────────────────────────────────────────────

router.get("/leads/:leadId/videos", requireAdmin, async (req, res) => {
  try {
    const videos = await db.select().from(heygenVideos)
      .where(eq(heygenVideos.leadId, String(req.params.leadId)))
      .orderBy(desc(heygenVideos.createdAt));
    return res.json(videos);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── All Videos ───────────────────────────────────────────────────────────────

router.get("/videos", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const videos = await db.select().from(heygenVideos).orderBy(desc(heygenVideos.createdAt)).limit(limit);
    return res.json(videos);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await getHeygenStats();
    return res.json(stats);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Script Templates ─────────────────────────────────────────────────────────

router.get("/templates", requireAdmin, async (req, res) => {
  try {
    const templates = await db.select().from(heygenScriptTemplates).orderBy(desc(heygenScriptTemplates.useCount));
    return res.json(templates);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/templates", requireAdmin, async (req, res) => {
  const { label, script, touchType } = req.body;
  if (!label || !script) return res.status(400).json({ error: "label and script required" });
  try {
    const [row] = await db.insert(heygenScriptTemplates).values({ label, script, touchType }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.patch("/templates/:id", requireAdmin, async (req, res) => {
  const { label, script, touchType } = req.body;
  try {
    await db.update(heygenScriptTemplates).set({ label, script, touchType }).where(eq(heygenScriptTemplates.id, String(req.params.id)));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.delete("/templates/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(heygenScriptTemplates).where(eq(heygenScriptTemplates.id, String(req.params.id)));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Save script as template ──────────────────────────────────────────────────

router.post("/videos/:id/save-template", requireAdmin, async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: "label required" });
  try {
    const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.id, String(req.params.id))).limit(1);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const [tmpl] = await db.insert(heygenScriptTemplates).values({ label, script: rows[0].script }).returning();
    return res.json(tmpl);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
