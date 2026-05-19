import { db } from "./db";
import { visitorSessions, visitorPageViews, crmClients } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { upsertSession, recordPageView, updateDuration, getVisitorSessions } from "./visitor-service";
import { apolloSearchByCompanyName } from "./apollo-service";

// ─── Private pages to never track ────────────────────────────────────────────
const SKIP_PATHS = ["/crm", "/login", "/seo", "/marketing", "/api"];

function shouldSkip(path: string) {
  return SKIP_PATHS.some((p) => path.startsWith(p));
}

function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.ip ||
    ""
  );
}

export function registerVisitorRoutes(app: any) {
  // ── Public: record a page view ──────────────────────────────────────────────
  app.post("/api/track/pageview", async (req: any, res: any) => {
    try {
      const { sessionId, path, title, referrer } = req.body as {
        sessionId: string;
        path: string;
        title: string;
        referrer: string;
      };
      if (!sessionId || !path || shouldSkip(path)) return res.json({ ok: true });

      const ip = getClientIp(req);
      const ua = req.headers["user-agent"] || "";

      // Fire enrichment + upsert in background — don't block response
      res.json({ ok: true });
      await upsertSession(sessionId, ip, ua);
      await recordPageView(sessionId, path, title || "", referrer || "");
    } catch (err) {
      res.json({ ok: true }); // always succeed silently
    }
  });

  // ── Public: heartbeat to update time-on-site ────────────────────────────────
  app.post("/api/track/heartbeat", async (req: any, res: any) => {
    try {
      const { sessionId, seconds } = req.body as { sessionId: string; seconds: number };
      if (!sessionId || !seconds) return res.json({ ok: true });
      res.json({ ok: true });
      await updateDuration(sessionId, Math.min(seconds, 60));
    } catch {
      res.json({ ok: true });
    }
  });

  // ── Admin: list all visitor sessions ────────────────────────────────────────
  app.get("/api/seo/visitors", async (req: any, res: any) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Admin required" });
    try {
      const limit = parseInt(req.query.limit as string || "200");
      const sessions = await getVisitorSessions(limit);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch visitors" });
    }
  });

  // ── Admin: manually identify a visitor ─────────────────────────────────────
  app.patch("/api/seo/visitors/:id/identify", async (req: any, res: any) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Admin required" });
    try {
      const { identifiedEmail, identifiedName, identifiedCompany } = req.body;
      const [updated] = await db
        .update(visitorSessions)
        .set({ identifiedEmail, identifiedName, identifiedCompany })
        .where(eq(visitorSessions.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update visitor" });
    }
  });

  // ── Admin: add visitor to CRM ───────────────────────────────────────────────
  app.post("/api/seo/visitors/:id/add-to-crm", async (req: any, res: any) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Admin required" });
    try {
      const [visitor] = await db
        .select()
        .from(visitorSessions)
        .where(eq(visitorSessions.id, req.params.id))
        .limit(1);
      if (!visitor) return res.status(404).json({ message: "Visitor not found" });

      const { fullName, email, notes } = req.body as { fullName?: string; email?: string; notes?: string };
      const name = fullName || visitor.identifiedName || "Website Visitor";
      const clientEmail = email || visitor.identifiedEmail || "";

      const [client] = await db
        .insert(crmClients)
        .values({
          fullName: name,
          email: clientEmail,
          country: visitor.country || "",
          status: "new_lead",
          notes: notes || `Website visitor — ${visitor.pageViewCount} pages viewed, ${Math.round((visitor.totalDuration || 0) / 60)} min on site. Company/ISP: ${visitor.org || visitor.isp || "Unknown"}`,
        })
        .returning();

      // Link the visitor session to the CRM client
      await db
        .update(visitorSessions)
        .set({ crmClientId: client.id })
        .where(eq(visitorSessions.id, visitor.id));

      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add to CRM" });
    }
  });

  // ── Admin: find people at visitor's company via Apollo ──────────────────────
  app.post("/api/seo/visitors/:id/find-people", async (req: any, res: any) => {
    if (!req.session?.adminId) return res.status(401).json({ message: "Admin required" });
    try {
      const [visitor] = await db
        .select()
        .from(visitorSessions)
        .where(eq(visitorSessions.id, String(req.params.id)))
        .limit(1);
      if (!visitor) return res.status(404).json({ message: "Visitor not found" });

      const companyName = visitor.identifiedCompany || visitor.org || visitor.isp;
      if (!companyName) return res.status(400).json({ message: "No company identified for this visitor" });

      const results = await apolloSearchByCompanyName(companyName, null, 10);
      res.json({
        companyName,
        location: [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", "),
        results,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to search company" });
    }
  });
}
