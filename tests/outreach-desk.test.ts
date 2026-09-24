import { test } from "node:test";
import assert from "node:assert/strict";
import {
  channelEligibility,
  normalizePhone,
  safeLinkedin,
  validTimezone,
  inContactHours,
  escapeHtml,
} from "../server/outreach-desk/policy";
import {
  deskQuerySchema,
  outcomeSchema,
  permissionSchema,
} from "../shared/outreach-desk";
import { localCallbackToUtc } from "../client/src/components/outreach-desk/api";
const now = new Date("2026-09-24T15:00:00Z");
const base = {
  phone: "+15125550147",
  email: "person@example.com",
  timezone: "America/Chicago",
  permissions: {
    call: {
      allowed: true,
      evidence: "Requested callback",
      recordedAt: now.toISOString(),
      expiresAt: "2026-10-01T00:00:00Z",
    },
  },
  suppressed: false,
  booked: false,
  status: "queued",
  attemptCount: 0,
  nextAttemptAt: null,
  linkedinUrl: null,
};
test("call eligibility requires evidence, known timezone and local hours", () => {
  assert.equal(channelEligibility(base, "call", now).allowed, true);
  for (const changes of [
    { suppressed: true },
    { booked: true },
    { timezone: null },
    { timezone: "bad" },
    { phone: "5125550147" },
    { permissions: {} },
    { attemptCount: 3 },
    { nextAttemptAt: "2026-09-25T15:00:00Z" },
  ])
    assert.equal(
      channelEligibility({ ...base, ...changes }, "call", now).allowed,
      false,
    );
  assert.equal(
    channelEligibility(base, "call", new Date("2026-09-26T15:00:00Z")).allowed,
    false,
  );
  assert.equal(
    channelEligibility(base, "call", new Date("2026-09-24T02:00:00Z")).allowed,
    false,
  );
});
test("expired evidence never grants permission and channels are independent", () => {
  assert.equal(channelEligibility(base, "sms", now).allowed, false);
  assert.equal(
    channelEligibility(
      {
        ...base,
        permissions: {
          call: { ...base.permissions.call, expiresAt: "invalid" },
        },
      },
      "call",
      now,
    ).allowed,
    false,
  );
  assert.equal(
    channelEligibility(
      {
        ...base,
        permissions: {
          call: { ...base.permissions.call, expiresAt: "2026-09-23T00:00:00Z" },
        },
      },
      "call",
      now,
    ).allowed,
    false,
  );
});
test("WhatsApp requires recorded permission and recent inbound message", () => {
  const wa = { ...base, permissions: { whatsapp: base.permissions.call } };
  assert.equal(channelEligibility(wa, "whatsapp", now).allowed, false);
  assert.equal(
    channelEligibility(
      { ...wa, whatsappInboundAt: "2026-09-24T14:00:00Z" },
      "whatsapp",
      now,
    ).allowed,
    true,
  );
  assert.equal(
    channelEligibility(
      { ...wa, whatsappInboundAt: "2026-09-23T15:00:00Z" },
      "whatsapp",
      now,
    ).allowed,
    false,
  );
});
test("phone and LinkedIn normalization reject ambiguous or executable destinations", () => {
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  for (const input of [
    "555-0100",
    "call@example.com",
    "+00000000000",
    "15125550147",
  ])
    assert.equal(normalizePhone(input), null);
  assert.equal(
    safeLinkedin("https://www.linkedin.com/in/person"),
    "https://www.linkedin.com/in/person",
  );
  for (const input of [
    "javascript:alert(1)",
    "https://linkedin.com.evil.test/in/a",
    "https://user:pass@linkedin.com/in/a",
  ])
    assert.equal(safeLinkedin(input), null);
  assert.equal(validTimezone("Missing"), false);
  assert.equal(inContactHours(null, now), false);
});
test("query and mutation inputs are bounded", () => {
  assert.equal(deskQuerySchema.parse({}).limit, 40);
  for (const input of [
    { days: 366 },
    { limit: 5000 },
    { q: "x".repeat(201) },
    { view: "invalid" },
  ])
    assert.equal(deskQuerySchema.safeParse(input).success, false);
  assert.equal(
    outcomeSchema.safeParse({
      operationId: crypto.randomUUID(),
      expectedUpdatedAt: now.toISOString(),
      outcome: "callback",
    }).success,
    false,
  );
  assert.equal(
    permissionSchema.safeParse({
      channel: "call",
      allowed: true,
      evidence: "yes",
      expiresAt: now.toISOString(),
    }).success,
    false,
  );
});
test("callback conversion uses contact timezone and rejects daylight-saving ambiguity", () => {
  assert.equal(
    localCallbackToUtc("2026-09-25T10:30", "America/Chicago"),
    "2026-09-25T15:30:00.000Z",
  );
  assert.throws(
    () => localCallbackToUtc("2026-11-01T01:30", "America/New_York"),
    /twice/,
  );
  assert.throws(
    () => localCallbackToUtc("2026-03-08T02:30", "America/New_York"),
    /does not exist/,
  );
});
test("outbound plain text is escaped before HTML formatting", () =>
  assert.equal(
    escapeHtml('<img src=x onerror="bad"> &'),
    "&lt;img src=x onerror=&quot;bad&quot;&gt; &amp;",
  ));

test("SMS and WhatsApp adapters honor cancellation without claiming acceptance", async () => {
  const keys = [
    "QUO_API_KEY",
    "QUO_PHONE_NUMBER_ID",
    "META_WHATSAPP_ACCESS_TOKEN",
    "META_WHATSAPP_PHONE_NUMBER_ID",
  ];
  const previous = keys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  try {
    for (const key of keys) process.env[key] = "isolated-test-fixture";
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        assert.ok(init?.signal);
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("Test request aborted")),
          { once: true },
        );
      });
    const { sendSmsViaQuo } = await import("../server/quo-service");
    const { sendWhatsAppMessage } =
      await import("../server/meta-whatsapp-service");
    const controller = new AbortController();
    const requests = Promise.all([
      sendSmsViaQuo("+15125550147", "Fixture", undefined, controller.signal),
      sendWhatsAppMessage("+15125550147", "Fixture", controller.signal),
    ]);
    controller.abort();
    for (const result of await requests) {
      assert.equal(result.success, false);
      assert.equal(result.id, undefined);
    }
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
