import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import { pool } from "../server/db";
import { getPostmasterConfig, getPostmasterSyncStatus, syncPostmaster } from "../server/postmaster-service";

const originalEnv = { ...process.env };
afterEach(() => { mock.restoreAll(); process.env = { ...originalEnv }; });
function credentials() {
  for (const name of Object.keys(process.env)) if (name.startsWith("POSTMASTER_")) delete process.env[name];
  process.env.POSTMASTER_CLIENT_ID = "client";
  process.env.POSTMASTER_CLIENT_SECRET = "secret";
  process.env.POSTMASTER_REFRESH_TOKEN = crypto.randomUUID();
  process.env.POSTMASTER_DOMAINS = "example.com";
}
const stat = (metric: string, value: number) => ({ metric, date: { year: 2026, month: 10, day: 1 }, value: { doubleValue: value } });

test("refreshes authorization, paginates v2 metrics, and preserves missing data", async () => {
  credentials();
  const writes: unknown[][] = [];
  mock.method(pool, "query", async (_sql: string, args: unknown[]) => { writes.push(args); return { rows: [] }; });
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    if (input.endsWith("/token")) {
      const form = init.body as URLSearchParams;
      assert.equal(form.get("grant_type"), "refresh_token");
      assert.equal(form.get("client_secret"), "secret");
      return Response.json({ access_token: "report-token", expires_in: 3600 });
    }
    assert.equal(init.method, "POST");
    const body = JSON.parse(String(init.body));
    requests.push({ url: input, body });
    return Response.json(body.pageToken ? { domainStats: [stat("dkimRatio", 1)] } : { domainStats: [stat("spamRate", 0)], nextPageToken: "next" });
  });
  assert.deepEqual(await syncPostmaster(), { stored: 1 });
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\/v2\/domains\/example.com\/domainStats:query$/);
  assert.equal(writes[0][2], 0);
  assert.equal(writes[0][3], 1);
  assert.equal(writes[0][4], null);
  assert.equal(writes[0][5], null);
  assert.equal(getPostmasterSyncStatus().state, "connected");
});

test("empty Google result is connected without data, never zero spam", async () => {
  credentials();
  const db = mock.method(pool, "query", async () => { throw new Error("should not write"); });
  mock.method(globalThis, "fetch", async (url: string) => Response.json(url.endsWith("/token") ? { access_token: "ok", expires_in: 3600 } : {}));
  assert.deepEqual(await syncPostmaster(), { stored: 0 });
  assert.equal(getPostmasterSyncStatus().state, "no_data");
  assert.equal(getPostmasterSyncStatus().error, null);
  assert.equal(db.mock.callCount(), 0);
});

for (const status of [401, 403, 429, 500]) test(`Google HTTP ${status} is a visible error, not no data`, async () => {
  credentials();
  mock.method(globalThis, "fetch", async (url: string) => url.endsWith("/token") ? Response.json({ access_token: "ok", expires_in: 3600 }) : new Response("private response", { status }));
  await syncPostmaster();
  assert.equal(getPostmasterSyncStatus().state, "error");
  assert.match(getPostmasterSyncStatus().error!, new RegExp(`HTTP ${status}`));
  assert.doesNotMatch(getPostmasterSyncStatus().error!, /private response/);
});

for (const result of [
  { domainStats: [stat("spamRate", 7)] },
  { domainStats: [{ ...stat("spamRate", 0), date: { year: 2026, month: 2, day: 30 } }] },
  { domainStats: "malformed" },
  { domainStats: [stat("spamRate", 0)], nextPageToken: "repeat" },
]) test("rejects malformed or incomplete reports before persistence", async () => {
  credentials();
  const db = mock.method(pool, "query", async () => ({ rows: [] }));
  mock.method(globalThis, "fetch", async (url: string) => Response.json(url.endsWith("/token") ? { access_token: "ok", expires_in: 3600 } : result));
  await syncPostmaster();
  assert.equal(getPostmasterSyncStatus().state, "error");
  assert.equal(db.mock.callCount(), 0);
});

test("revoked authorization and timeout surface safely without leaking secrets", async () => {
  credentials();
  mock.method(globalThis, "fetch", async () => new Response("secret", { status: 400 }));
  await syncPostmaster();
  assert.match(getPostmasterSyncStatus().error!, /authorization failed/);
  assert.doesNotMatch(getPostmasterSyncStatus().error!, /secret/);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => { throw new Error("secret timeout"); });
  await syncPostmaster();
  assert.equal(getPostmasterSyncStatus().state, "error");
  assert.doesNotMatch(getPostmasterSyncStatus().error!, /secret/);
});

test("incomplete credentials are not configured and make no request", async () => {
  credentials();
  delete process.env.POSTMASTER_REFRESH_TOKEN;
  assert.equal(getPostmasterConfig().configured, false);
  const request = mock.method(globalThis, "fetch", async () => { throw new Error("must not request"); });
  await syncPostmaster();
  assert.equal(getPostmasterSyncStatus().state, "not_configured");
  assert.equal(request.mock.callCount(), 0);
});
