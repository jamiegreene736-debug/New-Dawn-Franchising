import { Router } from "express";

import {
  mobileBootstrapResponseSchema,
  mobileStatusResponseSchema,
} from "@shared/mobile/contracts";

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

mobileRouter.get("/bootstrap", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const response = mobileBootstrapResponseSchema.parse({
    apiVersion: "v1",
    availability: "prelaunch",
    minimumAppVersion: "1.0.0",
    supportedLocales: ["en", "es"],
    features: {
      authentication: false,
      investorAccounts: false,
      partnerAccounts: false,
      attorneyAccounts: false,
    },
    security: {
      accessTokenExpiresInSeconds: 600,
      refreshTokenRotationRequired: true,
    },
    requestId: res.locals.requestId,
  });

  return res.json(response);
});

export default mobileRouter;
