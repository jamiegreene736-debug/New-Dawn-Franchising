import { Router } from "express";

import { mobileStatusResponseSchema } from "@shared/mobile/contracts";

const mobileRouter = Router();

mobileRouter.get("/status", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const response = mobileStatusResponseSchema.parse({
    apiVersion: "v1",
    availability: "prelaunch",
    minimumAppVersion: "1.0.0",
    requestId: res.locals.requestId,
  });

  return res.json(response);
});

export default mobileRouter;
