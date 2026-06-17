import { Router } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { storage } from "./storage";
import {
  agentLeads, agentMessages, agentDailyBatches, agentForumPosts,
  agentCompetitors, agentSettings, agentRunLogs, agentDnc,
  prospects, prospectLists, prospectListMembers, crmClients,
  agentChatSessions, agentChatMessages, agentScheduledJobs,
  dripCampaigns, dripEnrollments, forumAccounts, linkedinQueue,
} from "../shared/schema";
import { sendSmsViaQuo } from "./quo-service";
import { sendWhatsAppMessage as sendWhatsApp } from "./meta-whatsapp-service";
import { eq, desc, and, sql, or, ilike, inArray } from "drizzle-orm";
import {
  getAgentStats, runDailyPreparation, runDailyBrief, portalApprove, portalHold,
  discoverLeadsFromSeamless, enrichAndScoreNewLeads, executeBatch, importLeadManually,
  addToDnc,
} from "./agent-service";
import { getUpcomingBookings, getRecentBookings, getCalendlyStats, isCalendlyConfigured } from "./calendly-service";
import { isApifyConfigured } from "./apify-service";
import { sendSlackTest, listChannels, isSlackConfigured } from "./slack-service";
import { runEnrichmentSearch, enrichSingleCompany, type EnrichedContact } from "./prospect-enrichment";

const router = Router();

// ─── Dashboard / Stats ───────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  const stats = await getAgentStats();
  res.json(stats);
});

// ─── Daily Batch ─────────────────────────────────────────────────────────────

router.get("/batches", async (_req, res) => {
  const rows = await db.select().from(agentDailyBatches).orderBy(desc(agentDailyBatches.createdAt)).limit(30);
  res.json(rows);
});

router.get("/batches/today", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db.select().from(agentDailyBatches).where(eq(agentDailyBatches.batchDate, today)).limit(1);
  res.json(rows[0] || null);
});

router.post("/batches/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { skipItems = [] } = req.body;
  await portalApprove(id, skipItems);
  res.json({ ok: true });
});

router.post("/batches/:id/hold", async (req, res) => {
  const { id } = req.params;
  await portalHold(id);
  res.json({ ok: true });
});

// ─── Agent Actions ────────────────────────────────────────────────────────────

router.post("/run/prepare", async (_req, res) => {
  res.json({ ok: true, message: "Preparation run started" });
  runDailyPreparation().catch(e => console.error("[Agent] Manual prepare error:", e));
});

router.post("/run/brief", async (_req, res) => {
  res.json({ ok: true, message: "Brief run started" });
  runDailyBrief().catch(e => console.error("[Agent] Manual brief error:", e));
});

router.post("/run/discover", async (req, res) => {
  const { max = 20 } = req.body;
  res.json({ ok: true, message: "Discovery started" });
  discoverLeadsFromSeamless(max).catch(e => console.error("[Agent] Manual discover error:", e));
});

router.post("/run/score", async (_req, res) => {
  res.json({ ok: true, message: "Scoring started" });
  enrichAndScoreNewLeads().catch(e => console.error("[Agent] Manual score error:", e));
});

// Pause / resume
router.post("/pause", async (_req, res) => {
  await db.update(agentSettings).set({ agentPaused: true, updatedAt: new Date() }).where(eq(agentSettings.id, 1));
  res.json({ ok: true });
});

router.post("/resume", async (_req, res) => {
  await db.update(agentSettings).set({ agentPaused: false, updatedAt: new Date() }).where(eq(agentSettings.id, 1));
  res.json({ ok: true });
});

// ─── Leads ────────────────────────────────────────────────────────────────────

router.get("/leads", async (req, res) => {
  const { stage, search, limit = 50, offset = 0 } = req.query;
  let query = db.select().from(agentLeads).$dynamic();

  const conditions: any[] = [];
  if (stage) conditions.push(eq(agentLeads.stage, stage as string));
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(
      ilike(agentLeads.firstName, s),
      ilike(agentLeads.lastName, s),
      ilike(agentLeads.email, s),
      ilike(agentLeads.company, s),
      ilike(agentLeads.country, s),
    ));
  }
  if (conditions.length > 0) query = query.where(and(...conditions));

  const rows = await query
    .orderBy(desc(agentLeads.aiScore))
    .limit(Number(limit))
    .offset(Number(offset));
  res.json(rows);
});

router.get("/leads/:id", async (req, res) => {
  const rows = await db.select().from(agentLeads).where(eq(agentLeads.id, req.params.id)).limit(1);
  if (!rows[0]) { res.status(404).json({ message: "Not found" }); return; }
  const messages = await db.select().from(agentMessages).where(eq(agentMessages.leadId, req.params.id)).orderBy(desc(agentMessages.createdAt));
  res.json({ ...rows[0], messages });
});

router.post("/leads", async (req, res) => {
  const { firstName, lastName, email, phone, company, title, country, linkedinUrl, notes, source } = req.body;
  if (!firstName) { res.status(400).json({ message: "firstName required" }); return; }
  const id = await importLeadManually({ firstName, lastName: lastName || "", email, phone, company, title, country, linkedinUrl, notes, source });
  res.status(201).json({ id });
});

router.patch("/leads/:id", async (req, res) => {
  const allowed = ["firstName", "lastName", "email", "phone", "company", "title", "country", "linkedinUrl", "stage", "notes", "investmentType", "tags", "dnc"];
  const updates: any = { updatedAt: new Date() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  await db.update(agentLeads).set(updates).where(eq(agentLeads.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/leads/:id", async (req, res) => {
  await db.update(agentLeads).set({ dnc: true, stage: "dnc", updatedAt: new Date() }).where(eq(agentLeads.id, req.params.id));
  res.json({ ok: true });
});

router.post("/leads/:id/dnc", async (req, res) => {
  const { reason } = req.body;
  const rows = await db.select().from(agentLeads).where(eq(agentLeads.id, req.params.id)).limit(1);
  if (rows[0]) {
    await addToDnc(rows[0].email || undefined, rows[0].phone || undefined, undefined, reason);
    await db.update(agentLeads).set({ dnc: true, stage: "dnc", updatedAt: new Date() }).where(eq(agentLeads.id, req.params.id));
  }
  res.json({ ok: true });
});

// ─── Messages ─────────────────────────────────────────────────────────────────

router.get("/messages", async (req, res) => {
  const { batchId, status, leadId } = req.query;
  const conditions: any[] = [];
  if (batchId) conditions.push(eq(agentMessages.dailyBatchId, batchId as string));
  if (status) conditions.push(eq(agentMessages.status, status as string));
  if (leadId) conditions.push(eq(agentMessages.leadId, leadId as string));

  const rows = await db.select().from(agentMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentMessages.createdAt))
    .limit(100);
  res.json(rows);
});

router.patch("/messages/:id", async (req, res) => {
  const { body, subject, status } = req.body;
  const updates: any = {};
  if (body !== undefined) updates.body = body;
  if (subject !== undefined) updates.subject = subject;
  if (status !== undefined) updates.status = status;
  await db.update(agentMessages).set(updates).where(eq(agentMessages.id, req.params.id));
  res.json({ ok: true });
});

// Mark as replied (detect unsubscribe too)
router.post("/messages/:id/replied", async (req, res) => {
  const { replyText = "" } = req.body;
  await db.update(agentMessages).set({ repliedAt: new Date(), status: "replied" }).where(eq(agentMessages.id, req.params.id));

  const msg = await db.select().from(agentMessages).where(eq(agentMessages.id, req.params.id)).limit(1);
  if (msg[0]) {
    await db.update(agentLeads).set({ stage: "replied", updatedAt: new Date() }).where(eq(agentLeads.id, msg[0].leadId));

    const unsubKeywords = ["unsubscribe", "remove me", "stop", "opt out", "not interested", "do not contact"];
    if (unsubKeywords.some(k => replyText.toLowerCase().includes(k))) {
      const lead = await db.select().from(agentLeads).where(eq(agentLeads.id, msg[0].leadId)).limit(1);
      if (lead[0]) await addToDnc(lead[0].email || undefined, undefined, undefined, "Replied to unsubscribe");
      await db.update(agentLeads).set({ dnc: true, stage: "dnc", updatedAt: new Date() }).where(eq(agentLeads.id, msg[0].leadId));
    }
  }
  res.json({ ok: true });
});

// ─── Forum Posts ──────────────────────────────────────────────────────────────

router.get("/forum", async (_req, res) => {
  const rows = await db.select().from(agentForumPosts).orderBy(desc(agentForumPosts.createdAt)).limit(50);
  res.json(rows);
});

router.post("/forum", async (req, res) => {
  const { platform, postUrl, postTitle, postBody, author, draftReply } = req.body;
  if (!platform || !postUrl || !postTitle) { res.status(400).json({ message: "Missing fields" }); return; }
  const [row] = await db.insert(agentForumPosts).values({ platform, postUrl, postTitle, postBody, author, draftReply, status: "pending" }).returning();
  res.status(201).json(row);
});

router.patch("/forum/:id", async (req, res) => {
  const { draftReply, status } = req.body;
  const updates: any = {};
  if (draftReply !== undefined) updates.draftReply = draftReply;
  if (status !== undefined) updates.status = status;
  await db.update(agentForumPosts).set(updates).where(eq(agentForumPosts.id, req.params.id));
  res.json({ ok: true });
});

// ─── Competitors ──────────────────────────────────────────────────────────────

router.get("/competitors", async (_req, res) => {
  const rows = await db.select().from(agentCompetitors).orderBy(agentCompetitors.name);
  res.json(rows);
});

router.post("/competitors", async (req, res) => {
  const { name, domain } = req.body;
  if (!name || !domain) { res.status(400).json({ message: "name and domain required" }); return; }
  const [row] = await db.insert(agentCompetitors).values({ name, domain }).returning();
  res.status(201).json(row);
});

router.post("/competitors/:id/scan", async (req, res) => {
  const rows = await db.select().from(agentCompetitors).where(eq(agentCompetitors.id, req.params.id)).limit(1);
  if (!rows[0]) { res.status(404).json({ message: "Not found" }); return; }

  res.json({ ok: true, message: "Scan started" });

  // Run SerpAPI scan
  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) return;

  try {
    const searchUrl = `https://serpapi.com/search?engine=google&q=site:${rows[0].domain}&api_key=${serpKey}&num=10`;
    const r = await fetch(searchUrl);
    const data = await r.json() as any;

    const insights = {
      scannedAt: new Date().toISOString(),
      organicResults: (data.organic_results || []).slice(0, 5).map((r: any) => ({
        title: r.title, link: r.link, snippet: r.snippet,
      })),
      relatedSearches: (data.related_searches || []).slice(0, 5).map((r: any) => r.query),
    };

    await db.update(agentCompetitors).set({ lastScannedAt: new Date(), insights }).where(eq(agentCompetitors.id, req.params.id));
  } catch (e) {
    console.error("[Agent] Competitor scan error:", e);
  }
});

router.delete("/competitors/:id", async (req, res) => {
  await db.delete(agentCompetitors).where(eq(agentCompetitors.id, req.params.id));
  res.json({ ok: true });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(agentSettings).limit(1);
  res.json(rows[0] || {});
});

router.patch("/settings", async (req, res) => {
  const allowed = [
    "approvalEmail", "briefSendHour", "approvalDeadlineHour", "maxLeadsPerDay",
    "maxEmailsPerDay", "maxWhatsappPerDay", "calendlyLink", "dylanBio",
    "dylanVoiceSamples", "prohibitedPhrases", "targetCountries", "blacklistDomains",
    "agentPaused", "slackWebhookUrl",
  ];
  const updates: any = { updatedAt: new Date() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  await db.insert(agentSettings).values({ id: 1, ...updates }).onConflictDoUpdate({ target: agentSettings.id, set: updates });
  res.json({ ok: true });
});

// ─── DNC ──────────────────────────────────────────────────────────────────────

router.get("/dnc", async (_req, res) => {
  const rows = await db.select().from(agentDnc).orderBy(desc(agentDnc.addedAt)).limit(200);
  res.json(rows);
});

router.post("/dnc", async (req, res) => {
  const { email, phone, domain, reason } = req.body;
  const [row] = await db.insert(agentDnc).values({ email, phone, domain, reason }).returning();
  res.status(201).json(row);
});

router.delete("/dnc/:id", async (req, res) => {
  await db.delete(agentDnc).where(eq(agentDnc.id, req.params.id));
  res.json({ ok: true });
});

// ─── Run Logs ─────────────────────────────────────────────────────────────────

router.get("/logs", async (_req, res) => {
  const rows = await db.select().from(agentRunLogs).orderBy(desc(agentRunLogs.createdAt)).limit(50);
  res.json(rows);
});

// ─── Calendly ─────────────────────────────────────────────────────────────────

router.get("/calendly/stats", async (_req, res) => {
  if (!isCalendlyConfigured()) {
    res.json({ configured: false });
    return;
  }
  const stats = await getCalendlyStats();
  res.json({ configured: true, ...stats });
});

router.get("/calendly/upcoming", async (_req, res) => {
  if (!isCalendlyConfigured()) { res.json([]); return; }
  const bookings = await getUpcomingBookings(20);
  res.json(bookings);
});

router.get("/calendly/recent", async (_req, res) => {
  if (!isCalendlyConfigured()) { res.json([]); return; }
  const bookings = await getRecentBookings(10);
  res.json(bookings);
});

// ─── Integration Status ───────────────────────────────────────────────────────

router.get("/integrations", async (_req, res) => {
  res.json({
    openai: !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    seamless: !!process.env.SEAMLESS_API_KEY,
    hunter: !!process.env.HUNTER_API_KEY,
    apify: await isApifyConfigured(),
    calendly: isCalendlyConfigured(),
    whatsapp: !!(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID),
    gmail_dylan: !!process.env.GMAIL_APP_PASSWORD_DYLAN,
    serpapi: !!process.env.SERPAPI_KEY,
    slack: isSlackConfigured(),
  });
});

// ─── Slack ────────────────────────────────────────────────────────────────────

router.post("/slack/test", async (req, res) => {
  if (!isSlackConfigured()) {
    res.status(400).json({ ok: false, error: "Slack not configured" });
    return;
  }
  const { channel } = req.body as { channel?: string };
  const ok = await sendSlackTest(channel);
  res.json({ ok });
});

router.get("/slack/channels", async (_req, res) => {
  if (!isSlackConfigured()) {
    res.json([]);
    return;
  }
  const channels = await listChannels();
  res.json(channels);
});

// ─── Scheduled Jobs Runner (exported for cron) ───────────────────────────────

export async function runScheduledJobs() {
  const now = new Date();
  const due = await db.select().from(agentScheduledJobs)
    .where(and(
      eq(agentScheduledJobs.status, "pending"),
      sql`${agentScheduledJobs.scheduledAt} <= ${now}`
    ));

  for (const job of due) {
    await db.update(agentScheduledJobs).set({ status: "running" }).where(eq(agentScheduledJobs.id, job.id));
    try {
      const result = await executeTool(job.tool, job.args as Record<string, unknown>);
      await db.update(agentScheduledJobs).set({ status: "done", result }).where(eq(agentScheduledJobs.id, job.id));
      console.log(`[ScheduledJob] ${job.id} (${job.tool}) completed: ${result.slice(0, 120)}`);
    } catch (e: any) {
      await db.update(agentScheduledJobs).set({ status: "failed", result: e.message }).where(eq(agentScheduledJobs.id, job.id));
      console.error(`[ScheduledJob] ${job.id} (${job.tool}) failed:`, e.message);
    }
  }
}

// ─── Agent Chat ───────────────────────────────────────────────────────────────

// Tool descriptions embedded directly in the system prompt — guaranteed to work
// with any model/API regardless of native function-calling support.
const AGENT_SYSTEM_PROMPT = `You are the AI Outreach Agent for New Dawn Franchising LLC — an El Paso, Texas-based franchise company helping international investors obtain E-2 investor visas through franchise ownership.

You assist Dylan Delaney (Director of Franchise Development) with outreach and sales operations. You have REAL, WORKING ACCESS to the tools below. When Dylan asks you to do something, you EXECUTE IT immediately using the tools — you never refuse, never say you "can't access" a tool, and never just give advice when action is requested.

════════════════════════════════════════
HOW TO USE TOOLS
════════════════════════════════════════
When you need to use a tool, output ONLY a raw JSON object on a single line — nothing before it, nothing after it:
{"tool":"TOOL_NAME","args":{...}}

After I execute the tool and return the result, you can use another tool or write your final response. Never apologize or claim you cannot access tools — just use them.

════════════════════════════════════════
AVAILABLE TOOLS
════════════════════════════════════════

TOOL: find_new_leads
Finds and saves real people to the leads system using the FULL multi-source enrichment pipeline.

BROKER persona: Runs the complete enrichment pipeline — Google Maps + web search finds real law firms/consulting firms, then Seamless.AI enriches with staff contacts + emails + seniority, Hunter fills missing emails via domain patterns, ZeroBounce verifies emails, Twilio validates phone types, decision-maker scoring ranks contacts by title/reachability/E-2 relevance. Results include verified emails, phone numbers, and quality scores.

INVESTOR persona: Searches LinkedIn profiles of business owners/CEOs/founders from E-2 treaty countries.

Args:
  count        (number, default 5, max 100) — how many leads to find (broker pipeline returns ~5-10 per company × 10 companies per location)
  persona      ("investor" | "broker") — broker=immigration attorneys/consultants/visa advisors; investor=business owners/CEOs from treaty countries
  locations    (string[], optional) — for brokers: US states or cities e.g. ["Florida"], ["Miami","Orlando"]; for investors: countries e.g. ["UAE","India"]
  titles       (string[], optional) — for brokers: changes the search category e.g. ["immigration consultant"] or ["franchise consultant"]; for investors: custom LinkedIn search terms
  add_to_list  (string, optional) — prospect list name to add results to e.g. "brokers", "florida attorneys"
Example: {"tool":"find_new_leads","args":{"count":50,"persona":"broker","locations":["Florida"],"add_to_list":"brokers"}}

TOOL: find_people_at_company
Finds ALL people who work at a specific company website using the full enrichment pipeline (Seamless.AI by domain → website team page scraping → Hunter email discovery → ZeroBounce verification → decision-maker scoring). Use this when the user provides a specific company URL like "find everyone at visafranchise.com" or "who works at smithimmigration.com".

Args:
  url          (string, required) — the company website URL e.g. "visafranchise.com" or "https://smithimmigration.com"
  add_to_list  (string, optional) — prospect list name to save results to
Example: {"tool":"find_people_at_company","args":{"url":"visafranchise.com","add_to_list":"visa franchise team"}}

TOOL: add_to_prospect_list
Adds a specific named person to a prospect list (creates list if needed).
Args: list_name (string), name (string), email, company, title, country, category
Example: {"tool":"add_to_prospect_list","args":{"list_name":"brokers","name":"Jane Smith","company":"Smith Immigration Law","title":"Attorney","country":"USA"}}

TOOL: get_agent_leads
Returns current leads in the agent system with scores and status.
Args: limit (number, default 10)
Example: {"tool":"get_agent_leads","args":{"limit":20}}

TOOL: get_pipeline_summary
Returns CRM pipeline counts by stage.
Args: (none)
Example: {"tool":"get_pipeline_summary","args":{}}

TOOL: send_sms_blast
Sends an SMS message right now to every member of a saved prospect list who has a phone number.
Args:
  list_name  (string, required) — exact name of the prospect list
  message    (string, required) — text to send; use {{name}} for first-name personalisation
Example: {"tool":"send_sms_blast","args":{"list_name":"Florida Brokers","message":"Hi {{name}}, this is Dylan from New Dawn Franchising…"}}

TOOL: send_whatsapp_blast
Sends a WhatsApp message right now to every member of a saved prospect list who has a phone number.
Args:
  list_name  (string, required) — exact name of the prospect list
  message    (string, required) — text to send; use {{name}} for first-name personalisation
Example: {"tool":"send_whatsapp_blast","args":{"list_name":"Texas Attorneys","message":"Hi {{name}}, following up on E-2 franchise opportunities…"}}

TOOL: enroll_list_in_campaign
Enrolls every member of a prospect list in a drip email campaign (skips already-enrolled contacts).
Args:
  list_name      (string, required) — exact name of the prospect list
  campaign_name  (string, optional) — name of the email campaign; uses the first campaign if omitted
Example: {"tool":"enroll_list_in_campaign","args":{"list_name":"Texas Brokers","campaign_name":"Broker Introduction Sequence"}}

TOOL: schedule_job
Schedules any of the above tools to run at a future date/time. The current El Paso time is __CURRENT_TIME__ (America/Chicago, UTC-6 in standard time / UTC-5 in daylight saving).
Args:
  description  (string, required) — plain English label e.g. "Send Tuesday morning SMS to Texas Brokers"
  tool         (string, required) — one of: send_sms_blast, send_whatsapp_blast, enroll_list_in_campaign, find_new_leads, find_people_at_company
  tool_args    (object, required) — the args for that tool, exactly as you would pass them directly
  run_at       (string, required) — ISO 8601 datetime WITH timezone offset e.g. "2026-04-15T05:00:00-06:00" for 5 AM El Paso time
IMPORTANT: Always include the timezone offset (-06:00 for El Paso Mountain Standard, -05:00 for Mountain Daylight) so the time is correct. Never use UTC unless the user explicitly says UTC.
Example: {"tool":"schedule_job","args":{"description":"Tuesday morning SMS to Texas Brokers","tool":"send_sms_blast","tool_args":{"list_name":"Texas Brokers","message":"Hi {{name}}, reaching out about franchise opportunities…"},"run_at":"2026-04-14T05:00:00-06:00"}}

════════════════════════════════════════
DEFAULTS
════════════════════════════════════════
- "investors/leads" → CEOs, Founders, MDs from: UAE, India, Mexico, South Korea, Turkey, Germany, UK, Japan, Brazil
- "brokers/attorneys" → Immigration attorneys, visa consultants — default location: United States
- "brokers list" → add_to_list: "brokers"
- For 50+ requests: set count to exact number, tool handles pagination automatically

════════════════════════════════════════
ABOUT NEW DAWN FRANCHISING
════════════════════════════════════════
- Territory: El Paso, Texas (the only active territory)
- Min investment $225,000 (E-2 substantiality requirement)
- Director-led model (investor directs business; territory manager runs day-to-day)
- 14-day FDD review required before signing
- E-2 requires: treaty country citizenship + substantial investment + active direction

Tone: Direct, professional, warm. Write like Dylan — confident, knowledgeable, genuinely helpful.
Compliance: Never say "passive income" or "hands-free" — say "director-led". Never guarantee visa approval. Always mention 14-day FDD rule when discussing signing.`;

// ── Tool execution helpers ──────────────────────────────────────────────────

async function execFindNewLeads(args: {
  count?: number;
  persona: "investor" | "broker";
  locations?: string[];
  titles?: string[];
  add_to_list?: string;
}): Promise<string> {
  if (!process.env.SERPAPI_KEY) return "SERPAPI_KEY not configured. Please add it in project Secrets.";

  const target = Math.min(args.count || 5, 100);
  const isInvestor = args.persona === "investor";

  // ── Resolve / create prospect list ────────────────────────────────────────
  let listId: string | null = null;
  if (args.add_to_list) {
    const listName = args.add_to_list.trim();
    const ex = await db.select().from(prospectLists).where(ilike(prospectLists.name, listName)).limit(1);
    listId = ex.length > 0 ? ex[0].id : (await storage.createProspectList(listName)).id;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BROKER PATH — full multi-source enrichment pipeline:
  //   SerpAPI Google Maps + Web → real companies (law firms, consulting firms)
  //   Apollo (domain + company name) → staff with emails + seniority
  //   Hunter → email discovery + domain pattern generation
  //   ZeroBounce → batch email verification
  //   Twilio Lookup → phone type validation (mobile/landline/voip)
  //   Decision-maker scoring → title, reachability, relevance, E-2 bio signals
  //   Fuzzy name dedup (Levenshtein) + role-alias filtering (info@, admin@, etc.)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isInvestor) {
    const searchLocations: string[] = args.locations?.length ? args.locations : ["United States"];

    // Map custom title requests to closest enrichment category
    const categoryId = (() => {
      const titleStr = (args.titles || []).join(" ").toLowerCase();
      if (titleStr.includes("consultant") || titleStr.includes("advisor")) return "immigration_consultant";
      if (titleStr.includes("franchise")) return "franchise_consultant";
      if (titleStr.includes("cpa") || titleStr.includes("accountant")) return "cpa_international";
      if (titleStr.includes("relocation")) return "relocation_service";
      if (titleStr.includes("e-2") || titleStr.includes("e2")) return "e2_visa_firm";
      return "immigration_attorney"; // default: immigration attorneys
    })();

    // Run enrichment for each location (up to 3 to keep response fast)
    const enrichedContacts: EnrichedContact[] = [];
    const locsToSearch = searchLocations.slice(0, 3);

    for (const loc of locsToSearch) {
      if (enrichedContacts.length >= target) break;
      try {
        const result = await runEnrichmentSearch(categoryId, loc);
        enrichedContacts.push(...result.companies.flatMap(c => c.contacts));
      } catch (e: any) {
        console.error(`[AgentFindLeads] enrichment failed for ${loc}:`, e.message);
      }
    }

    if (enrichedContacts.length === 0) {
      return `The enrichment search for ${args.persona}s in ${locsToSearch.join(", ")} returned no contacts. Try a more specific US city (e.g. "Miami", "Houston") or a different category.`;
    }

    // Sort by decision-maker score (best first), cap at target
    enrichedContacts.sort((a, b) => b.decisionMakerScore - a.decisionMakerScore);
    const topContacts = enrichedContacts.slice(0, target);

    // ── Save to DB ───────────────────────────────────────────────────────────
    const saved: string[] = [];
    let skipped = 0;

    for (const c of topContacts) {
      // Deduplicate by email
      if (c.email) {
        const dup = await db.select({ id: agentLeads.id }).from(agentLeads).where(eq(agentLeads.email, c.email)).limit(1);
        if (dup.length > 0) { skipped++; continue; }
      }

      await db.insert(agentLeads).values({
        firstName: c.firstName, lastName: c.lastName,
        email: c.email, phone: c.phone,
        linkedinUrl: c.linkedinUrl, company: c.companyName,
        title: c.jobTitle, country: null,
        source: "enriched_search", aiScore: c.decisionMakerScore,
      });

      if (listId) {
        const [prospect] = await db.insert(prospects).values({
          name: c.fullName, company: c.companyName, email: c.email, phone: c.phone,
          category: "immigration_attorney",
          location: locsToSearch[0],
          source: "Enriched Search (AI Agent)", sourceUrl: c.linkedinUrl,
        }).returning();
        await storage.addProspectToList(listId, prospect.id);
      }

      const scoreTag = `[Score: ${c.decisionMakerScore}/100 ${c.scoreBreakdown.tierEmoji}]`;
      const emailTag = c.email ? ` — ${c.emailVerified ? "✅" : ""}${c.email}` : "";
      const phoneTag = c.phone ? ` 📞 ${c.phone}` : "";
      const listNote = listId ? ` → **${args.add_to_list}**` : "";
      saved.push(
        `**${c.fullName}**${c.jobTitle ? `, ${c.jobTitle}` : ""} @ ${c.companyName}${emailTag}${phoneTag} ${scoreTag}${listNote}`
      );
    }

    if (saved.length === 0) {
      return `Found ${topContacts.length} enriched contacts but all were already in the system (${skipped} duplicates skipped).`;
    }

    const skipNote = skipped > 0 ? ` (${skipped} duplicates skipped)` : "";
    const listSummary = listId ? ` and added to the **"${args.add_to_list}"** list` : "";
    const sourceNote = `\n\n_Source pipeline: Google Maps + Web search → Seamless.AI → Hunter → ZeroBounce email verification → Twilio phone lookup → decision-maker scoring_`;
    let reply = `Found and saved **${saved.length}** enriched ${args.persona}(s) from ${locsToSearch.join(", ")}${listSummary}${skipNote}:\n\n`;
    reply += saved.map((s, i) => `${i + 1}. ${s}`).join("\n");
    if (saved.length < target) {
      reply += `\n\n_Enrichment returned ${enrichedContacts.length} contacts (fewer than ${target} requested). Want me to search additional cities or states?_`;
    }
    reply += sourceNote;
    return reply;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR PATH — LinkedIn search via SerpAPI
  // Investors are individuals, not companies — enrichment pipeline finds staff
  // at companies, so LinkedIn profile search is the right approach here.
  // ═══════════════════════════════════════════════════════════════════════════
  const searchLocations: string[] = args.locations?.length
    ? args.locations
    : ["UAE", "India", "Mexico", "South Korea", "United Kingdom", "Turkey", "Germany", "Brazil"];

  const termGroups: string[] = args.titles?.length
    ? args.titles
    : ["CEO entrepreneur investor", "Founder Managing Director investor", "business owner investor", "Director investor international"];

  interface RawLead { name: string; firstName: string; lastName: string; jobTitle: string | null; company: string | null; linkedinUrl: string | null; location: string | null; }

  function parseLinkedInResult(r: Record<string, unknown>): RawLead | null {
    const rawTitle = ((r.title as string) || "").replace(/\s*\|\s*LinkedIn$/i, "").trim();
    const parts = rawTitle.split(/\s*[-–]\s*/).filter(Boolean);
    if (!parts[0] || parts[0].length < 3) return null;
    const name = parts[0].trim();
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || "";
    const jobTitle = parts[1] || null;
    let company = parts[2] || null;
    const linkedinUrl = typeof r.link === "string" && (r.link as string).includes("linkedin.com/in") ? r.link as string : null;
    const snippet = (r.snippet as string) || "";
    if (!company) {
      const expMatch = snippet.match(/Experience\s*[·•]\s*([^·•\n]{3,50?})\s*[·•]/i);
      if (expMatch) company = expMatch[1].replace(/Graphic$/i, "").trim() || null;
    }
    if (!company) {
      const atMatch = snippet.match(/\bat\s+([A-Z][^·•\n]{2,40?})\s*[·•]/);
      if (atMatch) company = atMatch[1].trim() || null;
    }
    const locMatch = snippet.match(/[·•]\s+([A-Za-z][\w\s,]+(UAE|India|Mexico|Korea|Germany|Brazil|Turkey|UK|United Kingdom|Colombia|Pakistan|Nigeria|USA|US)[\w\s]*)\s*[·•]/);
    const location = locMatch ? locMatch[1].trim() : null;
    return { name, firstName, lastName, jobTitle, company, linkedinUrl, location };
  }

  const seen = new Set<string>();
  const rawLeads: RawLead[] = [];

  outer:
  for (const loc of searchLocations) {
    for (const term of termGroups) {
      if (rawLeads.length >= target) break outer;
      for (let start = 0; start < 30 && rawLeads.length < target; start += 10) {
        const q = `${term} ${loc} site:linkedin.com/in`;
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=10&start=${start}&api_key=${process.env.SERPAPI_KEY}`;
        try {
          const resp = await fetch(url);
          if (!resp.ok) break;
          const data = await resp.json() as { organic_results?: Record<string, unknown>[] };
          const results = data.organic_results || [];
          if (results.length === 0) break;
          for (const r of results) {
            if (rawLeads.length >= target) break outer;
            const lead = parseLinkedInResult(r);
            if (!lead) continue;
            const key = lead.linkedinUrl || lead.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            rawLeads.push(lead);
          }
          if (results.length < 8) break;
        } catch { break; }
      }
    }
  }

  if (rawLeads.length === 0) {
    return `No LinkedIn profiles found for investors in ${searchLocations.join(", ")}. Try different countries.`;
  }

  const saved: string[] = [];
  let skipped = 0;

  for (const lead of rawLeads) {
    if (lead.linkedinUrl) {
      const dup = await db.select({ id: agentLeads.id }).from(agentLeads).where(eq(agentLeads.linkedinUrl, lead.linkedinUrl)).limit(1);
      if (dup.length > 0) { skipped++; continue; }
    }
    await db.insert(agentLeads).values({
      firstName: lead.firstName, lastName: lead.lastName,
      email: null, phone: null, linkedinUrl: lead.linkedinUrl,
      company: lead.company, title: lead.jobTitle, country: null,
      source: "serpapi_linkedin", aiScore: 0,
    });
    if (listId) {
      const [prospect] = await db.insert(prospects).values({
        name: lead.name, company: lead.company, email: null, phone: null,
        category: "investor", location: lead.location || searchLocations[0],
        source: "LinkedIn (AI Agent)", sourceUrl: lead.linkedinUrl,
      }).returning();
      await storage.addProspectToList(listId, prospect.id);
    }
    const listNote = listId ? ` → **${args.add_to_list}**` : "";
    saved.push(`**${lead.name}**${lead.jobTitle ? `, ${lead.jobTitle}` : ""}${lead.company ? ` @ ${lead.company}` : ""}${lead.location ? ` (${lead.location})` : ""}${listNote}`);
  }

  if (saved.length === 0) return `Found ${rawLeads.length} LinkedIn profiles but all were already in the system (${skipped} duplicates skipped).`;

  const skipNote = skipped > 0 ? ` (${skipped} duplicates skipped)` : "";
  const listSummary = listId ? ` and added to the **"${args.add_to_list}"** list` : "";
  let reply = `Found and saved **${saved.length}** investor(s) from ${searchLocations.join(", ")}${listSummary}${skipNote}:\n\n`;
  reply += saved.map((s, i) => `${i + 1}. ${s}`).join("\n");
  if (saved.length < target) reply += `\n\n_LinkedIn returned ${rawLeads.length} unique profiles (fewer than ${target} requested). Want me to try more countries?_`;
  return reply;
}

async function execAddToProspectList(args: {
  list_name: string;
  name: string;
  email?: string;
  company?: string;
  title?: string;
  country?: string;
  category?: string;
}): Promise<string> {
  try {
    const listName = args.list_name.trim();
    const existing = await db.select().from(prospectLists).where(ilike(prospectLists.name, listName)).limit(1);
    let listId: string;
    let created = false;
    if (existing.length > 0) {
      listId = existing[0].id;
    } else {
      const newList = await storage.createProspectList(listName);
      listId = newList.id;
      created = true;
    }

    const [prospect] = await db.insert(prospects).values({
      name: args.name,
      company: args.company || null,
      email: args.email || null,
      phone: null,
      category: args.category || "prospect",
      location: args.country || "Unknown",
      source: "AI Agent (manual)",
    }).returning();

    await storage.addProspectToList(listId, prospect.id);

    const listMsg = created ? `Created new list "${listName}" and added` : `Added`;
    return `${listMsg} ${args.name}${args.company ? ` (${args.company})` : ""} to the "${listName}" prospect list.`;
  } catch (e: any) {
    return `Error adding to list: ${e.message}`;
  }
}

async function execGetAgentLeads(args: { limit?: number }): Promise<string> {
  const leads = await db.select().from(agentLeads)
    .where(eq(agentLeads.dnc, false))
    .orderBy(desc(agentLeads.aiScore), desc(agentLeads.createdAt))
    .limit(args.limit || 10);

  if (leads.length === 0) return "No leads in the system yet. Use find_new_leads to discover some.";

  const lines = leads.map(l =>
    `• ${l.firstName} ${l.lastName}${l.title ? `, ${l.title}` : ""}${l.company ? ` @ ${l.company}` : ""}${l.country ? ` (${l.country})` : ""} — Score: ${l.aiScore}/100 — Stage: ${l.stage}`
  );
  return `Current agent leads (${leads.length}):\n\n${lines.join("\n")}`;
}

async function execGetPipelineSummary(): Promise<string> {
  const clients = await db.select({ status: crmClients.status }).from(crmClients);
  if (clients.length === 0) return "CRM pipeline is empty — no clients yet.";

  const counts: Record<string, number> = {};
  for (const c of clients) {
    const s = c.status || "unknown";
    counts[s] = (counts[s] || 0) + 1;
  }
  const lines = Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([stage, count]) => `• ${stage}: ${count}`);
  return `CRM Pipeline (${clients.length} total clients):\n\n${lines.join("\n")}`;
}

// ── find_people_at_company — full enrichment pipeline for a specific URL ────
async function execFindPeopleAtCompany(args: {
  url: string;
  add_to_list?: string;
}): Promise<string> {
  if (!args.url) return "url is required — e.g. visafranchise.com";

  let listId: string | null = null;
  if (args.add_to_list) {
    const listName = args.add_to_list.trim();
    const ex = await db.select().from(prospectLists).where(ilike(prospectLists.name, listName)).limit(1);
    listId = ex.length > 0 ? ex[0].id : (await storage.createProspectList(listName)).id;
  }

  const result = await enrichSingleCompany(args.url, "", "custom", "");
  const company = result.companies[0];
  if (!company) return `No results found for ${args.url}`;

  const contacts = company.contacts;
  if (contacts.length === 0) return `Found the company (${company.name}) but could not discover any staff contacts.`;

  // Optionally save to prospect list
  if (listId && contacts.length > 0) {
    for (const c of contacts) {
      try {
        const [p] = await db.insert(prospects).values({
          name: `${c.firstName} ${c.lastName}`.trim(),
          company: company.name,
          email: c.email || null,
          phone: c.phone || null,
          category: "custom",
          location: "Global",
          source: "AI Agent (company search)",
        }).returning();
        await storage.addProspectToList(listId, p.id);
      } catch {}
    }
  }

  const lines = contacts.map((c, i) => {
    const parts = [`${i + 1}. ${c.firstName} ${c.lastName}`];
    if (c.jobTitle) parts.push(`— ${c.jobTitle}`);
    if (c.email) parts.push(`| 📧 ${c.email}${c.emailVerified ? " ✓" : ""}`);
    if (c.phone) {
      const waTag = (c as { whatsappEligible?: boolean }).whatsappEligible ? " 🟢WA" : "";
      const typeTag = (c as { phoneType?: string }).phoneType && (c as { phoneType?: string }).phoneType !== "unverified"
        ? ` (${(c as { phoneType?: string }).phoneType})` : "";
      parts.push(`| 📞 ${c.phone}${typeTag}${waTag}`);
    }
    if (c.linkedinUrl) parts.push(`| LinkedIn: ${c.linkedinUrl}`);
    if (c.emailConfidence) parts.push(`| Email confidence: ${c.emailConfidence}%`);
    return parts.join(" ");
  });

  const saved = listId ? ` Saved to "${args.add_to_list}".` : "";
  return `Found **${contacts.length} people** at **${company.name}** (${args.url}):\n\n${lines.join("\n")}${saved}`;
}

// ── New schedulable tool executors ──────────────────────────────────────────

async function execSendSmsBlast(args: { list_name: string; message: string }): Promise<string> {
  if (!args.list_name || !args.message) return "Error: list_name and message are required.";
  const ex = await db.select().from(prospectLists).where(ilike(prospectLists.name, args.list_name)).limit(1);
  if (!ex.length) return `No list found named "${args.list_name}". Check the list name.`;
  const listId = ex[0].id;
  const members = await db.select().from(prospects)
    .innerJoin(prospectListMembers, eq(prospectListMembers.prospectId, prospects.id))
    .where(eq(prospectListMembers.listId, listId));
  if (!members.length) return `List "${args.list_name}" has no members.`;
  let sent = 0, skipped = 0, failed = 0;
  for (const row of members) {
    const p = row.prospects;
    if (!p.phone) { skipped++; continue; }
    const firstName = (p.name || "").split(" ")[0] || "there";
    const body = args.message.replace(/\{\{name\}\}/gi, firstName).replace(/\{\{firstName\}\}/gi, firstName);
    const result = await sendSmsViaQuo(p.phone, body);
    result.success ? sent++ : failed++;
    await new Promise(r => setTimeout(r, 600));
  }
  return `SMS blast to "${args.list_name}" complete. Sent: ${sent}, Skipped (no phone): ${skipped}, Failed: ${failed}.`;
}

async function execSendWhatsappBlast(args: { list_name: string; message: string }): Promise<string> {
  if (!args.list_name || !args.message) return "Error: list_name and message are required.";
  const ex = await db.select().from(prospectLists).where(ilike(prospectLists.name, args.list_name)).limit(1);
  if (!ex.length) return `No list found named "${args.list_name}". Check the list name.`;
  const listId = ex[0].id;
  const members = await db.select().from(prospects)
    .innerJoin(prospectListMembers, eq(prospectListMembers.prospectId, prospects.id))
    .where(eq(prospectListMembers.listId, listId));
  if (!members.length) return `List "${args.list_name}" has no members.`;
  let sent = 0, skipped = 0, failed = 0;
  for (const row of members) {
    const p = row.prospects;
    if (!p.phone) { skipped++; continue; }
    const firstName = (p.name || "").split(" ")[0] || "there";
    const body = args.message.replace(/\{\{name\}\}/gi, firstName).replace(/\{\{firstName\}\}/gi, firstName);
    const result = await sendWhatsApp(p.phone, body);
    result.success ? sent++ : failed++;
    await new Promise(r => setTimeout(r, 600));
  }
  return `WhatsApp blast to "${args.list_name}" complete. Sent: ${sent}, Skipped (no phone): ${skipped}, Failed: ${failed}.`;
}

async function execEnrollListInCampaign(args: { list_name: string; campaign_name?: string }): Promise<string> {
  if (!args.list_name) return "Error: list_name is required.";
  const listEx = await db.select().from(prospectLists).where(ilike(prospectLists.name, args.list_name)).limit(1);
  if (!listEx.length) return `No list found named "${args.list_name}".`;
  const listId = listEx[0].id;

  let campaignId: string;
  if (args.campaign_name) {
    const cEx = await db.select().from(dripCampaigns).where(ilike(dripCampaigns.name, args.campaign_name)).limit(1);
    if (!cEx.length) return `No email campaign found named "${args.campaign_name}".`;
    campaignId = cEx[0].id;
  } else {
    const campaigns = await db.select().from(dripCampaigns).orderBy(dripCampaigns.createdAt).limit(1);
    if (!campaigns.length) return "No email campaigns exist yet. Create one in the Campaigns tab first.";
    campaignId = campaigns[0].id;
  }

  const members = await db.select().from(prospects)
    .innerJoin(prospectListMembers, eq(prospectListMembers.prospectId, prospects.id))
    .where(eq(prospectListMembers.listId, listId));
  if (!members.length) return `List "${args.list_name}" has no members.`;

  const existingEnrollments = await db.select().from(dripEnrollments).where(eq(dripEnrollments.campaignId, campaignId));
  const enrolledEmails = new Set(existingEnrollments.map(e => e.prospectEmail?.toLowerCase()));

  let enrolled = 0, skipped = 0;
  for (const row of members) {
    const p = row.prospects;
    if (!p.email || !p.id || enrolledEmails.has(p.email.toLowerCase())) { skipped++; continue; }
    await db.insert(dripEnrollments).values({
      campaignId,
      prospectId: p.id,
      prospectName: p.name || "",
      prospectEmail: p.email,
    });
    enrolled++;
  }
  return `Enrolled ${enrolled} prospects from "${args.list_name}" in the email campaign. Skipped ${skipped} already enrolled or missing email.`;
}

async function execScheduleJob(args: {
  description: string;
  tool: string;
  tool_args: Record<string, unknown>;
  run_at: string;
  session_id?: string;
}): Promise<string> {
  if (!args.description || !args.tool || !args.run_at) return "Error: description, tool, and run_at are required.";
  const validTools = ["send_sms_blast", "send_whatsapp_blast", "enroll_list_in_campaign", "find_new_leads", "find_people_at_company"];
  if (!validTools.includes(args.tool)) return `Unknown schedulable tool "${args.tool}". Valid: ${validTools.join(", ")}`;

  let scheduledAt: Date;
  try {
    scheduledAt = new Date(args.run_at);
    if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date");
  } catch {
    return `Could not parse run_at="${args.run_at}". Please provide an ISO 8601 datetime like "2026-04-15T05:00:00-06:00" for 5 AM Mountain time.`;
  }
  if (scheduledAt <= new Date()) return "Scheduled time is in the past. Please provide a future datetime.";

  const [job] = await db.insert(agentScheduledJobs).values({
    description: args.description,
    tool: args.tool,
    args: args.tool_args || {},
    scheduledAt,
    timezone: "America/Chicago",
    status: "pending",
    sessionId: args.session_id || null,
  }).returning();

  const localTime = scheduledAt.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "full", timeStyle: "short" });
  return `✅ Job scheduled! "${args.description}" will run on ${localTime} (El Paso time). Job ID: ${job.id}`;
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  find_new_leads: "🔍 Running enrichment pipeline — Google Maps → Seamless.AI → Hunter → ZeroBounce → scoring... (may take 20-40s)",
  find_people_at_company: "🔍 Scraping company website → Seamless.AI → Hunter → ZeroBounce → scoring... (may take 30-60s)",
  add_to_prospect_list: "📋 Adding to prospect list...",
  get_agent_leads: "📊 Loading current leads...",
  get_pipeline_summary: "📈 Pulling CRM pipeline...",
  send_sms_blast: "📱 Sending SMS to all members of the list...",
  send_whatsapp_blast: "💬 Sending WhatsApp messages to the list...",
  enroll_list_in_campaign: "📧 Enrolling list members in email campaign...",
  schedule_job: "🗓️ Scheduling task...",
};

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "find_new_leads": return await execFindNewLeads(args as Parameters<typeof execFindNewLeads>[0]);
      case "find_people_at_company": return await execFindPeopleAtCompany(args as Parameters<typeof execFindPeopleAtCompany>[0]);
      case "add_to_prospect_list": return await execAddToProspectList(args as Parameters<typeof execAddToProspectList>[0]);
      case "get_agent_leads": return await execGetAgentLeads(args as Parameters<typeof execGetAgentLeads>[0]);
      case "get_pipeline_summary": return await execGetPipelineSummary();
      case "send_sms_blast": return await execSendSmsBlast(args as Parameters<typeof execSendSmsBlast>[0]);
      case "send_whatsapp_blast": return await execSendWhatsappBlast(args as Parameters<typeof execSendWhatsappBlast>[0]);
      case "enroll_list_in_campaign": return await execEnrollListInCampaign(args as Parameters<typeof execEnrollListInCampaign>[0]);
      case "schedule_job": return await execScheduleJob(args as Parameters<typeof execScheduleJob>[0]);
      default: return `Unknown tool "${name}". Available: find_new_leads, find_people_at_company, add_to_prospect_list, get_agent_leads, get_pipeline_summary, send_sms_blast, send_whatsapp_blast, enroll_list_in_campaign, schedule_job`;
    }
  } catch (e: any) {
    try {
      switch (name) {
        case "find_new_leads": return await execFindNewLeads(args as Parameters<typeof execFindNewLeads>[0]);
        case "find_people_at_company": return await execFindPeopleAtCompany(args as Parameters<typeof execFindPeopleAtCompany>[0]);
        case "add_to_prospect_list": return await execAddToProspectList(args as Parameters<typeof execAddToProspectList>[0]);
        case "get_agent_leads": return await execGetAgentLeads(args as Parameters<typeof execGetAgentLeads>[0]);
        case "get_pipeline_summary": return await execGetPipelineSummary();
        case "send_sms_blast": return await execSendSmsBlast(args as Parameters<typeof execSendSmsBlast>[0]);
        case "send_whatsapp_blast": return await execSendWhatsappBlast(args as Parameters<typeof execSendWhatsappBlast>[0]);
        case "enroll_list_in_campaign": return await execEnrollListInCampaign(args as Parameters<typeof execEnrollListInCampaign>[0]);
        case "schedule_job": return await execScheduleJob(args as Parameters<typeof execScheduleJob>[0]);
        default: return `Unknown tool "${name}"`;
      }
    } catch (e2: any) {
      return `Tool "${name}" failed after retry: ${e2.message}`;
    }
  }
}

// ── Parse JSON tool call from model output ──────────────────────────────────
function parseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  const trimmed = text.trim();
  // Look for JSON object anywhere in the response (model sometimes adds a tiny prefix)
  const match = trimmed.match(/\{[\s\S]*"tool"\s*:\s*"[^"]+"[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.tool && typeof parsed.tool === "string") {
      return { tool: parsed.tool, args: (parsed.args as Record<string, unknown>) || {} };
    }
  } catch {}
  return null;
}

function makeClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

// ── POST /chat (non-streaming, kept for backwards compat) ───────────────────
router.post("/chat", async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!messages || !Array.isArray(messages)) { res.status(400).json({ message: "messages array required" }); return; }
  try {
    const client = makeClient();
    const currentTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "full", timeStyle: "short" });
    const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT.replace("__CURRENT_TIME__", currentTime) },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];
    for (let round = 0; round < 5; round++) {
      const completion = await client.chat.completions.create({ model: "gpt-4o", messages: history, max_tokens: 1500 });
      const text = completion.choices[0]?.message?.content || "";
      const call = parseToolCall(text);
      if (call) {
        const result = await executeTool(call.tool, call.args);
        history.push({ role: "assistant", content: text });
        history.push({ role: "user", content: `[Tool result — ${call.tool}]:\n${result}` });
        continue;
      }
      res.json({ reply: text }); return;
    }
    res.json({ reply: "Done." });
  } catch (err: any) { res.status(500).json({ message: err.message || "Chat failed" }); }
});

// ── POST /chat/stream (SSE streaming) ──────────────────────────────────────
router.post("/chat/stream", async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!messages || !Array.isArray(messages)) { res.status(400).json({ message: "messages array required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} };

  try {
    const client = makeClient();
    const currentTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "full", timeStyle: "short" });
    const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT.replace("__CURRENT_TIME__", currentTime) },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    for (let round = 0; round < 5; round++) {
      // Non-streaming decision call — check if model wants to use a tool
      const decision = await client.chat.completions.create({
        model: "gpt-4o",
        messages: history,
        max_tokens: 600,
        temperature: 0,
      });

      const decisionText = decision.choices[0]?.message?.content || "";
      console.log(`[AgentChat] round=${round} output=${decisionText.slice(0, 120)}`);

      const call = parseToolCall(decisionText);
      if (call) {
        const label = TOOL_LABELS[call.tool] || `⚙️ Running ${call.tool}...`;
        send("status", { text: label });
        const result = await executeTool(call.tool, call.args);
        console.log(`[AgentChat] tool=${call.tool} result_len=${result.length}`);
        history.push({ role: "assistant", content: decisionText });
        history.push({ role: "user", content: `[Tool result — ${call.tool}]:\n${result}` });
        send("status", { text: "" });
        continue;
      }

      // No tool call — stream the final response
      send("status", { text: "" });
      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: history,
        stream: true,
        max_tokens: 1800,
      });
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) send("token", { text: token });
      }
      send("done", {});
      res.end();
      return;
    }

    send("done", {});
    res.end();
  } catch (err: any) {
    console.error("[AgentChat] error:", err.message);
    send("error", { message: err.message || "Chat failed" });
    res.end();
  }
});

// ── Chat session management ─────────────────────────────────────────────────

// List all sessions (most recent first)
router.get("/chat/sessions", async (_req, res) => {
  try {
    const sessions = await db.select().from(agentChatSessions)
      .orderBy(desc(agentChatSessions.updatedAt))
      .limit(50);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new session
router.post("/chat/sessions", async (req, res) => {
  try {
    const { title } = req.body as { title?: string };
    const [session] = await db.insert(agentChatSessions)
      .values({ title: title || "New Chat" })
      .returning();
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get a session with all its messages
router.get("/chat/sessions/:id", async (req, res) => {
  try {
    const [session] = await db.select().from(agentChatSessions).where(eq(agentChatSessions.id, req.params.id));
    if (!session) { res.status(404).json({ message: "Session not found" }); return; }
    const msgs = await db.select().from(agentChatMessages)
      .where(eq(agentChatMessages.sessionId, req.params.id))
      .orderBy(agentChatMessages.createdAt);
    res.json({ ...session, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Save messages to a session (replaces all messages for this session)
router.post("/chat/sessions/:id/messages", async (req, res) => {
  try {
    const { messages, title } = req.body as { messages: { role: string; content: string }[]; title?: string };
    const [session] = await db.select().from(agentChatSessions).where(eq(agentChatSessions.id, req.params.id));
    if (!session) { res.status(404).json({ message: "Session not found" }); return; }

    // Delete existing messages and re-insert (simple upsert approach)
    await db.delete(agentChatMessages).where(eq(agentChatMessages.sessionId, req.params.id));
    if (messages.length > 0) {
      await db.insert(agentChatMessages).values(
        messages.map(m => ({ sessionId: req.params.id, role: m.role, content: m.content }))
      );
    }
    // Update session title and timestamp
    const updates: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
    if (title) updates.title = title;
    await db.update(agentChatSessions).set(updates).where(eq(agentChatSessions.id, req.params.id));

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a session
router.delete("/chat/sessions/:id", async (req, res) => {
  try {
    await db.delete(agentChatMessages).where(eq(agentChatMessages.sessionId, req.params.id));
    await db.delete(agentChatSessions).where(eq(agentChatSessions.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Scheduled Jobs ──────────────────────────────────────────────────────────

// List all scheduled jobs (most recent first)
router.get("/scheduled-jobs", async (_req, res) => {
  try {
    const jobs = await db.select().from(agentScheduledJobs)
      .orderBy(desc(agentScheduledJobs.scheduledAt))
      .limit(100);
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel / delete a scheduled job
router.delete("/scheduled-jobs/:id", async (req, res) => {
  try {
    await db.delete(agentScheduledJobs).where(eq(agentScheduledJobs.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Run a scheduled job immediately (manual trigger)
router.post("/scheduled-jobs/:id/run", async (req, res) => {
  try {
    const [job] = await db.select().from(agentScheduledJobs).where(eq(agentScheduledJobs.id, req.params.id));
    if (!job) { res.status(404).json({ message: "Job not found" }); return; }
    if (job.status === "running") { res.status(409).json({ message: "Job already running" }); return; }
    res.json({ ok: true, message: "Job started" });
    await db.update(agentScheduledJobs).set({ status: "running" }).where(eq(agentScheduledJobs.id, job.id));
    try {
      const result = await executeTool(job.tool, job.args as Record<string, unknown>);
      await db.update(agentScheduledJobs).set({ status: "done", result }).where(eq(agentScheduledJobs.id, job.id));
    } catch (e: any) {
      await db.update(agentScheduledJobs).set({ status: "failed", result: e.message }).where(eq(agentScheduledJobs.id, job.id));
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Forum Accounts (credentials store) ──────────────────────────────────────

router.get("/forum-accounts", async (_req, res) => {
  try {
    const rows = await db.select().from(forumAccounts).orderBy(forumAccounts.forumName);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/forum-accounts", async (req, res) => {
  try {
    const { forumName, siteUrl, loginUrl, username, password, notes, autoScanEnabled } = req.body;
    if (!forumName || !siteUrl) { res.status(400).json({ message: "forumName and siteUrl required" }); return; }
    const [row] = await db.insert(forumAccounts).values({
      forumName, siteUrl, loginUrl, username, password, notes,
      autoScanEnabled: autoScanEnabled ?? true,
    }).returning();
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/forum-accounts/:id", async (req, res) => {
  try {
    const updates: Record<string, unknown> = {};
    for (const key of ["forumName", "siteUrl", "loginUrl", "username", "password", "notes", "autoScanEnabled"]) {
      if (key in req.body) updates[key === "forumName" ? "forum_name" : key === "siteUrl" ? "site_url" : key === "loginUrl" ? "login_url" : key === "autoScanEnabled" ? "auto_scan_enabled" : key] = req.body[key];
    }
    updates.updated_at = new Date();
    const [row] = await db.update(forumAccounts).set(req.body).where(eq(forumAccounts.id, req.params.id)).returning();
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/forum-accounts/:id", async (req, res) => {
  try {
    await db.delete(forumAccounts).where(eq(forumAccounts.id, req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── LinkedIn Queue ───────────────────────────────────────────────────────────

// GET /touches/linkedin — returns pending + recent linkedin queue items
// Maps DB columns → the shape the frontend LinkedInQueueSection expects:
//   t.id, t.lead.{ fullName, title, company, linkedinUrl }, t.body, t.type, t.status, t.createdAt
router.get("/touches/linkedin", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(linkedinQueue)
      .orderBy(desc(linkedinQueue.createdAt))
      .limit(100);

    const items = rows.map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      body: r.message,
      notes: r.notes,
      approvalToken: r.approvalToken,
      sentAt: r.sentAt,
      createdAt: r.createdAt,
      sequenceEventId: r.sequenceEventId,
      lead: {
        id: r.leadId,
        fullName: r.leadName,
        title: r.leadTitle,
        company: r.leadCompany,
        linkedinUrl: r.leadLinkedinUrl,
      },
    }));

    res.json(items);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /touches/:id/mark-sent — manually confirm you sent the LinkedIn message
router.post("/touches/:id/mark-sent", async (req, res) => {
  try {
    const [updated] = await db
      .update(linkedinQueue)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(linkedinQueue.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /touches/:id/skip — skip this LinkedIn item without sending
router.post("/touches/:id/skip", async (req, res) => {
  try {
    const [updated] = await db
      .update(linkedinQueue)
      .set({ status: "skipped", notes: req.body.reason ?? null })
      .where(eq(linkedinQueue.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
