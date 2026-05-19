import { db } from "./db";
import {
  briefs, outreachLeads, leadCampaigns, outreachActivityLog,
  contentDrafts, metaSuggestions, meetings, visitorWatchlist, seoScheduledTasks,
  keywordRankings, seoIssues,
} from "@shared/schema";
import { eq, desc, gte, and, count, sql, lt } from "drizzle-orm";
import { emailQueue } from "./core/email-queue";

const JAMIE_EMAIL = "jamie.greene736@gmail.com";
const FROM_EMAIL = "franchising@newdawnfranchising.com";

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) return "OpenAI not configured.";
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an executive business intelligence assistant for New Dawn Franchising LLC (E-2 visa property management franchise). You synthesize data into a prioritised weekly strategy brief for Jamie (ops leader). Be direct, prioritise ruthlessly, and tell her exactly what to do. This week's data follows.`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2500,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || "Unable to generate brief.";
}

// ─── Data aggregation ─────────────────────────────────────────────────────────

async function aggregateData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // SEO data
  const keywordChanges = await db.select().from(keywordRankings)
    .where(gte(keywordRankings.checkedAt, sevenDaysAgo))
    .orderBy(desc(keywordRankings.checkedAt))
    .limit(20);
  const openIssues = await db.select().from(seoIssues).where(eq(seoIssues.status, "open")).limit(10);

  // Content engine
  const pendingDrafts = await db.select().from(contentDrafts).where(eq(contentDrafts.status, "draft")).limit(10);
  const pendingMeta = await db.select().from(metaSuggestions).where(eq(metaSuggestions.status, "pending")).limit(10);

  // Leads
  const newLeads = await db.select().from(outreachLeads)
    .where(gte(outreachLeads.createdAt, sevenDaysAgo)).limit(20);
  const hotLeads = await db.select().from(outreachLeads)
    .where(and(gte(outreachLeads.score, 7), eq(outreachLeads.status, "active"))).limit(10);
  const convertedLeads = await db.select().from(outreachLeads)
    .where(and(eq(outreachLeads.status, "converted"), gte(outreachLeads.createdAt, sevenDaysAgo))).limit(5);
  const deadLeads = await db.select().from(outreachLeads)
    .where(and(eq(outreachLeads.status, "dead"), gte(outreachLeads.createdAt, sevenDaysAgo))).limit(5);
  const repliedLeads = await db.select().from(outreachLeads)
    .where(and(eq(outreachLeads.status, "replied"), gte(outreachLeads.createdAt, sevenDaysAgo))).limit(5);

  // Campaigns
  const activeCampaigns = await db.select().from(leadCampaigns).where(eq(leadCampaigns.status, "active")).limit(10);
  const pendingCampaigns = await db.select().from(leadCampaigns).where(eq(leadCampaigns.status, "draft")).limit(5);

  // Activity
  const recentActivity = await db.select().from(outreachActivityLog)
    .where(gte(outreachActivityLog.createdAt, sevenDaysAgo)).limit(100);
  const emailsSent = recentActivity.filter(a => a.channel === "email").length;
  const smsSent = recentActivity.filter(a => a.channel === "sms").length;
  const waSent = recentActivity.filter(a => a.channel === "whatsapp").length;
  const replies = recentActivity.filter(a => a.repliedAt !== null).length;

  // Meetings
  const upcomingMeetings = await db.select().from(meetings)
    .where(and(gte(meetings.scheduledAt, new Date()), eq(meetings.status, "confirmed")))
    .orderBy(meetings.scheduledAt).limit(10);
  const pastMeetings = await db.select().from(meetings)
    .where(and(
      gte(meetings.scheduledAt, sevenDaysAgo),
      lt(meetings.scheduledAt, new Date())
    )).limit(10);

  // Visitors
  const highIntentVisitors = await db.select().from(visitorWatchlist)
    .where(gte(visitorWatchlist.visitCount, 2))
    .orderBy(desc(visitorWatchlist.lastSeen)).limit(5);

  return {
    seo: { keywordChanges, openIssues },
    content: { pendingDrafts, pendingMeta },
    leads: { newLeads, hotLeads, convertedLeads, repliedLeads, deadLeads },
    campaigns: { activeCampaigns, pendingCampaigns },
    outreach: { emailsSent, smsSent, waSent, replies, recentActivity: recentActivity.slice(0, 20) },
    meetings: { upcoming: upcomingMeetings, past: pastMeetings },
    visitors: { highIntent: highIntentVisitors },
  };
}

// ─── Generate brief ───────────────────────────────────────────────────────────

export async function generateWeeklyBrief(): Promise<void> {
  console.log("[StrategyBrief] Generating weekly strategy brief...");

  const data = await aggregateData();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Build data prompt
  const prompt = `Generate the weekly strategy brief for Jamie. Today is ${today}.

=== SEO SNAPSHOT ===
Keyword ranking changes (last 7 days): ${data.seo.keywordChanges.length} tracked
- Improving: ${data.seo.keywordChanges.filter(k => (k.delta || 0) > 0).length}
- Declining: ${data.seo.keywordChanges.filter(k => (k.delta || 0) < 0).length}
Open SEO issues: ${data.seo.openIssues.length} (${data.seo.openIssues.filter(i => i.severity === "critical").length} critical)

=== CONTENT ENGINE ===
Pending blog drafts awaiting approval: ${data.content.pendingDrafts.length}
Draft titles: ${data.content.pendingDrafts.slice(0, 3).map(d => `"${d.title}"`).join(", ")}
Pending meta optimization suggestions: ${data.content.pendingMeta.length} pages

=== LEAD GEN ===
New leads added this week: ${data.leads.newLeads.length}
Hot leads (score ≥7, active): ${data.leads.hotLeads.length}
Leads who replied this week: ${data.leads.repliedLeads.length}
Leads converted this week: ${data.leads.convertedLeads.length}
Leads gone dead this week: ${data.leads.deadLeads.length}
Top new leads: ${data.leads.newLeads.slice(0, 3).map(l => `${l.fullName} (${l.category}, score ${l.score})`).join("; ")}

=== OUTREACH ===
Emails sent: ${data.outreach.emailsSent}
SMS sent: ${data.outreach.smsSent}
WhatsApp sent: ${data.outreach.waSent}
Total replies: ${data.outreach.replies}
Active campaigns: ${data.campaigns.activeCampaigns.length}
Campaigns pending approval: ${data.campaigns.pendingCampaigns.length}

=== MEETINGS ===
Upcoming meetings: ${data.meetings.upcoming.length}
${data.meetings.upcoming.slice(0, 3).map(m => `- ${m.inviteeName || "Lead"} on ${m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "TBD"}`).join("\n")}
Past meetings last 7 days: ${data.meetings.past.length}
Past meetings with outcomes: ${data.meetings.past.filter(m => m.outcome).length}

=== VISITOR INTELLIGENCE ===
High-intent anonymous visitors: ${data.visitors.highIntent.length}

---

Write the brief in this exact structure:

SECTION 1 — THIS WEEK AT A GLANCE
[3-4 sentence executive summary of the most important things]

SECTION 2 — TOP 3 PRIORITIES THIS WEEK
[Numbered list of exactly 3 concrete actions with deadlines]

SECTION 3 — WINS
[Bullet list of actual wins, 3-5 items, only if data supports them]

SECTION 4 — LEAD GEN ACTIONS NEEDED
[Specific leads or campaigns that need Jamie's decision]

SECTION 5 — SEO & CONTENT ACTIONS
[Specific drafts or issues that need approval or attention]

SECTION 6 — WATCH LIST
[Anything that needs monitoring but not immediate action]

Use actual data — don't fabricate numbers. If data is thin in an area, say so and suggest what to improve.`;

  const briefContent = await callOpenAI(prompt);

  // Format as HTML email
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; background: #f5f5f5;">
      <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 100%); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0 0 6px; font-size: 24px;">📋 Weekly Strategy Brief</h1>
          <p style="color: #93b4d6; margin: 0; font-size: 14px;">New Dawn Franchising — ${today}</p>
        </div>

        <!-- Quick stats -->
        <div style="display: flex; border-bottom: 1px solid #f0f0f0; background: #fafafa;">
          ${[
            { label: "New Leads", value: data.leads.newLeads.length },
            { label: "Replies", value: data.outreach.replies },
            { label: "Meetings", value: data.meetings.upcoming.length },
            { label: "Drafts Pending", value: data.content.pendingDrafts.length },
          ].map(s => `
            <div style="flex: 1; padding: 20px; text-align: center; border-right: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1a2a4a;">${s.value}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${s.label}</p>
            </div>
          `).join("")}
        </div>

        <!-- Brief content -->
        <div style="padding: 32px;">
          <div style="line-height: 1.8; color: #374151; white-space: pre-wrap; font-size: 15px;">${briefContent.replace(/\n/g, "<br>").replace(/={3,}/g, '<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">')}</div>
        </div>

        <!-- CTA -->
        <div style="padding: 24px; background: #f8fafc; text-align: center; border-top: 1px solid #e5e7eb;">
          <a href="https://www.newdawnfranchising.com/agent" style="background: #1a2a4a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Open Portal →</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const subject = `📋 New Dawn Franchising — Weekly Strategy Brief [${today}]`;

  // Save brief to DB
  const [brief] = await db.insert(briefs).values({
    subject,
    htmlBody,
    prioritiesCount: 3,
    winsCount: data.leads.convertedLeads.length,
    deliveryStatus: "pending",
  }).returning();

  // Send via email queue
  emailQueue.add({
    to: JAMIE_EMAIL,
    from: FROM_EMAIL,
    subject,
    html: htmlBody,
    priority: "HIGH",
    metadata: { briefId: brief.id },
  });

  await db.update(briefs).set({ deliveredAt: new Date(), deliveryStatus: "sent" }).where(eq(briefs.id, brief.id));
  console.log(`[StrategyBrief] Weekly brief sent for ${today}`);
}
