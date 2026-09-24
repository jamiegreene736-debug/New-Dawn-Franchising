import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import express from "express";
import session from "express-session";
import type { Server } from "node:http";
import { pool } from "../server/db";
import { ensureDeskSchema } from "../server/outreach-desk/schema";
import { createDeskRouter } from "../server/outreach-desk/routes";
import {
  createDraft,
  approveAction,
  saveOutcome,
  claimPerson,
} from "../server/outreach-desk/actions";
import {
  listPeople,
  campaignPeople,
  personRow,
  iso,
} from "../server/outreach-desk/queries";
import { processOneAction } from "../server/outreach-desk/worker";
import { inContactHours } from "../server/outreach-desk/policy";
import { enqueueCall } from "../server/call-queue-service";
import { verifyPersonEmail } from "../server/outreach-desk/enrichment";
import { deskQuerySchema } from "../shared/outreach-desk";

const databaseUrl = process.env.DESK_TEST_DATABASE_URL;
const skip = !databaseUrl;
let server: Server, baseUrl: string, cookie: string;
const timezone =
  [
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Tokyo",
    "Pacific/Auckland",
  ].find((zone) => inContactHours(zone)) || "America/New_York";
async function seedPerson(overrides: Record<string, unknown> = {}) {
  const phone =
    "+1512" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const id = randomUUID(),
    email = `${id}@example.com`;
  await pool.query(
    `INSERT INTO call_queue(id,name,email,phone,track,trigger_type,trigger_at,status) VALUES($1,'Test person',$2,$3,'client','reply_no_meeting',now(),'queued')`,
    [id, email, phone],
  );
  const permission = {
    allowed: true,
    evidence: "Integration fixture permission",
    recordedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  };
  await pool.query(
    `INSERT INTO outreach_desk_profiles(queue_id,timezone,permissions) VALUES($1,$2,$3)`,
    [
      id,
      timezone,
      JSON.stringify({ email: permission, call: permission, sms: permission }),
    ],
  );
  for (const [key, value] of Object.entries(overrides)) {
    assert.ok(
      ["status", "trigger_type", "next_attempt_at", "name"].includes(key),
    );
    await pool.query(`UPDATE call_queue SET ${key}=$2 WHERE id=$1`, [
      id,
      value,
    ]);
  }
  return { id, email };
}
before(async () => {
  if (skip) return;
  const parsed = new URL(databaseUrl!);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      parsed.pathname === "/new_dawn_outreach_desk_test",
    "Tests require a dedicated local test database",
  );
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  const exists = (
    await pool.query("SELECT to_regclass('public.call_queue') AS name")
  ).rows[0].name;
  if (!exists) {
    const schema = execFileSync(
      process.execPath,
      [
        "node_modules/drizzle-kit/bin.cjs",
        "export",
        "--dialect",
        "postgresql",
        "--schema",
        "./shared/schema.ts",
      ],
      { encoding: "utf8" },
    );
    await pool.query(schema);
  }
  await ensureDeskSchema();
  await pool.query(
    "TRUNCATE outreach_desk_email_evidence,outreach_desk_events,outreach_desk_actions,outreach_desk_profiles,outreach_desk_views,call_queue_attempts,call_queue,drip_sends,drip_enrollments,drip_steps,drip_campaigns,prospects,agent_dnc,crm_direct_emails,crm_clients,contact_activities,contacts,meetings CASCADE",
  );
  await pool.query(
    "UPDATE outreach_desk_settings SET paused=false,auto_followups=false,daily_limit=100 WHERE id=1",
  );
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "isolated-integration-test-secret-only",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.get("/test-session", (req, res) => {
    req.session.adminId = "integration-admin";
    res.json({ ok: true });
  });
  app.use("/api/outreach-desk", createDeskRouter());
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${baseUrl}/test-session`);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});
const api = (
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  fetch(`${baseUrl}/api/outreach-desk${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

test(
  "auth, request validation and same-origin mutation boundary",
  { skip },
  async () => {
    assert.equal(
      (await fetch(`${baseUrl}/api/outreach-desk/queue`)).status,
      401,
    );
    assert.equal((await api("/queue?limit=9000")).status, 400);
    assert.equal(
      (
        await api(
          "/settings",
          "PATCH",
          { paused: true, autoFollowups: false, dailyLimit: 20 },
          { Origin: "https://untrusted.example" },
        )
      ).status,
      403,
    );
  },
);
test(
  "queue ordering, due filtering and keyset pagination",
  { skip },
  async () => {
    const a = await seedPerson({
      name: "Unique alpha",
      trigger_type: "engaged_open",
    });
    const b = await seedPerson({ name: "Unique beta", status: "callback" });
    await seedPerson({
      name: "Unique later",
      status: "callback",
      next_attempt_at: new Date(Date.now() + 86400_000),
    });
    const first = await listPeople(
      deskQuerySchema.parse({ q: "Unique", limit: 1 }),
    );
    assert.equal(first.items[0].id, b.id);
    assert.ok(first.nextCursor);
    const second = await listPeople(
      deskQuerySchema.parse({
        q: "Unique",
        limit: 1,
        cursor: first.nextCursor,
      }),
    );
    assert.equal(second.items[0].id, a.id);
    assert.equal(second.nextCursor, null);
  },
);
test(
  "claims protect work from competing agent sessions",
  { skip },
  async () => {
    const p = await seedPerson();
    await claimPerson(p.id, "agent-one");
    await assert.rejects(() => claimPerson(p.id, "agent-two"), /Another agent/);
  },
);
test(
  "outcome is atomic, idempotent and never fabricates a booked meeting",
  { skip },
  async () => {
    const p = await seedPerson();
    const row = await personRow(p.id);
    const data = {
      operationId: randomUUID(),
      expectedUpdatedAt: iso(row.updatedAt)!,
      outcome: "meeting_pending" as const,
      notes: "Agreed to choose a time",
    };
    await saveOutcome(p.id, data, "agent");
    await saveOutcome(p.id, data, "agent");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM call_queue_attempts WHERE queue_id=$1",
          [p.id],
        )
      ).rows[0].count,
      1,
    );
    assert.equal((await personRow(p.id)).status, "meeting_pending");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM meetings WHERE invitee_email=$1",
          [p.email],
        )
      ).rows[0].count,
      0,
    );
  },
);
test("DNC cancels pending work and creates suppression", { skip }, async () => {
  const p = await seedPerson();
  const draft = await createDraft(
    p.id,
    {
      operationId: randomUUID(),
      channel: "email",
      subject: "Test",
      body: "Requested details",
    },
    "agent",
  );
  const row = await personRow(p.id);
  await saveOutcome(
    p.id,
    {
      operationId: randomUUID(),
      expectedUpdatedAt: iso(row.updatedAt)!,
      outcome: "dnc",
      notes: "Stop all contact",
    },
    "agent",
  );
  assert.equal(
    (
      await pool.query("SELECT status FROM outreach_desk_actions WHERE id=$1", [
        draft.id,
      ])
    ).rows[0].status,
    "cancelled",
  );
  assert.equal((await personRow(p.id)).suppressed, true);
});
test(
  "concurrent worker runs dispatch once with a provider receipt",
  { skip },
  async () => {
    if (!inContactHours(timezone)) return;
    const p = await seedPerson();
    const a = await createDraft(
      p.id,
      {
        operationId: randomUUID(),
        channel: "email",
        subject: "Test",
        body: "Requested details",
      },
      "agent",
    );
    await approveAction(a.id, new Date().toISOString(), "agent");
    let sends = 0;
    const send = async () => {
      sends++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { success: true, id: "provider-123" };
    };
    await Promise.all([processOneAction(send), processOneAction(send)]);
    assert.equal(sends, 1);
    const row = (
      await pool.query(
        "SELECT status,provider_id FROM outreach_desk_actions WHERE id=$1",
        [a.id],
      )
    ).rows[0];
    assert.equal(row.status, "accepted");
    assert.equal(row.provider_id, "provider-123");
  },
);
test("reply after draft holds scheduled send", { skip }, async () => {
  const p = await seedPerson();
  const a = await createDraft(
    p.id,
    {
      operationId: randomUUID(),
      channel: "email",
      subject: "Test",
      body: "Requested details",
    },
    "agent",
  );
  await approveAction(a.id, new Date().toISOString(), "agent");
  const c = (
    await pool.query(
      "INSERT INTO crm_clients(full_name,email) VALUES('Test',$1) RETURNING id",
      [p.email],
    )
  ).rows[0];
  await pool.query(
    `INSERT INTO crm_direct_emails(client_id,from_email,from_name,to_email,subject,body_html,direction,sent_at) VALUES($1,$2,'Test','team@example.com','Reply','Hello','inbound',now()+interval '1 second')`,
    [c.id, p.email],
  );
  let sends = 0;
  await processOneAction(async () => {
    sends++;
    return { success: true };
  });
  assert.equal(sends, 0);
  assert.equal(
    (
      await pool.query("SELECT status FROM outreach_desk_actions WHERE id=$1", [
        a.id,
      ])
    ).rows[0].status,
    "held",
  );
});
test(
  "ambiguous provider error is quarantined and never auto retried",
  { skip },
  async () => {
    if (!inContactHours(timezone)) return;
    const p = await seedPerson();
    const a = await createDraft(
      p.id,
      {
        operationId: randomUUID(),
        channel: "sms",
        subject: "",
        body: "Requested details",
      },
      "agent",
    );
    await approveAction(a.id, new Date().toISOString(), "agent");
    let sends = 0;
    const send = async () => {
      sends++;
      throw new Error("response lost");
    };
    await processOneAction(send);
    await processOneAction(send);
    assert.equal(sends, 1);
    assert.equal(
      (
        await pool.query(
          "SELECT status FROM outreach_desk_actions WHERE id=$1",
          [a.id],
        )
      ).rows[0].status,
      "unknown",
    );
  },
);
test("saved views and overview expose persisted data", { skip }, async () => {
  assert.equal(
    (
      await api("/views", "POST", {
        name: "My callbacks",
        filters: { view: "callbacks" },
      })
    ).status,
    200,
  );
  const views = await (await api("/views")).json();
  assert.equal(views[0].name, "My callbacks");
  const overview = await (await api("/overview")).json();
  assert.equal(typeof overview.active, "number");
  assert.equal(overview.settings.autoFollowups, false);
});
test(
  "campaign search deduplicates recipients and respects campaign and open filters",
  { skip },
  async () => {
    const c = (
      await pool.query(
        "INSERT INTO drip_campaigns(name) VALUES('Integration campaign') RETURNING id",
      )
    ).rows[0];
    const p = (
      await pool.query(
        "INSERT INTO prospects(name,email,category,location) VALUES('Campaign person','campaign@example.com','partner','London') RETURNING id",
      )
    ).rows[0];
    const e = (
      await pool.query(
        "INSERT INTO drip_enrollments(campaign_id,prospect_id,prospect_email,prospect_name) VALUES($1,$2,'campaign@example.com','Campaign person') RETURNING id",
        [c.id, p.id],
      )
    ).rows[0];
    const step = (
      await pool.query(
        "INSERT INTO drip_steps(campaign_id,step_order,delay_days,subject,body_html) VALUES($1,1,1,'Test','Body') RETURNING id",
        [c.id],
      )
    ).rows[0];
    for (let i = 0; i < 2; i++)
      await pool.query(
        "INSERT INTO drip_sends(enrollment_id,step_id,recipient_email,recipient_name,subject,status,sent_at,opened_at,open_count) VALUES($1,$2,'campaign@example.com','Campaign person','Test','sent',now(),now(),1)",
        [e.id, step.id],
      );
    const result = await campaignPeople(
      deskQuerySchema.parse({ campaignId: c.id, signal: "opened" }),
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].opens, 2);
    assert.equal(
      (
        await campaignPeople(
          deskQuerySchema.parse({ campaignId: c.id, signal: "clicked" }),
        )
      ).items.length,
      0,
    );
  },
);

test(
  "handled relationships cannot be requeued by another campaign signal",
  { skip },
  async () => {
    const p = await seedPerson({ status: "needs_followup" });
    const result = await enqueueCall({
      name: "Test",
      email: p.email,
      triggerType: "link_click",
    });
    assert.equal(result.ok, false);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM call_queue WHERE email=$1",
          [p.email],
        )
      ).rows[0].n,
      1,
    );
  },
);
test(
  "verification is shared, cached and preserves evidence during provider failure",
  { skip },
  async () => {
    const p = await seedPerson();
    let calls = 0;
    const provider = async (email: string) => {
      calls++;
      return {
        email,
        result: "deliverable",
        status: "valid",
        score: 99,
        disposable: false,
        webmail: false,
        mxRecords: true,
        smtpServer: true,
      };
    };
    await Promise.all([
      verifyPersonEmail(p.id, "test", provider),
      verifyPersonEmail(p.id, "test", provider).catch((error) => {
        assert.equal(error.status, 409);
      }),
    ]);
    assert.equal(calls, 1);
    assert.equal((await personRow(p.id)).emailStatus, "valid");
    await verifyPersonEmail(p.id, "test", provider);
    assert.equal(calls, 1);
    await pool.query(
      "UPDATE outreach_desk_email_evidence SET attempted_at=now()-interval '31 days',checked_at=now()-interval '31 days' WHERE email=$1",
      [p.email],
    );
    await assert.rejects(
      () => verifyPersonEmail(p.id, "test", async () => null),
      /provider unavailable/,
    );
    assert.equal((await personRow(p.id)).emailStatus, "valid");
  },
);
test(
  "draft editing rejects stale writes and removes automatic playbook eligibility",
  { skip },
  async () => {
    const p = await seedPerson();
    const a = await createDraft(
      p.id,
      {
        operationId: randomUUID(),
        channel: "email",
        subject: "Before",
        body: "Before",
      },
      "agent",
    );
    await pool.query(
      "UPDATE outreach_desk_actions SET operation_id='outcome:test-edited' WHERE id=$1",
      [a.id],
    );
    const row = (
      await pool.query(
        "SELECT updated_at FROM outreach_desk_actions WHERE id=$1",
        [a.id],
      )
    ).rows[0];
    const data = {
      subject: "After",
      body: "Reviewed message",
      updatedAt: iso(row.updated_at),
    };
    assert.equal((await api(`/actions/${a.id}`, "PATCH", data)).status, 200);
    assert.equal((await api(`/actions/${a.id}`, "PATCH", data)).status, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT operation_id FROM outreach_desk_actions WHERE id=$1",
          [a.id],
        )
      ).rows[0].operation_id,
      "edited:outcome:test-edited",
    );
  },
);
test("pause and changed recipients hold scheduled work", { skip }, async () => {
  const p = await seedPerson();
  const a = await createDraft(
    p.id,
    {
      operationId: randomUUID(),
      channel: "email",
      subject: "Test",
      body: "Test",
    },
    "agent",
  );
  await approveAction(a.id, new Date().toISOString(), "agent");
  await pool.query("UPDATE outreach_desk_settings SET paused=true WHERE id=1");
  assert.equal(
    await processOneAction(async () => {
      throw Error("Must not dispatch");
    }),
    false,
  );
  await pool.query("UPDATE outreach_desk_settings SET paused=false WHERE id=1");
  await pool.query(
    "UPDATE call_queue SET email='changed@example.com' WHERE id=$1",
    [p.id],
  );
  await processOneAction(async () => {
    throw Error("Must not dispatch");
  });
  const row = (
    await pool.query(
      "SELECT status,error FROM outreach_desk_actions WHERE id=$1",
      [a.id],
    )
  ).rows[0];
  assert.equal(row.status, "held");
  assert.match(row.error, /contact detail changed/);
});
