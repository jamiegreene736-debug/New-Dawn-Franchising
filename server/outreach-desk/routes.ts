import { createHash } from "node:crypto";
import {
  Router,
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { pool } from "../db";
import { storage } from "../storage";
import { enqueueFromDripSend } from "../call-queue-service";
import { getQuoStatus } from "../quo-service";
import { getWhatsAppStatus } from "../meta-whatsapp-service";
import {
  getGmailSyncLastResult,
  getGmailSyncStatus,
} from "../gmail-sync-service";
import { getEnrichmentApiStatus } from "../prospect-enrichment";
import { verifyPersonEmail } from "./enrichment";
import {
  deskQuerySchema,
  outcomeSchema,
  profileSchema,
  permissionSchema,
  actionDraftSchema,
  approveActionSchema,
  settingsSchema,
} from "@shared/outreach-desk";
import type { DeskConnection, DeskSettings } from "@shared/outreach-desk";
import { ensureDeskSchema } from "./schema";
import { campaignPeople, detail, iso, listPeople, personRow } from "./queries";
import {
  approveAction,
  claimPerson,
  createDraft,
  event,
  handoff,
  listActions,
  saveOutcome,
  transaction,
} from "./actions";
import {
  DeskError,
  normalizePhone,
  safeLinkedin,
  validTimezone,
} from "./policy";
import { prepareDesk } from "./worker";

const idSchema = z.string().min(1).max(100);
const actor = (req: Request) =>
  `${req.session.adminId}:${createHash("sha256").update(req.sessionID).digest("hex").slice(0, 12)}`;
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
export async function readSettings(): Promise<DeskSettings> {
  const row = (
    await pool.query<DeskSettings>(`SELECT paused,auto_followups AS "autoFollowups",daily_limit AS "dailyLimit",
    last_prepared_at AS "lastPreparedAt",preparation_error AS "preparationError" FROM outreach_desk_settings WHERE id=1`)
  ).rows[0];
  return { ...row, lastPreparedAt: iso(row.lastPreparedAt) };
}
export function createDeskRouter() {
  const router = Router();
  router.use((req, res, next) => {
    if (!req.session?.adminId) {
      res.status(401).json({ message: "Sign in to the admin portal." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.get("origin");
      let originHost: string | undefined;
      try {
        originHost = origin ? new URL(origin).host : undefined;
      } catch {
        originHost = "invalid";
      }
      if (
        req.get("sec-fetch-site") === "cross-site" ||
        (originHost && originHost !== req.get("host"))
      ) {
        res.status(403).json({ message: "Cross-site action rejected." });
        return;
      }
      if (!req.is("application/json")) {
        res.status(415).json({ message: "Use a JSON request." });
        return;
      }
    }
    next();
  });
  router.get(
    "/queue",
    route(async (req, res) =>
      res.json(await listPeople(deskQuerySchema.parse(req.query))),
    ),
  );
  router.get(
    "/campaigns",
    route(async (_req, res) =>
      res.json(
        (
          await pool.query(
            `SELECT id,name,audience_type AS "audienceType",is_active AS "isActive" FROM drip_campaigns ORDER BY created_at DESC LIMIT 250`,
          )
        ).rows,
      ),
    ),
  );
  router.get(
    "/campaign-people",
    route(async (req, res) =>
      res.json(await campaignPeople(deskQuerySchema.parse(req.query))),
    ),
  );
  router.get(
    "/people/:id",
    route(async (req, res) =>
      res.json(await detail(idSchema.parse(req.params.id))),
    ),
  );
  router.post(
    "/people/:id/claim",
    route(async (req, res) =>
      res.json(await claimPerson(idSchema.parse(req.params.id), actor(req))),
    ),
  );
  router.post(
    "/people/:id/handoff",
    route(async (req, res) =>
      res.json(await handoff(idSchema.parse(req.params.id), actor(req))),
    ),
  );
  router.post(
    "/people/:id/outcome",
    route(async (req, res) =>
      res.json(
        await saveOutcome(
          idSchema.parse(req.params.id),
          outcomeSchema.parse(req.body),
          actor(req),
        ),
      ),
    ),
  );
  router.post(
    "/people/:id/drafts",
    route(async (req, res) =>
      res
        .status(201)
        .json(
          await createDraft(
            idSchema.parse(req.params.id),
            actionDraftSchema.parse(req.body),
            actor(req),
          ),
        ),
    ),
  );
  router.patch(
    "/people/:id/profile",
    route(async (req, res) => {
      const id = idSchema.parse(req.params.id),
        input = profileSchema.parse(req.body);
      if (!validTimezone(input.timezone))
        throw new DeskError(
          400,
          "Choose a valid IANA timezone, such as America/New_York.",
        );
      if (input.phone && !normalizePhone(input.phone))
        throw new DeskError(400, "Enter a phone number with +country code.");
      if (input.linkedinUrl && !safeLinkedin(input.linkedinUrl))
        throw new DeskError(
          400,
          "Use an https://www.linkedin.com/in/ profile URL.",
        );
      await transaction(async (client) => {
        await client.query("SELECT id FROM call_queue WHERE id=$1 FOR UPDATE", [
          id,
        ]);
        await personRow(id, client);
        await client.query(
          `INSERT INTO outreach_desk_profiles(queue_id,timezone,linkedin_url) VALUES($1,$2,$3)
        ON CONFLICT(queue_id) DO UPDATE SET timezone=$2,linkedin_url=COALESCE($3,outreach_desk_profiles.linkedin_url),updated_at=now()`,
          [id, input.timezone, input.linkedinUrl ?? null],
        );
        await client.query(
          `UPDATE call_queue SET phone=COALESCE($2,phone),updated_at=now() WHERE id=$1`,
          [id, input.phone ? normalizePhone(input.phone) : null],
        );
        await event(
          client,
          id,
          "profile_verified",
          `Contact timezone confirmed as ${input.timezone}.`,
          actor(req),
        );
      });
      res.json(await detail(id));
    }),
  );
  router.post(
    "/people/:id/permissions",
    route(async (req, res) => {
      const id = idSchema.parse(req.params.id),
        input = permissionSchema.parse(req.body);
      const expires = Date.parse(input.expiresAt);
      if (expires <= Date.now() || expires > Date.now() + 366 * 86400_000)
        throw new DeskError(
          400,
          "Eligibility must expire within the next year.",
        );
      await transaction(async (client) => {
        await client.query("SELECT id FROM call_queue WHERE id=$1 FOR UPDATE", [
          id,
        ]);
        await personRow(id, client);
        const permission = {
          allowed: input.allowed,
          evidence: input.evidence,
          recordedAt: new Date().toISOString(),
          expiresAt: input.expiresAt,
        };
        await client.query(
          `INSERT INTO outreach_desk_profiles(queue_id,permissions) VALUES($1,jsonb_build_object($2::text,$3::jsonb))
        ON CONFLICT(queue_id) DO UPDATE SET permissions=outreach_desk_profiles.permissions || EXCLUDED.permissions,updated_at=now()`,
          [id, input.channel, JSON.stringify(permission)],
        );
        await event(
          client,
          id,
          "channel_eligibility",
          `${input.channel}: ${input.allowed ? "eligible" : "held"}. ${input.evidence}`,
          actor(req),
        );
      });
      res.json(await detail(id));
    }),
  );
  router.post(
    "/campaign-people/queue",
    route(async (req, res) => {
      const { sendId } = z.object({ sendId: idSchema }).parse(req.body);
      const send = await storage.getDripSend(sendId);
      if (!send)
        throw new DeskError(404, "Campaign activity no longer exists.");
      // An agent can explicitly choose an observed opener, without presenting the open as verified intent.
      const result = await enqueueFromDripSend(
        send,
        send.clickedAt ? "link_click" : "engaged_open",
      );
      if (!result.ok)
        throw new DeskError(409, `Contact cannot be queued: ${result.reason}`);
      res.json({ id: result.item.id });
    }),
  );
  router.get(
    "/actions",
    route(async (_req, res) => res.json(await listActions())),
  );
  router.patch(
    "/actions/:id",
    route(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const input = z
        .object({
          subject: z.string().trim().max(200),
          body: z.string().trim().min(1).max(4000),
          updatedAt: z.string().datetime(),
        })
        .parse(req.body);
      await transaction(async (client) => {
        const result = await client.query(
          `UPDATE outreach_desk_actions SET subject=$2,body=$3,updated_at=now(),
        operation_id=CASE WHEN operation_id LIKE 'outcome:%' THEN 'edited:' || operation_id ELSE operation_id END
        WHERE id=$1 AND status IN ('draft','held') AND date_trunc('milliseconds',updated_at)=$4::timestamptz RETURNING queue_id`,
          [id, input.subject, input.body, input.updatedAt],
        );
        if (!result.rows[0])
          throw new DeskError(
            409,
            "This draft changed or is already scheduled. Refresh before editing.",
          );
        await event(
          client,
          result.rows[0].queue_id,
          "draft_edited",
          "Draft content edited; manual approval required.",
          actor(req),
        );
      });
      res.json({ saved: true });
    }),
  );
  router.post(
    "/actions/:id/approve",
    route(async (req, res) =>
      res.json(
        await approveAction(
          z.string().uuid().parse(req.params.id),
          approveActionSchema.parse(req.body).scheduledAt,
          actor(req),
        ),
      ),
    ),
  );
  router.post(
    "/actions/:id/cancel",
    route(async (req, res) => {
      const result = await pool.query(
        `UPDATE outreach_desk_actions SET status='cancelled',error='Cancelled by agent.',updated_at=now()
      WHERE id=$1 AND status IN ('draft','held','scheduled') RETURNING id`,
        [z.string().uuid().parse(req.params.id)],
      );
      if (!result.rowCount)
        throw new DeskError(
          409,
          "Action already dispatched or no longer pending.",
        );
      res.json({ cancelled: true });
    }),
  );
  router.get(
    "/settings",
    route(async (_req, res) => res.json(await readSettings())),
  );
  router.patch(
    "/settings",
    route(async (req, res) => {
      const input = settingsSchema.parse(req.body);
      await transaction(async (client) => {
        await client.query(
          "UPDATE outreach_desk_settings SET paused=$1,auto_followups=$2,daily_limit=$3 WHERE id=1",
          [input.paused, input.autoFollowups, input.dailyLimit],
        );
        if (input.paused)
          await client.query(
            "UPDATE outreach_desk_actions SET status='held',error='Desk paused by administrator.',updated_at=now() WHERE status='scheduled'",
          );
      });
      res.json(await readSettings());
    }),
  );
  router.post(
    "/prepare",
    route(async (_req, res) => {
      await prepareDesk();
      res.json(await readSettings());
    }),
  );
  router.get(
    "/views",
    route(async (req, res) =>
      res.json(
        (
          await pool.query(
            "SELECT id,name,filters FROM outreach_desk_views WHERE owner=$1 ORDER BY name",
            [req.session.adminId],
          )
        ).rows,
      ),
    ),
  );
  router.post(
    "/views",
    route(async (req, res) => {
      const data = z
        .object({
          name: z.string().trim().min(1).max(80),
          filters: deskQuerySchema,
        })
        .parse(req.body);
      const filters = { ...data.filters, cursor: "" };
      res.json(
        (
          await pool.query(
            `INSERT INTO outreach_desk_views(owner,name,filters) VALUES($1,$2,$3)
      ON CONFLICT(owner,name) DO UPDATE SET filters=EXCLUDED.filters RETURNING id,name,filters`,
            [req.session.adminId, data.name, JSON.stringify(filters)],
          )
        ).rows[0],
      );
    }),
  );
  router.get(
    "/overview",
    route(async (_req, res) => {
      const row = (
        await pool.query(`SELECT
      (SELECT count(*)::int FROM call_queue WHERE status IN ('queued','calling','callback','no_answer','voicemail','needs_phone')) AS active,
      (SELECT count(*)::int FROM call_queue WHERE status='callback' AND next_attempt_at<=now()) AS callbacks,
      (SELECT count(*)::int FROM call_queue WHERE trigger_type='reply_no_meeting' AND status IN ('queued','calling')) AS replies,
      (SELECT count(*)::int FROM call_queue q LEFT JOIN outreach_desk_profiles p ON p.queue_id=q.id WHERE q.status IN ('queued','needs_phone') AND (q.phone IS NULL OR p.timezone IS NULL)) AS "needsResearch",
      (SELECT count(*)::int FROM phone_calls WHERE direction='outbound' AND openphone_created_at>=date_trunc('day',now())) AS "confirmedCalls",
      (SELECT count(*)::int FROM phone_calls WHERE direction='outbound' AND status='completed' AND duration_seconds>0 AND openphone_created_at>=date_trunc('day',now())) AS "connectedCalls",
      (SELECT count(*)::int FROM meetings WHERE status='confirmed' AND calendly_event_id LIKE 'https://api.calendly.com/%' AND created_at>=date_trunc('day',now())) AS "confirmedMeetings",
      (SELECT count(*)::int FROM outreach_desk_actions WHERE status='draft') AS "awaitingReview",
      (SELECT count(*)::int FROM outreach_desk_actions WHERE status IN ('held','unknown','failed')) AS exceptions`)
      ).rows[0];
      res.json({
        ...row,
        generatedAt: new Date().toISOString(),
        settings: await readSettings(),
      });
    }),
  );
  router.get(
    "/connections",
    route(async (_req, res) => {
      const sync = getGmailSyncLastResult(),
        gmail = getGmailSyncStatus(),
        quo = getQuoStatus(),
        wa = getWhatsAppStatus(),
        enrichment = getEnrichmentApiStatus();
      const evidence = (
        await pool.query<{
          last_call: string | null;
          last_meeting: string | null;
        }>(`SELECT (SELECT max(synced_at) FROM phone_calls) AS last_call,
      (SELECT max(created_at) FROM meetings WHERE calendly_event_id LIKE 'https://api.calendly.com/%') AS last_meeting`)
      ).rows[0];
      const cards: DeskConnection[] = [
        {
          id: "quo",
          name: "Quo · calls & SMS",
          configured: quo.configured,
          status: quo.configured ? "Configured" : "Not configured",
          detail:
            "Call handoff uses your device dialer. Call history and transcripts are imported by the existing Quo sync.",
          lastEvidenceAt: iso(evidence.last_call),
        },
        {
          id: "email",
          name: "Email & replies",
          configured: gmail.configured,
          status: sync.error
            ? "Sync needs attention"
            : sync.lastRunAt
              ? "Last sync recorded"
              : gmail.configured
                ? "Awaiting sync"
                : "Not configured",
          detail:
            "Follow-ups use franchising@. Autonomous email dispatch holds if reply sync or email verification is stale.",
          lastEvidenceAt: iso(sync.lastRunAt),
        },
        {
          id: "whatsapp",
          name: "Meta WhatsApp",
          configured: wa.configured,
          status: wa.configured ? "Configured" : "Not configured",
          detail:
            "This desk sends permission-based replies inside a recorded 24-hour service window. Approved template outreach stays in Campaigns.",
          lastEvidenceAt: null,
        },
        {
          id: "calendly",
          name: "Calendly",
          configured: !!process.env.CALENDLY_API_KEY,
          status: process.env.CALENDLY_API_KEY
            ? "Configured"
            : "Not configured",
          detail:
            "Scheduling links open the actual calendar. Only provider-identified bookings count as confirmed meetings here.",
          lastEvidenceAt: iso(evidence.last_meeting),
        },
        {
          id: "enrichment",
          name: "Contact enrichment",
          configured: Object.values(enrichment).some(Boolean),
          status: Object.values(enrichment).some(Boolean)
            ? "Providers configured"
            : "Not configured",
          detail: `Available configuration: ${
            Object.entries(enrichment)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(", ") || "none"
          }. Existing discovery syncs feed linked contacts. The desk fills missing details and verifies up to 20 queued email identities daily; verification is also available in each profile.`,
          lastEvidenceAt: null,
        },
        {
          id: "linkedin",
          name: "LinkedIn",
          configured: true,
          status: "Manual relationship task",
          detail:
            "Open a verified profile and copy a draft. No automated connections or DMs.",
          lastEvidenceAt: null,
        },
      ];
      res.json(cards);
    }),
  );
  router.post(
    "/people/:id/verify-email",
    route(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      await verifyPersonEmail(id, actor(req));
      res.json(await detail(id));
    }),
  );
  router.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: error.issues[0]?.message || "Invalid request." });
        return;
      }
      if (error instanceof DeskError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      console.error(
        "[outreach-desk] request failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      res
        .status(500)
        .json({
          message:
            "Outreach Desk could not complete this request. Please retry.",
        });
    },
  );
  return router;
}
export async function registerDeskRoutes(app: Express) {
  await ensureDeskSchema();
  app.use("/api/outreach-desk", createDeskRouter());
}
