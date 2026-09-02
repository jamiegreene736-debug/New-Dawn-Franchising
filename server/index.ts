import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { serveStatic } from "./static";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { pool } from "./db";
import mobileRouter from "./mobile/routes";
import { createMobileApiError } from "./mobile/api-errors";
import { readRequiredEnvironmentValue } from "./runtime-config";
import { readApplicationRuntimeProfile } from "./runtime-profile";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const runtimeProfile = readApplicationRuntimeProfile();

if (isProduction) {
  app.set("trust proxy", 1);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    brokerId?: string;
    adminId?: string;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

if (runtimeProfile.legacySessionEnabled) {
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      // The `session` table is provisioned by ensureSchema() via raw SQL on boot.
      // Do NOT use connect-pg-simple's `createTableIfMissing`: it reads a bundled
      // `table.sql` asset at runtime, which esbuild does not emit into dist/, so it
      // throws ENOENT and breaks every session read/write. See server/ensure-schema.ts.
      store: new PgSession({ pool }),
      secret: readRequiredEnvironmentValue("SESSION_SECRET"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    }),
  );
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const incomingRequestId = req.header("x-request-id")?.trim();
  const requestId = incomingRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms requestId=${requestId}`);
    }
  });

  next();
});

(async () => {
  let warmProviderCaches: (() => Promise<void>) | null = null;

  if (runtimeProfile.legacyStartupWritesEnabled) {
    const [{ ensureSchema }, { seedBlogPostsIfEmpty }, { storage }] = await Promise.all([
      import("./ensure-schema"),
      import("./seed-posts"),
      import("./storage"),
    ]);

    // Ensure required tables exist (runs over Railway's internal network).
    await ensureSchema();
    try {
      const { applyOutreachHealOnce } = await import("./legacy-campaign-pause");
      const heal = await applyOutreachHealOnce();
      if (heal.paused.length) {
        console.log(`[Heal] paused ${heal.paused.length} pre-quality-gate campaign(s)`);
      }
    } catch (err: any) {
      console.error(`[Heal] outreach heal skipped: ${err?.message}`);
    }
    // Give pre-existing CRM lists a linked prospect_list so they're campaign-selectable
    // (idempotent — only does work on the first boot after this feature ships).
    try {
      const healed = await storage.backfillCrmListMirrors();
      if (healed > 0) console.log(`[crm-list-mirror] backfilled ${healed} existing CRM list(s) into prospect lists`);
    } catch (err: any) {
      console.error(`[crm-list-mirror] backfill skipped: ${err?.message}`);
    }
    try {
      const { syncWebsiteLeadsFromHistory } = await import("./website-leads");
      const sync = await syncWebsiteLeadsFromHistory();
      if (sync.created || sync.updated || sync.listed) {
        console.log(
          `[website-leads] synced ${sync.created} created · ${sync.updated} updated · ${sync.listed} listed`,
        );
      }
    } catch (err: any) {
      console.error(`[website-leads] backfill skipped: ${err?.message}`);
    }
    // Publish the starter blog posts the first time the blog is empty.
    await seedBlogPostsIfEmpty();
  }

  if (runtimeProfile.legacyRoutesEnabled) {
    const routes = await import("./routes");
    await routes.registerRoutes(httpServer, app);
    warmProviderCaches = routes.warmHomepageVoiceover;
  } else {
    app.get("/healthz", (_req, res) => res.json({ status: "ok", mode: runtimeProfile.mode }));
    app.use("/api/mobile/v1", mobileRouter);
    console.log("[runtime] mobile-staging isolation enabled; legacy routes, jobs, and startup writes are disabled");
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    if (_req.path.startsWith("/api/mobile/")) {
      return res.status(500).json(createMobileApiError("INTERNAL_ERROR", res.locals.requestId));
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(status).json({ message, requestId: res.locals.requestId });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    if (runtimeProfile.staticWebsiteEnabled) {
      serveStatic(app);
    }
  } else {
    if (runtimeProfile.staticWebsiteEnabled) {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  }

  if (!runtimeProfile.staticWebsiteEnabled) {
    app.use((_req, res) => res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "This staging service exposes only the mobile API.",
        requestId: res.locals.requestId,
        retryable: false,
      },
    }));
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port} mode=${runtimeProfile.mode}`);
      if (runtimeProfile.providerWarmupsEnabled && warmProviderCaches) {
        // Pre-generate the homepage voiceover so the first play is instant (best-effort).
        warmProviderCaches();
      }
    },
  );
})();
