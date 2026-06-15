import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createHash } from "node:crypto";
import path from "path";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertLeadSchema, insertBrokerSchema, insertBrokerClientSchema, insertCrmClientSchema, insertProspectSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { generateBlogPost, scheduleWeeklyBlogGeneration } from "./blog-generator";
import { generateBrochurePDF } from "./brochure";
import { generateBrokerAgreementPDF } from "./broker-agreement-pdf";
import { searchProspects, SEARCH_CATEGORIES } from "./prospect-search";
import { scheduleDripProcessing, processDripEmails, reprocessStep } from "./drip-processor";
import { scheduleGmailSync, syncFranchisingInbox, getGmailSyncStatus, getGmailSyncLastResult } from "./gmail-sync-service";
import { seedDefaultCampaign } from "./default-campaign";
import { seedGrokCampaign } from "./grok-campaign";
import { sendEmail, sendEmailFromSender, getTrackingPixelUrl, getAvailableSenders, CRM_EMAIL_TEMPLATES, cacheDylanCalendlyUrl } from "./email-service";
import { isAutomatedOrBulkEmail, shouldShowInCrmEmailHistory } from "./crm-email-filter";
import { generateFacebookPost } from "./facebook-generator";
import { postToFacebook, getAutoPostStatus, setAutoPostEnabled, scheduleDailyFacebookPosting } from "./facebook-poster";
import { registerContactRoutes } from "./contacts-routes";
import { registerSeoRoutes } from "./seo-routes";
import { registerOutreachRoutes } from "./outreach-routes";
import { runSeoBrief } from "./seo-service";
import {
  seedScheduledTasks, runDailyAutomations, runWeeklyAutomations, runMonthlyAutomations, sendSeoDigestEmail,
} from "./seo-automation";
import seoAgentRouter from "./seo-agent-routes";
import seoCampaignRouter from "./seo-campaign-routes";
import { runAllActiveCampaigns } from "./seo-campaign-agent";
import approvalRouter, { sendMorningDigest } from "./approval-routes";
import { registerVisitorRoutes } from "./visitor-routes";
import agentRouter, { runScheduledJobs } from "./agent-routes";
import franchiseeRouter from "./franchisee-routes";
import heygenRouter from "./heygen-routes";
import partnerRouter from "./partner-routes";
import { processPartnerSequence } from "./partner-sequence-service";
import { runDailyPreparation, runDailyBrief, pollForApprovalReply, runApprovalDeadlineCheck } from "./agent-service";
import { hunterFindEmail, hunterDomainPattern, buildEmailFromPattern, hunterVerifyEmail, getHunterStatus } from "./hunter-service";
import { apolloEnrichPerson, apolloConfigured } from "./apollo-service";
import { origamiEnrichPerson, origamiConfigured } from "./origami-service";
import { runLeadResearchAgent } from "./lead-research-agent";
import { pollAllRenderingVideos, runHeygenPreparation } from "./heygen-service";
import { heygenVideos, prospectLists } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { runAllHealthChecks, runHealthCheckWithAlerts } from "./api-health";
import cron from "node-cron";
import { planDailyIntelligence, getRecentPlans, getTodaysPlan } from "./outreach-intelligence-service";
import { sendSmsViaQuo, getQuoStatus, listQuoPhoneNumbers, SMS_TEMPLATES, fetchSmsConversation, phoneLast10, type SmsConversationMessage } from "./quo-service";
import { sendAgentSms, handleInboundAgentSms, notifyDraftPending, notifyBlocker, notifyError, getAgentSmsHistory, AGENT_NUMBERS, DYLAN_PHONE } from "./agent-sms-service";
import { fetchOpenPhoneCalls, fetchCallTranscript, formatTranscript, getCallerNumber, getCallerName } from "./openphone-calls";
import { smartSmsDelay, smartWhatsAppDelay, isOptimalSmsWindow, nextWindowDescription, estimateSend, projectStepSendTime, EMAIL_WINDOW_SUMMARY, type SendMode } from "./smart-scheduler";
import { sendWhatsAppMessage as sendWhatsApp, sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from "./meta-whatsapp-service";
import { sendRinglessVoicemail, getVoicemailStatus, VOICEMAIL_SCRIPTS } from "./voicemail-service";
import { runEnrichmentSearch, enrichSingleCompany, findSimilarCompanies, getEnrichmentApiStatus } from "./prospect-enrichment";
import {
  seamlessContactSearch,
  seamlessCompanySearch,
  seamlessRevealContacts,
  providerSearch,
  parseNaturalLanguageToFilters,
  type LeadSearchFilters,
  type ProviderId,
} from "./seamless-prospects";
import { getProviderStatuses } from "./provider-credits";
import { seedContactEnrichment } from "./people-finder";
import { calculateDecisionMakerScore } from "./decision-maker-scorer";
import { whitePageslookup, whitepagesVerifyPhone } from "./whitepages-service";
import { generateToken, sendSignatureRequestEmail, sendWelcomeEmail, sendWireReceiptEmail } from "./signature-service";
import { notifications } from "./core/notifications";
import { emailQueue } from "./core/email-queue";
import { rateLimiter } from "./core/rate-limiter";
import {
  getContentDrafts, getMetaSuggestions, approveDraft, discardDraft, updateDraft,
  approveMetaSuggestion, requestDraft, pingSitemap,
} from "./content-engine";
import { INDEXNOW_KEY, indexNowKeyFilePath } from "./indexnow";
import {
  trackVisit, identifyVisitorByForm, identifyVisitorByEmailClick,
  getLiveVisitors, getIdentifiedVisitors, getWatchlist,
} from "./visitor-trigger";
import {
  getMeetings, getUpcomingMeetings, updateMeetingOutcome, handleMeetingBooked, classifyReplyIntent,
} from "./meetings";
import { generateWeeklyBrief } from "./strategy-brief";
import { briefs, systemNotifications } from "@shared/schema";
import { callClaude } from "./chat-service";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "dylan@newdawnfranchising.com").toLowerCase().trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "NewHorizons@12").trim();

// Per-scene narration for the homepage overview. Each segment corresponds 1:1
// with a scene in the front-end player, so the voice stays in sync with the
// scene that is on screen. ("two hundred twenty-five thousand" / "F D D" are
// spelled for natural text-to-speech pronunciation.)
const OVERVIEW_SEGMENTS = [
  "New Dawn Franchising is the first franchise built from the ground up for the E-2 visa investor. You keep full ownership and oversight — without the day-to-day operations — while our proprietary A I puts your business growth on a more automated path. And you can live anywhere in the United States.",
  "You own and direct a real U.S. business while our local teams handle the day-to-day operations. And you can live anywhere in the United States with your family.",
  "Choose from three recurring-revenue franchises: property management, telecom, or insurance — each selected to fit the E-2 visa.",
  "These are recurring-revenue businesses, designed to generate steady, ongoing returns. Full financial details are in the F D D.",
  "We stand behind your application. If your E-2 visa is not approved, you get your investment back.",
  "Your money stays protected. Your two hundred twenty-five thousand dollars is held in escrow until your visa is approved, then it is released to fund your operating business.",
  "And when you are ready to move on, our in-house buy-back program gives you a clear path to recover your investment, typically after about four years.",
  "You are backed by an experienced team — in-house immigration, finance, real estate, and legal professionals, each with over a decade of proven success. So you can invest with confidence.",
  "We also reward our partners: brokers and advisors earn a referral fee for every qualified investor they introduce.",
  "Get started from two hundred twenty-five thousand dollars. Request the F D D today and compare your three options.",
];

// Changes whenever the narration changes, so cached audio URLs bust automatically.
const OVERVIEW_VERSION = createHash("sha1").update(OVERVIEW_SEGMENTS.join("|")).digest("hex").slice(0, 10);

function getElevenLabsConfig() {
  const apiKey =
    process.env.ELEVENLABS_API_KEY ||
    process.env.ELEVEN_LABS_API_KEY ||
    process.env.XI_API_KEY;
  const voiceId =
    process.env.ELEVENLABS_HOME_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID ||
    process.env.ELEVEN_LABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  return { apiKey, voiceId, modelId };
}

// Cache each synthesized voiceover segment so playback is instant. ElevenLabs
// TTS takes several seconds; without caching it was re-synthesized on every
// play. Warmed at startup.
const voiceoverCache: (Buffer | null)[] = OVERVIEW_SEGMENTS.map(() => null);

async function synthOverviewSegment(index: number): Promise<Buffer | null> {
  const { apiKey, voiceId, modelId } = getElevenLabsConfig();
  const text = OVERVIEW_SEGMENTS[index];
  if (!apiKey || !voiceId || !text) return null;
  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.52, similarity_boost: 0.82, style: 0.24, use_speaker_boost: true },
      }),
    },
  );
  if (!elevenRes.ok) {
    throw new Error(`ElevenLabs ${elevenRes.status}: ${(await elevenRes.text()).slice(0, 200)}`);
  }
  voiceoverCache[index] = Buffer.from(await elevenRes.arrayBuffer());
  return voiceoverCache[index];
}

/** Pre-generate all homepage voiceover segments at startup so the first play is instant. */
export async function warmHomepageVoiceover(): Promise<void> {
  const { apiKey, voiceId } = getElevenLabsConfig();
  if (!apiKey || !voiceId) return;
  for (let i = 0; i < OVERVIEW_SEGMENTS.length; i++) {
    try {
      await synthOverviewSegment(i);
    } catch (err: any) {
      console.error(`[voiceover] warm segment ${i} failed:`, err?.message);
    }
  }
  console.log(
    `[voiceover] homepage voiceover warmed (${voiceoverCache.filter(Boolean).length}/${OVERVIEW_SEGMENTS.length} segments)`,
  );
}

function requireBrokerAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.brokerId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// ─── Hourly OpenPhone call sync ───────────────────────────────────────────────

async function autoSyncPhoneCalls(): Promise<void> {
  const apiKey = process.env.QUO_API_KEY;
  if (!apiKey) return; // OpenPhone not configured — skip silently

  try {
    // Sync calls from the last 2 hours (overlap to catch any processing delays)
    const createdAfter = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: apiCalls } = await fetchOpenPhoneCalls({ maxResults: 50, createdAfter });

    if (apiCalls.length === 0) {
      console.log("[PhoneSync] No new calls in last 2 hours");
      return;
    }

    const allClients = await storage.getCrmClients();
    const normalise = (n: string) => n.replace(/\D/g, "").slice(-10);
    let synced = 0;

    for (const call of apiCalls) {
      const callerNumber = getCallerNumber(call);
      const callerName = getCallerName(call);
      const matched = allClients.find(c => c.phone && normalise(c.phone) === normalise(callerNumber));

      let transcriptText: string | null = null;
      let aiSummary: string | null = null;

      if (call.status === "completed") {
        try {
          const transcript = await fetchCallTranscript(call.id);
          if (transcript) {
            transcriptText = transcript.summary || formatTranscript(transcript) || null;
            if (transcriptText && !transcript.summary) {
              // Use Claude for AI summary
              try {
                aiSummary = await callClaude([
                  { role: "user", content: `Summarise this franchise sales call in 2-4 sentences. Cover caller intent, key topics discussed, and next steps:\n\n${transcriptText.slice(0, 3000)}` }
                ]);
              } catch { /* non-fatal */ }
            } else if (transcript.summary) {
              aiSummary = transcript.summary;
            }
          }
        } catch { /* non-fatal — transcript unavailable */ }
      }

      const existing = await storage.getPhoneCallByExternalId(call.id).catch(() => null);

      await storage.upsertPhoneCall({
        id: call.id,
        direction: call.direction,
        fromNumber: call.from,
        toNumber: call.to,
        status: call.status,
        durationSeconds: call.duration || null,
        callerName: callerName || (matched ? matched.fullName : null),
        recordingUrl: call.recording?.url || null,
        recordingId: call.recording?.id || null,
        transcriptText,
        aiSummary,
        voicemailUrl: call.voicemail?.url || null,
        voicemailTranscript: call.voicemail?.transcription || null,
        crmClientId: matched?.id || null,
        openphoneCreatedAt: call.createdAt ? new Date(call.createdAt) : null,
      });

      // Log to CRM activity timeline (inbound, not already logged)
      if (matched && call.direction === "inbound" && !existing?.crmClientId) {
        try {
          await storage.createCrmClientActivity({
            clientId: matched.id,
            activityType: "phone_call",
            metadata: {
              callId: call.id,
              direction: call.direction,
              status: call.status,
              duration: call.duration,
              fromNumber: call.from,
              aiSummary,
            },
          });
        } catch { /* non-fatal */ }
      }

      synced++;
    }

    console.log(`[PhoneSync] Auto-synced ${synced} call(s) from OpenPhone`);
  } catch (err: any) {
    console.error("[PhoneSync] Hourly sync error:", err.message);
  }
}

function scheduleAgentCrons() {
  // 8:00 AM ET — daily preparation run (1 hour before brief)
  cron.schedule("0 8 * * *", () => {
    console.log("[Agent Cron] Running daily preparation...");
    runDailyPreparation().catch(e => console.error("[Agent Cron] Preparation error:", e));
  }, { timezone: "America/New_York" });

  // 9:00 AM ET — send daily brief to approval email
  cron.schedule("0 9 * * *", () => {
    console.log("[Agent Cron] Sending daily brief...");
    runDailyBrief().catch(e => console.error("[Agent Cron] Brief error:", e));
  }, { timezone: "America/New_York" });

  // Every 15 min 9am-9pm ET — poll for approval reply
  cron.schedule("*/15 9-21 * * *", () => {
    pollForApprovalReply().catch(e => console.error("[Agent Cron] IMAP poll error:", e));
  }, { timezone: "America/New_York" });

  // 3:00 PM ET — deadline check
  cron.schedule("0 15 * * *", () => {
    console.log("[Agent Cron] Running approval deadline check...");
    runApprovalDeadlineCheck().catch(e => console.error("[Agent Cron] Deadline error:", e));
  }, { timezone: "America/New_York" });

  // 9:00 AM ET — SEO digest email (replaces old brief)
  cron.schedule("0 9 * * *", () => {
    console.log("[SEO Cron] Sending SEO daily digest email...");
    sendSeoDigestEmail().catch(e => console.error("[SEO Cron] Digest error:", e));
  }, { timezone: "America/New_York" });

  // 6:00 AM CT — Daily SEO automations (rank tracker, broken links, CWV, competitor monitor)
  cron.schedule("0 6 * * *", () => {
    console.log("[SEO Cron] Running daily automations...");
    runDailyAutomations().catch(e => console.error("[SEO Cron] Daily automation error:", e));
  }, { timezone: "America/Chicago" });

  // Monday 7:00 AM CT — Weekly SEO automations
  cron.schedule("0 7 * * 1", () => {
    console.log("[SEO Cron] Running weekly automations...");
    runWeeklyAutomations().catch(e => console.error("[SEO Cron] Weekly automation error:", e));
  }, { timezone: "America/Chicago" });

  // 1st of month 8:00 AM CT — Monthly SEO automations
  cron.schedule("0 8 1 * *", () => {
    console.log("[SEO Cron] Running monthly automations...");
    runMonthlyAutomations().catch(e => console.error("[SEO Cron] Monthly automation error:", e));
  }, { timezone: "America/Chicago" });

  // Every 3 minutes — poll HeyGen rendering status
  cron.schedule("*/3 * * * *", () => {
    pollAllRenderingVideos().catch(e => console.error("[HeyGen Cron] Poll error:", e));
  }, { timezone: "America/New_York" });

  // Every 5 minutes — run due scheduled jobs from AI chat
  cron.schedule("*/5 * * * *", () => {
    runScheduledJobs().catch(e => console.error("[ScheduledJobs Cron] Error:", e));
  });

  // ── Startup catchup — runs once 90s after the server starts ─────────────────
  // Handles the common case where the server restarts after scheduled cron times
  // (deploys, crashes, Replit sleep). All functions are idempotent.
  // Guard: only run once per calendar day per server instance to avoid storm on rapid restarts.
  let _catchupRanDate = "";
  setTimeout(async () => {
    const todayStr = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
    if (_catchupRanDate === todayStr) {
      console.log("[Agent Startup] Catchup already ran today — skipping");
      return;
    }
    _catchupRanDate = todayStr;
    try {
      // Get current hour in America/New_York timezone
      const nyHour = parseInt(
        new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false })
      );
      console.log(`[Agent Startup] Running startup catchup at ${nyHour}h ET...`);

      // ── SEO Campaign Agent (normally 7AM ET) — run any time before 6PM ──────
      if (nyHour >= 7 && nyHour < 18) {
        console.log("[Agent Startup] Running SEO Campaign Agent catchup...");
        runAllActiveCampaigns().catch((e: any) =>
          console.error("[Agent Startup] SEO Campaign catchup error:", e.message)
        );
      }

      // ── Morning digest (normally 8AM ET) — run any time before 2PM ──────────
      if (nyHour >= 8 && nyHour < 14) {
        console.log("[Agent Startup] Running morning digest catchup...");
        sendMorningDigest().catch((e: any) =>
          console.error("[Agent Startup] Morning digest catchup error:", e.message)
        );
      }

      // ── Outreach agent (prep 8AM, brief 9AM) — run any time before 2PM ─────
      if (nyHour >= 8 && nyHour < 14) {
        console.log("[Agent Startup] Running outreach agent catchup...");
        await runDailyPreparation();
        if (nyHour >= 9) {
          await runDailyBrief();
        }
      }

      console.log("[Agent Startup] Catchup complete");
    } catch (e: any) {
      console.error("[Agent Startup] Catchup error:", e.message);
    }
  }, 90000);

  console.log("AI Outreach Agent scheduled: 8AM prep, 9AM brief, 15min reply polling, 3PM deadline (America/New_York)");
  console.log("SEO Agent scheduled: daily digest 9AM ET, automations 6AM CT daily / Mon 7AM CT weekly / 1st 8AM CT monthly");
  seedScheduledTasks().catch(e => console.error("[SEO] Seed error:", e));
  // SEO Campaign Agent — daily loop at 7 AM ET every day
  cron.schedule("0 7 * * *", () => {
    runAllActiveCampaigns().catch(e => console.error("[SEO Campaign Agent] Cron error:", e));
  }, { timezone: "America/New_York" });
  console.log("SEO Campaign Agent scheduled: daily 7AM ET");

  // Morning approval digest — 8 AM ET daily (texts Dylan links to all pending approvals)
  cron.schedule("0 8 * * *", () => {
    sendMorningDigest().catch(e => console.error("[Morning Digest] Error:", e));
  }, { timezone: "America/New_York" });
  console.log("Morning approval digest scheduled: 8AM ET daily");

  // Outreach Intelligence — 6 AM ET daily: plan daily leads + SMS Dylan for approval
  cron.schedule("0 6 * * *", () => {
    planDailyIntelligence().catch(e => console.error("[OutreachIntel] Daily plan error:", e));
  }, { timezone: "America/New_York" });
  console.log("Outreach Intelligence Agent scheduled: 6AM ET daily");

  // Broker sequence event processor — every 30 min
  cron.schedule("*/30 * * * *", () => {
    import("./broker-sequence-service").then(m => m.processSequenceEvents()).catch(e => console.error("[BrokerSequence] Cron error:", e));
  });
  console.log("Broker outreach sequence processor scheduled: every 30 minutes");

  // Partner sequence event processor — every 30 min
  cron.schedule("*/30 * * * *", () => {
    processPartnerSequence().catch(e => console.error("[PartnerSequence] Cron error:", e));
  });
  console.log("Partner outreach sequence processor scheduled: every 30 minutes");

  // OpenPhone call sync — every hour on the hour
  cron.schedule("0 * * * *", () => {
    autoSyncPhoneCalls().catch(e => console.error("[PhoneSync] Cron error:", e));
  });
  console.log("OpenPhone call sync scheduled: every hour");

  console.log("HeyGen video polling scheduled: every 3 minutes");
  console.log("Scheduled jobs runner: every 5 minutes");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Manifest: tells the client the current narration version + scene count so it
  // can request versioned (cache-busting) audio URLs. Never cached.
  app.get("/api/homepage-overview-voiceover", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ version: OVERVIEW_VERSION, count: OVERVIEW_SEGMENTS.length });
  });

  app.get("/api/homepage-overview-voiceover/:index", async (req, res) => {
    const { apiKey, voiceId } = getElevenLabsConfig();
    if (!apiKey || !voiceId) {
      return res.status(503).json({
        message: "ElevenLabs voiceover is not configured",
        required: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
      });
    }

    const index = parseInt(req.params.index, 10);
    if (!Number.isInteger(index) || index < 0 || index >= OVERVIEW_SEGMENTS.length) {
      return res.status(404).json({ message: "Unknown voiceover segment" });
    }

    try {
      // Serve the cached segment if it's been synthesized; otherwise synthesize
      // once and cache it for every subsequent request.
      const audio = voiceoverCache[index] ?? (await synthOverviewSegment(index));
      if (!audio) {
        return res.status(503).json({ message: "ElevenLabs voiceover is not configured" });
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.setHeader("Content-Length", String(audio.length));
      return res.send(audio);
    } catch (err: any) {
      return res.status(502).json({
        message: "Failed to generate homepage voiceover",
        detail: err.message,
      });
    }
  });

  // Serve logo at a stable URL for use in email signatures
  app.get("/email-logo.png", (_req, res) => {
    res.sendFile(path.resolve("attached_assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png"));
  });

  app.get("/api/config/ga", (_req, res) => {
    res.json({ id: process.env.GA_MEASUREMENT_ID || "" });
  });

  // Public — returns the WhatsApp number for the homepage chat widget
  app.get("/api/config/whatsapp", (_req, res) => {
    res.json({ number: "19158995538" });
  });

  // Public — AI chat widget (Dylan persona via Claude)
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body as { messages: Array<{ role: "user" | "assistant"; content: string }> };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }
      const reply = await callClaude(messages);
      res.json({ reply });
    } catch (err: any) {
      console.error("[/api/chat]", err.message);
      res.json({ reply: "Hey, seems like I'm having a quick tech moment 😅 Try WhatsApp or leave me a message below!" });
    }
  });

  // Public — Leave-a-message form from chat widget
  app.post("/api/contact/message", async (req, res) => {
    try {
      const { name, phone, message } = req.body as { name: string; phone?: string; message: string };
      if (!name || !message) return res.status(400).json({ error: "name and message required" });

      // Store as a lead in the DB
      await storage.createLead({
        fullName: name,
        email: "chat-widget@newdawnfranchising.com",
        phone: phone || "",
        country: "Unknown",
        message: `[Chat Widget Message] ${message}`,
      });

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[/api/contact/message]", err.message);
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  const SITE_URL = "https://www.newdawnfranchising.com";
  const STATIC_PAGES = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/about", priority: "0.8", changefreq: "monthly" },
    { path: "/team", priority: "0.7", changefreq: "monthly" },
    { path: "/e2-visa-franchise", priority: "0.9", changefreq: "monthly" },
    { path: "/e2-fit", priority: "0.8", changefreq: "monthly" },
    { path: "/process", priority: "0.8", changefreq: "monthly" },
    { path: "/territories", priority: "0.8", changefreq: "monthly" },
    { path: "/marketing", priority: "0.7", changefreq: "monthly" },
    { path: "/real-estate", priority: "0.7", changefreq: "monthly" },
    { path: "/blog", priority: "0.7", changefreq: "daily" },
    { path: "/quiz", priority: "0.6", changefreq: "monthly" },
    { path: "/contact", priority: "0.8", changefreq: "monthly" },
  ];

  app.get("/sitemap.xml", async (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const page of STATIC_PAGES) {
        xml += `  <url>\n`;
        xml += `    <loc>${SITE_URL}${page.path}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `  </url>\n`;
      }

      // Blog posts are isolated: a database or data hiccup must never take down
      // the whole sitemap, so on failure we still return the static pages (200).
      try {
        const posts = await storage.getBlogPosts();
        for (const post of posts) {
          if (!post?.slug) continue;
          let lastmod = today;
          if (post.publishedAt) {
            const d = new Date(post.publishedAt);
            if (!isNaN(d.getTime())) lastmod = d.toISOString().split("T")[0];
          }
          xml += `  <url>\n`;
          xml += `    <loc>${SITE_URL}/blog/${post.slug}</loc>\n`;
          xml += `    <lastmod>${lastmod}</lastmod>\n`;
          xml += `    <changefreq>monthly</changefreq>\n`;
          xml += `    <priority>0.6</priority>\n`;
          xml += `  </url>\n`;
        }
      } catch (blogErr) {
        console.error("Sitemap: blog posts unavailable, serving static pages only:", blogErr);
      }

      xml += `</urlset>`;

      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("Sitemap generation error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  // IndexNow key-verification file — proves domain ownership to Bing/Yandex.
  app.get(indexNowKeyFilePath, (_req, res) => {
    res.set("Content-Type", "text/plain").send(INDEXNOW_KEY);
  });

  app.get("/robots.txt", (_req, res) => {
    // Private/app areas kept out of all indexes.
    const disallow = [
      "/api/",
      "/crm",
      "/login",
      "/approve/",
      "/sign/",
      "/verify/",
      "/agent",
      "/seo",
      "/heygen",
      "/training",
      "/marketing-portal",
      "/brokers",
    ];
    // AI answer engines & assistants — explicitly welcomed to read public pages.
    const aiAgents = [
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-User",
      "anthropic-ai",
      "PerplexityBot",
      "Perplexity-User",
      "Google-Extended",
      "Applebot-Extended",
      "CCBot",
      "Amazonbot",
      "meta-externalagent",
      "Bingbot",
    ];
    const ruleBlock = (userAgents: string[]) =>
      [
        ...userAgents.map((ua) => `User-agent: ${ua}`),
        "Allow: /",
        ...disallow.map((d) => `Disallow: ${d}`),
      ].join("\n");

    const txt = [
      "# New Dawn Franchising",
      ruleBlock(["*"]),
      "",
      "# AI answer engines & assistants are explicitly welcome to read public pages",
      ruleBlock(aiAgents),
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      "",
    ].join("\n");
    res.set("Content-Type", "text/plain");
    res.send(txt);
  });

  // llms.txt — a curated, AI-friendly map of the site (see llmstxt.org).
  app.get("/llms.txt", async (_req, res) => {
    const pages: Array<[string, string]> = [
      ["/", "Multi-vertical E-2 visa franchise platform (Property Management, Telecom, Insurance) — overview, how it works, FAQ"],
      ["/e2-visa-franchise", "The franchisor built for the E-2 visa — how the model is designed around E-2 requirements, plus the three verticals and FAQ"],
      ["/e2-fit", "Why New Dawn satisfies each E-2 Treaty Investor Visa requirement, plus E-2 FAQ"],
      ["/process", "Step-by-step franchise process from inquiry to E-2 approval and operations"],
      ["/territories", "El Paso, TX market and territory details for the property management vertical"],
      ["/about", "Company background, the three verticals, and the New Dawn Franchising Group of Companies"],
      ["/team", "Leadership team and advisors"],
      ["/marketing", "Proprietary marketing system included for franchisees"],
      ["/real-estate", "Real estate referral income via Star Spangled Banner Realty"],
      ["/blog", "Insights on E-2 visas, franchising, and U.S. business ownership for international investors"],
      ["/contact", "Request the FDD, overview deck, or an intro call"],
    ];

    const lines: string[] = [
      "# New Dawn Franchising",
      "",
      "> Multi-vertical franchisor specializing in E-2 Treaty Investor Visa-qualifying franchises. " +
        "Investors choose from three recurring-revenue industries — Property Management, Telecom, or Insurance — " +
        "and direct a real U.S. business while New Dawn's operating teams handle daily execution. " +
        "Franchise investment from $225,000. Headquartered in El Paso, Texas. FDD available upon request.",
      "",
      "## Key Pages",
      ...pages.map(([path, desc]) => `- [${path}](${SITE_URL}${path}): ${desc}`),
      "",
      "## Key Facts",
      "- Identity: multi-vertical franchisor specialized for E-2 visa investors (not a single-industry franchise)",
      "- Verticals: Property Management, Telecom, and Insurance — recurring-revenue industries chosen for E-2 fit",
      "- Franchise investment: from $225,000, structured to meet E-2 visa requirements",
      "- Owner role: you direct the business and control the bank accounts; approved local teams run daily operations",
      "- Headquarters: El Paso, Texas; owners may live anywhere in the U.S.",
      "- Support: in-house immigration attorneys, financing, real estate brokerage, and proprietary technology",
      "- E-2 holders may live anywhere in the U.S.; spouse is eligible for work authorization",
      "",
      "## Contact",
      "- Phone: (346) 597-9994",
      "- Email: franchising@newdawnfranchising.com",
      "- Address: 2601 N Zaragoza Rd, El Paso, TX 79938",
    ];

    try {
      const posts = await storage.getBlogPosts();
      if (posts.length) {
        lines.push("", "## Recent Articles");
        for (const post of posts.slice(0, 15)) {
          lines.push(`- [${post.title}](${SITE_URL}/blog/${post.slug}): ${post.excerpt}`);
        }
      }
    } catch {
      // Blog list is optional; omit if unavailable.
    }

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(lines.join("\n") + "\n");
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);
      res.status(201).json(lead);

      // Auto-create a CRM client from the website lead (fire-and-forget)
      storage.createCrmClient({
        fullName: lead.fullName,
        email: lead.email || "",
        phone: lead.phone || null,
        country: lead.country || null,
        status: "new",
        leadSource: "website",
        notes: lead.message || null,
      }).catch((e) => console.error("Failed to auto-create CRM client from lead:", e));

      // Fire-and-forget emails — don't block the response
      const NOTIFY_TO = "franchising@newdawnfranchising.com";
      const BASE_URL = process.env.BASE_URL || "https://www.newdawnfranchising.com";

      // 1. Internal notification to the team
      const internalHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
          <div style="background:#1a2a4a;padding:24px 32px;border-radius:8px 8px 0 0;">
            <img src="${BASE_URL}/email-logo.png" alt="New Dawn Franchising" style="height:48px;" />
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px;">
            <h2 style="margin:0 0 8px;color:#1a2a4a;font-size:20px;">New Contact Form Submission</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">A prospective investor just filled out the contact form on your website.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 12px;background:#f9fafb;border-radius:4px;color:#6b7280;width:140px;font-weight:600;">Name</td><td style="padding:8px 12px;">${lead.fullName}</td></tr>
              <tr><td style="padding:8px 12px;color:#6b7280;font-weight:600;">Email</td><td style="padding:8px 12px;">${lead.email}</td></tr>
              ${lead.phone ? `<tr><td style="padding:8px 12px;background:#f9fafb;border-radius:4px;color:#6b7280;font-weight:600;">Phone</td><td style="padding:8px 12px;">${lead.phone}</td></tr>` : ""}
              ${lead.country ? `<tr><td style="padding:8px 12px;color:#6b7280;font-weight:600;">Country</td><td style="padding:8px 12px;">${lead.country}</td></tr>` : ""}
              ${lead.capitalRange ? `<tr><td style="padding:8px 12px;background:#f9fafb;border-radius:4px;color:#6b7280;font-weight:600;">Investment Range</td><td style="padding:8px 12px;">${lead.capitalRange}</td></tr>` : ""}
              ${lead.timeline ? `<tr><td style="padding:8px 12px;color:#6b7280;font-weight:600;">Timeline</td><td style="padding:8px 12px;">${lead.timeline}</td></tr>` : ""}
              ${lead.message ? `<tr><td style="padding:8px 12px;background:#f9fafb;border-radius:4px;color:#6b7280;font-weight:600;vertical-align:top;">Message</td><td style="padding:8px 12px;">${lead.message.replace(/\n/g, "<br>")}</td></tr>` : ""}
            </table>
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <a href="${BASE_URL}/crm" style="display:inline-block;background:#1a2a4a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">View in CRM →</a>
            </div>
          </div>
        </div>`;

      sendEmail(NOTIFY_TO, `New Lead: ${lead.fullName}`, internalHtml).catch((e) =>
        console.error("Failed to send internal lead notification:", e)
      );

      // 2. Confirmation to the submitter (only if they have an email that looks real)
      if (lead.email && lead.email.includes("@") && lead.fullName !== "Newsletter Subscriber") {
        const firstName = lead.fullName.split(" ")[0];
        const confirmHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
            <div style="background:#1a2a4a;padding:24px 32px;border-radius:8px 8px 0 0;">
              <img src="${BASE_URL}/email-logo.png" alt="New Dawn Franchising" style="height:48px;" />
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px;">
              <h2 style="margin:0 0 12px;color:#1a2a4a;font-size:22px;">Thank you, ${firstName}!</h2>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">We've received your inquiry and a member of our team will reach out to you within one business day.</p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">In the meantime, feel free to explore more about the New Dawn Franchising opportunity, our E-2 visa fit, and the available territories across Texas.</p>
              <div style="background:#f0f4ff;border-left:4px solid #1a2a4a;border-radius:4px;padding:16px 20px;margin:0 0 28px;">
                <p style="margin:0;font-size:14px;color:#1a2a4a;font-weight:600;">What happens next?</p>
                <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:#374151;line-height:1.8;">
                  <li>We'll review your information and match you with the right territory</li>
                  <li>A franchise consultant will schedule a discovery call with you</li>
                  <li>You'll receive our Franchise Disclosure Document (FDD)</li>
                </ul>
              </div>
              <a href="${BASE_URL}" style="display:inline-block;background:#1a2a4a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Explore the Opportunity →</a>
              <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">Questions? Reply to this email or call us at (346) 597-9994.<br/>New Dawn Franchising LLC · El Paso, TX</p>
            </div>
          </div>`;

        sendEmail(
          lead.email,
          "We received your inquiry — New Dawn Franchising",
          confirmHtml
        ).catch((e) => console.error("Failed to send lead confirmation email:", e));
      }
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ message: fromZodError(err).message });
      } else {
        throw err;
      }
    }
  });

  app.post("/api/newsletter", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        res.status(400).json({ message: "Please enter a valid email address" });
        return;
      }
      const trimmedEmail = email.trim();
      const lead = await storage.createLead({
        fullName: "Newsletter Subscriber",
        email: trimmedEmail,
        message: "[Newsletter Signup] Subscribed via website footer",
      });

      // Also add to CRM as a new client so it shows up in the dashboard
      try {
        const existingClients = await storage.getCrmClients();
        const alreadyInCrm = existingClients.some((c) => c.email.toLowerCase() === trimmedEmail.toLowerCase());
        if (!alreadyInCrm) {
          await storage.createCrmClient({
            fullName: "Newsletter Subscriber",
            email: trimmedEmail,
            status: "new",
            leadSource: "newsletter",
            notes: "Subscribed via website footer 'Stay Updated' form",
            tags: ["newsletter"],
          });
        }
      } catch (crmErr) {
        console.error("Newsletter → CRM add failed:", crmErr);
      }

      res.status(201).json({ ok: true, id: lead.id });

      // Confirmation email to the subscriber
      const BASE_URL = process.env.BASE_URL || "https://www.newdawnfranchising.com";
      const confirmHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
          <div style="background:#1a2a4a;padding:24px 32px;border-radius:8px 8px 0 0;">
            <img src="${BASE_URL}/email-logo.png" alt="New Dawn Franchising" style="height:48px;" />
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:32px;">
            <h2 style="margin:0 0 12px;color:#1a2a4a;font-size:22px;">You're on the list!</h2>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Thanks for subscribing to updates from New Dawn Franchising. You'll be among the first to hear about new territory availability, franchise opportunities, and insights on E-2 visa investing in Texas.
            </p>
            <div style="background:#f0f4ff;border-left:4px solid #1a2a4a;border-radius:4px;padding:16px 20px;margin:0 0 28px;">
              <p style="margin:0 0 8px;font-size:14px;color:#1a2a4a;font-weight:600;">While you're here, explore:</p>
              <ul style="margin:0;padding-left:18px;font-size:14px;color:#374151;line-height:2;">
                <li><a href="${BASE_URL}/e2-fit" style="color:#1a2a4a;">How the E-2 visa works with our franchise</a></li>
                <li><a href="${BASE_URL}/territories" style="color:#1a2a4a;">Available territories across Texas</a></li>
                <li><a href="${BASE_URL}/process" style="color:#1a2a4a;">Our step-by-step investment process</a></li>
                <li><a href="${BASE_URL}/blog" style="color:#1a2a4a;">Franchise &amp; E-2 visa insights blog</a></li>
              </ul>
            </div>
            <a href="${BASE_URL}/contact" style="display:inline-block;background:#1a2a4a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Request a Free Consultation →</a>
            <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">
              Questions? Reply to this email or call (346) 597-9994.<br/>
              New Dawn Franchising LLC · El Paso, TX<br/>
              <a href="${BASE_URL}" style="color:#9ca3af;">${BASE_URL}</a>
            </p>
          </div>
        </div>`;

      sendEmail(
        trimmedEmail,
        "You're subscribed — New Dawn Franchising updates",
        confirmHtml
      ).catch((e) => console.error("Failed to send newsletter confirmation:", e));
    } catch (err) {
      console.error("Newsletter signup error:", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/posts", async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/posts/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  app.patch("/api/posts/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      const allowedFields = ["title", "excerpt", "content", "coverImageUrl"];
      const data: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const updated = await storage.updateBlogPost(id, data);
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(updated);
    } catch (err) {
      console.error("Update blog post error:", err);
      res.status(500).json({ message: "Failed to update post" });
    }
  });

  app.post("/api/posts/generate", async (req, res) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.BLOG_ADMIN_TOKEN;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      await generateBlogPost();
      res.json({ message: "Blog post generated successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to generate blog post" });
    }
  });

  app.post("/api/brokers/register", async (req, res) => {
    try {
      const data = insertBrokerSchema.parse(req.body);
      const existing = await storage.getBrokerByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(data.password, 12);
      const broker = await storage.createBroker({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        passwordHash,
      });
      req.session.brokerId = broker.id;
      res.status(201).json({ id: broker.id, fullName: broker.fullName, email: broker.email, agreementSigned: broker.agreementSigned });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ message: fromZodError(err).message });
      } else {
        throw err;
      }
    }
  });

  app.post("/api/brokers/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const broker = await storage.getBrokerByEmail(email);
      if (!broker) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, broker.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.brokerId = broker.id;
      res.json({ id: broker.id, fullName: broker.fullName, email: broker.email, agreementSigned: broker.agreementSigned });
    } catch (err) {
      console.error("[brokers/login] failed:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/brokers/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/brokers/me", requireBrokerAuth, async (req, res) => {
    try {
      const broker = await storage.getBrokerById(req.session.brokerId!);
      if (!broker) {
        return res.status(404).json({ message: "Broker not found" });
      }
      res.json({ id: broker.id, fullName: broker.fullName, email: broker.email, company: broker.company, phone: broker.phone, agreementSigned: broker.agreementSigned, agreementSignedAt: broker.agreementSignedAt });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch broker" });
    }
  });

  app.post("/api/brokers/sign-agreement", requireBrokerAuth, async (req, res) => {
    try {
      const existingBroker = await storage.getBrokerById(req.session.brokerId!);
      if (!existingBroker) {
        return res.status(404).json({ message: "Broker not found" });
      }

      const signedAt = new Date();
      const pdfBuffer = await generateBrokerAgreementPDF({
        fullName: existingBroker.fullName,
        email: existingBroker.email,
        company: existingBroker.company,
        phone: existingBroker.phone,
        signedAt,
      });

      const pdfBase64 = pdfBuffer.toString("base64");
      const broker = await storage.signBrokerAgreement(req.session.brokerId!, pdfBase64);

      sendEmail(
        existingBroker.email,
        "Your Signed Broker Commission Agreement — New Dawn Franchising",
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1B2E5A;padding:24px 32px;">
            <h1 style="color:#F0A30A;margin:0;font-size:22px;">New Dawn Franchising</h1>
          </div>
          <div style="padding:24px 32px;">
            <p>Dear ${existingBroker.fullName},</p>
            <p>Thank you for signing the Referring Broker Commission Agreement with New Dawn Franchising LLC.</p>
            <p>Please find your signed copy of the agreement attached to this email as a PDF. You can also access your signed agreement at any time by logging into the <strong>Broker Portal</strong>.</p>
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <p style="margin-top:24px;">Best regards,<br/><strong>New Dawn Franchising LLC</strong><br/>dylan@newdawnfranchising.com<br/>(346) 597-9994</p>
          </div>
        </div>`,
        undefined,
        [{ filename: "Broker_Agreement_Signed.pdf", content: pdfBuffer }]
      ).catch((err) => console.error("Failed to send agreement email:", err));

      res.json({ id: broker.id, agreementSigned: broker.agreementSigned, agreementSignedAt: broker.agreementSignedAt });
    } catch (err) {
      console.error("Sign agreement error:", err);
      res.status(500).json({ message: "Failed to sign agreement" });
    }
  });

  app.get("/api/brokers/agreement-pdf", requireBrokerAuth, async (req, res) => {
    try {
      const broker = await storage.getBrokerById(req.session.brokerId!);
      if (!broker || !broker.agreementPdf) {
        return res.status(404).json({ message: "No signed agreement found" });
      }
      const pdfBuffer = Buffer.from(broker.agreementPdf, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="Broker_Agreement_Signed.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({ message: "Failed to retrieve agreement" });
    }
  });

  app.get("/api/brokers/clients", requireBrokerAuth, async (req, res) => {
    try {
      const brokerId = req.session.brokerId!;
      const clients = await storage.getBrokerClients(brokerId);
      const allCrm = await storage.getCrmClients();
      const crmByEmail = new Map(
        allCrm.filter(c => c.brokerId === brokerId).map(c => [c.email?.toLowerCase(), c.status])
      );
      const enriched = clients.map(c => ({
        ...c,
        crmStatus: crmByEmail.get(c.email?.toLowerCase()) ?? null,
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post("/api/brokers/clients", requireBrokerAuth, async (req, res) => {
    try {
      const data = insertBrokerClientSchema.parse(req.body);
      const client = await storage.createBrokerClient(req.session.brokerId!, data);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ message: fromZodError(err).message });
      } else {
        throw err;
      }
    }
  });

  app.get("/api/brochure", (_req, res) => {
    try {
      generateBrochurePDF(res);
    } catch (err) {
      console.error("Brochure generation error:", err);
      res.status(500).json({ message: "Failed to generate brochure" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (email.toLowerCase().trim() === ADMIN_EMAIL && password.trim() === ADMIN_PASSWORD) {
        req.session.adminId = "admin";
        return res.json({ role: "admin", email: ADMIN_EMAIL });
      }

      const broker = await storage.getBrokerByEmail(email);
      if (!broker) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, broker.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.brokerId = broker.id;
      return res.json({ role: "broker", id: broker.id, fullName: broker.fullName, email: broker.email, agreementSigned: broker.agreementSigned });
    } catch (err) {
      console.error("[auth/login] failed:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session.adminId) {
      return res.json({ role: "admin", email: ADMIN_EMAIL });
    }
    if (req.session.brokerId) {
      return res.json({ role: "broker", brokerId: req.session.brokerId });
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/crm/clients", requireAdminAuth, async (_req, res) => {
    try {
      const clients = await storage.getCrmClients();
      res.json(clients);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/crm/client-tags", requireAdminAuth, async (_req, res) => {
    try {
      const tags = await storage.getUniqueCrmTags();
      res.json(tags);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post("/api/crm/clients/bulk-add", requireAdminAuth, async (req, res) => {
    try {
      const { contacts, tags } = req.body as { contacts: any[]; tags?: string[] };
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "contacts array is required" });
      }
      const results = [];
      for (const contact of contacts) {
        const data = insertCrmClientSchema.parse({
          fullName: contact.fullName || "Unknown",
          email: contact.email || `unknown-${Date.now()}@placeholder.com`,
          phone: contact.phone || undefined,
          leadSource: "prospect_finder",
          companyName: contact.companyName || undefined,
          profession: contact.jobTitle || undefined,
          linkedinUrl: contact.linkedinUrl || undefined,
          notes: contact.bio ? contact.bio.slice(0, 500) : undefined,
          status: "new",
          tags: tags && tags.length > 0 ? tags : [],
        });
        const created = await storage.createCrmClient(data);
        results.push(created);
      }
      res.status(201).json({ added: results.length, clients: results });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ message: fromZodError(err).message });
      } else {
        throw err;
      }
    }
  });

  // Bulk-update tags for a set of clients (replace existing tags or merge)
  app.post("/api/crm/clients/bulk-tags", requireAdminAuth, async (req, res) => {
    try {
      const { ids, tags, mode = "replace" } = req.body as { ids: string[]; tags: string[]; mode?: "replace" | "merge" };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array required" });
      const updated: any[] = [];
      for (const id of ids) {
        const existing = await storage.getCrmClient(id);
        if (!existing) continue;
        const newTags = mode === "merge"
          ? Array.from(new Set([...(existing.tags || []), ...tags]))
          : tags;
        const result = await storage.updateCrmClient(id, { tags: newTags });
        updated.push(result);
      }
      res.json({ updated: updated.length, clients: updated });
    } catch (err) {
      console.error("bulk-tags error:", err);
      res.status(500).json({ message: "Failed to update tags" });
    }
  });

  app.post("/api/crm/clients", requireAdminAuth, async (req, res) => {
    try {
      const data = insertCrmClientSchema.parse(req.body);
      const client = await storage.createCrmClient(data);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ message: fromZodError(err).message });
      } else {
        throw err;
      }
    }
  });

  app.patch("/api/crm/clients/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      const existing = await storage.getCrmClient(id);
      if (!existing) {
        return res.status(404).json({ message: "Client not found" });
      }
      const updated = await storage.updateCrmClient(id, req.body);
      // Log status change in activity timeline
      if (req.body.status && req.body.status !== existing.status) {
        await storage.createCrmClientActivity({
          clientId: id,
          activityType: "status_changed",
          metadata: { oldStatus: existing.status, newStatus: req.body.status },
        });
        // Auto-send wire receipt + welcome email when wire is confirmed
        if (req.body.status === "wire_received" && existing.email) {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          await Promise.allSettled([
            sendWireReceiptEmail(existing.email, existing.fullName, existing.investmentAmount || ""),
            sendWelcomeEmail(existing.email, existing.fullName),
          ]);
        }
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/crm/clients/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      await storage.deleteCrmClient(id);
      res.json({ message: "Client deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // ─── Direct email routes ───────────────────────────────────────────────────
  app.get("/api/crm/sender-profiles", requireAdminAuth, (_req, res) => {
    res.json(getAvailableSenders());
  });

  app.get("/api/crm/email-templates", requireAdminAuth, (_req, res) => {
    res.json(CRM_EMAIL_TEMPLATES);
  });

  app.get("/api/crm/clients/:id/emails", requireAdminAuth, async (req, res) => {
    try {
      const emails = await storage.getCrmDirectEmails(String(req.params.id) as string);
      res.json(emails.filter(shouldShowInCrmEmailHistory));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch email history" });
    }
  });

  app.post("/api/crm/clients/:id/send-email", requireAdminAuth, async (req, res) => {
    try {
      const clientId = String(req.params.id) as string;
      const client = await storage.getCrmClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const { fromEmail, subject, bodyHtml, bodyText } = req.body;
      if (!fromEmail || !subject || !bodyHtml) {
        return res.status(400).json({ message: "fromEmail, subject, and bodyHtml are required" });
      }

      const trackingId = `de_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const pixelUrl = getTrackingPixelUrl(baseUrl, trackingId);

      // sendEmailFromSender auto-injects the signature with the production URL
      const result = await sendEmailFromSender(fromEmail, client.email, subject, bodyHtml, pixelUrl);
      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send email" });
      }

      const senderProfile = getAvailableSenders().find(p => p.email === fromEmail);
      const emailRecord = await storage.createCrmDirectEmail({
        clientId,
        fromEmail,
        fromName: senderProfile?.name || fromEmail,
        toEmail: client.email,
        subject,
        bodyHtml,
        bodyText,
        trackingId,
      });

      await storage.createCrmClientActivity({
        clientId,
        activityType: "email_sent",
        metadata: { subject, from: fromEmail, emailId: emailRecord.id },
      });

      res.json(emailRecord);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // ─── AI outreach draft ────────────────────────────────────────────────────
  app.post("/api/crm/clients/:id/draft-outreach", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });

      const { stepId, stepName, channel, dayNumber } = req.body as {
        stepId: string; stepName: string; channel: string; dayNumber: number;
      };

      const activities = await storage.getCrmClientActivities(client.id);
      const recentActs = activities.slice(0, 12).map(a => {
        const d = new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const meta = (a.metadata as Record<string, string>) || {};
        if (a.activityType === "email_sent")    return `${d}: Sent email — "${meta.subject || "no subject"}"`;
        if (a.activityType === "sms_sent")      return `${d}: Sent SMS`;
        if (a.activityType === "whatsapp_sent") return `${d}: Sent WhatsApp`;
        if (a.activityType === "note" || a.activityType === "note_added") return `${d}: Note — ${meta.note || meta.text || ""}`;
        if (a.activityType === "call_logged")   return `${d}: Call — ${meta.summary || "logged"}`;
        return `${d}: ${a.activityType}`;
      }).join("\n");

      const daysSinceCreated = Math.floor((Date.now() - new Date(client.createdAt).getTime()) / 86400000);

      const context = [
        `Name: ${client.fullName}`,
        client.companyName  ? `Company: ${client.companyName}`          : null,
        client.profession   ? `Profession: ${client.profession}`         : null,
        client.country      ? `Country: ${client.country}`               : null,
        client.citizenship  ? `Citizenship: ${client.citizenship}`       : null,
        client.visaType     ? `Visa type of interest: ${client.visaType}`: null,
        client.investmentAmount ? `Investment budget: ${client.investmentAmount}` : null,
        client.leadSource   ? `Lead source: ${client.leadSource}`        : null,
        client.leadTemperature ? `Lead temperature: ${client.leadTemperature}` : null,
        client.tags?.length ? `Tags: ${client.tags.join(", ")}`          : null,
        client.notes        ? `Admin notes: ${client.notes}`             : null,
        `In CRM for: ${daysSinceCreated} days`,
        recentActs          ? `\nRecent activity:\n${recentActs}`        : "No prior contact logged",
      ].filter(Boolean).join("\n");

      const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";

      const channelInstructions: Record<string, string> = {
        email: `Write a professional, warm outreach email. Return JSON with "subject" and "body" keys. The body should be plain text (no HTML), 3–5 short paragraphs, conversational but polished. End with your name and title. Do NOT use generic phrases like "I hope this email finds you well."`,
        sms: `Write a short, personal SMS message (max 160 characters ideally, hard limit 320). Return JSON with "body" key only. Casual but professional. Include the Calendly link naturally.`,
        whatsapp: `Write a WhatsApp message — slightly warmer than email, can use 1–2 emojis. 2–4 short paragraphs. Return JSON with "body" key only. Include the Calendly link.`,
      };

      const systemPrompt = `You are Dylan Delaney, founder of New Dawn Franchising LLC. You are writing outreach messages on behalf of yourself.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT NEW DAWN FRANCHISING ACTUALLY IS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New Dawn Franchising offers a multi-vertical franchise platform specifically engineered for E-2 Treaty Investor Visa applicants, with recurring-revenue options in Property Management, Telecom, and Insurance.

The franchise model: "You Own It. You Direct It. We Run It."
- The investor selects a franchise vertical and reviews investment details through the Franchise Disclosure Document
- They are the legal owner and sole signatory on US bank accounts — USCIS requires this
- Local operations teams execute the day-to-day manual work while the investor maintains executive and supervisory control
- The investor can live ANYWHERE in the USA while overseeing the enterprise
- Revenue comes from recurring-service activity in the selected vertical

What's included in the franchise:
- A real operating franchise model in Property Management, Telecom, or Insurance
- A USCIS-compliant business plan (partnered with Joorney Business Plans)
- Operational support by New Dawn's local teams
- Escrow structure through the investor's selected escrow account
- Escrow refund protection if the visa is denied twice, as detailed in the FDD and transaction documents
- Internal buyback pathway and documentation support for future growth planning
- Investor funds held in escrow by a third-party attorney — only released on visa approval

Additional paths: As the business grows, it can serve as a stepping stone to EB-5 (Green Card).

We do NOT yet have franchisees — we are in the early sales phase. Do not claim or imply we have many existing franchisees or a proven track record with franchisees.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHO YOU ARE WRITING TO (read this carefully)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The CRM contacts fall into two categories — you must identify which from the profile:

CATEGORY A — REFERRAL PARTNERS (the majority):
Immigration attorneys, business brokers, financial advisors, visa consultants, business transaction lawyers. These people DO NOT personally want to buy a franchise. You want them to refer their E-2 investor clients to you. You pay a referral fee when a referred client signs.

Pitch to referral partners:
- "I wanted to introduce a franchise option you could offer E-2 clients who need a compliant business"
- Emphasise: escrow protection (safe for their clients to recommend), fully managed (no experience needed), USCIS-compliant business plan included, $225K meets the investment threshold
- Mention the referral fee arrangement
- Make them the hero to their client — you solve a hard problem for them

CATEGORY B — DIRECT INVESTORS (much rarer):
International nationals from E-2 treaty countries (Mexico, UK, Japan, South Korea, Colombia, etc.) who are exploring the E-2 visa for themselves. Usually no "attorney" or "broker" in their profession. They want to move to/stay in the US.

Pitch to direct investors:
- They own the business and direct strategy — the Territory Manager does the day-to-day
- They can live anywhere in the US, not just El Paso
- The escrow means zero risk if denied
- The initial portfolio means revenue from day one, making the USCIS petition stronger
- It's a stepping stone toward a Green Card path too

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Be direct and human — no corporate speak, no buzzwords
- NEVER say "I hope this email finds you well", "exciting opportunity", "synergies", "at your earliest convenience"
- Personalise heavily — reference their name, profession, company, country, anything in the profile
- Keep it SHORT — attorneys and brokers are busy; respect their time
- Calendly booking link: ${CALENDLY}
- Sign off: Dylan Delaney | New Dawn Franchising

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.`;

      const userPrompt = `Write a "${stepName}" outreach message (sequence step at Day ${dayNumber}) for this contact.

CHANNEL: ${channel}
FORMAT RULES: ${channelInstructions[channel] || channelInstructions.email}

CONTACT PROFILE:
${context}

First decide: is this person a REFERRAL PARTNER (attorney/broker/advisor who refers E-2 clients) or a DIRECT INVESTOR (international national pursuing an E-2 visa for themselves)? Write the message accordingly. Personalise every sentence you can — make it obvious this is not a mass email.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(503).json({ message: "AI not configured" });

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!aiRes.ok) {
        const err = await aiRes.text();
        console.error("[DraftOutreach] Claude error:", aiRes.status, err);
        return res.status(502).json({ message: "AI draft failed" });
      }

      const aiData = await aiRes.json() as any;
      const raw = aiData.content?.[0]?.text || "";

      // Parse JSON from Claude response
      let draft: { subject?: string; body: string } = { body: "" };
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        draft = jsonMatch ? JSON.parse(jsonMatch[0]) : { body: raw };
      } catch {
        draft = { body: raw };
      }

      res.json({ subject: draft.subject || "", body: draft.body || "" });
    } catch (err: any) {
      console.error("[DraftOutreach] Error:", err.message);
      res.status(500).json({ message: err.message || "Draft generation failed" });
    }
  });

  // ─── Reports route ─────────────────────────────────────────────────────────
  app.get("/api/crm/reports", requireAdminAuth, async (_req, res) => {
    try {
      const clients = await storage.getCrmClients();

      // Pipeline funnel by status
      const statusCounts: Record<string, number> = {};
      for (const c of clients) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }

      // By country
      const countryCounts: Record<string, number> = {};
      for (const c of clients) {
        const key = c.country || "Unknown";
        countryCounts[key] = (countryCounts[key] || 0) + 1;
      }

      // By lead source
      const sourceCounts: Record<string, number> = {};
      for (const c of clients) {
        const key = c.leadSource || "Unknown";
        sourceCounts[key] = (sourceCounts[key] || 0) + 1;
      }

      // By contact method
      const methodCounts: Record<string, number> = {};
      for (const c of clients) {
        const key = c.lastContactMethod || "none";
        methodCounts[key] = (methodCounts[key] || 0) + 1;
      }

      // Last contacted buckets
      const now = new Date();
      const buckets = { today: 0, week: 0, month: 0, older: 0, never: 0 };
      for (const c of clients) {
        if (!c.lastContactedAt) { buckets.never++; continue; }
        const diff = (now.getTime() - new Date(c.lastContactedAt).getTime()) / 86400000;
        if (diff < 1) buckets.today++;
        else if (diff < 7) buckets.week++;
        else if (diff < 30) buckets.month++;
        else buckets.older++;
      }

      // FDD & receipt stats
      const fddSent = clients.filter(c => c.fddSent).length;
      const receiptSigned = clients.filter(c => c.receiptSigned).length;
      const active = clients.filter(c => c.status === "active").length;
      const wireReceived = clients.filter(c => c.status === "wire_received").length;

      // By lead temperature
      const tempCounts: Record<string, number> = {};
      for (const c of clients) {
        const key = c.leadTemperature || "unset";
        tempCounts[key] = (tempCounts[key] || 0) + 1;
      }

      res.json({
        total: clients.length,
        fddSent,
        receiptSigned,
        active,
        wireReceived,
        byStatus: statusCounts,
        byCountry: Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
        byLeadSource: Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]),
        byContactMethod: methodCounts,
        lastContactedBuckets: buckets,
        byTemperature: tempCounts,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/crm/brokers", requireAdminAuth, async (_req, res) => {
    try {
      const allBrokers = await storage.getAllBrokers();
      res.json(allBrokers.map(b => ({ id: b.id, fullName: b.fullName, email: b.email, company: b.company })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch brokers" });
    }
  });

  app.post("/api/crm/brokers", requireAdminAuth, async (req, res) => {
    try {
      const { fullName, email, phone, company } = req.body as { fullName: string; email?: string; phone?: string; company?: string };
      if (!fullName?.trim()) {
        return res.status(400).json({ message: "Full name is required" });
      }
      const existing = email ? await storage.getBrokerByEmail(email) : null;
      if (existing) {
        return res.status(409).json({ message: "A broker with this email already exists" });
      }
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const broker = await storage.createBroker({ fullName: fullName.trim(), email: email || `noemail-${Date.now()}@placeholder.local`, phone, company, passwordHash });
      res.status(201).json({ id: broker.id, fullName: broker.fullName, email: broker.email, company: broker.company });
    } catch (err) {
      res.status(500).json({ message: "Failed to create broker" });
    }
  });

  app.get("/api/crm/leads", requireAdminAuth, async (_req, res) => {
    try {
      const allLeads = await storage.getLeads();
      res.json(allLeads);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/crm/broker-clients", requireAdminAuth, async (_req, res) => {
    try {
      const allBrokers = await storage.getAllBrokers();
      const allBrokerClients = [];
      for (const b of allBrokers) {
        const clients = await storage.getBrokerClients(b.id);
        for (const c of clients) {
          allBrokerClients.push({ ...c, brokerName: b.fullName, brokerEmail: b.email });
        }
      }
      res.json(allBrokerClients);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch broker clients" });
    }
  });

  app.post("/api/crm/broker-clients/:id/mark-imported", requireAdminAuth, async (req, res) => {
    try {
      await storage.markBrokerClientImported(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark broker client as imported" });
    }
  });

  app.delete("/api/crm/broker-clients/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.markBrokerClientImported(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to dismiss broker referral" });
    }
  });

  app.get("/api/crm/prospect-categories", requireAdminAuth, (_req, res) => {
    res.json(SEARCH_CATEGORIES);
  });

  // ─── Enriched Prospect Search (v2) ──────────────────────────────────────────

  app.get("/api/crm/enrichment-status", requireAdminAuth, (_req, res) => {
    res.json(getEnrichmentApiStatus());
  });

  // Conversational Lead Research agent — natural language → searches, ICP
  // analysis, and outreach drafting via Claude tool-use. Returns the assistant
  // reply plus any prospects it built (the UI renders + saves them).
  app.post("/api/crm/lead-research/agent", requireAdminAuth, async (req, res) => {
    try {
      const { messages, provider } = req.body as {
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
        provider?: string;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "messages required" });
      }
      const result = await runLeadResearchAgent(messages, provider);
      res.json(result);
    } catch (err: any) {
      console.error("[lead-research/agent] error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Lead research agent failed" });
    }
  });

  // ─── Seamless.AI Lead Research (search free · reveal spends credits) ────────
  // Unified contact/company search. Optionally parses a natural-language query
  // (aiQuery) into structured filters first, then searches Seamless. Email/phone
  // are NOT included here — they are revealed on demand via /seamless-reveal.
  app.post("/api/crm/prospects/seamless-search", requireAdminAuth, async (req, res) => {
    try {
      const { mode, aiQuery, nextToken } = req.body as {
        mode?: "contacts" | "companies";
        filters?: LeadSearchFilters;
        aiQuery?: string;
        nextToken?: string | null;
        provider?: ProviderId;
      };
      // Which provider to run for this call (defaults to Seamless for back-compat).
      const provider: ProviderId =
        req.body?.provider === "apollo" || req.body?.provider === "origami"
          ? req.body.provider
          : "seamless";

      const KEY_FOR: Record<ProviderId, string> = {
        seamless: "SEAMLESS_API_KEY",
        apollo: "APOLLO_API_KEY",
        origami: "ORIGAMI_API_KEY",
      };
      if (!process.env[KEY_FOR[provider]]) {
        return res.status(503).json({ message: `${provider} is not configured (${KEY_FOR[provider]} missing).` });
      }

      let filters: LeadSearchFilters = (req.body?.filters as LeadSearchFilters) || {};

      // If a natural-language query is supplied, parse it and merge over the
      // explicit filters (explicit values the user typed win; parsed fills gaps).
      let appliedFilters = filters;
      if (aiQuery && aiQuery.trim()) {
        const parsed = await parseNaturalLanguageToFilters(aiQuery.trim());
        const explicit = Object.fromEntries(
          Object.entries(filters).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v)),
        ) as LeadSearchFilters;
        appliedFilters = { ...parsed, ...explicit };
      }

      const hasAnyFilter = Object.values(appliedFilters).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
      if (!hasAnyFilter) {
        return res.status(400).json({ message: "Add at least one filter or type what you're looking for." });
      }

      const result = await providerSearch(provider, mode === "companies" ? "companies" : "contacts", appliedFilters, { nextToken });

      res.json({ ...result, appliedFilters, provider });
    } catch (err: any) {
      console.error("Provider search error:", err);
      res.status(500).json({ message: err.message || "Provider search failed" });
    }
  });

  // Connection + remaining-credit status for each contact-search provider
  // (Seamless.AI, Apollo.io, Origami). Drives the provider selector UI.
  app.get("/api/crm/prospects/provider-status", requireAdminAuth, async (req, res) => {
    try {
      const force = req.query.refresh === "1" || req.query.force === "1";
      const statuses = await getProviderStatuses(force);
      res.json({ providers: statuses });
    } catch (err: any) {
      console.error("Provider status error:", err);
      res.status(500).json({ message: err.message || "Failed to load provider status" });
    }
  });

  // Reveal email + phone for the given Seamless searchResultIds. Spends ~1
  // Seamless credit per contact.
  app.post("/api/crm/prospects/seamless-reveal", requireAdminAuth, async (req, res) => {
    try {
      if (!process.env.SEAMLESS_API_KEY) {
        return res.status(503).json({ message: "Seamless.AI is not configured (SEAMLESS_API_KEY missing)." });
      }
      const { searchResultIds } = req.body as { searchResultIds?: string[] };
      if (!Array.isArray(searchResultIds) || searchResultIds.length === 0) {
        return res.status(400).json({ message: "searchResultIds is required" });
      }
      const results = await seamlessRevealContacts(searchResultIds.slice(0, 50));
      res.json({ results });
    } catch (err: any) {
      console.error("Seamless reveal error:", err);
      res.status(500).json({ message: err.message || "Seamless reveal failed" });
    }
  });

  // ─── Whitepages manual enrichment ─────────────────────────────────────────
  // Look up a single contact by name + (optionally) email, city, state.
  // Returns best phone and current mailing address from public records.
  // Uses 1 Whitepages credit per call.
  app.post("/api/crm/enrich/whitepages", requireAdminAuth, async (req, res) => {
    try {
      const { firstName, lastName, email, city, stateCode, postalCode, phone } = req.body;
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "firstName and lastName are required" });
      }
      if (!process.env.WHITEPAGES_API_KEY) {
        return res.status(503).json({ message: "Whitepages API key not configured" });
      }
      const result = await whitePageslookup({ firstName, lastName, email, city, stateCode, postalCode, phone });
      res.json(result);
    } catch (err: any) {
      console.error("[Whitepages endpoint] error:", err);
      res.status(500).json({ message: err.message || "Whitepages lookup failed" });
    }
  });

  // Verify a contact's email (Hunter.io email-verifier) and phone (format check).
  app.post("/api/crm/verify-contact", requireAdminAuth, async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim();
      const phone = String(req.body?.phone || "").trim();
      const out: { email?: any; phone?: any } = {};

      if (email) {
        const v = await hunterVerifyEmail(email);
        out.email = v
          ? { ...v, configured: true }
          : { result: "unknown", status: "unknown", score: 0, configured: getHunterStatus().configured };
      }
      if (phone) {
        // Lightweight format/length check (E.164-ish). Not a live carrier lookup.
        const digits = phone.replace(/[^\d]/g, "");
        out.phone = {
          valid: digits.length >= 10 && digits.length <= 15,
          normalized: digits,
          note: "Format check only — not a live carrier lookup.",
        };
      }
      res.json(out);
    } catch (err: any) {
      console.error("[verify-contact] error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Verification failed" });
    }
  });

  // Enrich a single CRM client via the configured providers (Apollo + Origami).
  // Merges results (first non-empty value per field) and returns the best
  // email/phone/title/company/LinkedIn/location — the user decides what to apply.
  // Never auto-overwrites existing data.
  app.post("/api/crm/clients/:id/enrich", requireAdminAuth, async (req, res) => {
    try {
      if (!apolloConfigured() && !origamiConfigured()) {
        return res.status(503).json({ message: "No enrichment provider configured (set APOLLO_API_KEY and/or ORIGAMI_API_KEY)." });
      }
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });

      const parts = (client.fullName || "").trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ");
      const domain = (client.email || "").split("@")[1] || undefined;
      const args = { firstName, lastName, email: client.email || undefined, domain };

      const [apollo, origami] = await Promise.all([
        apolloConfigured() ? apolloEnrichPerson({ ...args, revealPhone: true }) : Promise.resolve(null),
        origamiConfigured() ? origamiEnrichPerson(args) : Promise.resolve(null),
      ]);

      const sources: string[] = [];
      if (apollo) sources.push("apollo");
      if (origami) sources.push("origami");
      if (!apollo && !origami) return res.json({ found: false });

      // Merge field-by-field, Apollo first then Origami.
      const pickField = (k: "email" | "phone" | "jobTitle" | "company" | "linkedinUrl" | "city" | "state" | "country") =>
        (apollo as any)?.[k] || (origami as any)?.[k] || null;
      const enrichment = {
        email: pickField("email"),
        phone: pickField("phone"),
        jobTitle: pickField("jobTitle"),
        company: pickField("company"),
        linkedinUrl: pickField("linkedinUrl"),
        city: pickField("city"),
        state: pickField("state"),
        country: pickField("country"),
      };
      res.json({ found: true, enrichment, sources });
    } catch (err: any) {
      console.error("[enrich] error:", err?.message || err);
      res.status(500).json({ message: err?.message || "Enrichment failed" });
    }
  });

  // Reverse phone lookup — verifies a number and optionally checks if it belongs to expectName
  // Uses 1 Whitepages credit per call.
  app.post("/api/crm/verify/phone", requireAdminAuth, async (req, res) => {
    try {
      const { phone, expectName } = req.body;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ message: "phone is required" });
      }
      if (!process.env.WHITEPAGES_API_KEY) {
        return res.status(503).json({ message: "Whitepages API key not configured" });
      }
      const result = await whitepagesVerifyPhone(phone, expectName);
      res.json(result);
    } catch (err: any) {
      console.error("[Whitepages verify] error:", err);
      res.status(500).json({ message: err.message || "Phone verification failed" });
    }
  });

  app.post("/api/crm/prospects/search-v2", requireAdminAuth, async (req, res) => {
    try {
      const { category, location } = req.body;
      if (!category || !location) {
        return res.status(400).json({ message: "Category and location are required" });
      }
      const result = await runEnrichmentSearch(category, location);
      res.json(result);
    } catch (err: any) {
      console.error("Enriched prospect search error:", err);
      res.status(500).json({ message: err.message || "Enriched search failed" });
    }
  });

  app.post("/api/crm/prospects/find-similar", requireAdminAuth, async (req, res) => {
    try {
      const { url, category } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      // Hard 85-second overall timeout so the client never hangs indefinitely
      const timeoutMs = 85_000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Search timed out after ${timeoutMs / 1000}s — try a simpler URL or check your API connections`)), timeoutMs)
      );
      const result = await Promise.race([
        findSimilarCompanies(url, category || "Similar Companies"),
        timeoutPromise,
      ]);
      res.json(result);
    } catch (err: any) {
      console.error("Find similar error:", err);
      res.status(500).json({ message: err.message || "Failed to find similar companies" });
    }
  });

  app.post("/api/crm/prospects/enrich-url", requireAdminAuth, async (req, res) => {
    try {
      const { url, name, category, location } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      const result = await enrichSingleCompany(url, name || "", category || "Custom", location || "Global");
      res.json(result);
    } catch (err: any) {
      console.error("Enrich URL error:", err);
      res.status(500).json({ message: err.message || "Enrichment failed" });
    }
  });

  // ── Manual contact seeding: enrich a single named person ─────────────────────
  app.post("/api/crm/prospects/seed-contact", requireAdminAuth, async (req, res) => {
    try {
      const { firstName, lastName, company, website } = req.body as {
        firstName: string; lastName: string; company: string; website?: string;
      };
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const timeoutMs = 60_000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Seed timed out after 60s")), timeoutMs)
      );
      const result = await Promise.race([
        seedContactEnrichment(
          firstName.trim(),
          lastName.trim(),
          (company || "").trim(),
          (website || "").trim(),
        ),
        timeoutPromise,
      ]);
      if (!result) {
        return res.status(404).json({ message: "No data found for this person. Try adding a website URL or check the name spelling." });
      }
      const scoreBreakdown = calculateDecisionMakerScore({
        jobTitle: result.jobTitle,
        seniority: result.seniority,
        email: result.email,
        emailVerified: result.emailVerified,
        emailConfidence: result.emailConfidence,
        phone: result.phone,
        phoneType: result.phoneType,
        linkedinUrl: result.linkedinUrl,
        bio: result.bio,
        e2ViaBio: result.e2ViaBio,
        internationalBio: result.internationalBio,
      });
      res.json({ ...result, scoreBreakdown, decisionMakerScore: scoreBreakdown.total });
    } catch (err: any) {
      console.error("Seed contact error:", err);
      res.status(500).json({ message: err.message || "Seed enrichment failed" });
    }
  });

  // Save individual enriched contact to prospects table
  app.post("/api/crm/prospects/save-individual", requireAdminAuth, async (req, res) => {
    try {
      const { contact, category, location } = req.body as {
        contact: {
          fullName: string; companyName: string; email: string | null;
          phone: string | null; website: string | null; linkedinUrl: string | null;
          jobTitle: string | null; bio: string | null; decisionMakerScore: number;
          emailVerified: boolean; emailConfidence: number; phoneType: string | null;
          sources: string[]; e2ViaBio: boolean;
        };
        category: string;
        location: string;
      };

      const saved = await storage.createProspect({
        name: contact.fullName,
        company: contact.companyName || null,
        email: contact.email || null,
        phone: contact.phone || null,
        website: contact.website || null,
        address: null,
        category,
        location,
        source: contact.sources.join(", ") || "Enriched Search",
        sourceUrl: contact.linkedinUrl || null,
        notes: contact.bio?.slice(0, 200) || null,
      });

      res.status(201).json(saved);
    } catch (err: any) {
      console.error("Save individual error:", err);
      res.status(500).json({ message: err.message || "Failed to save contact" });
    }
  });

  // Add enriched contact directly to attorney CRM contacts
  app.post("/api/crm/prospects/add-to-contacts", requireAdminAuth, async (req, res) => {
    try {
      const { contact, category } = req.body as {
        contact: {
          fullName: string; firstName: string; lastName: string; companyName: string;
          email: string | null; phone: string | null; linkedinUrl: string | null;
          jobTitle: string | null; bio: string | null; decisionMakerScore: number;
          e2ViaBio: boolean; internationalBio: boolean;
        };
        category: string;
      };

      const { contacts: contactsTable } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      // Check for existing contact
      if (contact.email) {
        const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.email, contact.email));
        if (existing) {
          return res.status(409).json({ message: "Contact with this email already exists", existing });
        }
      }

      const { calculateLeadScore } = await import("./lead-scoring");
      const personaMap: Record<string, string> = {
        immigration_attorney: "immigration_attorney",
        e2_visa_firm: "immigration_attorney",
        business_broker: "business_broker",
        immigration_consultant: "immigration_consultant",
        franchise_consultant: "franchise_consultant",
        cpa_international: "international_tax_advisor",
        relocation_service: "relocation_consultant",
      };

      const contactData = {
        firstName: contact.firstName || contact.fullName.split(" ")[0],
        lastName: contact.lastName || contact.fullName.split(" ").slice(1).join(" ") || "",
        email: contact.email || null,
        phone: contact.phone || null,
        firmName: contact.companyName || null,
        jobTitle: contact.jobTitle || null,
        personaType: personaMap[category] || "immigration_attorney",
        linkedinUrl: contact.linkedinUrl || null,
        websiteUrl: null,
        status: "new" as const,
        tags: [] as string[],
        notes: contact.bio?.slice(0, 300) || null,
        source: "Prospect Finder",
        country: null,
        city: null,
        gdprNote: null,
        consentSource: null,
        referredByContactId: null,
        possibleDuplicateOf: null,
      };

      const score = calculateLeadScore(contactData, contact.e2ViaBio);
      const [created] = await db.insert(contactsTable).values({ ...contactData, leadScore: score }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      console.error("Add to contacts error:", err);
      res.status(500).json({ message: err.message || "Failed to add contact" });
    }
  });

  app.post("/api/crm/prospects/search", requireAdminAuth, async (req, res) => {
    try {
      const { category, location, offset } = req.body;
      if (!category || !location) {
        return res.status(400).json({ message: "Category and location are required" });
      }
      const results = await searchProspects(category, location, offset || 0);
      res.json(results);
    } catch (err: any) {
      console.error("Prospect search error:", err);
      res.status(500).json({ message: err.message || "Search failed" });
    }
  });

  app.post("/api/crm/prospects/save", requireAdminAuth, async (req, res) => {
    try {
      const { prospects: prospectList, category, location } = req.body;
      if (!Array.isArray(prospectList) || !category || !location) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const toInsert = prospectList.map((p: any) => ({
        name: p.name,
        company: p.company || null,
        email: p.email || null,
        phone: p.phone || null,
        website: p.website || null,
        address: p.address || null,
        category,
        location,
        source: p.source || "SerpAPI",
        sourceUrl: p.sourceUrl || null,
        notes: p.notes || null,
      }));
      const saved = await storage.createProspects(toInsert);
      res.status(201).json(saved);
    } catch (err: any) {
      console.error("Prospect save error:", err);
      res.status(500).json({ message: err.message || "Failed to save prospects" });
    }
  });

  app.get("/api/crm/prospects", requireAdminAuth, async (_req, res) => {
    try {
      const allProspects = await storage.getProspects();
      res.json(allProspects);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch prospects" });
    }
  });

  app.delete("/api/crm/prospects/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteProspect(String(req.params.id) as string);
      res.json({ message: "Prospect deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete prospect" });
    }
  });

  // --- Prospect Lists ---
  app.get("/api/crm/prospect-lists", requireAdminAuth, async (_req, res) => {
    try {
      const lists = await storage.getProspectLists();
      res.json(lists);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch lists" });
    }
  });

  app.post("/api/crm/prospect-lists", requireAdminAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "List name is required" });
      }
      const list = await storage.createProspectList(name.trim());
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create list" });
    }
  });

  app.patch("/api/crm/prospect-lists/:id", requireAdminAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "List name is required" });
      }
      await db.update(prospectLists).set({ name: name.trim() }).where(eq(prospectLists.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to rename list" });
    }
  });

  app.delete("/api/crm/prospect-lists/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteProspectList(String(req.params.id) as string);
      res.json({ message: "List deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete list" });
    }
  });

  app.get("/api/crm/prospect-lists/:listId/members", requireAdminAuth, async (req, res) => {
    try {
      const members = await storage.getProspectsByListId(req.params.listId as string);
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch list members" });
    }
  });

  app.post("/api/crm/prospect-lists/:listId/members", requireAdminAuth, async (req, res) => {
    try {
      const { prospectId } = req.body;
      if (!prospectId) return res.status(400).json({ message: "prospectId required" });
      await storage.addProspectToList(req.params.listId as string, prospectId as string);
      res.json({ message: "Added to list" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add to list" });
    }
  });

  app.delete("/api/crm/prospect-lists/:listId/members/:prospectId", requireAdminAuth, async (req, res) => {
    try {
      await storage.removeProspectFromList(req.params.listId as string, req.params.prospectId as string);
      res.json({ message: "Removed from list" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to remove from list" });
    }
  });

  // --- Tracking pixel endpoint (no auth required) ---
  app.get("/api/track/open/:sendId", async (req, res) => {
    const sendId = req.params.sendId as string;
    try {
      if (sendId.startsWith("de_")) {
        await storage.recordDirectEmailOpen(sendId);
      } else {
        await storage.recordEmailOpen(sendId);
      }
    } catch (err) {
      // silently fail - don't break the pixel
    }
    // Also check if this token belongs to a broker sequence event
    try {
      const { handleEmailOpen } = await import("./broker-sequence-service");
      await handleEmailOpen(sendId);
    } catch { /* non-fatal */ }

    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" });
    res.send(pixel);
  });

  // Link-click tracking — outgoing email links are rewritten to this redirect so
  // every send is tracked for clicks as well as opens. `:id` is a drip send id or
  // a "de_"-prefixed direct-email tracking id; `u` is the original destination.
  app.get("/api/track/click/:id", async (req, res) => {
    const id = String(req.params.id);
    const target = String(req.query.u || "");
    try {
      if (id.startsWith("de_")) {
        await storage.recordDirectEmailClick(id);
      } else {
        await storage.recordEmailClick(id);
      }
    } catch {
      // non-fatal — always still redirect the recipient
    }
    // Only follow http(s) targets — blocks javascript:/data: open-redirect abuse.
    if (/^https?:\/\//i.test(target)) {
      return res.redirect(302, target);
    }
    res.status(204).end();
  });

  // --- Drip Campaign routes ---
  app.get("/api/crm/campaigns", requireAdminAuth, async (_req, res) => {
    try {
      const campaigns = await storage.getDripCampaigns();
      res.json(campaigns);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/crm/campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      const campaign = await storage.getDripCampaign(String(req.params.id) as string);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const steps = await storage.getDripSteps(campaign.id);
      res.json({ ...campaign, steps });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  // Per-step + overview analytics for the Seamless-style builder.
  app.get("/api/crm/campaigns/:id/stats", requireAdminAuth, async (req, res) => {
    try {
      const campaignId = String(req.params.id);
      const [steps, enrollments, sends, replyAddrs] = await Promise.all([
        storage.getDripSteps(campaignId),
        storage.getDripEnrollments(campaignId),
        storage.getDripSendsByCampaign(campaignId),
        storage.getInboundReplyAddresses(),
      ]);

      const totalEnrollments = enrollments.length;
      const replySet = new Set(replyAddrs);
      const repliedCount = enrollments.filter(
        (e) => e.prospectEmail && replySet.has(e.prospectEmail.toLowerCase())
      ).length;

      // Per-step breakdown keyed by stepId.
      const perStep: Record<string, { sent: number; opened: number; clicked: number; bounced: number; tasks: number; notSent: number }> = {};
      for (const step of steps) {
        const rows = sends.filter((s) => s.stepId === step.id);
        const sent = rows.filter((s) => s.status === "sent").length;
        const opened = rows.filter((s) => s.status === "sent" && s.openedAt).length;
        const clicked = rows.filter((s) => s.status === "sent" && (s as any).clickedAt).length;
        const bounced = rows.filter((s) => s.status === "failed" || s.status === "bounced").length;
        const tasks = rows.filter((s) => s.status === "task").length;
        const handled = sent + bounced + tasks;
        perStep[step.id] = {
          sent,
          opened,
          clicked,
          bounced,
          tasks,
          notSent: Math.max(0, totalEnrollments - handled),
        };
      }

      const emailSends = sends.filter((s) => s.status === "sent" || s.status === "failed");
      const overview = {
        total: totalEnrollments,
        active: enrollments.filter((e) => e.status === "active").length,
        completed: enrollments.filter((e) => e.status === "completed").length,
        paused: enrollments.filter((e) => e.status === "paused").length,
        emails: sends.filter((s) => s.status === "sent").length,
        opens: sends.filter((s) => s.status === "sent" && s.openedAt).length,
        clicks: sends.filter((s) => s.status === "sent" && (s as any).clickedAt).length,
        replies: repliedCount,
        bounced: emailSends.filter((s) => s.status === "failed" || s.status === "bounced").length,
      };

      res.json({ overview, perStep });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch campaign stats" });
    }
  });

  app.post("/api/crm/campaigns", requireAdminAuth, async (req, res) => {
    try {
      const { name, description, isActive, steps } = req.body;
      if (!name) return res.status(400).json({ message: "Campaign name is required" });
      const campaign = await storage.createDripCampaign({ name, description, isActive: isActive ?? true });
      if (Array.isArray(steps)) {
        for (const step of steps) {
          await storage.createDripStep({
            campaignId: campaign.id,
            stepOrder: step.stepOrder,
            delayDays: step.delayDays,
            subject: step.subject,
            bodyHtml: step.bodyHtml,
          });
        }
      }
      const savedSteps = await storage.getDripSteps(campaign.id);
      res.status(201).json({ ...campaign, steps: savedSteps });
    } catch (err) {
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/crm/campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      const updated = await storage.updateDripCampaign(String(req.params.id) as string, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/crm/campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteDripCampaign(String(req.params.id) as string);
      res.json({ message: "Campaign deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Duplicate a campaign + all its steps (created paused so it never sends until activated).
  app.post("/api/crm/campaigns/:id/duplicate", requireAdminAuth, async (req, res) => {
    try {
      const src = await storage.getDripCampaign(String(req.params.id));
      if (!src) return res.status(404).json({ message: "Campaign not found" });
      const steps = await storage.getDripSteps(src.id);
      const copy = await storage.createDripCampaign({
        name: `Copy of ${src.name}`,
        description: src.description,
        isActive: false,
      });
      for (const s of steps) {
        await storage.createDripStep({
          campaignId: copy.id,
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          stepType: s.stepType,
          stepName: s.stepName,
          priority: s.priority,
          subject: s.subject,
          bodyHtml: s.bodyHtml,
        } as any);
      }
      const savedSteps = await storage.getDripSteps(copy.id);
      res.status(201).json({ ...copy, steps: savedSteps });
    } catch (err) {
      res.status(500).json({ message: "Failed to duplicate campaign" });
    }
  });

  // --- Campaign Steps ---
  app.post("/api/crm/campaigns/:id/steps", requireAdminAuth, async (req, res) => {
    try {
      const step = await storage.createDripStep({
        campaignId: String(req.params.id) as string,
        ...req.body,
      });
      res.status(201).json(step);
    } catch (err) {
      res.status(500).json({ message: "Failed to add step" });
    }
  });

  app.patch("/api/crm/steps/:id", requireAdminAuth, async (req, res) => {
    try {
      const updated = await storage.updateDripStep(String(req.params.id) as string, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  app.delete("/api/crm/steps/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteDripStep(String(req.params.id) as string);
      res.json({ message: "Step deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete step" });
    }
  });

  // --- Enrollments ---
  app.get("/api/crm/enrollments", requireAdminAuth, async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string | undefined;
      const enrollments = await storage.getDripEnrollments(campaignId);
      res.json(enrollments);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  // Projected send schedule for a campaign's enrollments — when each upcoming
  // step is "meant to go out" (step delay + the optimal email send window).
  // Powers the schedule display in the campaign builder's Contacts tab.
  app.get("/api/crm/campaigns/:id/schedule", requireAdminAuth, async (req, res) => {
    try {
      const campaignId = String(req.params.id);
      const [steps, enrollments] = await Promise.all([
        storage.getDripSteps(campaignId),       // ordered by stepOrder asc (matches the processor)
        storage.getDripEnrollments(campaignId),
      ]);

      const result = enrollments.map((e) => {
        const enrolledAt = new Date(e.enrolledAt);
        // Upcoming = steps the processor hasn't sent yet (index >= currentStep).
        const upcoming = steps.slice(e.currentStep).map((s, i) => ({
          stepOrder: s.stepOrder,
          stepNumber: e.currentStep + i + 1,
          name: s.subject || s.stepName || `Step ${s.stepOrder}`,
          stepType: s.stepType || "email",
          delayDays: s.delayDays,
          sendAt: (e.status === "active")
            ? projectStepSendTime(enrolledAt, s.delayDays)
            : null, // paused/completed enrollments aren't actively scheduled
        }));
        return {
          enrollmentId: e.id,
          prospectName: e.prospectName,
          prospectEmail: e.prospectEmail,
          status: e.status,
          currentStep: e.currentStep,
          totalSteps: steps.length,
          nextSendAt: e.status === "active" ? (upcoming[0]?.sendAt ?? null) : null,
          nextStepName: upcoming[0]?.name ?? null,
          nextStepType: upcoming[0]?.stepType ?? null,
          upcoming,
        };
      });

      res.json({ windowSummary: EMAIL_WINDOW_SUMMARY, enrollments: result });
    } catch (err) {
      console.error("GET /api/crm/campaigns/:id/schedule error:", err);
      res.status(500).json({ message: "Failed to compute campaign schedule" });
    }
  });

  // Live campaigns for a single CRM client: which drip campaigns this person is
  // enrolled in, their status, and per-step progress. Bridged by email since
  // crm_clients has no FK into the prospect/enrollment world.
  app.get("/api/crm/clients/:id/campaigns", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.json([]);

      const enrollments = await storage.getDripEnrollmentsByEmail(client.email);
      const result = await Promise.all(enrollments.map(async (e) => {
        const [campaign, steps] = await Promise.all([
          storage.getDripCampaign(e.campaignId),
          storage.getDripSteps(e.campaignId),
        ]);
        const totalSteps = steps.length;
        // currentStep is a 0-based index into the (stepOrder-sorted) steps: the
        // next touch to fire. Anything before it has been sent; a completed
        // enrollment (or one past the last step) has every step done.
        const isComplete = e.status === "completed" || e.currentStep >= totalSteps;
        const stepList = steps.map((s, idx) => ({
          stepOrder: s.stepOrder,
          stepName: s.stepName || s.subject || `Step ${idx + 1}`,
          stepType: s.stepType,
          delayDays: s.delayDays,
          state: isComplete || idx < e.currentStep ? "done" : idx === e.currentStep ? "current" : "upcoming",
        }));
        const currentStepObj = !isComplete && e.currentStep < totalSteps ? steps[e.currentStep] : null;
        return {
          enrollmentId: e.id,
          campaignId: e.campaignId,
          campaignName: campaign?.name || "Unknown campaign",
          campaignActive: campaign?.isActive ?? false,
          status: e.status,
          currentStep: e.currentStep,
          totalSteps,
          currentStepName: currentStepObj ? (currentStepObj.stepName || currentStepObj.subject) : null,
          currentStepType: currentStepObj ? currentStepObj.stepType : null,
          enrolledAt: e.enrolledAt,
          completedAt: e.completedAt,
          steps: stepList,
        };
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch client campaigns" });
    }
  });

  app.post("/api/crm/enrollments", requireAdminAuth, async (req, res) => {
    try {
      const { campaignId, prospectIds } = req.body;
      if (!campaignId || !Array.isArray(prospectIds)) {
        return res.status(400).json({ message: "campaignId and prospectIds are required" });
      }
      const results = [];
      for (const prospectId of prospectIds) {
        const prospects = await storage.getProspects();
        const prospect = prospects.find(p => p.id === prospectId);
        if (!prospect || !prospect.email) continue;
        const existingEnrollments = await storage.getDripEnrollments(campaignId);
        const alreadyEnrolled = existingEnrollments.some(e => e.prospectId === prospectId);
        if (alreadyEnrolled) continue;
        const enrollment = await storage.createDripEnrollment({
          campaignId,
          prospectId,
          prospectEmail: prospect.email,
          prospectName: prospect.name,
          currentStep: 0,
          status: "active",
        });
        results.push(enrollment);
      }
      res.status(201).json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to enroll prospects" });
    }
  });

  // Enroll straight from the CRM Contacts list. Each contact is transparently
  // mirrored to a prospect (find-or-create by email), then enrolled — so the
  // Contacts list and campaigns are unified without a separate prospect step.
  app.post("/api/crm/enrollments/from-contacts", requireAdminAuth, async (req, res) => {
    try {
      const { campaignId, contactIds } = req.body as { campaignId?: string; contactIds?: string[] };
      if (!campaignId || !Array.isArray(contactIds)) {
        return res.status(400).json({ message: "campaignId and contactIds are required" });
      }
      const existing = await storage.getDripEnrollments(campaignId);
      const enrolled = new Set(existing.map((e) => e.prospectId));
      const results = [];
      let skippedNoEmail = 0;
      for (const rawId of contactIds) {
        // IDs may be prefixed to indicate which CRM store they come from:
        //   "client:<id>"  → crm_clients (the main CRM tab)
        //   "contact:<id>" → contacts (attorney/lead contacts)
        // Bare ids default to a contact for backward compatibility.
        const id = String(rawId);
        const isClient = id.startsWith("client:");
        const bareId = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;

        let prospect;
        let email: string | null;
        if (isClient) {
          const client = await storage.getCrmClient(bareId);
          if (!client) continue;
          if (!client.email) { skippedNoEmail++; continue; }
          email = client.email;
          prospect = await storage.findOrCreateProspectForClient(client);
        } else {
          const contact = await storage.getContact(bareId);
          if (!contact) continue;
          if (!contact.email) { skippedNoEmail++; continue; }
          email = contact.email;
          prospect = await storage.findOrCreateProspectForContact(contact);
        }

        if (enrolled.has(prospect.id)) continue;
        const enrollment = await storage.createDripEnrollment({
          campaignId,
          prospectId: prospect.id,
          prospectEmail: prospect.email || email,
          prospectName: prospect.name,
          currentStep: 0,
          status: "active",
        });
        enrolled.add(prospect.id);
        results.push(enrollment);
      }
      res.status(201).json({ enrolled: results, count: results.length, skippedNoEmail });
    } catch (err) {
      res.status(500).json({ message: "Failed to enroll contacts" });
    }
  });

  // Unified list of people available to enroll in a campaign, merged from BOTH
  // CRM stores — crm_clients (the main CRM tab) and contacts (lead/attorney
  // contacts) — de-duplicated by email. IDs are prefixed with their source
  // ("client:" / "contact:") so enrollment resolves them against the right table.
  app.get("/api/crm/enroll-candidates", requireAdminAuth, async (_req, res) => {
    try {
      const [clients, contactsResult] = await Promise.all([
        storage.getCrmClients(),
        storage.getContacts({ limit: 5000, offset: 0 }),
      ]);

      const seenEmails = new Set<string>();
      const candidates: Array<{
        id: string; firstName: string; lastName: string;
        email: string | null; firmName: string | null; jobTitle: string | null; source: string;
      }> = [];

      // Clients first (this is what the main CRM tab writes to).
      for (const c of clients) {
        const key = (c.email || "").toLowerCase();
        if (key) seenEmails.add(key);
        const parts = (c.fullName || "").trim().split(/\s+/);
        candidates.push({
          id: `client:${c.id}`,
          firstName: parts[0] || c.fullName || "",
          lastName: parts.slice(1).join(" "),
          email: c.email || null,
          firmName: c.companyName || null,
          jobTitle: c.profession || null,
          source: "CRM",
        });
      }

      // Then attorney/lead contacts, skipping any already covered by email.
      const contactList = (contactsResult as { contacts?: any[] }).contacts || [];
      for (const c of contactList) {
        const key = (c.email || "").toLowerCase();
        if (key && seenEmails.has(key)) continue;
        if (key) seenEmails.add(key);
        candidates.push({
          id: `contact:${c.id}`,
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email: c.email || null,
          firmName: c.firmName || null,
          jobTitle: c.jobTitle || null,
          source: "Contacts",
        });
      }

      res.json({ contacts: candidates, total: candidates.length });
    } catch (err) {
      console.error("GET /api/crm/enroll-candidates error:", err);
      res.status(500).json({ message: "Failed to load enrollment candidates" });
    }
  });

  app.patch("/api/crm/enrollments/:id", requireAdminAuth, async (req, res) => {
    try {
      const updated = await storage.updateDripEnrollment(String(req.params.id) as string, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update enrollment" });
    }
  });

  // --- Email Sends ---
  app.get("/api/crm/sends", requireAdminAuth, async (_req, res) => {
    try {
      const sends = await storage.getAllDripSends();
      res.json(sends);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sends" });
    }
  });

  // --- Unified Activity feed (all channels: email / text / LinkedIn / call / note …) ---
  // Merges three sources into one time-ordered timeline:
  //   • drip_sends            → every campaign touch (channel stamped per step)
  //   • contact_activities    → manual & inbound touches against attorney contacts
  //   • crm_client_activities → touches against investor-CRM clients
  app.get("/api/crm/activity", requireAdminAuth, async (_req, res) => {
    try {
      // activity_type → channel/direction. Anything unmapped falls back to "other".
      const ACT_MAP: Record<string, { channel: string; direction: "outbound" | "inbound" }> = {
        email_sent: { channel: "email", direction: "outbound" },
        email_opened: { channel: "email", direction: "outbound" },
        email_received: { channel: "email", direction: "inbound" },
        email_reply: { channel: "email", direction: "inbound" },
        sms_sent: { channel: "sms", direction: "outbound" },
        sms_failed: { channel: "sms", direction: "outbound" },
        sms_received: { channel: "sms", direction: "inbound" },
        whatsapp_sent: { channel: "whatsapp", direction: "outbound" },
        whatsapp_failed: { channel: "whatsapp", direction: "outbound" },
        whatsapp_received: { channel: "whatsapp", direction: "inbound" },
        phone_call: { channel: "call", direction: "outbound" },
        call_logged: { channel: "call", direction: "outbound" },
        voicemail_dropped: { channel: "call", direction: "outbound" },
        voicemail_failed: { channel: "call", direction: "outbound" },
        linkedin: { channel: "linkedin", direction: "outbound" },
        linkedin_sent: { channel: "linkedin", direction: "outbound" },
        linkedin_connect: { channel: "linkedin", direction: "outbound" },
        linkedin_message: { channel: "linkedin", direction: "outbound" },
        note: { channel: "note", direction: "outbound" },
        note_added: { channel: "note", direction: "outbound" },
        status_changed: { channel: "status", direction: "outbound" },
        signature_sent: { channel: "document", direction: "outbound" },
        document_signed: { channel: "document", direction: "inbound" },
        document_uploaded: { channel: "document", direction: "outbound" },
      };

      const pick = (m: any, ...keys: string[]): string => {
        if (!m || typeof m !== "object") return "";
        for (const k of keys) if (m[k]) return String(m[k]);
        return "";
      };
      const humanize = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // Hide already-logged newsletter / service / notification mail (e.g.
      // "Re: Welcome to PR Newswire!") from the inbound activity feed. The inbox
      // sync filters these going forward; this also suppresses old rows.
      const looksAutomatedSubject = (s: string): boolean =>
        isAutomatedOrBulkEmail("", s || "");

      const [sends, contactActs, clientActs, allEnrollments, allCampaigns] = await Promise.all([
        storage.getAllDripSends(),
        storage.getRecentContactActivities(400),
        storage.getRecentCrmClientActivities(400),
        storage.getDripEnrollments(),
        storage.getDripCampaigns(),
      ]);

      // Map each send → its campaign name so the feed shows which campaign a
      // touch belongs to (send → enrollment → campaign).
      const campaignNameById = new Map(allCampaigns.map((c) => [c.id, c.name]));
      const campaignByEnrollment = new Map(allEnrollments.map((e) => [e.id, campaignNameById.get(e.campaignId) || ""]));

      const items: Array<{
        id: string; source: string; channel: string; direction: string;
        name: string; target: string; detail: string; status: string;
        timestamp: string | null; campaignName?: string;
        opened?: boolean; openedAt?: string | null; openCount?: number;
        clicked?: boolean; clickedAt?: string | null; clickCount?: number;
      }> = [];

      // 1) Campaign touches
      for (const s of sends as any[]) {
        const channel = s.channel || (s.status === "task" ? "task" : "email");
        const opened = !!s.openedAt;
        const clicked = !!s.clickedAt;
        // Status reflects the furthest engagement: clicked > opened > raw status.
        const status = clicked ? "clicked" : opened ? "opened" : s.status;
        items.push({
          id: `send-${s.id}`,
          source: "campaign",
          channel,
          direction: "outbound",
          name: s.recipientName || "",
          target: s.recipientEmail || "",
          detail: s.subject || s.errorMessage || "",
          status,
          timestamp: (s.sentAt || s.createdAt) ? new Date(s.sentAt || s.createdAt).toISOString() : null,
          campaignName: campaignByEnrollment.get(s.enrollmentId) || "",
          opened,
          openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : null,
          openCount: s.openCount ?? 0,
          clicked,
          clickedAt: s.clickedAt ? new Date(s.clickedAt).toISOString() : null,
          clickCount: s.clickCount ?? 0,
        });
      }

      // 2) Contact-level touches
      for (const a of contactActs) {
        const map = ACT_MAP[a.activityType] || { channel: "other", direction: "outbound" as const };
        const detail = pick(a.metadata, "subject", "message", "note", "text", "summary", "body", "title")
          || humanize(a.activityType);
        if (a.activityType === "email_received" && looksAutomatedSubject(detail)) continue;
        items.push({
          id: `contact-${a.id}`,
          source: "contact",
          channel: map.channel,
          direction: map.direction,
          name: a.name || "",
          target: a.email || "",
          detail,
          status: a.activityType.endsWith("_failed") ? "failed" : (map.direction === "inbound" ? "received" : "sent"),
          timestamp: a.createdAt ? new Date(a.createdAt).toISOString() : null,
        });
      }

      // 3) Investor-CRM client touches
      for (const a of clientActs) {
        const map = ACT_MAP[a.activityType] || { channel: "other", direction: "outbound" as const };
        const detail = pick(a.metadata, "subject", "message", "note", "text", "summary", "body", "title")
          || humanize(a.activityType);
        if (a.activityType === "email_received" && looksAutomatedSubject(detail)) continue;
        items.push({
          id: `client-${a.id}`,
          source: "client",
          channel: map.channel,
          direction: map.direction,
          name: a.name || "",
          target: a.email || "",
          detail,
          status: a.activityType.endsWith("_failed") ? "failed" : (map.direction === "inbound" ? "received" : "sent"),
          timestamp: a.createdAt ? new Date(a.createdAt).toISOString() : null,
        });
      }

      items.sort((x, y) => {
        const tx = x.timestamp ? Date.parse(x.timestamp) : 0;
        const ty = y.timestamp ? Date.parse(y.timestamp) : 0;
        return ty - tx;
      });

      res.json(items.slice(0, 500));
    } catch (err) {
      console.error("[Activity] Failed to build feed:", err);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // Reconstruct the exact email content sent for a campaign send. The body
  // isn't stored per-send (only the subject is), so we re-render the step's
  // bodyHtml with the same personalization the drip processor used at send time.
  app.get("/api/crm/sends/:id/content", requireAdminAuth, async (req, res) => {
    try {
      const send = await storage.getDripSend(String(req.params.id));
      if (!send) return res.status(404).json({ message: "Send not found" });

      const firstName = (send.recipientName || "").trim().split(/\s+/)[0] || send.recipientName || "there";
      const personalize = (s: string | null | undefined): string =>
        (s || "")
          .replace(/\[Contact First Name\]/gi, firstName)
          .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
          .replace(/\{\{\s*name\s*\}\}/gi, send.recipientName || "")
          .replace(/\{\{\s*email\s*\}\}/gi, send.recipientEmail || "");

      let bodyHtml = "";
      const steps = await storage.getDripSteps((await storage.getDripEnrollment(send.enrollmentId))?.campaignId || "");
      const step = steps.find((s) => s.id === send.stepId);
      if (step) bodyHtml = personalize(step.bodyHtml);

      res.json({
        recipientName: send.recipientName,
        recipientEmail: send.recipientEmail,
        subject: personalize(send.subject),
        bodyHtml,
        channel: send.channel,
        status: send.status,
        sentAt: send.sentAt,
        errorMessage: send.errorMessage || null,
        available: !!step,
      });
    } catch (err: any) {
      console.error("[SendContent] failed:", err?.message || err);
      res.status(500).json({ message: err?.message || "Failed to load email content" });
    }
  });

  // Find a better email for a bounced/failed send via Hunter.io (email finder,
  // then domain-pattern fallback). Returns a candidate for the user to confirm —
  // it never changes anything on its own.
  app.post("/api/crm/sends/:id/find-email", requireAdminAuth, async (req, res) => {
    try {
      const send = await storage.getDripSend(String(req.params.id));
      if (!send) return res.status(404).json({ message: "Send not found" });

      const name = (send.recipientName || "").trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ");
      const domain = String(req.body?.domain || (send.recipientEmail || "").split("@")[1] || "")
        .trim().toLowerCase();

      if (!domain) return res.status(400).json({ message: "No company domain to search" });
      if (!firstName || !lastName) return res.status(400).json({ message: "Need the contact's full name to find an email" });

      let candidate: { email: string; confidence: number; source: string } | null = null;
      const hit = await hunterFindEmail(firstName, lastName, domain);
      if (hit) {
        candidate = { email: hit.email, confidence: hit.confidence, source: "Hunter.io" };
      } else {
        const pattern = await hunterDomainPattern(domain);
        if (pattern) {
          candidate = {
            email: buildEmailFromPattern(firstName, lastName, domain, pattern),
            confidence: 50,
            source: `Domain pattern (${pattern})`,
          };
        }
      }

      // Don't suggest the exact address that just bounced.
      if (candidate && candidate.email.toLowerCase() === (send.recipientEmail || "").toLowerCase()) {
        candidate = null;
      }
      if (!candidate) return res.json({ found: false, domain });
      res.json({ found: true, candidate, domain });
    } catch (err: any) {
      console.error("[FindEmail] lookup failed:", err?.message || err);
      res.status(500).json({ message: err?.message || "Email lookup failed" });
    }
  });

  // Apply a corrected email to a bounced send's enrollment: update the address,
  // clear the dead send so the step re-sends, and resume the enrollment.
  app.post("/api/crm/sends/:id/apply-email", requireAdminAuth, async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ message: "A valid email address is required" });
      }
      const send = await storage.getDripSend(String(req.params.id));
      if (!send) return res.status(404).json({ message: "Send not found" });
      const enrollment = await storage.getDripEnrollment(send.enrollmentId);
      if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

      // The address we're replacing — used to find the canonical records.
      const oldEmail = (enrollment.prospectEmail || send.recipientEmail || "").trim().toLowerCase();

      // Propagate the corrected address everywhere this person lives so the
      // change sticks system-wide, not just on the campaign mirror:
      //   1) the prospect record the enrollment points at
      //   2) the originating CRM contact (matched by the old email)
      //   3) the originating investor-CRM client (matched by the old email)
      const updated: string[] = [];
      await storage.updateProspect(enrollment.prospectId, { email })
        .then(() => updated.push("prospect")).catch(() => {});
      if (oldEmail && oldEmail !== email) {
        try {
          const contact = await storage.getContactByEmail(oldEmail);
          if (contact) { await storage.updateContact(contact.id, { email }); updated.push("contact"); }
        } catch {}
        try {
          const client = await storage.getCrmClientByEmail(oldEmail);
          if (client) { await storage.updateCrmClient(client.id, { email }); updated.push("client"); }
        } catch {}
      }

      // Re-send the step that bounced: drop the dead send and rewind currentStep
      // to it so the processor re-attempts it to the new address next run.
      const steps = await storage.getDripSteps(enrollment.campaignId);
      const stepIndex = steps.findIndex((s) => s.id === send.stepId);
      await storage.deleteDripSend(send.id).catch(() => {});
      await storage.updateDripEnrollment(enrollment.id, {
        prospectEmail: email,
        status: "active",
        ...(stepIndex >= 0 ? { currentStep: stepIndex } : {}),
      } as any);

      console.log(`[ApplyEmail] ${oldEmail} → ${email} (updated: ${updated.join(", ") || "enrollment only"})`);
      res.json({ success: true, email, updated });
    } catch (err: any) {
      console.error("[ApplyEmail] failed:", err?.message || err);
      res.status(500).json({ message: err?.message || "Failed to update email" });
    }
  });

  // --- Manual send / process trigger ---
  app.post("/api/crm/drip/process", requireAdminAuth, async (req, res) => {
    // Manual "Send Due Now". REQUIRES a campaignId so it only ever sends to the
    // enrollments of the campaign the user is looking at — never a global blast
    // across every campaign. Overrides the optimal-window + hourly-cap gating so
    // due emails go out immediately, runs in the BACKGROUND, and responds right
    // away so the UI never hangs. The daily cap + in-progress guard remain.
    const campaignId = (req.body?.campaignId as string | undefined)?.trim();
    if (!campaignId) {
      return res.status(400).json({ message: "campaignId is required for manual send." });
    }
    processDripEmails({ force: true, campaignId }).catch((err) =>
      console.error("[Drip] Manual process error:", err),
    );
    res.status(202).json({ message: "Processing started", started: true, campaignId });
  });

  // Reprocess a single step: force-resend it to every enrolled contact in the
  // campaign now (ignores delay timing + the already-sent guard). Runs in the
  // background and responds immediately with the contact count.
  app.post("/api/crm/campaigns/:campaignId/steps/:stepId/reprocess", requireAdminAuth, async (req, res) => {
    try {
      const campaignId = String(req.params.campaignId);
      const stepId = String(req.params.stepId);
      const steps = await storage.getDripSteps(campaignId);
      const step = steps.find((s) => s.id === stepId);
      if (!step) return res.status(404).json({ message: "Step not found" });
      const stepType = (step.stepType || "email").toLowerCase();
      if (!["email", "manual_email", "sms"].includes(stepType)) {
        return res.status(400).json({ message: "Only email and text steps can be reprocessed." });
      }
      const enrollments = await storage.getDripEnrollments(campaignId);
      reprocessStep(campaignId, stepId).catch((err) => console.error("[Reprocess] error:", err));
      res.status(202).json({ message: "Reprocessing started", started: true, count: enrollments.length });
    } catch (err: any) {
      console.error("[Reprocess] route failed:", err?.message || err);
      res.status(500).json({ message: err?.message || "Failed to reprocess step" });
    }
  });

  // --- Test email ---
  app.post("/api/crm/drip/test-email", requireAdminAuth, async (req, res) => {
    try {
      const { to, subject, bodyHtml } = req.body;
      if (!to || !subject || !bodyHtml) {
        return res.status(400).json({ message: "to, subject, and bodyHtml are required" });
      }
      const result = await sendEmail(to, subject, bodyHtml);
      if (result.success) {
        res.json({ message: "Test email sent successfully" });
      } else {
        res.status(500).json({ message: result.error || "Failed to send test email" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send test email" });
    }
  });

  // --- Facebook Posts ---
  app.get("/api/facebook/posts", requireAdminAuth, async (_req, res) => {
    try {
      const posts = await storage.getFacebookPosts();
      res.json(posts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch Facebook posts" });
    }
  });

  app.post("/api/facebook/generate", requireAdminAuth, async (_req, res) => {
    try {
      const { content, imagePrompt } = await generateFacebookPost();
      const post = await storage.createFacebookPost({ content, imagePrompt, status: "draft" });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate Facebook post" });
    }
  });

  app.post("/api/facebook/posts", requireAdminAuth, async (req, res) => {
    try {
      const { content, status } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      const validStatuses = ["draft", "scheduled"];
      const postStatus = validStatuses.includes(status) ? status : "draft";
      const post = await storage.createFacebookPost({ content: content.trim(), status: postStatus });
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create Facebook post" });
    }
  });

  app.patch("/api/facebook/posts/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      const existing = await storage.getFacebookPost(id);
      if (!existing) return res.status(404).json({ message: "Post not found" });
      const allowed: Record<string, boolean> = { content: true, status: true, imagePrompt: true, scheduledFor: true };
      const updates: Record<string, any> = {};
      for (const key of Object.keys(req.body)) {
        if (allowed[key]) updates[key] = req.body[key];
      }
      if (updates.status) {
        const validStatuses = ["draft", "scheduled"];
        if (!validStatuses.includes(updates.status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
      }
      const post = await storage.updateFacebookPost(id, updates);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update Facebook post" });
    }
  });

  app.delete("/api/facebook/posts/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      const existing = await storage.getFacebookPost(id);
      if (!existing) return res.status(404).json({ message: "Post not found" });
      await storage.deleteFacebookPost(id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete Facebook post" });
    }
  });

  app.post("/api/facebook/posts/:id/publish", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id) as string;
      const existing = await storage.getFacebookPost(id);
      if (!existing) return res.status(404).json({ message: "Post not found" });
      await postToFacebook(id);
      const post = await storage.getFacebookPost(id);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to publish to Facebook" });
    }
  });

  app.get("/api/facebook/auto-post", requireAdminAuth, async (_req, res) => {
    res.json({ enabled: getAutoPostStatus() });
  });

  app.post("/api/facebook/auto-post", requireAdminAuth, async (req, res) => {
    const { enabled } = req.body;
    setAutoPostEnabled(!!enabled);
    res.json({ enabled: getAutoPostStatus() });
  });

  // ─── CRM Client Activities ────────────────────────────────────────────────

  app.get("/api/crm/clients/:id/activities", requireAdminAuth, async (req, res) => {
    try {
      const acts = await storage.getCrmClientActivities(String(req.params.id));
      res.json(acts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/crm/clients/:id/activities", requireAdminAuth, async (req, res) => {
    try {
      const act = await storage.createCrmClientActivity({
        clientId: String(req.params.id),
        activityType: req.body.activityType || "note_added",
        metadata: req.body.metadata || {},
      });
      res.status(201).json(act);
    } catch (err) {
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  // ─── CRM Client Documents ─────────────────────────────────────────────────

  app.get("/api/crm/clients/:id/documents", requireAdminAuth, async (req, res) => {
    try {
      const docs = await storage.getCrmClientDocuments(String(req.params.id));
      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/crm/clients/:id/documents", requireAdminAuth, async (req, res) => {
    try {
      const { fileName, fileType, fileSize, fileData } = req.body as {
        fileName: string; fileType: string; fileSize: number; fileData: string;
      };
      if (!fileName || !fileData) {
        return res.status(400).json({ message: "fileName and fileData are required" });
      }
      const MAX_SIZE = 8 * 1024 * 1024; // 8MB base64
      if (fileData.length > MAX_SIZE) {
        return res.status(413).json({ message: "File too large (max 6MB)" });
      }
      const doc = await storage.createCrmClientDocument({
        clientId: String(req.params.id),
        fileName,
        fileType: fileType || "application/octet-stream",
        fileSize: fileSize || fileData.length,
        fileData,
      });
      await storage.createCrmClientActivity({
        clientId: String(req.params.id),
        activityType: "document_uploaded",
        metadata: { fileName, fileType },
      });
      res.status(201).json(doc);
    } catch (err) {
      console.error("Document upload error:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/crm/documents/:id/download", requireAdminAuth, async (req, res) => {
    try {
      const doc = await storage.getCrmClientDocument(String(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      const buffer = Buffer.from(doc.fileData, "base64");
      res.setHeader("Content-Type", doc.fileType);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/crm/documents/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteCrmClientDocument(String(req.params.id));
      res.json({ message: "Document deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ─── SMS / WhatsApp (Quo + Meta) ──────────────────────────────────────────

  // ─── Messaging status (Quo for SMS, Meta for WhatsApp) ─────────────────────

  app.get("/api/crm/twilio-status", requireAdminAuth, (_req, res) => {
    // SMS via Quo, WhatsApp via Meta Cloud API
    const quo = getQuoStatus();
    const metaToken = process.env.META_WHATSAPP_ACCESS_TOKEN || "";
    const metaPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
    const whatsappReady = !!(metaToken && metaPhoneId);
    res.json({
      configured: quo.configured || whatsappReady,
      smsReady: quo.smsReady,
      whatsappReady,
      smsNumber: quo.phoneNumberId,
      whatsappNumber: "19158995538",
      provider: { sms: "quo", whatsapp: "meta" },
    });
  });

  app.get("/api/crm/quo-phone-numbers", requireAdminAuth, async (_req, res) => {
    try {
      const numbers = await listQuoPhoneNumbers();
      res.json(numbers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Gmail inbox sync (franchising@) ────────────────────────────────────────
  app.get("/api/crm/gmail-sync/status", requireAdminAuth, (_req, res) => {
    res.json({ ...getGmailSyncStatus(), last: getGmailSyncLastResult() });
  });

  app.post("/api/crm/gmail-sync/run", requireAdminAuth, async (_req, res) => {
    try {
      const result = await syncFranchisingInbox();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Gmail sync failed" });
    }
  });

  // ── Phone Calls (OpenPhone) ────────────────────────────────────────────────
  app.get("/api/crm/phone-calls", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const calls = await storage.getPhoneCalls({ limit });
      res.json(calls);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/crm/phone-calls/sync", requireAdminAuth, async (req, res) => {
    try {
      const { createdAfter } = req.body as { createdAfter?: string };
      const { data: apiCalls } = await fetchOpenPhoneCalls({
        maxResults: 100,
        createdAfter,
      });

      if (apiCalls.length === 0) {
        return res.json({ synced: 0, message: "No new calls found" });
      }

      // Fetch all CRM clients once for phone number matching
      const allClients = await storage.getCrmClients();

      const results = [];
      for (const call of apiCalls) {
        const callerNumber = getCallerNumber(call);
        const callerName = getCallerName(call);

        // Match to CRM client by phone number
        const normalise = (n: string) => n.replace(/\D/g, "").slice(-10);
        const matched = allClients.find(
          (c) => c.phone && normalise(c.phone) === normalise(callerNumber)
        );

        // Fetch transcript for completed calls
        let transcriptText: string | null = null;
        let aiSummary: string | null = null;
        if (call.status === "completed") {
          const transcript = await fetchCallTranscript(call.id);
          if (transcript) {
            transcriptText = transcript.summary || formatTranscript(transcript) || null;
            if (transcriptText && !transcript.summary) {
              // Generate AI summary from transcript text
              try {
                const { default: OpenAI } = await import("openai");
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const completion = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are a helpful assistant summarising a sales call transcript for a franchise business. Produce a concise 2–4 sentence summary covering: the caller's intent, key topics discussed, any next steps mentioned. Be professional and factual.",
                    },
                    { role: "user", content: transcriptText.slice(0, 4000) },
                  ],
                  max_tokens: 200,
                });
                aiSummary = completion.choices[0]?.message?.content || null;
              } catch {
                aiSummary = null;
              }
            } else if (transcript.summary) {
              aiSummary = transcript.summary;
            }
          }
        }

        const saved = await storage.upsertPhoneCall({
          id: call.id,
          direction: call.direction,
          fromNumber: call.from,
          toNumber: call.to,
          status: call.status,
          durationSeconds: call.duration || null,
          callerName: callerName || (matched ? matched.fullName : null),
          recordingUrl: call.recording?.url || null,
          recordingId: call.recording?.id || null,
          transcriptText,
          aiSummary,
          voicemailUrl: call.voicemail?.url || null,
          voicemailTranscript: call.voicemail?.transcription || null,
          crmClientId: matched?.id || null,
          openphoneCreatedAt: call.createdAt ? new Date(call.createdAt) : null,
        });

        // Log to CRM activity if matched and inbound
        if (matched && call.direction === "inbound") {
          try {
            const existing = await storage.getPhoneCallByExternalId(call.id);
            // Only log once (if this is a new sync, not already logged)
            if (!existing?.crmClientId) {
              await storage.createCrmClientActivity({
                clientId: matched.id,
                activityType: "phone_call",
                metadata: {
                  callId: call.id,
                  direction: call.direction,
                  status: call.status,
                  duration: call.duration,
                  fromNumber: call.from,
                  aiSummary,
                },
              });
            }
          } catch { /* non-fatal */ }
        }

        results.push(saved);
      }

      res.json({ synced: results.length, calls: results });
    } catch (err: any) {
      console.error("[PhoneCalls] sync error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/crm/phone-calls/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const data = req.body as { crmClientId?: string; callerName?: string; aiSummary?: string };
      const updated = await storage.updatePhoneCall(id, data);
      if (!updated) return res.status(404).json({ message: "Call not found" });

      // If linking to CRM client, log activity
      if (data.crmClientId) {
        const call = await storage.getPhoneCallByExternalId(id);
        if (call) {
          await storage.createCrmClientActivity({
            clientId: data.crmClientId,
            activityType: "phone_call",
            metadata: {
              callId: id,
              direction: call.direction,
              status: call.status,
              duration: call.durationSeconds,
              fromNumber: call.fromNumber,
              aiSummary: call.aiSummary,
              manuallyLinked: true,
            },
          });
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Webhook for real-time OpenPhone call + SMS events
  app.post("/api/webhooks/openphone", async (req, res) => {
    try {
      const event = req.body as {
        type?: string;
        data?: { object?: any };
      };
      res.json({ received: true }); // Acknowledge immediately

      // Inbound SMS from CRM prospects
      if (event.type === "message.received") {
        const msgData = event?.data?.object;
        if (!msgData?.id) return;

        const fromNumber = msgData.from || "";
        const body = msgData.text || msgData.body || "";
        if (!fromNumber || !body) return;

        const allClients = await storage.getCrmClients();
        const matched = allClients.find(
          (c) => c.phone && phoneLast10(c.phone) === phoneLast10(fromNumber),
        );
        if (!matched) return;

        const acts = await storage.getCrmClientActivities(matched.id);
        const already = acts.some((a) => {
          const m = (a.metadata || {}) as Record<string, string>;
          return m.messageId === msgData.id || m.id === msgData.id;
        });
        if (already) return;

        await storage.createCrmClientActivity({
          clientId: matched.id,
          activityType: "sms_received",
          metadata: {
            message: body,
            messageId: msgData.id,
            from: fromNumber,
            direction: "incoming",
          },
        });
        return;
      }

      const callData = event?.data?.object;
      if (!callData?.id) return;

      if (
        event.type === "call.completed" ||
        event.type === "call.ringing" ||
        event.type === "call.missed"
      ) {
        const allClients = await storage.getCrmClients();
        const callerNumber = callData.direction === "inbound" ? callData.from : callData.to;
        const normalise = (n: string) => n.replace(/\D/g, "").slice(-10);
        const matched = allClients.find(
          (c) => c.phone && normalise(c.phone) === normalise(callerNumber)
        );

        await storage.upsertPhoneCall({
          id: callData.id,
          direction: callData.direction || "inbound",
          fromNumber: callData.from || "",
          toNumber: callData.to || "",
          status: callData.status || "completed",
          durationSeconds: callData.duration || null,
          callerName: matched ? matched.fullName : null,
          recordingUrl: callData.recording?.url || null,
          recordingId: callData.recording?.id || null,
          voicemailUrl: callData.voicemail?.url || null,
          voicemailTranscript: callData.voicemail?.transcription || null,
          crmClientId: matched?.id || null,
          openphoneCreatedAt: callData.createdAt ? new Date(callData.createdAt) : new Date(),
        });

        if (matched && callData.direction === "inbound") {
          await storage.createCrmClientActivity({
            clientId: matched.id,
            activityType: "phone_call",
            metadata: {
              callId: callData.id,
              direction: callData.direction,
              status: callData.status,
              duration: callData.duration,
              fromNumber: callData.from,
              realtime: true,
            },
          });
        }
      }
    } catch (err) {
      console.error("[OpenPhone webhook]", err);
    }
  });

  app.get("/api/crm/sms-templates", requireAdminAuth, (_req, res) => {
    res.json(SMS_TEMPLATES);
  });

  app.get("/api/crm/whatsapp-templates", requireAdminAuth, (_req, res) => {
    res.json(WHATSAPP_TEMPLATES);
  });

  // Check if a phone number is registered on WhatsApp
  app.post("/api/crm/whatsapp-check-number", requireAdminAuth, async (req, res) => {
    try {
      const { phone } = req.body as { phone: string };
      if (!phone) return res.status(400).json({ error: "phone required" });
      const { checkWhatsAppNumber } = await import("./meta-whatsapp-service");
      const result = await checkWhatsAppNumber(phone);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send WhatsApp free-form text to any phone number (prospect finder)
  app.post("/api/prospects/whatsapp/send", requireAdminAuth, async (req, res) => {
    try {
      const { to, message } = req.body as { to: string; message: string };
      if (!to) return res.status(400).json({ error: "to (phone number) is required" });
      if (!message?.trim()) return res.status(400).json({ error: "message is required" });
      const result = await sendWhatsApp(to, message.trim());
      if (!result.success) return res.status(502).json({ error: result.error });
      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send WhatsApp template to any phone number (prospect finder — cold outreach)
  app.post("/api/prospects/whatsapp/send-template", requireAdminAuth, async (req, res) => {
    try {
      const { to, templateName, languageCode = "en_US", firstName } = req.body as {
        to: string; templateName: string; languageCode?: string; firstName?: string;
      };
      if (!to) return res.status(400).json({ error: "to (phone number) is required" });
      if (!templateName) return res.status(400).json({ error: "templateName is required" });
      const variables = firstName ? [firstName] : [];
      const result = await sendWhatsAppTemplate(to, templateName, languageCode, variables);
      if (!result.success) return res.status(502).json({ error: result.error });
      res.json({ success: true, id: result.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/crm/clients/:id/sms", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });

      const fromQuo = client.phone ? await fetchSmsConversation(client.phone) : [];
      const acts = await storage.getCrmClientActivities(client.id);
      const fromActs: SmsConversationMessage[] = acts
        .filter((a) => ["sms_sent", "sms_failed", "sms_received"].includes(a.activityType))
        .map((a) => {
          const m = (a.metadata || {}) as Record<string, string>;
          return {
            id: m.id || m.messageId || a.id,
            direction: a.activityType === "sms_received" ? "inbound" as const : "outbound" as const,
            body: m.message || "",
            status: a.activityType === "sms_failed" ? "failed" : a.activityType === "sms_received" ? "received" : "sent",
            sentAt: new Date(a.createdAt).toISOString(),
          };
        })
        .filter((m) => m.body.trim().length > 0);

      const byId = new Map<string, SmsConversationMessage>();
      for (const msg of [...fromActs, ...fromQuo]) {
        byId.set(msg.id, msg);
      }
      const messages = [...byId.values()].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));

      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch SMS history" });
    }
  });

  app.post("/api/crm/clients/:id/sms", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.phone) return res.status(400).json({ message: "Client has no phone number" });

      const body = (req.body.message as string || "")
        .replace(/\{\{name\}\}/g, client.fullName.split(" ")[0]);

      const result = await sendSmsViaQuo(client.phone, body);

      await storage.createCrmClientActivity({
        clientId: client.id,
        activityType: result.success ? "sms_sent" : "sms_failed",
        metadata: { message: body, id: result.id, error: result.error },
      });

      if (!result.success) return res.status(502).json({ message: result.error });
      res.json({ success: true, id: result.id });
    } catch (err) {
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  app.post("/api/crm/clients/:id/whatsapp", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.phone) return res.status(400).json({ message: "Client has no phone number" });

      const body = (req.body.message as string || "")
        .replace(/\{\{name\}\}/g, client.fullName.split(" ")[0]);

      const result = await sendWhatsApp(client.phone, body);

      await storage.createCrmClientActivity({
        clientId: client.id,
        activityType: result.success ? "whatsapp_sent" : "whatsapp_failed",
        metadata: { message: body, sid: result.id, error: result.error },
      });

      if (!result.success) return res.status(502).json({ message: result.error });
      res.json({ success: true, sid: result.id });
    } catch (err) {
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });

  // ─── SMS Campaigns (blast) ────────────────────────────────────────────────

  app.get("/api/crm/sms-campaigns", requireAdminAuth, async (_req, res) => {
    try {
      res.json(await storage.getSmsCampaigns());
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch SMS campaigns" });
    }
  });

  app.post("/api/crm/sms-campaigns", requireAdminAuth, async (req, res) => {
    try {
      const campaign = await storage.createSmsCampaign(req.body);
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create SMS campaign" });
    }
  });

  app.delete("/api/crm/sms-campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteSmsCampaign(String(req.params.id) as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete SMS campaign" });
    }
  });

  app.get("/api/crm/sms-campaigns/:id/estimate", requireAdminAuth, async (req, res) => {
    try {
      const campaigns = await storage.getSmsCampaigns();
      const campaign = campaigns.find(c => c.id === String(req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const members = campaign.listId ? await storage.getProspectsByListId(campaign.listId) : [];
      if (members.length === 0) {
        return res.json({
          windowStatus: "closed",
          windowDescription: nextWindowDescription("sms"),
          estimatedMinutes: 0,
          recommendation: "No prospects in this list yet. Add contacts to the list before sending.",
        });
      }
      res.json(estimateSend("sms", members.length));
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to estimate" });
    }
  });

  app.post("/api/crm/sms-campaigns/:id/send", requireAdminAuth, async (req, res) => {
    try {
      const campaigns = await storage.getSmsCampaigns();
      const campaign = campaigns.find(c => c.id === String(req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Campaign already sending" });
      if (!campaign.listId) return res.status(400).json({ message: "No prospect list attached to this campaign" });

      const mode: SendMode = req.body?.mode === "now" ? "now" : "smart";

      // Smart send: if outside optimal window, delay start until window opens
      // "now" mode skips the window check
      if (mode === "smart" && !isOptimalSmsWindow()) {
        const windowDesc = nextWindowDescription("sms");
        return res.json({
          queued: true,
          message: `Smart Send queued — ${windowDesc} (El Paso time). Use mode "now" to send immediately.`,
        });
      }

      await storage.updateSmsCampaign(campaign.id, { status: "sending" });
      res.json({ message: "Campaign sending started", mode });

      // Run in background
      (async () => {
        const members = await storage.getProspectsByListId(campaign.listId!);
        let sent = 0, failed = 0;
        console.log(`[SMS Campaign] Starting send of ${members.length} messages (mode=${mode})`);
        for (const m of members) {
          if (!m.phone) { failed++; continue; }
          const firstName = (m.name || "").split(" ")[0] || "there";
          const body = campaign.message.replace(/\{\{name\}\}/g, firstName).replace(/\{\{firstName\}\}/g, firstName);
          const result = await sendSmsViaQuo(m.phone, body);
          result.success ? sent++ : failed++;
          const delay = mode === "now" ? 1200 : smartSmsDelay(members.length);
          await new Promise(r => setTimeout(r, delay));
        }
        console.log(`[SMS Campaign] Done — sent=${sent} failed=${failed}`);
        await storage.updateSmsCampaign(campaign.id, { status: "sent", sentCount: sent, failCount: failed, sentAt: new Date() });
      })().catch(console.error);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send SMS campaign" });
    }
  });

  // ─── WhatsApp Campaigns (blast) ──────────────────────────────────────────

  app.get("/api/crm/wa-campaigns", requireAdminAuth, async (_req, res) => {
    try {
      res.json(await storage.getWhatsappCampaigns());
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch WhatsApp campaigns" });
    }
  });

  app.post("/api/crm/wa-campaigns", requireAdminAuth, async (req, res) => {
    try {
      const campaign = await storage.createWhatsappCampaign(req.body);
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create WhatsApp campaign" });
    }
  });

  app.delete("/api/crm/wa-campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteWhatsappCampaign(String(req.params.id) as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete WhatsApp campaign" });
    }
  });

  app.get("/api/crm/wa-campaigns/:id/estimate", requireAdminAuth, async (req, res) => {
    try {
      const campaigns = await storage.getWhatsappCampaigns();
      const campaign = campaigns.find(c => c.id === String(req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const members = campaign.listId ? await storage.getProspectsByListId(campaign.listId) : [];
      if (members.length === 0) {
        return res.json({
          windowStatus: "closed",
          windowDescription: nextWindowDescription("sms"),
          estimatedMinutes: 0,
          recommendation: "No prospects in this list yet. Add contacts to the list before sending.",
        });
      }
      res.json(estimateSend("whatsapp", members.length));
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to estimate" });
    }
  });

  app.post("/api/crm/wa-campaigns/:id/send", requireAdminAuth, async (req, res) => {
    try {
      const campaigns = await storage.getWhatsappCampaigns();
      const campaign = campaigns.find(c => c.id === String(req.params.id));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sending") return res.status(409).json({ message: "Campaign already sending" });
      if (!campaign.listId) return res.status(400).json({ message: "No prospect list attached to this campaign" });

      const mode: SendMode = req.body?.mode === "now" ? "now" : "smart";

      if (mode === "smart" && !isOptimalSmsWindow()) {
        const windowDesc = nextWindowDescription("sms");
        return res.json({
          queued: true,
          message: `Smart Send queued — ${windowDesc} (El Paso time). Use mode "now" to send immediately.`,
        });
      }

      await storage.updateWhatsappCampaign(campaign.id, { status: "sending" });
      res.json({ message: "Campaign sending started", mode });

      // Run in background
      (async () => {
        const members = await storage.getProspectsByListId(campaign.listId!);
        let sent = 0, failed = 0;
        console.log(`[WA Campaign] Starting send of ${members.length} messages (mode=${mode})`);
        for (const m of members) {
          if (!m.phone) { failed++; continue; }
          const firstName = (m.name || "").split(" ")[0] || "there";
          const body = campaign.message.replace(/\{\{name\}\}/g, firstName).replace(/\{\{firstName\}\}/g, firstName);
          const result = await sendWhatsApp(m.phone, body);
          result.success ? sent++ : failed++;
          const delay = mode === "now" ? 1200 : smartWhatsAppDelay(members.length);
          await new Promise(r => setTimeout(r, delay));
        }
        console.log(`[WA Campaign] Done — sent=${sent} failed=${failed}`);
        await storage.updateWhatsappCampaign(campaign.id, { status: "sent", sentCount: sent, failCount: failed, sentAt: new Date() });
      })().catch(console.error);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send WhatsApp campaign" });
    }
  });

  // ─── Voicemail Drops ──────────────────────────────────────────────────────

  app.get("/api/crm/voicemail-status", requireAdminAuth, (_req, res) => {
    res.json(getVoicemailStatus());
  });

  app.get("/api/crm/voicemail-scripts", requireAdminAuth, (_req, res) => {
    res.json(VOICEMAIL_SCRIPTS);
  });

  app.post("/api/crm/clients/:id/voicemail", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.phone) return res.status(400).json({ message: "Client has no phone number" });

      const { audioUrl } = req.body as { audioUrl: string };
      if (!audioUrl) return res.status(400).json({ message: "audioUrl is required" });

      const result = await sendRinglessVoicemail(client.phone, audioUrl);

      await storage.createCrmClientActivity({
        clientId: client.id,
        activityType: result.success ? "voicemail_dropped" : "voicemail_failed",
        metadata: { audioUrl, id: result.id, error: result.error },
      });

      if (!result.success) return res.status(502).json({ message: result.error });
      res.json({ success: true, id: result.id });
    } catch (err) {
      res.status(500).json({ message: "Failed to drop voicemail" });
    }
  });

  // ─── Lob Postcard ─────────────────────────────────────────────────────────

  app.post("/api/crm/clients/:id/postcard", requireAdminAuth, async (req, res) => {
    try {
      const { sendCrmPostcard } = await import("./lob-service");
      const client = await storage.getCrmClient(String(req.params.id));
      if (!client) return res.status(404).json({ message: "Client not found" });

      const address: string = (req.body as any).address ?? client.address ?? "";
      if (!address.trim()) return res.status(400).json({ message: "Mailing address is required" });

      const result = await sendCrmPostcard({
        fullName: client.fullName,
        address,
        companyName: client.companyName,
        citizenship: client.citizenship,
      });

      await storage.createCrmClientActivity({
        clientId: client.id,
        activityType: result.success ? "note" : "note",
        metadata: {
          type: result.demoMode ? "postcard_demo" : result.success ? "postcard_sent" : "postcard_failed",
          lobId: result.lobId,
          address,
          error: result.error,
          demoMode: result.demoMode ?? false,
        } as any,
      });

      if (!result.success) return res.status(502).json({ message: result.error });
      res.json({ success: true, lobId: result.lobId, demoMode: result.demoMode ?? false });
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to send postcard" });
    }
  });

  // ─── Bulk SMS ─────────────────────────────────────────────────────────────

  app.post("/api/crm/bulk-sms", requireAdminAuth, async (req, res) => {
    try {
      const { ids, message } = req.body as { ids: string[]; message: string };
      if (!ids?.length || !message) return res.status(400).json({ message: "ids and message are required" });
      const results: { id: string; name: string; success: boolean; error?: string }[] = [];
      for (const id of ids) {
        const client = await storage.getCrmClient(id);
        if (!client || !client.phone) {
          results.push({ id, name: client?.fullName || id, success: false, error: "No phone number" });
          continue;
        }
        const body = message.replace(/\{\{name\}\}/g, client.fullName.split(" ")[0]);
        const r = await sendSmsViaQuo(client.phone, body);
        await storage.createCrmClientActivity({
          clientId: id,
          activityType: r.success ? "sms_sent" : "sms_failed",
          metadata: { message: body, id: r.id, error: r.error, bulk: true },
        });
        results.push({ id, name: client.fullName, success: r.success, error: r.error });
      }
      res.json({ results, sent: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length });
    } catch (err) {
      res.status(500).json({ message: "Bulk SMS failed" });
    }
  });

  // ── Signature Requests ─────────────────────────────────────────────────────
  app.get("/api/crm/clients/:id/signatures", requireAdminAuth, async (req, res) => {
    try {
      const sigs = await storage.getSignatureRequests(String(req.params.id) as string);
      res.json(sigs);
    } catch {
      res.status(500).json({ message: "Failed to fetch signatures" });
    }
  });

  app.post("/api/crm/clients/:id/send-signature", requireAdminAuth, async (req, res) => {
    try {
      const clientId = String(req.params.id) as string;
      const { documentType } = req.body as { documentType: string };
      if (!["fdd_receipt", "franchise_agreement"].includes(documentType)) {
        return res.status(400).json({ message: "Invalid documentType" });
      }
      const client = await storage.getCrmClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const token = generateToken();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const sigReq = await storage.createSignatureRequest({
        clientId,
        documentType,
        token,
        sentToEmail: client.email,
      });

      const emailResult = await sendSignatureRequestEmail(
        client.email, client.fullName, documentType, token, baseUrl
      );

      // Update client status and fddSent flag
      const statusMap: Record<string, string> = {
        fdd_receipt: "fdd_sent",
        franchise_agreement: "agreement_sent",
      };
      await storage.updateCrmClient(clientId, {
        status: statusMap[documentType],
        ...(documentType === "fdd_receipt" ? { fddSent: true } : {}),
      });

      await storage.createCrmClientActivity({
        clientId,
        activityType: "signature_sent",
        metadata: { documentType, token, email: client.email, emailSent: emailResult.success },
      });

      // Log to email history so it appears in the Email tab
      const docLabel = documentType === "fdd_receipt" ? "FDD Receipt" : "Franchise Agreement";
      await storage.createCrmDirectEmail({
        clientId,
        fromEmail: "dylan@newdawnfranchising.com",
        fromName: "Dylan Delaney",
        toEmail: client.email,
        subject: `Action Required: Please Sign Your ${docLabel}`,
        bodyHtml: `<p>Signature request sent automatically via the signing workflow.</p><p>A secure link was emailed to ${client.email} to sign the ${docLabel}.</p>`,
        bodyText: `Signature request sent for ${docLabel}.`,
        trackingId: `sig_${token.slice(0, 16)}`,
      });

      res.json({ success: true, signatureRequest: sigReq, emailSent: emailResult.success });
    } catch (err: any) {
      console.error("send-signature error:", err);
      res.status(500).json({ message: "Failed to send signature request" });
    }
  });

  // Public endpoint — no auth required
  app.get("/api/sign/:token", async (req, res) => {
    try {
      const sigReq = await storage.getSignatureRequestByToken(req.params.token as string);
      if (!sigReq) return res.status(404).json({ message: "Signing link not found or expired" });
      const client = await storage.getCrmClient(sigReq.clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json({
        documentType: sigReq.documentType,
        clientName: client.fullName,
        sentAt: sigReq.sentAt,
        signedAt: sigReq.signedAt,
        signerName: sigReq.signerName,
        alreadySigned: !!sigReq.signedAt,
      });
    } catch {
      res.status(500).json({ message: "Failed to load signing request" });
    }
  });

  // Public endpoint — no auth required
  app.post("/api/sign/:token", async (req, res) => {
    try {
      const sigReq = await storage.getSignatureRequestByToken(req.params.token as string);
      if (!sigReq) return res.status(404).json({ message: "Signing link not found" });
      if (sigReq.signedAt) return res.status(409).json({ message: "Document already signed" });

      const { signerName, signatureData } = req.body as { signerName: string; signatureData: string };
      if (!signerName?.trim()) return res.status(400).json({ message: "Signer name is required" });

      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

      const updated = await storage.completeSignature(sigReq.token, signerName.trim(), ip, signatureData || "");
      if (!updated) return res.status(500).json({ message: "Failed to record signature" });

      // Update client status + receiptSigned flag
      const client = await storage.getCrmClient(sigReq.clientId);
      if (client) {
        const newStatus = sigReq.documentType === "fdd_receipt" ? "fdd_signed" : "agreement_signed";
        await storage.updateCrmClient(sigReq.clientId, {
          status: newStatus,
          ...(sigReq.documentType === "fdd_receipt" ? { receiptSigned: true } : {}),
        });
        await storage.createCrmClientActivity({
          clientId: sigReq.clientId,
          activityType: "document_signed",
          metadata: { documentType: sigReq.documentType, signerName, signerIp: ip, signedAt: updated.signedAt },
        });
      }

      res.json({ success: true, signedAt: updated.signedAt });
    } catch (err: any) {
      console.error("sign error:", err);
      res.status(500).json({ message: "Failed to submit signature" });
    }
  });

  // Manual welcome email trigger
  app.post("/api/crm/clients/:id/send-welcome", requireAdminAuth, async (req, res) => {
    try {
      const client = await storage.getCrmClient(String(req.params.id) as string);
      if (!client) return res.status(404).json({ message: "Client not found" });
      const [wireResult, welcomeResult] = await Promise.allSettled([
        sendWireReceiptEmail(client.email, client.fullName, client.investmentAmount || ""),
        sendWelcomeEmail(client.email, client.fullName),
      ]);
      await storage.createCrmClientActivity({
        clientId: client.id,
        activityType: "email_sent",
        metadata: { subject: "Wire Receipt + Welcome to the Family", type: "welcome" },
      });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to send welcome email" });
    }
  });

  // ─── Agent SMS Webhook (QUO/OpenPhone inbound) ────────────────────────────
  app.post("/api/webhooks/agent-sms", async (req: any, res: any) => {
    res.json({ received: true }); // acknowledge immediately
    try {
      const body = req.body as Record<string, any>;
      // OpenPhone webhook shape: { type, data: { object: { body, from, to, ... } } }
      const msg = body?.data?.object ?? body;
      const text = msg?.body ?? msg?.content ?? msg?.text ?? "";
      const from = msg?.from ?? "";
      const to = Array.isArray(msg?.to) ? msg.to[0] : (msg?.to ?? "");
      if (!text || !from || !to) return;

      const agentResult = await handleInboundAgentSms(to, from, text, msg?.id);
      if (agentResult.handled) return;

      // Prospect reply to the shared Quo line — log on matching CRM client
      const allClients = await storage.getCrmClients();
      const matched = allClients.find(
        (c) => c.phone && phoneLast10(c.phone) === phoneLast10(from),
      );
      if (!matched) return;

      const acts = await storage.getCrmClientActivities(matched.id);
      const msgId = msg?.id || "";
      const already = acts.some((a) => {
        const m = (a.metadata || {}) as Record<string, string>;
        return msgId && (m.messageId === msgId || m.id === msgId);
      });
      if (already) return;

      await storage.createCrmClientActivity({
        clientId: matched.id,
        activityType: "sms_received",
        metadata: { message: text, messageId: msgId, from, direction: "incoming" },
      });
    } catch (err) {
      console.error("[AgentSMS webhook]", err);
    }
  });

  // GET /api/agent-sms/:agentType — message history
  app.get("/api/agent-sms/:agentType", requireAdminAuth, async (req: any, res: any) => {
    try {
      const { agentType } = req.params;
      if (!["seo", "outreach"].includes(agentType)) return res.status(400).json({ error: "Invalid agent type" });
      const msgs = await getAgentSmsHistory(agentType as "seo" | "outreach", 200);
      res.json({ messages: msgs.reverse() }); // oldest first for chat display
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/agent-sms/:agentType/send — manual send from portal
  app.post("/api/agent-sms/:agentType/send", requireAdminAuth, async (req: any, res: any) => {
    try {
      const { agentType } = req.params;
      const { body } = req.body as { body: string };
      if (!["seo", "outreach"].includes(agentType)) return res.status(400).json({ error: "Invalid agent type" });
      if (!body) return res.status(400).json({ error: "body required" });
      const result = await sendAgentSms(agentType as "seo" | "outreach", body, { triggerType: "manual" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/agent-sms/test — send a test message from each agent
  app.post("/api/agent-sms/test", requireAdminAuth, async (req: any, res: any) => {
    try {
      const { agentType } = req.body as { agentType?: string };
      const types = agentType ? [agentType] : ["seo", "outreach"];
      const results: Record<string, any> = {};
      for (const t of types) {
        if (!["seo", "outreach"].includes(t)) continue;
        const label = t === "seo" ? "SEO Agent" : "Outreach Agent";
        const fromNum = AGENT_NUMBERS[t];
        results[t] = await sendAgentSms(t as "seo" | "outreach",
          `${label}: Test message ✅\n\nThis confirms your ${label} SMS channel is working.\nFrom: ${fromNum}\nTo: ${DYLAN_PHONE}\n\nReply to this number to send instructions back to the agent.`,
          { triggerType: "test" },
        );
      }
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  registerContactRoutes(app);
  registerSeoRoutes(app);
  registerOutreachRoutes(app);
  registerVisitorRoutes(app);

  app.use("/api/seo/agent", seoAgentRouter);
  app.use("/api/seo/campaigns", seoCampaignRouter);
  app.use("/api/approve", approvalRouter);
  app.use("/api/agent", requireAdminAuth, agentRouter);

  // ─── Outreach Intelligence API ─────────────────────────────────────────────
  app.get("/api/outreach/intelligence/plans", requireAdminAuth, async (_req, res) => {
    try { res.json(await getRecentPlans(14)); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  app.get("/api/outreach/intelligence/today", requireAdminAuth, async (_req, res) => {
    try { res.json(await getTodaysPlan()); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  app.post("/api/outreach/intelligence/run", requireAdminAuth, async (_req, res) => {
    res.json({ ok: true, message: "Intelligence planning started — you will receive an SMS shortly." });
    planDailyIntelligence().catch(e => console.error("[OutreachIntel] Manual trigger error:", e));
  });

  // HeyGen AI Video routes
  app.use("/api/heygen", heygenRouter);

  // ─── HeyGen Video Click Tracking ───────────────────────────────────────────
  app.get("/v/:trackingToken", async (req, res) => {
    const { trackingToken } = req.params;
    try {
      const rows = await db.select().from(heygenVideos).where(eq(heygenVideos.trackingToken, trackingToken)).limit(1);
      if (!rows[0] || !rows[0].videoUrl) return res.status(404).send("Video not found");
      const video = rows[0];
      // Log the click
      await db.update(heygenVideos).set({
        clickedAt: new Date(), deliveryStatus: "clicked", updatedAt: new Date(),
      }).where(eq(heygenVideos.id, video.id));
      // Redirect to the actual HeyGen video
      return res.redirect(302, video.videoUrl || "/");
    } catch {
      return res.status(404).send("Not found");
    }
  });

  // Partner Outreach Sequence routes
  app.use("/api/partner", requireAdminAuth, partnerRouter);

  // Franchisee portal routes (public: /login, /verify; protected by franchisee session)
  app.use("/api/franchisee", franchiseeRouter);

  // ─── API Health Check endpoints ────────────────────────────────────────────
  app.get("/api/admin/api-health", requireAdminAuth, async (_req, res) => {
    try {
      const results = await runAllHealthChecks();
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/api-health/run-now", requireAdminAuth, async (_req, res) => {
    try {
      const results = await runHealthCheckWithAlerts();
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Schedule hourly API health checks ────────────────────────────────────
  cron.schedule("0 * * * *", () => {
    runHealthCheckWithAlerts().catch(e => console.error("[ApiHealth] Cron error:", e));
  }, { timezone: "America/Chicago" });
  console.log("API health monitor scheduled: every hour on the hour");

  // Cache Dylan's Calendly URL for email signatures (runs in background)
  cacheDylanCalendlyUrl().catch(() => {});

  // ─── Notifications API ────────────────────────────────────────────────────
  app.get("/api/notifications", requireAdminAuth, async (_req, res) => {
    try { res.json(await notifications.getUnread()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/notifications/count", requireAdminAuth, async (_req, res) => {
    try { res.json({ count: await notifications.getCount() }); } catch (e: any) { res.status(500).json({ count: 0 }); }
  });
  app.patch("/api/notifications/:id/read", requireAdminAuth, async (req, res) => {
    try { await notifications.markRead(String(req.params.id)); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/notifications/mark-all-read", requireAdminAuth, async (_req, res) => {
    try { await notifications.markAllRead(); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Rate Limiter Status ──────────────────────────────────────────────────
  app.get("/api/admin/rate-limits", requireAdminAuth, async (_req, res) => {
    try { res.json(await rateLimiter.getStatus()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/admin/email-queue", requireAdminAuth, (_req, res) => {
    res.json(emailQueue.getStatus());
  });

  // ─── Content Engine API ───────────────────────────────────────────────────
  app.get("/api/content/drafts", requireAdminAuth, async (_req, res) => {
    try { res.json(await getContentDrafts()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/content/meta-suggestions", requireAdminAuth, async (_req, res) => {
    try { res.json(await getMetaSuggestions()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/content/drafts/:id/approve", requireAdminAuth, async (req, res) => {
    try { res.json(await approveDraft(String(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/content/drafts/:id/discard", requireAdminAuth, async (req, res) => {
    try { await discardDraft(String(req.params.id)); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/content/drafts/:id", requireAdminAuth, async (req, res) => {
    try { res.json(await updateDraft(String(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/content/meta-suggestions/:id/approve", requireAdminAuth, async (req, res) => {
    try { res.json(await approveMetaSuggestion(String(req.params.id))); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/content/drafts/request", requireAdminAuth, async (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) return res.status(400).json({ error: "topic required" });
      const draftId = await requestDraft(topic);
      res.json({ draftId });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/content/sitemap-ping", requireAdminAuth, async (_req, res) => {
    try { res.json(await pingSitemap()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Visitor Trigger API ──────────────────────────────────────────────────
  app.post("/api/visitors/track", async (req, res) => {
    try {
      await trackVisit(req.body);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/visitors/identify", async (req, res) => {
    try {
      await identifyVisitorByForm(req.body);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/visitors/identify-click", async (req, res) => {
    try {
      await identifyVisitorByEmailClick(req.body);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/visitors/live", requireAdminAuth, async (_req, res) => {
    try { res.json(await getLiveVisitors()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/visitors/identified", requireAdminAuth, async (_req, res) => {
    try { res.json(await getIdentifiedVisitors()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/visitors/watchlist", requireAdminAuth, async (_req, res) => {
    try { res.json(await getWatchlist()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Meetings API ─────────────────────────────────────────────────────────
  app.post("/api/meetings/webhook", async (req, res) => {
    try {
      const { event, payload: webhookPayload } = req.body;
      if (event === "invitee.created") {
        const invitee = webhookPayload?.invitee || {};
        const eventData = webhookPayload?.event || {};
        const meetingId = await handleMeetingBooked({
          calendlyEventId: webhookPayload?.event_uri || webhookPayload?.uri || "",
          inviteeName: invitee.name || "Unknown",
          inviteeEmail: invitee.email || "",
          scheduledAt: new Date(eventData.start_time || Date.now()),
        });
        return res.json({ ok: true, meetingId });
      }
      if (event === "invitee.canceled") {
        // emit cancel event
        const { emit: emitEvent } = await import("./core/event-bus");
        emitEvent("meeting:cancelled", {
          meetingId: webhookPayload?.event_uri || "",
          leadId: "",
          cancelledAt: new Date(),
        });
        return res.json({ ok: true });
      }
      res.json({ ok: true, note: "unhandled event" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/meetings", requireAdminAuth, async (_req, res) => {
    try { res.json(await getMeetings()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/meetings/upcoming", requireAdminAuth, async (_req, res) => {
    try { res.json(await getUpcomingMeetings()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/meetings/:id/outcome", requireAdminAuth, async (req, res) => {
    try {
      const { outcome, notes } = req.body;
      res.json(await updateMeetingOutcome(String(req.params.id), outcome, notes));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/meetings/manual", requireAdminAuth, async (req, res) => {
    try {
      const id = await handleMeetingBooked({
        calendlyEventId: "",
        inviteeName: req.body.inviteeName || "Manual Meeting",
        inviteeEmail: req.body.inviteeEmail || "",
        scheduledAt: new Date(req.body.scheduledAt || Date.now()),
        leadId: req.body.leadId,
      });
      res.json({ id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Strategy Brief API ───────────────────────────────────────────────────
  app.get("/api/briefs", requireAdminAuth, async (_req, res) => {
    try {
      const all = await db.select().from(briefs).orderBy(desc(briefs.generatedAt)).limit(20);
      res.json(all);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/briefs/generate", requireAdminAuth, async (_req, res) => {
    try {
      generateWeeklyBrief().catch(e => console.error("[Brief] Error:", e));
      res.json({ ok: true, message: "Brief generation started" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── Weekly Strategy Brief Cron (Monday 8AM EST) ─────────────────────────
  cron.schedule("0 8 * * 1", () => {
    console.log("[StrategyBrief] Running weekly strategy brief...");
    generateWeeklyBrief().catch(e => console.error("[StrategyBrief] Error:", e));
  }, { timezone: "America/New_York" });
  console.log("Weekly strategy brief scheduled: Monday 8:00 AM EST");

  scheduleWeeklyBlogGeneration();
  scheduleDripProcessing();
  scheduleGmailSync();
  seedDefaultCampaign();
  seedGrokCampaign();
  scheduleDailyFacebookPosting();
  scheduleAgentCrons();

  return httpServer;
}
