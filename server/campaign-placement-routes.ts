import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { placementOverview, startPlacementTest, refreshPlacementTest, cancelPlacementTest } from "./campaign-placement-service";
import { PlacementError } from "./glockapps-service";
const startSchema = z.object({ stepId: z.string().min(1).max(100), requestId: z.string().uuid(), reason: z.string().trim().max(500).default("") }).strict();
export function registerCampaignPlacementRoutes(app: Express, auth: RequestHandler) {
  const base = "/api/crm/campaigns/:id/placement-tests";
  app.get(base, auth, async (req,res) => {
    res.setHeader("Cache-Control", "no-store");
    try { res.json(await placementOverview(String(req.params.id))); }
    catch (e) { res.status(e instanceof PlacementError ? e.status : 503).json({ message: e instanceof PlacementError ? e.message : "Could not load inbox placement tests." }); }
  });
  app.post(base, auth, async (req,res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Select a saved email and provide a valid test request." });
    try { const v=parsed.data; res.status(202).json({ id: await startPlacementTest(String(req.params.id),v.stepId,v.requestId,v.reason) }); }
    catch (e) { res.status(e instanceof PlacementError ? e.status : 503).json({ message: e instanceof PlacementError ? e.message : "Test preparation could not be confirmed. Refresh before retrying." }); }
  });
  for (const action of ["refresh", "cancel"] as const) app.post(`${base}/:testId/${action}`,auth,async (req,res) => {
    if (!z.string().uuid().safeParse(req.params.testId).success) return res.status(400).json({ message: "Invalid test ID." });
    try {
      await (action === "refresh" ? refreshPlacementTest : cancelPlacementTest)(String(req.params.id),String(req.params.testId));
      res.json({ ok: true });
    } catch (e) { res.status(e instanceof PlacementError ? e.status : 503).json({ message: e instanceof PlacementError ? e.message : "The test could not be updated. No emails were resent." }); }
  });
}
