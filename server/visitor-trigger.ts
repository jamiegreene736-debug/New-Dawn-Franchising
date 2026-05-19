import { db } from "./db";
import { visitorEvents, visitorWatchlist, outreachLeads } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { emit, on } from "./core/event-bus";
import { emailQueue } from "./core/email-queue";
import { notifications } from "./core/notifications";

const JAMIE_EMAIL = "jamie.greene736@gmail.com";
const FROM_EMAIL = "franchising@newdawnfranchising.com";

const HIGH_INTENT_PATHS = ["/fdd", "/investment", "/contact", "/how-it-works", "/quiz", "/territories", "/process"];

// Debounce queue per session (500ms)
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Track a visit event ──────────────────────────────────────────────────────

export async function trackVisit(event: {
  sessionId: string;
  fingerprint?: string;
  pageUrl: string;
  referralSource?: string;
  utmSource?: string;
  utmCampaign?: string;
  timeOnPageSeconds?: number;
  leadId?: string;
}): Promise<void> {
  const key = `${event.sessionId}:${event.pageUrl}`;
  if (pendingWrites.has(key)) clearTimeout(pendingWrites.get(key)!);

  const timer = setTimeout(async () => {
    pendingWrites.delete(key);
    try {
      await db.insert(visitorEvents).values({
        sessionId: event.sessionId,
        fingerprint: event.fingerprint,
        pageUrl: event.pageUrl,
        referralSource: event.referralSource,
        utmSource: event.utmSource,
        utmCampaign: event.utmCampaign,
        timeOnPageSeconds: event.timeOnPageSeconds,
        leadId: event.leadId,
        visitedAt: new Date(),
      });
      await processVisitorSignal(event);
    } catch (err: any) {
      console.error("[VisitorTrigger] Write failed:", err.message);
    }
  }, 500);
  pendingWrites.set(key, timer);
}

// ─── Process visitor signal ────────────────────────────────────────────────────

async function processVisitorSignal(event: { sessionId: string; fingerprint?: string; pageUrl: string; leadId?: string }): Promise<void> {
  const pathPart = new URL(event.pageUrl.startsWith("http") ? event.pageUrl : `https://x.com${event.pageUrl}`).pathname;
  const isHighIntent = HIGH_INTENT_PATHS.some(p => pathPart.startsWith(p)) || pathPart.includes("form") || pathPart.includes("contact");

  if (!isHighIntent || !event.fingerprint) return;

  const fp = event.fingerprint;

  // Update watchlist
  const existing = await db.select().from(visitorWatchlist).where(eq(visitorWatchlist.fingerprint, fp));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (existing.length === 0) {
    await db.insert(visitorWatchlist).values({
      fingerprint: fp,
      pagesVisited: [event.pageUrl],
      visitCount: 1,
      status: "watching",
      leadId: event.leadId,
    });
  } else {
    const entry = existing[0];
    const pages = [...new Set([...(entry.pagesVisited || []), event.pageUrl])];
    const newCount = (entry.visitCount || 0) + 1;
    await db.update(visitorWatchlist)
      .set({ pagesVisited: pages, visitCount: newCount, lastSeen: new Date(), leadId: event.leadId || entry.leadId })
      .where(eq(visitorWatchlist.fingerprint, fp));

    // Method 3: Return visitor scoring — 2+ visits to high-intent pages in 7 days
    if (newCount >= 2 && entry.firstSeen && entry.firstSeen >= sevenDaysAgo && entry.status === "watching") {
      await db.update(visitorWatchlist).set({ status: "high_intent" }).where(eq(visitorWatchlist.fingerprint, fp));
      emit("visitor:high_intent", {
        fingerprint: fp,
        pageUrl: event.pageUrl,
        visitCount: newCount,
        sessionId: event.sessionId,
      });
    }
  }
}

// ─── Identify visitor via form submission ──────────────────────────────────────

export async function identifyVisitorByForm(params: {
  sessionId: string;
  fingerprint?: string;
  name: string;
  email: string;
  leadId?: string;
}): Promise<void> {
  let leadId = params.leadId;

  // Find or create lead
  if (!leadId) {
    const existing = await db.select().from(outreachLeads).where(eq(outreachLeads.email, params.email));
    if (existing.length > 0) {
      leadId = existing[0].id;
    } else {
      const [newLead] = await db.insert(outreachLeads).values({
        fullName: params.name,
        email: params.email,
        status: "new",
        score: 5,
        category: "website_visitor",
      }).returning();
      leadId = newLead.id;
      emit("lead:created", {
        leadId: newLead.id,
        name: params.name,
        company: "",
        category: "website_visitor",
        score: 5,
        source: "form_submission",
      });
    }
  }

  // Link session to lead
  if (params.fingerprint) {
    await db.update(visitorWatchlist)
      .set({ leadId, status: "identified" })
      .where(eq(visitorWatchlist.fingerprint, params.fingerprint));
  }

  // Get session history
  const history = await db.select().from(visitorEvents)
    .where(eq(visitorEvents.sessionId, params.sessionId))
    .orderBy(desc(visitorEvents.visitedAt))
    .limit(20);

  emit("visitor:identified", {
    leadId: leadId!,
    fingerprint: params.fingerprint || params.sessionId,
    sessionHistory: history,
    identifiedVia: "form_submission",
  });
}

// ─── Identify via email link click ─────────────────────────────────────────────

export async function identifyVisitorByEmailClick(params: {
  leadId: string;
  sessionId: string;
  fingerprint?: string;
}): Promise<void> {
  if (params.fingerprint) {
    await db.update(visitorWatchlist)
      .set({ leadId: params.leadId, status: "identified" })
      .where(eq(visitorWatchlist.fingerprint, params.fingerprint));
  }

  const history = await db.select().from(visitorEvents)
    .where(eq(visitorEvents.sessionId, params.sessionId)).limit(20);

  emit("visitor:identified", {
    leadId: params.leadId,
    fingerprint: params.fingerprint || params.sessionId,
    sessionHistory: history,
    identifiedVia: "email_click",
  });
}

// ─── Event listeners ──────────────────────────────────────────────────────────

on("visitor:identified", async (payload) => {
  const lead = await db.select().from(outreachLeads).where(eq(outreachLeads.id, payload.leadId));
  if (!lead.length) return;
  const l = lead[0];

  await notifications.create({
    type: "visitor_identified",
    system: "visitor_trigger",
    title: "Visitor Identified",
    message: `${l.fullName || l.email} identified via ${payload.identifiedVia}`,
    leadId: payload.leadId,
    actionUrl: "/agent?section=pipeline",
  });

  // Routing logic
  if (l.status === "new") {
    await db.update(outreachLeads).set({ status: "active" }).where(eq(outreachLeads.id, payload.leadId));
  }

  // If confirmed partner — alert Jamie
  if (l.category !== "website_visitor" && (l.score || 0) >= 7) {
    emailQueue.add({
      to: JAMIE_EMAIL,
      from: FROM_EMAIL,
      subject: `🔥 Visitor Alert: ${l.fullName || l.email} just visited the site`,
      html: `
        <h2>Partner Visitor Alert</h2>
        <p><strong>${l.fullName}</strong> (${l.company || l.category}) just visited the site via ${payload.identifiedVia}.</p>
        <p><strong>Pages visited:</strong> ${payload.sessionHistory.map((v: any) => v.pageUrl).join(", ")}</p>
        <p><strong>Lead score:</strong> ${l.score}/10</p>
        <p><a href="https://www.newdawnfranchising.com/agent?section=pipeline">View in portal →</a></p>
      `,
      priority: "HIGH",
    });
  }
});

on("visitor:high_intent", async (payload) => {
  await notifications.create({
    type: "visitor_high_intent",
    system: "visitor_trigger",
    title: "High-Intent Anonymous Visitor",
    message: `Anonymous visitor (${payload.visitCount} visits) on ${payload.pageUrl}`,
    actionUrl: "/agent?section=pipeline",
  });
});

// ─── API data helpers ──────────────────────────────────────────────────────────

export async function getLiveVisitors(limit = 30): Promise<any[]> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  return db.select().from(visitorEvents)
    .where(gte(visitorEvents.visitedAt, fiveMinAgo))
    .orderBy(desc(visitorEvents.visitedAt))
    .limit(limit);
}

export async function getIdentifiedVisitors(limit = 50): Promise<any[]> {
  return db.select().from(visitorWatchlist)
    .where(eq(visitorWatchlist.status, "identified"))
    .orderBy(desc(visitorWatchlist.lastSeen))
    .limit(limit);
}

export async function getWatchlist(limit = 50): Promise<any[]> {
  return db.select().from(visitorWatchlist)
    .where(and(
      sql`${visitorWatchlist.status} IN ('watching', 'high_intent')`,
      gte(visitorWatchlist.visitCount, 2)
    ))
    .orderBy(desc(visitorWatchlist.visitCount))
    .limit(limit);
}
