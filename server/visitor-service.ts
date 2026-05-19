import { db } from "./db";
import { visitorSessions, visitorPageViews } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

// ─── IP enrichment via ip-api.com (free, no key required) ───────────────────

interface IpInfo {
  country: string | null;
  city: string | null;
  region: string | null;
  org: string | null;
  isp: string | null;
}

const ipCache = new Map<string, IpInfo>();

export async function lookupIp(ip: string): Promise<IpInfo> {
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127")) {
    return { country: "Local", city: "Localhost", region: null, org: null, isp: null };
  }
  const cleanIp = ip.replace("::ffff:", "");
  if (ipCache.has(cleanIp)) return ipCache.get(cleanIp)!;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=country,city,regionName,org,isp`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return { country: null, city: null, region: null, org: null, isp: null };
    const data = await res.json() as { country?: string; city?: string; regionName?: string; org?: string; isp?: string };
    const info: IpInfo = {
      country: data.country || null,
      city: data.city || null,
      region: data.regionName || null,
      org: data.org || null,
      isp: data.isp || null,
    };
    ipCache.set(cleanIp, info);
    return info;
  } catch {
    return { country: null, city: null, region: null, org: null, isp: null };
  }
}

// ─── Device detection from User-Agent ────────────────────────────────────────

export function detectDevice(ua: string): string {
  if (!ua) return "Unknown";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "Mobile";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Desktop";
}

// ─── Upsert session ───────────────────────────────────────────────────────────

export async function upsertSession(
  sessionId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  const device = detectDevice(userAgent);
  const ipInfo = await lookupIp(ip);

  const existing = await db
    .select({ id: visitorSessions.id })
    .from(visitorSessions)
    .where(eq(visitorSessions.sessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(visitorSessions)
      .set({ lastSeen: new Date(), ip, userAgent, device, ...ipInfo })
      .where(eq(visitorSessions.sessionId, sessionId));
  } else {
    await db.insert(visitorSessions).values({
      sessionId,
      ip,
      userAgent,
      device,
      ...ipInfo,
    });
  }
}

// ─── Record a page view ───────────────────────────────────────────────────────

export async function recordPageView(
  sessionId: string,
  path: string,
  title: string,
  referrer: string
): Promise<void> {
  await db.insert(visitorPageViews).values({ sessionId, path, title, referrer });
  await db
    .update(visitorSessions)
    .set({
      lastSeen: new Date(),
      pageViewCount: sql`${visitorSessions.pageViewCount} + 1`,
    })
    .where(eq(visitorSessions.sessionId, sessionId));
}

// ─── Update duration (heartbeat) ─────────────────────────────────────────────

export async function updateDuration(sessionId: string, seconds: number): Promise<void> {
  await db
    .update(visitorSessions)
    .set({
      lastSeen: new Date(),
      totalDuration: sql`${visitorSessions.totalDuration} + ${seconds}`,
    })
    .where(eq(visitorSessions.sessionId, sessionId));
}

// ─── Get sessions with their page views ──────────────────────────────────────

export async function getVisitorSessions(limit = 100) {
  const sessions = await db
    .select()
    .from(visitorSessions)
    .orderBy(desc(visitorSessions.lastSeen))
    .limit(limit);

  const sessionIds = sessions.map((s) => s.sessionId);
  const pageViews = sessionIds.length
    ? await db
        .select()
        .from(visitorPageViews)
        .where(sql`${visitorPageViews.sessionId} = ANY(${sessionIds})`)
        .orderBy(desc(visitorPageViews.viewedAt))
    : [];

  const pvBySession = new Map<string, typeof pageViews>();
  for (const pv of pageViews) {
    if (!pvBySession.has(pv.sessionId)) pvBySession.set(pv.sessionId, []);
    pvBySession.get(pv.sessionId)!.push(pv);
  }

  return sessions.map((s) => ({
    ...s,
    pages: pvBySession.get(s.sessionId) || [],
  }));
}
