import { db } from "./db";
import { heygenVideos, heygenSettings, agentLeads } from "../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendSlackMessage } from "./slack-service";

const HEYGEN_BASE = "https://api.heygen.com";
const DEMO_MODE = !process.env.HEYGEN_API_KEY;

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_VIDEOS = [
  {
    id: "demo-v1",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnailUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
    duration: 42,
  },
  {
    id: "demo-v2",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnailUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
    duration: 38,
  },
  {
    id: "demo-v3",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnailUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
    duration: 51,
  },
];

// ─── HeyGen API Helpers ───────────────────────────────────────────────────────

async function heygenFetch(path: string, opts: RequestInit = {}) {
  const url = `${HEYGEN_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Api-Key": process.env.HEYGEN_API_KEY ?? "",
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const json = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new Error(json?.message || `HeyGen API error: ${res.status}`);
  return json;
}

// ─── Get Settings ─────────────────────────────────────────────────────────────

export async function getHeygenSettings() {
  const rows = await db.select().from(heygenSettings).where(eq(heygenSettings.id, 1)).limit(1);
  return rows[0] ?? {
    id: 1, avatarId: process.env.HEYGEN_AVATAR_ID ?? "", voiceId: process.env.HEYGEN_VOICE_ID ?? "",
    defaultChannel: "email", speakingSpeed: 1.0, bgColour: "#ffffff",
    dailyVideoLimit: 5, autoHotLeads: true, autoTouch3: true, autoPostCall: true,
  };
}

// ─── Generate Script via OpenAI ───────────────────────────────────────────────

export async function generateVideoScript(lead: {
  firstName: string; company?: string | null; country?: string | null;
  aiScore?: number; researchDossier?: any; sequenceStage?: number;
  tags?: string[];
}, touchType: string = "first_contact"): Promise<{ script: string; subjectLine: string }> {
  const baseUrl   = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!;
  const apiKey    = process.env.AI_INTEGRATIONS_OPENAI_OPENAI_API_KEY!;
  const model     = "gpt-4o";

  const tier = (lead.aiScore ?? 0) >= 85 ? "HOT" : (lead.aiScore ?? 0) >= 65 ? "WARM" : "NURTURE";
  const research = lead.researchDossier
    ? `Summary: ${(lead.researchDossier as any).summary ?? "No summary"}\nRecent activity: ${(lead.researchDossier as any).recentActivity ?? "Unknown"}`
    : "No research dossier available.";

  const systemPrompt = `You are writing a short personalised video script for Dylan to record as an AI avatar video using HeyGen. Dylan is a franchise consultant at New Dawn Franchising (newdawnfranchising.com).

The video will be sent directly to the lead as part of their outreach sequence. It should feel like a genuine personal video message from Dylan — warm, direct, and specific to the recipient. Not a sales pitch. A human moment.

Script rules:
- Maximum 150 words (ideal is 90-120 words)
- Open with the lead's first name directly: "Hey [Name],"
- Reference one specific thing about them or their situation
- One or two sentences about how New Dawn Franchising could help
- Single clear CTA: book a quick call (reference [CALENDLY LINK] as placeholder)
- Close warmly as Dylan
- Write naturally for spoken delivery — short sentences, no jargon, no bullet points
- Never mention that this is an AI-generated video
- Never make promises about visa outcomes
- Never claim to be human if sincerely asked

Also provide a short email subject line for wrapping this video in an email (10 words max).
Respond in JSON: { "script": "...", "subjectLine": "..." }`;

  const userPrompt = `Write a personalised HeyGen video script for this lead:
Name: ${lead.firstName}
Company: ${lead.company ?? "Unknown"}
Country: ${lead.country ?? "Unknown"}
Score: ${lead.aiScore ?? 0} — ${tier}
Touch type: ${touchType}
Research: ${research}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 400, temperature: 0.8, response_format: { type: "json_object" } }),
    });
    const json = await res.json() as any;
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    return { script: parsed.script ?? "", subjectLine: parsed.subjectLine ?? `Personal message from Dylan for ${lead.firstName}` };
  } catch (e: any) {
    console.error("[HeyGen] Script generation failed:", e.message);
    return {
      script: `Hey ${lead.firstName}, I wanted to reach out personally because I think what we're doing at New Dawn Franchising could genuinely be relevant to your situation. I'd love to jump on a quick 15-minute call — no pressure, just a conversation. Book a time at [CALENDLY LINK]. Looking forward to it. Dylan.`,
      subjectLine: `A personal note for you, ${lead.firstName}`,
    };
  }
}

// ─── Submit Video to HeyGen ───────────────────────────────────────────────────

export async function submitVideoToHeygen(script: string): Promise<{ videoId: string }> {
  if (DEMO_MODE) {
    const demoId = `demo-vid-${Date.now()}`;
    console.log("[HeyGen] DEMO MODE — skipping real API call, video ID:", demoId);
    return { videoId: demoId };
  }

  const settings = await getHeygenSettings();
  const avatarId = settings.avatarId || process.env.HEYGEN_AVATAR_ID || "";
  const voiceId  = settings.voiceId  || process.env.HEYGEN_VOICE_ID  || "";

  if (!avatarId || !voiceId) throw new Error("HeyGen avatar ID or voice ID not configured");

  const body = {
    video_inputs: [{
      character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
      voice: { type: "text", input_text: script, voice_id: voiceId, speed: settings.speakingSpeed },
      background: { type: "color", value: settings.bgColour },
    }],
    dimension: { width: 1280, height: 720 },
    aspect_ratio: "16:9",
    test: false,
  };

  const json = await heygenFetch("/v2/video/generate", { method: "POST", body: JSON.stringify(body) });
  const videoId = json?.data?.video_id || json?.video_id;
  if (!videoId) throw new Error("HeyGen did not return a video_id");
  return { videoId };
}

// ─── Poll Video Status ────────────────────────────────────────────────────────

export async function pollVideoStatus(heygenVideoId: string): Promise<{
  status: "processing" | "completed" | "failed"; videoUrl?: string; thumbnailUrl?: string;
}> {
  if (DEMO_MODE || heygenVideoId.startsWith("demo-")) {
    const demo = DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)];
    return { status: "completed", videoUrl: demo.videoUrl, thumbnailUrl: demo.thumbnailUrl };
  }
  const json = await heygenFetch(`/v1/video_status.get?video_id=${heygenVideoId}`);
  const d = json?.data ?? json;
  return { status: d.status, videoUrl: d.video_url, thumbnailUrl: d.thumbnail_url };
}

// ─── List Avatars ─────────────────────────────────────────────────────────────

export async function listHeygenAvatars() {
  if (DEMO_MODE) {
    return [{ avatar_id: "demo-avatar-001", avatar_name: "Dylan Delaney (Demo)", gender: "male", preview_image_url: "" }];
  }
  const json = await heygenFetch("/v2/avatars");
  return json?.data?.avatars ?? json?.avatars ?? [];
}

// ─── List Voices ──────────────────────────────────────────────────────────────

export async function listHeygenVoices() {
  if (DEMO_MODE) {
    return [{ voice_id: "demo-voice-001", name: "Dylan Delaney (Demo)", language: "English", gender: "Male" }];
  }
  const json = await heygenFetch("/v2/voices");
  return json?.data?.voices ?? json?.voices ?? [];
}

// ─── Generate Video Record in DB ─────────────────────────────────────────────

export async function createVideoRecord(params: {
  leadId: string; leadName: string; leadEmail?: string; leadPhone?: string;
  script: string; subjectLine?: string; deliveryChannel: string;
  franchiseeId?: string; dailyBatchId?: string; scriptTemplateId?: string;
}): Promise<string> {
  const appBase = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
  const [row] = await db.insert(heygenVideos).values({
    leadId: params.leadId,
    leadName: params.leadName,
    leadEmail: params.leadEmail,
    leadPhone: params.leadPhone,
    franchiseeId: params.franchiseeId,
    script: params.script,
    subjectLine: params.subjectLine,
    deliveryChannel: params.deliveryChannel,
    dailyBatchId: params.dailyBatchId,
    scriptTemplateId: params.scriptTemplateId,
    status: "pending",
    deliveryStatus: "not_sent",
  }).returning();
  const trackingUrl = `${appBase}/v/${row.trackingToken}`;
  await db.update(heygenVideos).set({ trackingUrl }).where(eq(heygenVideos.id, row.id));
  return row.id;
}

// ─── Start Video Generation ───────────────────────────────────────────────────

export async function startVideoGeneration(videoId: string): Promise<void> {
  const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.id, videoId)).limit(1);
  if (!rows[0]) throw new Error("Video record not found");
  const video = rows[0];

  try {
    const { videoId: heygenId } = await submitVideoToHeygen(video.script);
    await db.update(heygenVideos).set({
      heygenVideoId: heygenId,
      status: "rendering",
      renderStartedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(heygenVideos.id, videoId));
  } catch (e: any) {
    await db.update(heygenVideos).set({ status: "failed", errorMessage: e.message, updatedAt: new Date() }).where(eq(heygenVideos.id, videoId));
    await sendSlackMessage(`🎬 HeyGen video generation failed for lead ${video.leadName ?? video.leadId}: ${e.message}`).catch(() => {});
    throw e;
  }
}

// ─── Poll All Rendering Videos ────────────────────────────────────────────────

export async function pollAllRenderingVideos(): Promise<void> {
  const rendering = await db.select().from(heygenVideos).where(eq(heygenVideos.status, "rendering"));
  if (!rendering.length) return;

  for (const video of rendering) {
    if (!video.heygenVideoId) continue;

    // Check for timeout (>30 minutes)
    if (video.renderStartedAt) {
      const elapsedMin = (Date.now() - new Date(video.renderStartedAt).getTime()) / 60000;
      if (elapsedMin > 30) {
        await db.update(heygenVideos).set({ status: "timed_out", updatedAt: new Date() }).where(eq(heygenVideos.id, video.id));
        await sendSlackMessage(`⏰ HeyGen video timed out after 30min for lead: ${video.leadName ?? video.leadId}`).catch(() => {});
        continue;
      }
    }

    try {
      const result = await pollVideoStatus(video.heygenVideoId);
      if (result.status === "completed") {
        await db.update(heygenVideos).set({
          status: "completed", videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl,
          renderCompletedAt: new Date(),
          renderDurationSec: video.renderStartedAt
            ? Math.round((Date.now() - new Date(video.renderStartedAt).getTime()) / 1000)
            : null,
          updatedAt: new Date(),
        }).where(eq(heygenVideos.id, video.id));
      } else if (result.status === "failed") {
        await db.update(heygenVideos).set({ status: "failed", errorMessage: "HeyGen rendering failed", updatedAt: new Date() }).where(eq(heygenVideos.id, video.id));
        await sendSlackMessage(`🎬 HeyGen video failed to render for ${video.leadName ?? video.leadId}`).catch(() => {});
      }
    } catch (e: any) {
      console.error(`[HeyGen] Poll error for ${video.id}:`, e.message);
    }
  }
}

// ─── Determine Recommended Channel ───────────────────────────────────────────

export function recommendChannel(lead: {
  email?: string | null; phone?: string | null; country?: string | null;
  sequenceStage?: number; tags?: string[];
}): "email" | "sms" | "whatsapp" {
  const waCountries = ["UAE", "India", "Pakistan", "Bangladesh", "Nigeria", "Ghana", "Kenya", "Egypt", "Morocco", "Jordan", "Turkey", "Brazil", "Mexico", "Colombia"];
  if (lead.country && waCountries.some(c => lead.country!.toLowerCase().includes(c.toLowerCase()))) {
    if (lead.phone) return "whatsapp";
  }
  if ((lead.sequenceStage ?? 0) >= 2 && !lead.email) return "sms";
  return "email";
}

// ─── Send Video ───────────────────────────────────────────────────────────────

export async function sendVideo(videoId: string): Promise<void> {
  const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.id, videoId)).limit(1);
  if (!rows[0]) throw new Error("Video not found");
  const video = rows[0];
  if (video.status !== "completed") throw new Error("Video is not yet rendered");
  if (!video.videoUrl) throw new Error("Video URL not available");

  const trackingUrl = video.trackingUrl ?? video.videoUrl;
  const appBase = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
  const calendlyUrl = process.env.CALENDLY_API_KEY ? "https://calendly.com/dylan-newdawnfranchising" : "https://calendly.com/dylan-newdawnfranchising";

  if (video.deliveryChannel === "email" && video.leadEmail) {
    const { sendEmail } = await import("./email-service");
    const subject = video.subjectLine ?? `A quick personal video message for you from Dylan`;
    const body = `<p>Hey ${video.leadName?.split(" ")[0] ?? "there"},</p>
<p>I recorded a quick personal message for you — I think it's easier to show you what I mean rather than just write about it:</p>
<p style="text-align:center;margin:24px 0;">
  <a href="${trackingUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">▶ Watch Dylan's Message</a>
</p>
<p>Once you've had a chance to watch, feel free to book a quick call: <a href="${calendlyUrl}">${calendlyUrl}</a></p>
<p>Looking forward to speaking,<br/>Dylan Delaney<br/>Director of Franchise Development, New Dawn Franchising</p>
<hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
<p style="font-size:11px;color:#999;">To unsubscribe, reply with "STOP".</p>`;
    await sendEmail(video.leadEmail, subject, body);
  } else if (video.deliveryChannel === "sms" && video.leadPhone) {
    const { sendSmsViaQuo } = await import("./quo-service");
    const msg = `Hey ${video.leadName?.split(" ")[0] ?? "there"}, Dylan here from New Dawn Franchising — I recorded a quick personal message for you: ${trackingUrl} Reply STOP to opt out.`;
    await sendSmsViaQuo(video.leadPhone, msg);
  } else if (video.deliveryChannel === "whatsapp" && video.leadPhone) {
    const { sendWhatsAppMessage } = await import("./meta-whatsapp-service");
    const msg = `Hey ${video.leadName?.split(" ")[0] ?? "there"} 👋 Dylan from New Dawn Franchising here — I recorded a short personal video message for you: ${trackingUrl}`;
    await sendWhatsAppMessage(video.leadPhone, msg);
  }

  await db.update(heygenVideos).set({
    deliveryStatus: "sent", sentAt: new Date(), updatedAt: new Date(),
  }).where(eq(heygenVideos.id, videoId));
}

// ─── Auto-trigger Logic for 6AM Run ──────────────────────────────────────────

export async function runHeygenPreparation(): Promise<string[]> {
  if (DEMO_MODE) {
    console.log("[HeyGen] DEMO MODE — skipping 6AM video preparation");
    return [];
  }

  const settings = await getHeygenSettings();
  const generatedIds: string[] = [];

  const candidates: typeof agentLeads.$inferSelect[] = [];

  if (settings.autoHotLeads) {
    const hotLeads = await db.select().from(agentLeads)
      .where(and(
        eq((agentLeads as any).dnc, false),
        eq((agentLeads as any).sequenceStage, 0),
      ))
      .limit(settings.dailyVideoLimit);
    const hot = hotLeads.filter(l => (l.aiScore ?? 0) >= 85);
    candidates.push(...hot);
  }

  if (settings.autoTouch3) {
    const touch2NoReply = await db.select().from(agentLeads)
      .where(and(
        eq((agentLeads as any).dnc, false),
        eq((agentLeads as any).sequenceStage, 2),
      ))
      .limit(settings.dailyVideoLimit);
    const eligible = touch2NoReply.filter(l => (l.aiScore ?? 0) >= 60);
    candidates.push(...eligible);
  }

  const deduped = candidates.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  const limited = deduped.slice(0, settings.dailyVideoLimit);

  for (const lead of limited) {
    try {
      const touchType = (lead.sequenceStage ?? 0) >= 2 ? "touch3_no_reply" : "hot_first_contact";
      const { script, subjectLine } = await generateVideoScript({
        firstName: lead.firstName, company: lead.company, country: lead.country,
        aiScore: lead.aiScore, researchDossier: lead.researchDossier, sequenceStage: lead.sequenceStage ?? 0,
      }, touchType);
      const channel = recommendChannel({ email: lead.email, phone: lead.phone, country: lead.country, sequenceStage: lead.sequenceStage ?? 0 });
      const videoId = await createVideoRecord({
        leadId: lead.id, leadName: `${lead.firstName} ${lead.lastName}`.trim(),
        leadEmail: lead.email ?? undefined, leadPhone: lead.phone ?? undefined,
        script, subjectLine, deliveryChannel: channel,
      });
      await startVideoGeneration(videoId);
      generatedIds.push(videoId);
    } catch (e: any) {
      console.error(`[HeyGen] 6AM prep error for lead ${lead.id}:`, e.message);
    }
  }

  return generatedIds;
}

// ─── Get Video Stats ──────────────────────────────────────────────────────────

export async function getHeygenStats() {
  const all = await db.select().from(heygenVideos);
  const now = new Date();
  const thisMonth = all.filter(v => {
    const d = new Date(v.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  return {
    totalGenerated: all.length,
    totalSent: all.filter(v => v.deliveryStatus !== "not_sent").length,
    thisMonthGenerated: thisMonth.length,
    thisMonthSent: thisMonth.filter(v => v.deliveryStatus !== "not_sent").length,
    clickRate: all.length > 0 ? Math.round((all.filter(v => v.clickedAt).length / Math.max(all.filter(v => v.deliveryStatus !== "not_sent").length, 1)) * 100) : 0,
    byChannel: {
      email:    all.filter(v => v.deliveryChannel === "email").length,
      sms:      all.filter(v => v.deliveryChannel === "sms").length,
      whatsapp: all.filter(v => v.deliveryChannel === "whatsapp").length,
    },
    byStatus: {
      pending:   all.filter(v => v.status === "pending").length,
      rendering: all.filter(v => v.status === "rendering").length,
      completed: all.filter(v => v.status === "completed").length,
      failed:    all.filter(v => v.status === "failed").length,
    },
    avgRenderSec: (() => {
      const rendered = all.filter(v => v.renderDurationSec);
      return rendered.length ? Math.round(rendered.reduce((s, v) => s + (v.renderDurationSec ?? 0), 0) / rendered.length) : null;
    })(),
    estimatedMonthlyCost: (thisMonth.length * 0.20).toFixed(2),
    demoMode: DEMO_MODE,
  };
}

export { DEMO_MODE };
