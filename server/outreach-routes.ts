import type { Express } from "express";
import { db } from "./db";
import {
  outreachLeads, outreachLists, outreachListMembers,
  leadCampaigns, leadCampaignSteps, outreachActivityLog, outreachCampaignMetrics,
  voiceProfiles, outreachTouches, leadScores, leadSources, outreachSequenceEvents,
  agentMessages, agentLeads,
} from "@shared/schema";
import {
  initializeSequence, getLeadTimeline, pauseSequence, cancelSequence,
} from "./broker-sequence-service";
import { eq, desc, and, or, ilike, sql, count, inArray, isNull, gte } from "drizzle-orm";
import {
  runOutreachCampaignLoop, draftFirstTouch, handleReply, approveAndSendTouch, getCampaignStats,
} from "./outreach-agent-service";
import { sendSingleAgentMessage } from "./agent-service";
import { seamlessFindPeople } from "./seamless-service";

function requireAdmin(req: any, res: any, next: any) {
  if (req.session?.adminId || req.session?.isAdmin) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string, system: string): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) return "OpenAI not configured.";
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || "No response.";
}

const AGENT_SYSTEM = `You are the Lead Generation & Outreach AI Agent for New Dawn Franchising — a U.S. property management franchise built exclusively for E-2 visa investors (minimum $225,000 investment). Your job is to find, qualify, and build referral partner relationships with immigration attorneys, relocation consultants, real estate brokers, business advisors, wealth managers, chambers of commerce, visa consultants, and franchise brokers who work with E-2 visa candidates. You write outreach copy that is professional, confident, non-salesy, and speaks the language of immigration and international business.`;

// ─── Route registration ───────────────────────────────────────────────────────

export function registerOutreachRoutes(app: Express) {

  // ── LEADS ──────────────────────────────────────────────────────────────────

  // Must be before /api/leads/:id to avoid param clash
  app.get("/api/leads/tags", requireAdmin, async (_req: any, res: any) => {
    const rows = await db.execute(sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM outreach_leads
      WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
      ORDER BY tag ASC
    `);
    res.json((rows.rows as { tag: string }[]).map(r => r.tag));
  });

  app.get("/api/leads", requireAdmin, async (req: any, res: any) => {
    const { status, category, search, minScore, tag } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(outreachLeads.status, status as string));
    if (category) conditions.push(eq(outreachLeads.category, category as string));
    if (search) conditions.push(or(
      ilike(outreachLeads.fullName, `%${search}%`),
      ilike(outreachLeads.company, `%${search}%`),
      ilike(outreachLeads.email, `%${search}%`)
    ));
    if (minScore) conditions.push(sql`${outreachLeads.score} >= ${Number(minScore)}`);
    if (tag) conditions.push(sql`${outreachLeads.tags} @> ARRAY[${tag}]::text[]`);
    const rows = await (conditions.length
      ? db.select().from(outreachLeads).where(and(...conditions)).orderBy(desc(outreachLeads.createdAt))
      : db.select().from(outreachLeads).orderBy(desc(outreachLeads.createdAt)));
    res.json(rows);
  });

  app.post("/api/leads", requireAdmin, async (req: any, res: any) => {
    const { fullName, title, company, email, phone, whatsapp, mailingAddress, linkedinUrl, website, category, score, notes, tags } = req.body;
    if (!fullName) return res.status(400).json({ message: "fullName is required" });
    const [row] = await db.insert(outreachLeads).values({
      fullName, title, company, email, phone, whatsapp, mailingAddress, linkedinUrl, website, category, score: score || 0, notes,
      tags: Array.isArray(tags) ? tags : [],
    }).returning();
    res.json(row);
  });

  // Update tags for a lead (replaces entire tag array)
  app.patch("/api/leads/:id/tags", requireAdmin, async (req: any, res: any) => {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ message: "tags must be an array" });
    const cleaned = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
    const [row] = await db.update(outreachLeads).set({ tags: cleaned }).where(eq(outreachLeads.id, req.params.id)).returning();
    res.json(row);
  });

  app.get("/api/leads/:id", requireAdmin, async (req: any, res: any) => {
    const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const activity = await db.select().from(outreachActivityLog)
      .where(eq(outreachActivityLog.leadId, req.params.id))
      .orderBy(desc(outreachActivityLog.createdAt))
      .limit(50);
    res.json({ ...lead, activity });
  });

  app.patch("/api/leads/:id", requireAdmin, async (req: any, res: any) => {
    const allowed = ["fullName","title","company","email","phone","whatsapp","mailingAddress","linkedinUrl","website","category","score","status","notes","optedOut"];
    const updates: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const [row] = await db.update(outreachLeads).set(updates).where(eq(outreachLeads.id, req.params.id)).returning();
    res.json(row);
  });

  app.delete("/api/leads/:id", requireAdmin, async (req: any, res: any) => {
    await db.delete(outreachLeads).where(eq(outreachLeads.id, req.params.id));
    res.json({ success: true });
  });

  app.post("/api/leads/:id/pause", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(outreachLeads).set({ status: "nurture" }).where(eq(outreachLeads.id, req.params.id)).returning();
    res.json(row);
  });

  app.post("/api/leads/:id/optout", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(outreachLeads).set({ optedOut: true, status: "dead" }).where(eq(outreachLeads.id, req.params.id)).returning();
    res.json(row);
  });

  // ── AI Lead Research / Discovery ───────────────────────────────────────────

  app.post("/api/leads/discover", requireAdmin, async (req: any, res: any) => {
    const { segment, category, location } = req.body;
    if (!segment) return res.status(400).json({ message: "segment is required" });

    const serpKey = process.env.SERPAPI_KEY;
    const leads: any[] = [];

    // Step 1: SerpAPI search
    if (serpKey) {
      const categorySearches: Record<string, string[]> = {
        immigration_attorney: [`"E-2 visa attorney" ${location || "USA"}`, `"immigration lawyer" "E-2 visa" ${location || ""}`],
        relocation_consultant: [`"international relocation consultant" ${location || "USA"}`, `"expat relocation services" USA`],
        real_estate: [`"foreign national real estate" ${location || "USA"}`, `"international buyer" real estate broker USA`],
        franchise_broker: [`"franchise broker" USA "E-2 visa"`, `"FranChoice" consultant`, `"Franchise Brokers Association"`],
        visa_consultant: [`"E-2 visa consultant"`, `"immigration advisor" investor USA`],
        wealth_manager: [`"wealth manager foreign national" USA`, `"international investor" "financial advisor"`],
      };
      const queries = categorySearches[category || "immigration_attorney"] || [`${segment}`];

      for (const q of queries.slice(0, 2)) {
        try {
          const params = new URLSearchParams({ engine: "google", q, api_key: serpKey, num: "10" });
          const r = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(10000) });
          if (!r.ok) continue;
          const data = await r.json() as any;
          for (const result of (data.organic_results || []).slice(0, 5)) {
            const url: string = result.link || "";
            const title: string = result.title || "";
            const snippet: string = result.snippet || "";
            if (!url) continue;
            const domain = new URL(url).hostname.replace("www.", "");
            leads.push({
              fullName: title.split("|")[0].trim().slice(0, 60),
              company: domain,
              website: url,
              category: category || "immigration_attorney",
              score: 6,
              notes: snippet.slice(0, 200),
            });
          }
          await new Promise(r => setTimeout(r, 800));
        } catch { /* skip */ }
      }
    }

    // Step 2: Seamless enrichment if available
    if (process.env.SEAMLESS_API_KEY && leads.length > 0) {
      for (const lead of leads.slice(0, 5)) {
        try {
          const found = await seamlessFindPeople(
            { companyDomains: [lead.company], limit: 1 },
            { enrich: true },
          );
          const person = found[0];
          if (person) {
            lead.fullName = `${person.firstName} ${person.lastName}`.trim() || lead.fullName;
            lead.title = person.jobTitle || lead.title;
            lead.email = person.email || lead.email;
            lead.phone = person.phone || lead.phone;
            lead.linkedinUrl = person.linkedinUrl || lead.linkedinUrl;
            lead.score = Math.min(10, lead.score + 2);
          }
        } catch { /* skip */ }
      }
    }

    // Step 3: AI scoring
    if (leads.length > 0) {
      const prompt = `Score these referral partner leads for New Dawn Franchising (E-2 visa property management franchise) on a scale of 1-10. Higher scores for immigration attorneys, E-2 specialists, large deal flow. Return as JSON array with same order, just add/update the "score" field. Leads:\n${JSON.stringify(leads.map((l, i) => ({ i, company: l.company, title: l.title, notes: l.notes })))}\nReturn only the JSON array.`;
      try {
        const scored = await callOpenAI(prompt, AGENT_SYSTEM);
        const arr = JSON.parse(scored.replace(/```json\n?|```\n?/g, "").trim());
        if (Array.isArray(arr)) {
          for (const s of arr) {
            if (leads[s.i]) leads[s.i].score = s.score;
          }
        }
      } catch { /* use default scores */ }
    }

    res.json({ leads, total: leads.length });
  });

  // ── LISTS ──────────────────────────────────────────────────────────────────

  app.get("/api/lists", requireAdmin, async (_req: any, res: any) => {
    const lists = await db.select().from(outreachLists).orderBy(desc(outreachLists.createdAt));
    res.json(lists);
  });

  app.post("/api/lists", requireAdmin, async (req: any, res: any) => {
    const { name, segmentTag, listType } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const [row] = await db.insert(outreachLists).values({ name, segmentTag, listType: listType || "cold" }).returning();
    res.json(row);
  });

  app.get("/api/lists/:id", requireAdmin, async (req: any, res: any) => {
    const [list] = await db.select().from(outreachLists).where(eq(outreachLists.id, req.params.id));
    if (!list) return res.status(404).json({ message: "List not found" });
    const members = await db.select({
      memberId: outreachListMembers.id,
      leadId: outreachListMembers.leadId,
      addedAt: outreachListMembers.addedAt,
      fullName: outreachLeads.fullName,
      title: outreachLeads.title,
      company: outreachLeads.company,
      email: outreachLeads.email,
      phone: outreachLeads.phone,
      category: outreachLeads.category,
      score: outreachLeads.score,
      status: outreachLeads.status,
    }).from(outreachListMembers)
      .innerJoin(outreachLeads, eq(outreachListMembers.leadId, outreachLeads.id))
      .where(and(eq(outreachListMembers.listId, req.params.id), isNull(outreachListMembers.removedAt)));
    res.json({ ...list, members });
  });

  app.post("/api/lists/:id/members", requireAdmin, async (req: any, res: any) => {
    const { leadIds } = req.body as { leadIds: string[] };
    if (!leadIds?.length) return res.status(400).json({ message: "leadIds required" });
    const existing = await db.select().from(outreachListMembers)
      .where(and(eq(outreachListMembers.listId, req.params.id), inArray(outreachListMembers.leadId, leadIds)));
    const existingIds = new Set(existing.map(m => m.leadId));
    const newLeads = leadIds.filter(id => !existingIds.has(id));
    if (newLeads.length) {
      await db.insert(outreachListMembers).values(newLeads.map(leadId => ({ listId: req.params.id, leadId })));
    }
    const total = await db.select({ c: count() }).from(outreachListMembers)
      .where(and(eq(outreachListMembers.listId, req.params.id), isNull(outreachListMembers.removedAt)));
    await db.update(outreachLists).set({ contactCount: total[0]?.c || 0 }).where(eq(outreachLists.id, req.params.id));
    res.json({ added: newLeads.length, skipped: existingIds.size });
  });

  app.delete("/api/lists/:id/members/:leadId", requireAdmin, async (req: any, res: any) => {
    await db.update(outreachListMembers).set({ removedAt: new Date(), removalReason: "manual_remove" })
      .where(and(eq(outreachListMembers.listId, req.params.id), eq(outreachListMembers.leadId, req.params.leadId)));
    res.json({ success: true });
  });

  app.post("/api/lists/:id/approve", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(outreachLists).set({ status: "approved" }).where(eq(outreachLists.id, req.params.id)).returning();
    res.json(row);
  });

  app.post("/api/lists/:id/refresh", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(outreachLists).set({ lastRefreshedAt: new Date() }).where(eq(outreachLists.id, req.params.id)).returning();
    res.json({ success: true, list: row });
  });

  app.delete("/api/lists/:id", requireAdmin, async (req: any, res: any) => {
    await db.update(outreachLists).set({ status: "archived" }).where(eq(outreachLists.id, req.params.id));
    res.json({ success: true });
  });

  // ── CAMPAIGNS ──────────────────────────────────────────────────────────────

  app.get("/api/campaigns", requireAdmin, async (_req: any, res: any) => {
    const campaigns = await db.select().from(leadCampaigns).orderBy(desc(leadCampaigns.createdAt));
    const metrics = await db.select().from(outreachCampaignMetrics);
    const metricMap = new Map(metrics.map(m => [m.campaignId, m]));
    res.json(campaigns.map(c => ({ ...c, metrics: metricMap.get(c.id) || null })));
  });

  app.post("/api/campaigns", requireAdmin, async (req: any, res: any) => {
    const { name, tag, goal, channelsEnabled, dailySendLimits, abTestEnabled, autoOptimize, startDate, endDate } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const [campaign] = await db.insert(leadCampaigns).values({
      name,
      tag: tag?.trim().toLowerCase() || null,
      goal, channelsEnabled: channelsEnabled || ["email"],
      dailySendLimits: dailySendLimits || { email: 50, sms: 20, whatsapp: 20, mail: 10 },
      abTestEnabled: abTestEnabled || false,
      autoOptimize: autoOptimize || false,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }).returning();
    res.json(campaign);
  });

  app.get("/api/campaigns/:id", requireAdmin, async (req: any, res: any) => {
    const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const steps = await db.select().from(leadCampaignSteps)
      .where(eq(leadCampaignSteps.campaignId, req.params.id))
      .orderBy(leadCampaignSteps.stepNumber);
    const [metrics] = await db.select().from(outreachCampaignMetrics)
      .where(eq(outreachCampaignMetrics.campaignId, req.params.id))
      .orderBy(desc(outreachCampaignMetrics.computedAt))
      .limit(1);
    const recentActivity = await db.select().from(outreachActivityLog)
      .where(eq(outreachActivityLog.campaignId, req.params.id))
      .orderBy(desc(outreachActivityLog.createdAt))
      .limit(50);
    res.json({ ...campaign, steps, metrics: metrics || null, recentActivity });
  });

  app.patch("/api/campaigns/:id", requireAdmin, async (req: any, res: any) => {
    const allowed = ["name","tag","goal","status","channelsEnabled","dailySendLimits","abTestEnabled","autoOptimize","startDate","endDate"];
    const updates: any = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (updates.tag) updates.tag = updates.tag.trim().toLowerCase();
    const [row] = await db.update(leadCampaigns).set(updates).where(eq(leadCampaigns.id, req.params.id)).returning();
    res.json(row);
  });

  app.post("/api/campaigns/:id/approve", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(leadCampaigns).set({ status: "active" }).where(eq(leadCampaigns.id, req.params.id)).returning();
    res.json(row);
  });

  app.post("/api/campaigns/:id/pause", requireAdmin, async (req: any, res: any) => {
    const [row] = await db.update(leadCampaigns).set({ status: "paused" }).where(eq(leadCampaigns.id, req.params.id)).returning();
    res.json(row);
  });

  // ── Campaign steps (sequence builder) ─────────────────────────────────────

  app.get("/api/campaigns/:id/steps", requireAdmin, async (req: any, res: any) => {
    const steps = await db.select().from(leadCampaignSteps)
      .where(eq(leadCampaignSteps.campaignId, req.params.id))
      .orderBy(leadCampaignSteps.stepNumber);
    res.json(steps);
  });

  app.post("/api/campaigns/:id/steps", requireAdmin, async (req: any, res: any) => {
    const { stepNumber, channel, scheduledDay, subjectLine, messageBody, variant } = req.body;
    const [step] = await db.insert(leadCampaignSteps).values({
      campaignId: req.params.id, stepNumber, channel, scheduledDay, subjectLine, messageBody, variant: variant || "A",
    }).returning();
    res.json(step);
  });

  app.patch("/api/campaigns/:id/steps/:stepId", requireAdmin, async (req: any, res: any) => {
    const { subjectLine, messageBody, variant, status } = req.body;
    const updates: any = {};
    if (subjectLine !== undefined) updates.subjectLine = subjectLine;
    if (messageBody !== undefined) updates.messageBody = messageBody;
    if (variant !== undefined) updates.variant = variant;
    if (status !== undefined) updates.status = status;
    const [row] = await db.update(leadCampaignSteps).set(updates)
      .where(and(eq(leadCampaignSteps.id, req.params.stepId), eq(leadCampaignSteps.campaignId, req.params.id)))
      .returning();
    res.json(row);
  });

  app.delete("/api/campaigns/:id/steps/:stepId", requireAdmin, async (req: any, res: any) => {
    await db.delete(leadCampaignSteps)
      .where(and(eq(leadCampaignSteps.id, req.params.stepId), eq(leadCampaignSteps.campaignId, req.params.id)));
    res.json({ success: true });
  });

  // ── AI Sequence Generator ──────────────────────────────────────────────────

  app.post("/api/campaigns/:id/generate-sequence", requireAdmin, async (req: any, res: any) => {
    const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const { category } = req.body;

    const channels = (campaign.channelsEnabled || ["email"]) as string[];
    const prompt = `Generate a complete outreach campaign sequence for New Dawn Franchising targeting: ${category || "immigration attorneys"}.

Campaign goal: ${campaign.goal || "meeting_booked"}
Channels available: ${channels.join(", ")}

Create a 6-8 step sequence spanning 20 days. For each step provide:
- stepNumber (1, 2, 3...)
- channel (email | sms | whatsapp | mail)
- scheduledDay (day in sequence, starting day 1)
- subjectLine (for email only)
- messageBody (full message text, channel-appropriate length)

Return as JSON array. For emails: professional, 3-4 sentences, single CTA. For SMS: under 160 chars, warm tone, opt-out mention. For WhatsApp: conversational, brief. The value proposition: "$225K E-2 visa franchise, property management, operational platform, in-house buy-back program." Position as a referral partner opportunity — they send E-2 visa clients, we handle the investment.`;

    const result = await callOpenAI(prompt, AGENT_SYSTEM);
    try {
      const steps = JSON.parse(result.replace(/```json\n?|```\n?/g, "").trim());
      if (Array.isArray(steps)) {
        await db.delete(leadCampaignSteps).where(eq(leadCampaignSteps.campaignId, req.params.id));
        const inserted = await db.insert(leadCampaignSteps).values(
          steps.map((s: any) => ({
            campaignId: req.params.id,
            stepNumber: s.stepNumber,
            channel: s.channel,
            scheduledDay: s.scheduledDay,
            subjectLine: s.subjectLine || null,
            messageBody: s.messageBody,
            variant: "A",
          }))
        ).returning();
        res.json({ steps: inserted });
      } else {
        res.status(500).json({ message: "Invalid AI response" });
      }
    } catch (e: any) {
      res.status(500).json({ message: "Failed to parse AI sequence", raw: result });
    }
  });

  // ── AI Optimization suggestions ────────────────────────────────────────────

  app.get("/api/campaigns/:id/suggestions", requireAdmin, async (req: any, res: any) => {
    const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    const [metrics] = await db.select().from(outreachCampaignMetrics)
      .where(eq(outreachCampaignMetrics.campaignId, req.params.id))
      .orderBy(desc(outreachCampaignMetrics.computedAt)).limit(1);

    const prompt = `Analyze this campaign and give 3-5 specific optimization suggestions.
Campaign: ${campaign.name}
Goal: ${campaign.goal}
Channels: ${(campaign.channelsEnabled || []).join(", ")}
Metrics: ${JSON.stringify(metrics || { note: "No data yet — provide general best practices for E-2 visa franchise outreach" })}

Return JSON array of suggestion objects with fields: id (short string), title (short), description (2 sentences), priority (high/medium/low), action (what to do).`;

    const result = await callOpenAI(prompt, AGENT_SYSTEM);
    try {
      const suggestions = JSON.parse(result.replace(/```json\n?|```\n?/g, "").trim());
      res.json(Array.isArray(suggestions) ? suggestions : []);
    } catch {
      res.json([]);
    }
  });

  app.post("/api/campaigns/:id/optimize", requireAdmin, async (req: any, res: any) => {
    res.json({ message: "Optimization analysis queued" });
    // Async: compute metrics and update
    const activity = await db.select().from(outreachActivityLog)
      .where(eq(outreachActivityLog.campaignId, req.params.id));
    if (!activity.length) return;
    const sent = activity.filter(a => ["sent","delivered","opened","clicked","replied"].includes(a.status || "")).length;
    const opened = activity.filter(a => a.openedAt).length;
    const replied = activity.filter(a => a.repliedAt).length;
    await db.insert(outreachCampaignMetrics).values({
      campaignId: req.params.id,
      totalContacted: sent,
      sent,
      delivered: sent,
      opened,
      replied,
      openRate: sent ? opened / sent : 0,
      replyRate: sent ? replied / sent : 0,
      conversionRate: 0,
    });
  });

  // ── ACTIVITY LOG ───────────────────────────────────────────────────────────

  app.get("/api/outreach/log", requireAdmin, async (req: any, res: any) => {
    const { leadId, campaignId, limit: lim } = req.query;
    const conditions: any[] = [];
    if (leadId) conditions.push(eq(outreachActivityLog.leadId, leadId as string));
    if (campaignId) conditions.push(eq(outreachActivityLog.campaignId, campaignId as string));
    const rows = await (conditions.length
      ? db.select().from(outreachActivityLog).where(and(...conditions)).orderBy(desc(outreachActivityLog.createdAt)).limit(Number(lim) || 100)
      : db.select().from(outreachActivityLog).orderBy(desc(outreachActivityLog.createdAt)).limit(Number(lim) || 100));
    res.json(rows);
  });

  app.post("/api/outreach/log", requireAdmin, async (req: any, res: any) => {
    const { leadId, campaignId, stepId, channel, status, messagePreview } = req.body;
    if (!leadId || !channel) return res.status(400).json({ message: "leadId and channel required" });
    const [row] = await db.insert(outreachActivityLog).values({
      leadId, campaignId, stepId, channel, status: status || "sent",
      sentAt: new Date(), messagePreview,
    }).returning();
    res.json(row);
  });

  // ── AI Lead Research Endpoint (bulk discovery for Lists) ──────────────────

  app.post("/api/leads/research", requireAdmin, async (req: any, res: any) => {
    const { description, category, location, scoreThreshold } = req.body;
    if (!description) return res.status(400).json({ message: "description required" });
    const serpKey = process.env.SERPAPI_KEY;
    const hunterKey = process.env.HUNTER_API_KEY;
    const discovered: any[] = [];

    // SerpAPI discovery
    if (serpKey) {
      const q = description.includes("site:") ? description : `${description} ${location || ""}`.trim();
      try {
        const params = new URLSearchParams({ engine: "google", q, api_key: serpKey, num: "10" });
        const r = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
        if (r.ok) {
          const data = await r.json() as any;
          for (const result of (data.organic_results || []).slice(0, 8)) {
            discovered.push({
              fullName: result.title?.split("|")[0].trim().slice(0, 60) || "Unknown",
              company: result.link ? new URL(result.link).hostname.replace("www.", "") : "",
              website: result.link || "",
              category: category || "immigration_attorney",
              score: 5,
              notes: result.snippet?.slice(0, 200) || "",
            });
          }
        }
      } catch { /* skip */ }
    }

    // Seamless enrichment on top results
    if (process.env.SEAMLESS_API_KEY && discovered.length > 0) {
      for (const lead of discovered.slice(0, 5)) {
        try {
          const found = await seamlessFindPeople(
            { companyDomains: [lead.company], limit: 1 },
            { enrich: true },
          );
          const person = found[0];
          if (person) {
            lead.fullName = `${person.firstName} ${person.lastName}`.trim() || lead.fullName;
            lead.title = person.jobTitle;
            lead.email = person.email;
            lead.phone = person.phone;
            lead.linkedinUrl = person.linkedinUrl;
            lead.score = Math.min(10, lead.score + 2);
          }
        } catch { /* skip */ }
      }
    }

    // AI scoring and filtering
    const threshold = Number(scoreThreshold) || 5;
    if (discovered.length > 0) {
      try {
        const prompt = `Score these leads for E-2 visa franchise referral potential (1-10). Focus on: relevance to E-2 visa investors, likely deal flow, professional standing. Return JSON array with "score" field updated. Input:\n${JSON.stringify(discovered.map((l, i) => ({ i, company: l.company, title: l.title, notes: l.notes })))}`;
        const scored = await callOpenAI(prompt, AGENT_SYSTEM);
        const arr = JSON.parse(scored.replace(/```json\n?|```\n?/g, "").trim());
        if (Array.isArray(arr)) {
          for (const s of arr) { if (discovered[s.i]) discovered[s.i].score = s.score; }
        }
      } catch { /* skip */ }
    }

    const filtered = discovered.filter(l => l.score >= threshold);
    res.json({ total: discovered.length, filtered: filtered.length, leads: filtered });
  });

  // ── Pipeline stats ─────────────────────────────────────────────────────────

  app.get("/api/leads/stats/pipeline", requireAdmin, async (_req: any, res: any) => {
    const rows = await db.select({ status: outreachLeads.status, count: count() })
      .from(outreachLeads)
      .where(eq(outreachLeads.optedOut, false))
      .groupBy(outreachLeads.status);
    const activeCampaigns = await db.select({ count: count() }).from(leadCampaigns)
      .where(eq(leadCampaigns.status, "active"));
    const tagRows = await db.execute(sql`
      SELECT COUNT(DISTINCT t)::int AS unique_tags
      FROM outreach_leads, unnest(tags) t
      WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    `);
    const recentActivity = await db.select().from(outreachActivityLog)
      .orderBy(desc(outreachActivityLog.createdAt)).limit(10);
    const statusMap = Object.fromEntries(rows.map(r => [r.status, r.count]));
    res.json({
      pipeline: statusMap,
      activeCampaigns: activeCampaigns[0]?.count || 0,
      uniqueTags: (tagRows.rows[0] as any)?.unique_tags || 0,
      recentActivity,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH AGENT — Voice Profiles
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/agent/voice-profiles", requireAdmin, async (_req: any, res: any) => {
    const profiles = await db.select().from(voiceProfiles).orderBy(voiceProfiles.name);
    res.json(profiles);
  });

  app.post("/api/agent/voice-profiles", requireAdmin, async (req: any, res: any) => {
    const { name, toneRules, signatureBlock, doNotSay, sampleMessages } = req.body;
    const [p] = await db.insert(voiceProfiles).values({
      name, toneRules, signatureBlock,
      doNotSay: Array.isArray(doNotSay) ? doNotSay : [],
      sampleMessages: Array.isArray(sampleMessages) ? sampleMessages as unknown as Record<string, unknown>[] : [],
    }).returning();
    res.json(p);
  });

  app.patch("/api/agent/voice-profiles/:id", requireAdmin, async (req: any, res: any) => {
    const { name, toneRules, signatureBlock, doNotSay, sampleMessages } = req.body;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) update.name = name;
    if (toneRules !== undefined) update.toneRules = toneRules;
    if (signatureBlock !== undefined) update.signatureBlock = signatureBlock;
    if (doNotSay !== undefined) update.doNotSay = Array.isArray(doNotSay) ? doNotSay : [];
    if (sampleMessages !== undefined) update.sampleMessages = sampleMessages;
    const [p] = await db.update(voiceProfiles).set(update).where(eq(voiceProfiles.id, req.params.id)).returning();
    res.json(p);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH AGENT — Persona Campaigns
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/agent/outreach-campaigns", requireAdmin, async (_req: any, res: any) => {
    const campaigns = await db.select().from(leadCampaigns)
      .where(sql`persona_target IS NOT NULL`)
      .orderBy(desc(leadCampaigns.createdAt));
    const withStats = await Promise.all(campaigns.map(c => getCampaignStats(c.id)));
    res.json(withStats.filter(Boolean));
  });

  app.post("/api/agent/outreach-campaigns", requireAdmin, async (req: any, res: any) => {
    const { name, goal, personaTarget, weeklyMeetingGoal, channelsEnabled, autoSendRules, voiceProfileId } = req.body;
    const [c] = await db.insert(leadCampaigns).values({
      name, goal,
      personaTarget: personaTarget as Record<string, unknown>,
      weeklyMeetingGoal: weeklyMeetingGoal ?? 5,
      channelsEnabled: Array.isArray(channelsEnabled) ? channelsEnabled : ["email"],
      autoSendRules: autoSendRules as Record<string, unknown>,
      voiceProfileId: voiceProfileId ?? "dylan-default",
      status: "active",
    }).returning();
    res.json(c);
  });

  app.patch("/api/agent/outreach-campaigns/:id", requireAdmin, async (req: any, res: any) => {
    const allowed = ["status", "killSwitch", "weeklyMeetingGoal", "personaTarget", "autoSendRules", "voiceProfileId", "name", "goal", "meetingsBookedThisWeek"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const [c] = await db.update(leadCampaigns).set(update).where(eq(leadCampaigns.id, req.params.id)).returning();
    res.json(c);
  });

  app.post("/api/agent/outreach-campaigns/:id/run", requireAdmin, async (req: any, res: any) => {
    try {
      const result = await runOutreachCampaignLoop(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH AGENT — Approval Inbox
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/agent/touches/pending", requireAdmin, async (_req: any, res: any) => {
    // Query agent_messages (the active table) for staged messages awaiting approval
    const staged = await db.select().from(agentMessages)
      .where(eq(agentMessages.status, "staged"))
      .orderBy(desc(agentMessages.createdAt));

    const enriched = await Promise.all(staged.map(async t => {
      const [lead] = await db.select({
        fullName: sql<string>`TRIM(CONCAT(${agentLeads.firstName}, ' ', ${agentLeads.lastName}))`,
        title: agentLeads.title,
        company: agentLeads.company,
        email: agentLeads.email,
        score: agentLeads.aiScore,
      }).from(agentLeads).where(eq(agentLeads.id, t.leadId)).limit(1);
      return { ...t, lead: lead ?? null };
    }));

    const grouped = enriched.reduce((acc, t) => {
      const ch = t.channel;
      if (!acc[ch]) acc[ch] = [];
      acc[ch].push(t);
      return acc;
    }, {} as Record<string, typeof enriched>);

    res.json({ total: staged.length, byChannel: grouped });
  });

  app.post("/api/agent/touches/:id/approve", requireAdmin, async (req: any, res: any) => {
    try {
      const result = await sendSingleAgentMessage(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/api/agent/touches/:id/reject", requireAdmin, async (req: any, res: any) => {
    await db.update(agentMessages).set({ status: "held" })
      .where(eq(agentMessages.id, req.params.id));
    res.json({ ok: true });
  });

  app.patch("/api/agent/touches/:id", requireAdmin, async (req: any, res: any) => {
    const { subject, body } = req.body;
    const update: Record<string, unknown> = {};
    if (subject !== undefined) update.subject = subject;
    if (body !== undefined) update.body = body;
    const [t] = await db.update(agentMessages).set(update).where(eq(agentMessages.id, req.params.id)).returning();
    res.json(t);
  });

  // Bulk approve all staged messages in a channel — sends them all
  app.post("/api/agent/touches/bulk-approve", requireAdmin, async (req: any, res: any) => {
    const { channel } = req.body;
    const conditions: any[] = [eq(agentMessages.status, "staged")];
    if (channel) conditions.push(eq(agentMessages.channel, channel));
    const staged = await db.select({ id: agentMessages.id }).from(agentMessages).where(and(...conditions));
    let approved = 0;
    for (const t of staged) {
      try { await sendSingleAgentMessage(t.id); approved++; } catch { /* skip failures, continue */ }
    }
    res.json({ approved });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH AGENT — Reply Center
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/agent/touches/replies", requireAdmin, async (_req: any, res: any) => {
    const replies = await db.select().from(outreachTouches)
      .where(eq(outreachTouches.status, "replied"))
      .orderBy(desc(outreachTouches.replyReceivedAt));

    const enriched = await Promise.all(replies.map(async t => {
      const [lead] = await db.select({
        fullName: outreachLeads.fullName, title: outreachLeads.title,
        company: outreachLeads.company, email: outreachLeads.email,
      }).from(outreachLeads).where(eq(outreachLeads.id, t.contactId)).limit(1);

      // Find pending follow-up
      const [followUp] = await db.select().from(outreachTouches)
        .where(and(
          eq(outreachTouches.contactId, t.contactId),
          eq(outreachTouches.status, "awaiting_approval"),
        )).orderBy(desc(outreachTouches.createdAt)).limit(1);

      return { ...t, lead: lead ?? null, followUp: followUp ?? null };
    }));

    res.json(enriched);
  });

  app.post("/api/agent/touches/:id/handle-reply", requireAdmin, async (req: any, res: any) => {
    const { replyBody } = req.body;
    if (!replyBody) return res.status(400).json({ error: "replyBody required" });
    try {
      const result = await handleReply(req.params.id, replyBody);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH AGENT — LinkedIn & Forum Queues
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/agent/touches/linkedin", requireAdmin, async (_req: any, res: any) => {
    const items = await db.select().from(outreachTouches)
      .where(and(eq(outreachTouches.channel, "linkedin_draft"), eq(outreachTouches.status, "awaiting_approval")))
      .orderBy(desc(outreachTouches.createdAt));
    const enriched = await Promise.all(items.map(async t => {
      const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, t.contactId)).limit(1);
      return { ...t, lead: lead ?? null };
    }));
    res.json(enriched);
  });

  app.get("/api/agent/touches/forum", requireAdmin, async (_req: any, res: any) => {
    const items = await db.select().from(outreachTouches)
      .where(and(eq(outreachTouches.channel, "forum_draft"), eq(outreachTouches.status, "awaiting_approval")))
      .orderBy(desc(outreachTouches.createdAt));
    res.json(items);
  });

  // Mark as manually sent (LinkedIn/Forum — sent by human)
  app.post("/api/agent/touches/:id/mark-sent", requireAdmin, async (req: any, res: any) => {
    const [t] = await db.update(outreachTouches).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(outreachTouches.id, req.params.id)).returning();
    res.json(t);
  });

  // ── BROKER OUTREACH SEQUENCE ────────────────────────────────────────────────

  // GET /api/leads/:id/timeline — full outreach timeline for a lead
  app.get("/api/leads/:id/timeline", requireAdmin, async (req: any, res: any) => {
    try {
      const events = await getLeadTimeline(req.params.id);
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/leads/:id/sequence/start — initialize the sequence for a lead.
  // Optional body { track: "broker" | "client" } selects which pitch to run.
  app.post("/api/leads/:id/sequence/start", requireAdmin, async (req: any, res: any) => {
    try {
      const track = req.body?.track === "client" ? "client" : req.body?.track === "broker" ? "broker" : undefined;
      await initializeSequence(req.params.id, track);
      const events = await getLeadTimeline(req.params.id);
      res.json({ success: true, eventCount: events.length, events });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // POST /api/leads/:id/sequence/pause — pause remaining touches
  app.post("/api/leads/:id/sequence/pause", requireAdmin, async (req: any, res: any) => {
    const { reason } = req.body;
    try {
      await pauseSequence(req.params.id, reason || "Manually paused");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/leads/:id/sequence/cancel — cancel all remaining touches (DNC)
  app.post("/api/leads/:id/sequence/cancel", requireAdmin, async (req: any, res: any) => {
    const { reason } = req.body;
    try {
      await cancelSequence(req.params.id, reason || "Manually cancelled");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/leads/:id/sequence/trigger/:eventId — force-execute a single event now (manual override)
  app.post("/api/leads/:id/sequence/trigger/:eventId", requireAdmin, async (req: any, res: any) => {
    try {
      const { forceExecuteEvent } = await import("./broker-sequence-service");
      const result = await forceExecuteEvent(req.params.eventId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // PATCH /api/sequence-events/:id — manually update a sequence event status or notes
  app.patch("/api/sequence-events/:id", requireAdmin, async (req: any, res: any) => {
    const allowed = ["status", "notes", "metadata"];
    const update: any = { updatedAt: new Date() };
    for (const k of allowed) { if (req.body[k] !== undefined) update[k] = req.body[k]; }
    const [evt] = await db.update(outreachSequenceEvents).set(update)
      .where(eq(outreachSequenceEvents.id, req.params.id)).returning();
    res.json(evt);
  });

  // POST /api/leads/:id/linkedin-connected — mark LinkedIn as connected, trigger DM event
  app.post("/api/leads/:id/linkedin-connected", requireAdmin, async (req: any, res: any) => {
    await db.update(outreachLeads).set({ linkedinConnected: true }).where(eq(outreachLeads.id, req.params.id));
    // Unblock any scheduled LinkedIn DM events that were waiting for connection
    await db.update(outreachSequenceEvents)
      .set({ status: "scheduled", scheduledAt: new Date(), notes: "LinkedIn connected — DM now eligible", updatedAt: new Date() })
      .where(and(
        eq(outreachSequenceEvents.leadId, req.params.id),
        eq(outreachSequenceEvents.channel, "linkedin"),
        eq(outreachSequenceEvents.status, "skipped"),
      ));
    res.json({ success: true });
  });
}
