import type { Express, Request, Response } from "express";
import {
  attachQuoCall,
  backfillCallQueue,
  ensureCallQueueSchema,
  getCallQueueItem,
  getCallQueueStats,
  listCallQueue,
  markDialing,
  recordCallOutcome,
  scanEngagedOpens,
  scanRepliesWithoutMeetings,
  sendCalendlyLink,
} from "./call-queue-service";

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export function registerCallQueueRoutes(app: Express) {
  app.get("/api/crm/call-queue", requireAdminAuth, async (req, res) => {
    try {
      const view = req.query.view === "history" ? "history" : "today";
      const items = await listCallQueue({
        view,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        triggerType: typeof req.query.triggerType === "string" ? req.query.triggerType : undefined,
        assignedTo: typeof req.query.assignedTo === "string" ? req.query.assignedTo : undefined,
      });
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to load call queue" });
    }
  });

  app.get("/api/crm/call-queue/stats", requireAdminAuth, async (req, res) => {
    try {
      const since = typeof req.query.since === "string" ? new Date(req.query.since) : undefined;
      res.json(await getCallQueueStats(since && !Number.isNaN(since.getTime()) ? since : undefined));
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to load stats" });
    }
  });

  app.get("/api/crm/call-queue/:id", requireAdminAuth, async (req, res) => {
    try {
      const item = await getCallQueueItem(String(req.params.id));
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to load item" });
    }
  });

  app.post("/api/crm/call-queue/:id/dial", requireAdminAuth, async (req, res) => {
    try {
      const item = await markDialing(String(req.params.id));
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to mark dialing" });
    }
  });

  app.post("/api/crm/call-queue/:id/calendly-sms", requireAdminAuth, async (req, res) => {
    try {
      const result = await sendCalendlyLink(String(req.params.id));
      if (!result.success) return res.status(400).json({ message: result.error || "SMS failed" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send Calendly SMS" });
    }
  });

  app.patch("/api/crm/call-queue/:id", requireAdminAuth, async (req, res) => {
    try {
      const status = String(req.body?.status || "");
      const allowed = [
        "queued", "calling", "no_answer", "voicemail", "callback",
        "not_interested", "booked", "dnc", "wrong_number",
      ];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid outcome status" });
      }
      const item = await recordCallOutcome(String(req.params.id), {
        status,
        notes: req.body?.notes ? String(req.body.notes) : undefined,
        interestLevel: req.body?.interestLevel ? String(req.body.interestLevel) : undefined,
        scheduledAt: req.body?.scheduledAt || null,
        durationSeconds: req.body?.durationSeconds ?? null,
        phoneCallId: req.body?.phoneCallId || null,
      });
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to save outcome" });
    }
  });

  app.post("/api/crm/call-queue/backfill", requireAdminAuth, async (_req, res) => {
    try {
      const result = await backfillCallQueue();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Backfill failed" });
    }
  });

  app.post("/api/crm/call-queue/scan", requireAdminAuth, async (_req, res) => {
    try {
      const [opens, replies] = await Promise.all([scanEngagedOpens(), scanRepliesWithoutMeetings()]);
      res.json({ opens, replies });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Scan failed" });
    }
  });
}

export { attachQuoCall, ensureCallQueueSchema };
