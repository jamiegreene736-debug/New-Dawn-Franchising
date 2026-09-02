import { db } from "./db";
import { meetings, outreachLeads } from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { emit, on } from "./core/event-bus";
import { emailQueue } from "./core/email-queue";
import { notifications } from "./core/notifications";

const JAMIE_EMAIL = "jamie.greene736@gmail.com";
const FROM_EMAIL = "franchising@newdawnfranchising.com";

// ─── AI helper ────────────────────────────────────────────────────────────────

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
      max_tokens: 1500,
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || "No response.";
}

const MEETING_SYSTEM = `You are a strategic business intelligence assistant for New Dawn Franchising (E-2 visa property management franchise, $225K minimum investment, El Paso TX). You help prepare Dylan and Jamie for meetings with potential referral partners. Be specific, professional, and actionable.`;

// ─── Classify reply intent ─────────────────────────────────────────────────────

export async function classifyReplyIntent(replyText: string): Promise<{
  intent: "positive" | "neutral" | "objection" | "unsubscribe" | "out_of_office";
  objectionType?: string;
}> {
  const prompt = `Classify this reply from a potential referral partner for an E-2 visa property management franchise:

"${replyText}"

Reply with exactly one word from: POSITIVE, NEUTRAL, OBJECTION_COST, OBJECTION_ELIGIBILITY, OBJECTION_LOCATION, OBJECTION_OPERATIONAL, UNSUBSCRIBE, OUT_OF_OFFICE

Only reply with that single classification word.`;

  try {
    const result = await callOpenAI(prompt, MEETING_SYSTEM);
    const classification = result.trim().toUpperCase();
    if (classification.startsWith("POSITIVE")) return { intent: "positive" };
    if (classification.startsWith("UNSUBSCRIBE")) return { intent: "unsubscribe" };
    if (classification.startsWith("OUT_OF_OFFICE")) return { intent: "out_of_office" };
    if (classification.startsWith("OBJECTION")) {
      const objType = classification.split("_").slice(1).join("_").toLowerCase();
      return { intent: "objection", objectionType: objType };
    }
    return { intent: "neutral" };
  } catch {
    return { intent: "neutral" };
  }
}

// ─── Generate pre-meeting intelligence brief ──────────────────────────────────

export async function generatePreMeetingBrief(meetingId: string): Promise<void> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
  if (!meeting) return;

  let lead: any = null;
  if (meeting.leadId) {
    const leads = await db.select().from(outreachLeads).where(eq(outreachLeads.id, meeting.leadId));
    lead = leads[0] || null;
  }

  const meetingDate = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })
    : "Scheduled";

  const CATEGORY_TALKING_POINTS: Record<string, string> = {
    immigration_attorney: "Focus on: E-2 visa compliance, operational structure that satisfies 'direct and control' requirement, immigration timeline from FDD signing to visa approval, in-house legal review process.",
    relocation_consultant: "Focus on: Making the franchise turnkey for their clients, territory exclusivity in El Paso, lifestyle fit for international families, bilingual support.",
    franchise_broker: "Focus on: Commission structure, FDD availability, comparison to other E-2 qualifying franchises, brand strength.",
    real_estate: "Focus on: Property management franchise synergy, cross-referral opportunities, El Paso market conditions.",
    wealth_manager: "Focus on: ROI projections, capital deployment structure, exit strategy options, operational income potential.",
    default: "Focus on: E-2 visa qualification, $225K investment structure, operational model, El Paso market opportunity.",
  };

  const talkingPoints = CATEGORY_TALKING_POINTS[lead?.category || "default"] || CATEGORY_TALKING_POINTS.default;

  const briefHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #1a2a4a; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">📋 Pre-Meeting Intelligence Brief</h1>
        <p style="color: #93b4d6; margin: 4px 0 0;">${meetingDate}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: 0;">
        ${lead ? `
        <h2 style="color: #1a2a4a; font-size: 18px;">Lead Profile</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold; width: 140px;">Name</td><td style="padding: 6px 12px;">${lead.fullName}</td></tr>
          ${lead.title ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Title</td><td style="padding: 6px 12px;">${lead.title}</td></tr>` : ""}
          ${lead.company ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Company</td><td style="padding: 6px 12px;">${lead.company}</td></tr>` : ""}
          ${lead.email ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Email</td><td style="padding: 6px 12px;">${lead.email}</td></tr>` : ""}
          ${lead.phone ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Phone</td><td style="padding: 6px 12px;">${lead.phone}</td></tr>` : ""}
          <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Category</td><td style="padding: 6px 12px;">${lead.category || "—"}</td></tr>
          <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Score</td><td style="padding: 6px 12px;">${lead.score}/10</td></tr>
          <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: bold;">Status</td><td style="padding: 6px 12px;">${lead.status}</td></tr>
        </table>
        ` : `<p style="color: #6b7280;">Meeting with: ${meeting.inviteeName || "Unknown"} (${meeting.inviteeEmail || ""})</p>`}

        <h2 style="color: #1a2a4a; font-size: 18px;">💬 Suggested Talking Points</h2>
        <p style="line-height: 1.7; color: #374151;">${talkingPoints}</p>

        <h2 style="color: #1a2a4a; font-size: 18px;">❓ Common Objections to Anticipate</h2>
        <ul style="line-height: 1.9; color: #374151;">
          <li><strong>Cost:</strong> "$225K is above the E-2 minimum in many cases, but it signals a genuine investment and avoids USCIS scrutiny — plus it's backed by our buy-back program."</li>
          <li><strong>Location:</strong> "El Paso is a prime market — border city with strong bilingual workforce, affordable operations, and consistent rental demand."</li>
          <li><strong>Operational:</strong> "The franchise provides the platform, vendors, and oversight structure so the investor can satisfy 'direct and control' without managing properties day-to-day."</li>
          <li><strong>Eligibility:</strong> "We have experience with multiple nationality E-2 treaty countries — let's confirm eligibility on the call."</li>
        </ul>

        ${lead?.notes ? `<h2 style="color: #1a2a4a; font-size: 18px;">📝 Notes</h2><p style="line-height: 1.7; color: #374151;">${lead.notes}</p>` : ""}

        <div style="background: #f0f9ff; border-left: 4px solid #1a2a4a; padding: 16px; margin-top: 20px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #1a2a4a; font-weight: bold;">Meeting Goal</p>
          <p style="margin: 4px 0 0; color: #374151;">Qualify referral fit, explain the partnership model, offer to send the FDD for their review. Book a follow-up if interested.</p>
        </div>

        <p style="margin-top: 24px; text-align: center;">
          <a href="https://www.newdawnfranchising.com/agent?section=pipeline" style="background: #1a2a4a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Full Lead Profile →</a>
        </p>
      </div>
    </div>
  `;

  emailQueue.add({
    to: JAMIE_EMAIL,
    from: FROM_EMAIL,
    subject: `📋 Pre-Meeting Brief: ${lead?.fullName || meeting.inviteeName || "Meeting"} — ${meetingDate}`,
    html: briefHtml,
    priority: "HIGH",
  });

  await db.update(meetings).set({ briefSentAt: new Date() }).where(eq(meetings.id, meetingId));
  console.log(`[Meetings] Pre-meeting brief sent for meeting ${meetingId}`);
}

// ─── Handle meeting booked (from Calendly webhook) ────────────────────────────

export async function handleMeetingBooked(data: {
  calendlyEventId: string;
  inviteeName: string;
  inviteeEmail: string;
  scheduledAt: Date;
  leadId?: string;
}): Promise<string> {
  // Find or match lead
  let leadId = data.leadId;
  if (!leadId && data.inviteeEmail) {
    const leads = await db.select().from(outreachLeads).where(eq(outreachLeads.email, data.inviteeEmail));
    leadId = leads[0]?.id;
  }

  const [meeting] = await db.insert(meetings).values({
    leadId: leadId,
    calendlyEventId: data.calendlyEventId,
    scheduledAt: data.scheduledAt,
    inviteeName: data.inviteeName,
    inviteeEmail: data.inviteeEmail,
    status: "confirmed",
  }).returning();

  // Update lead status
  if (leadId) {
    await db.update(outreachLeads).set({ status: "active" }).where(eq(outreachLeads.id, leadId));
  }

  emit("meeting:booked", {
    meetingId: meeting.id,
    leadId: leadId || "",
    scheduledAt: data.scheduledAt,
    calendlyEventId: data.calendlyEventId,
  });

  try {
    const { markQueueBookedByEmail } = await import("./call-queue-service");
    if (data.inviteeEmail) await markQueueBookedByEmail(data.inviteeEmail, meeting.id);
  } catch (err: any) {
    console.error("[Meetings] call-queue book mark failed:", err?.message || err);
  }

  return meeting.id;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

on("meeting:booked", async (payload) => {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, payload.meetingId));
  const leads = payload.leadId ? await db.select().from(outreachLeads).where(eq(outreachLeads.id, payload.leadId)) : [];
  const lead = leads[0];

  const scheduledStr = payload.scheduledAt
    ? new Date(payload.scheduledAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })
    : "TBD";

  // 1. Immediate Jamie alert
  emailQueue.add({
    to: JAMIE_EMAIL,
    from: FROM_EMAIL,
    subject: `📅 Meeting Booked: ${lead?.fullName || meeting?.inviteeName || "New Meeting"} — ${scheduledStr}`,
    html: `
      <h2>A meeting has been booked!</h2>
      <p><strong>Name:</strong> ${lead?.fullName || meeting?.inviteeName}</p>
      <p><strong>Email:</strong> ${lead?.email || meeting?.inviteeEmail}</p>
      ${lead?.company ? `<p><strong>Company:</strong> ${lead.company}</p>` : ""}
      ${lead?.category ? `<p><strong>Category:</strong> ${lead.category}</p>` : ""}
      ${lead?.score !== undefined ? `<p><strong>Lead Score:</strong> ${lead.score}/10</p>` : ""}
      <p><strong>Meeting Time:</strong> ${scheduledStr}</p>
      <p><a href="https://www.newdawnfranchising.com/agent?section=meetings" style="background: #1a2a4a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Meeting →</a></p>
    `,
    priority: "CRITICAL",
  });

  // 2. Confirmation to lead
  if (lead?.email || meeting?.inviteeEmail) {
    emailQueue.add({
      to: lead?.email || meeting?.inviteeEmail || "",
      from: FROM_EMAIL,
      subject: `Meeting Confirmed — New Dawn Franchising`,
      html: `
        <p>Dear ${lead?.fullName || meeting?.inviteeName || ""},</p>
        <p>Your meeting with New Dawn Franchising is confirmed for <strong>${scheduledStr}</strong>.</p>
        <p>New Dawn Franchising is a U.S. property management franchise designed specifically for E-2 visa investors. We look forward to discussing how we might work together.</p>
        <p>In the meantime, feel free to explore our website: <a href="https://www.newdawnfranchising.com">www.newdawnfranchising.com</a></p>
        <p>Best regards,<br>New Dawn Franchising Team</p>
      `,
      priority: "NORMAL",
    });
  }

  // 3. Portal notification
  await notifications.create({
    type: "meeting_booked",
    system: "meetings",
    title: "Meeting Booked",
    message: `${lead?.fullName || meeting?.inviteeName} — ${scheduledStr}`,
    leadId: payload.leadId,
    actionUrl: "/agent?section=meetings",
  });

  // 4. Schedule pre-meeting brief for 24 hours before
  if (payload.scheduledAt) {
    const briefAt = new Date(new Date(payload.scheduledAt).getTime() - 24 * 60 * 60 * 1000);
    const msUntilBrief = briefAt.getTime() - Date.now();
    if (msUntilBrief > 0) {
      setTimeout(() => generatePreMeetingBrief(payload.meetingId), msUntilBrief);
      console.log(`[Meetings] Pre-meeting brief scheduled for ${briefAt.toISOString()}`);
    }
  }
});

on("meeting:cancelled", async (payload) => {
  await db.update(meetings).set({ status: "cancelled" }).where(eq(meetings.id, payload.meetingId));

  const leads = payload.leadId ? await db.select().from(outreachLeads).where(eq(outreachLeads.id, payload.leadId)) : [];
  const lead = leads[0];

  emailQueue.add({
    to: JAMIE_EMAIL,
    from: FROM_EMAIL,
    subject: `Meeting Cancelled: ${lead?.fullName || "Lead"}`,
    html: `<p>The meeting with <strong>${lead?.fullName || "a lead"}</strong> has been cancelled.</p><p><a href="https://www.newdawnfranchising.com/agent?section=meetings">View portal →</a></p>`,
    priority: "HIGH",
  });

  await notifications.create({
    type: "meeting_cancelled",
    system: "meetings",
    title: "Meeting Cancelled",
    message: `${lead?.fullName || "Lead"} cancelled their meeting`,
    leadId: payload.leadId,
  });
});

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function getMeetings(limit = 50): Promise<any[]> {
  return db.select().from(meetings).orderBy(desc(meetings.scheduledAt)).limit(limit);
}

export async function updateMeetingOutcome(id: string, outcome: string, notes?: string): Promise<any> {
  const [m] = await db.update(meetings).set({ outcome, status: "completed", notes }).where(eq(meetings.id, id)).returning();
  return m;
}

export async function getUpcomingMeetings(): Promise<any[]> {
  return db.select().from(meetings)
    .where(and(gte(meetings.scheduledAt, new Date()), eq(meetings.status, "confirmed")))
    .orderBy(meetings.scheduledAt)
    .limit(20);
}
