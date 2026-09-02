import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { ZodError, z } from "zod";

import {
  mobileAcceptedResponseSchema,
  mobileAuthenticatedResponseSchema,
  mobileBootstrapResponseSchema,
  mobileDeletionResponseSchema,
  mobileLoginRequestSchema,
  mobileLogoutRequestSchema,
  mobileMeResponseSchema,
  mobileOkResponseSchema,
  mobileRecoveryCompleteRequestSchema,
  mobileRecoveryRequestSchema,
  mobileRefreshRequestSchema,
  mobileRegisterRequestSchema,
  mobileSessionsResponseSchema,
  mobileStatusResponseSchema,
  mobilePathwayMilestoneKeySchema,
  mobilePathwayMilestoneResponseSchema,
  mobilePathwayResponseSchema,
  mobileVerificationResponseSchema,
  mobileVerifyEmailRequestSchema,
} from "@shared/mobile/contracts";

import { pool } from "../db";
import { MobileAccessTokenService } from "./access-tokens";
import { readMobileAuthRuntimeConfig } from "./auth-config";
import { PostgresMobileAuthRepository } from "./auth-repository";
import { MobileAuthService, MobileAuthServiceError } from "./auth-service";
import { createMobileApiError } from "./api-errors";
import { MobileAuthorizationError, requireMobileCapability } from "./authorization";
import { PostgresMobilePathwayRepository } from "./pathway-repository";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };
}

class MobileRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetsAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const now = Date.now();
      const key = `${req.ip}:${req.path}`;
      const current = this.attempts.get(key);
      const attempt = !current || current.resetsAt <= now
        ? { count: 1, resetsAt: now + this.windowMs }
        : { count: current.count + 1, resetsAt: current.resetsAt };
      this.attempts.set(key, attempt);

      if (attempt.count > this.limit) {
        res.setHeader("Retry-After", String(Math.ceil((attempt.resetsAt - now) / 1000)));
        res.status(429).json(createMobileApiError("RATE_LIMITED", res.locals.requestId, true));
        return;
      }
      next();
    };
  }
}

const authConfig = readMobileAuthRuntimeConfig();
const authService = authConfig.enabled && authConfig.accessTokenSecret
  ? new MobileAuthService(
    new PostgresMobileAuthRepository(pool),
    new MobileAccessTokenService(authConfig.accessTokenSecret),
    { testTokensEnabled: authConfig.testTokensEnabled },
  )
  : null;

const mobileRouter = Router();
const sensitiveLimiter = new MobileRateLimiter(10, 15 * 60 * 1000);
const tokenLimiter = new MobileRateLimiter(30, 15 * 60 * 1000);
const pathwayRepository = new PostgresMobilePathwayRepository(pool);

mobileRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

mobileRouter.get("/status", (_req, res) => {
  const response = mobileStatusResponseSchema.parse({
    apiVersion: "v1",
    availability: authConfig.enabled ? "pilot" : "prelaunch",
    minimumAppVersion: "1.0.0",
    requestId: res.locals.requestId,
  });
  return res.json(response);
});

mobileRouter.get("/bootstrap", (_req, res) => {
  const response = mobileBootstrapResponseSchema.parse({
    apiVersion: "v1",
    availability: authConfig.enabled ? "pilot" : "prelaunch",
    minimumAppVersion: "1.0.0",
    supportedLocales: ["en", "es"],
    features: {
      authentication: authConfig.enabled,
      investorAccounts: authConfig.enabled,
      partnerAccounts: authConfig.enabled,
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

function requireAuthService(): MobileAuthService {
  if (!authService) throw new MobileAuthServiceError("SERVICE_UNAVAILABLE", 503);
  return authService;
}

async function authenticated(req: Request) {
  return requireAuthService().authenticate(req.header("authorization"));
}

mobileRouter.post(
  "/auth/register",
  sensitiveLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileRegisterRequestSchema.parse(req.body);
    const result = await requireAuthService().register({
      email: body.email,
      password: body.password,
      role: body.role,
      requestId: res.locals.requestId,
    });
    return res.status(202).json(mobileAcceptedResponseSchema.parse({
      ...result,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/verify-email",
  tokenLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileVerifyEmailRequestSchema.parse(req.body);
    const result = await requireAuthService().verifyEmail({
      ...body,
      requestId: res.locals.requestId,
    });
    return res.json(mobileVerificationResponseSchema.parse({
      ...result,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/login",
  sensitiveLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileLoginRequestSchema.parse(req.body);
    const result = await requireAuthService().login({
      ...body,
      requestId: res.locals.requestId,
    });
    return res.json(mobileAuthenticatedResponseSchema.parse({
      ...result,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/refresh",
  tokenLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileRefreshRequestSchema.parse(req.body);
    const result = await requireAuthService().refresh(body.refreshToken, res.locals.requestId);
    return res.json(mobileAuthenticatedResponseSchema.parse({
      ...result,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/logout",
  tokenLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileLogoutRequestSchema.parse(req.body);
    await requireAuthService().logout(body.refreshToken, res.locals.requestId);
    return res.json(mobileOkResponseSchema.parse({
      status: "ok",
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/recovery/request",
  sensitiveLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileRecoveryRequestSchema.parse(req.body);
    const result = await requireAuthService().requestRecovery({
      email: body.email,
      requestId: res.locals.requestId,
    });
    return res.status(202).json(mobileAcceptedResponseSchema.parse({
      ...result,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/auth/recovery/complete",
  sensitiveLimiter.middleware(),
  asyncRoute(async (req, res) => {
    const body = mobileRecoveryCompleteRequestSchema.parse(req.body);
    await requireAuthService().completeRecovery(
      body.token,
      body.newPassword,
      res.locals.requestId,
    );
    return res.json(mobileOkResponseSchema.parse({
      status: "ok",
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.get(
  "/me",
  asyncRoute(async (req, res) => {
    const { account } = await authenticated(req);
    return res.json(mobileMeResponseSchema.parse({
      account,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.get(
  "/sessions",
  asyncRoute(async (req, res) => {
    const { principal } = await authenticated(req);
    const sessions = await requireAuthService().listSessions(
      principal.identityId,
      principal.sessionId,
    );
    return res.json(mobileSessionsResponseSchema.parse({
      sessions,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.get(
  "/investor/path",
  asyncRoute(async (req, res) => {
    const { principal } = await authenticated(req);
    requireMobileCapability(principal, "investor:path:read-own");
    const pathway = await pathwayRepository.readPath(principal.identityId);
    if (!pathway) throw new MobileAuthServiceError("INTERNAL_ERROR", 500);
    return res.json(mobilePathwayResponseSchema.parse({
      ...pathway,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.get(
  "/investor/path/:milestoneKey",
  asyncRoute(async (req, res) => {
    const { principal } = await authenticated(req);
    requireMobileCapability(principal, "investor:path:read-own");
    const milestoneKey = mobilePathwayMilestoneKeySchema.parse(req.params.milestoneKey);
    const pathwayMilestone = await pathwayRepository.readMilestone(
      principal.identityId,
      milestoneKey,
    );
    if (!pathwayMilestone) throw new MobileAuthServiceError("INVALID_REQUEST", 404);
    return res.json(mobilePathwayMilestoneResponseSchema.parse({
      ...pathwayMilestone,
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.delete(
  "/sessions/:sessionId",
  asyncRoute(async (req, res) => {
    const { principal } = await authenticated(req);
    const sessionId = z.string().uuid().parse(req.params.sessionId);
    await requireAuthService().revokeSession(
      principal.identityId,
      sessionId,
      res.locals.requestId,
    );
    return res.json(mobileOkResponseSchema.parse({
      status: "ok",
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.post(
  "/deletion-request",
  asyncRoute(async (req, res) => {
    const { principal } = await authenticated(req);
    await requireAuthService().requestDeletion(principal.identityId, res.locals.requestId);
    return res.status(202).json(mobileDeletionResponseSchema.parse({
      status: "deletion_requested",
      requestId: res.locals.requestId,
    }));
  }),
);

mobileRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json(createMobileApiError("INVALID_REQUEST", res.locals.requestId));
  }
  if (error instanceof MobileAuthServiceError) {
    return res.status(error.status).json(createMobileApiError(
      error.code,
      res.locals.requestId,
      error.code === "SERVICE_UNAVAILABLE",
    ));
  }
  if (error instanceof MobileAuthorizationError) {
    return res.status(403).json(createMobileApiError("NOT_AUTHORIZED", res.locals.requestId));
  }
  return next(error);
});

export default mobileRouter;
