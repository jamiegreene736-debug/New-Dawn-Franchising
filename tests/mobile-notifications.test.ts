import assert from "node:assert/strict";
import test from "node:test";

import { ExpoMobilePushGateway } from "../server/mobile/notification-service";
import {
  assertApprovedOfficialSource,
  buildMobileReminderDeliveries,
  DEFAULT_MOBILE_NOTIFICATION_PREFERENCES,
  GENERIC_LOCK_SCREEN_NOTIFICATION,
  isMobileNotificationCategoryEnabled,
} from "../shared/mobile/notification-policy";
import {
  mobileNotificationPreferencesResponseSchema,
  mobileNotificationSchema,
} from "../shared/mobile/contracts";

test("notification defaults prioritize pathway value without opting users into marketing", () => {
  assert.equal(DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.nextAction, true);
  assert.equal(DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.embassy, true);
  assert.equal(DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.opportunities, false);
  assert.equal(isMobileNotificationCategoryEnabled({
    ...DEFAULT_MOBILE_NOTIFICATION_PREFERENCES,
    opportunities: true,
  }, "opportunity"), true);
});

test("lock-screen push copy never contains immigration or financial detail", () => {
  assert.deepEqual(GENERIC_LOCK_SCREEN_NOTIFICATION, {
    title: "New Dawn Pathways",
    body: "You have an update in your pathway.",
  });
  assert.doesNotMatch(
    `${GENERIC_LOCK_SCREEN_NOTIFICATION.title} ${GENERIC_LOCK_SCREEN_NOTIFICATION.body}`,
    /visa|immigration|investment|passport|i-94|referral|fdd/i,
  );
});

test("appointment and FDD reminder schedules follow the approved timing policy", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const appointment = new Date("2026-09-18T12:00:00.000Z");
  const appointmentDeliveries = buildMobileReminderDeliveries("appointment", appointment, now);
  assert.deepEqual(appointmentDeliveries.map((item) => item.availableAt.toISOString()), [
    "2026-09-11T12:00:00.000Z",
    "2026-09-17T12:00:00.000Z",
    "2026-09-18T10:00:00.000Z",
  ]);
  const recordedFddReviewDate = new Date("2026-09-24T12:00:00.000Z");
  assert.equal(
    buildMobileReminderDeliveries("fdd_review", recordedFddReviewDate, now)[0].availableAt.toISOString(),
    "2026-09-24T12:00:00.000Z",
  );
});

test("official-source alerts require an allowlisted HTTPS source and human reviewer", () => {
  assert.doesNotThrow(() => assertApprovedOfficialSource({
    sourceUrl: "https://travel.state.gov/content/travel/en/us-visas.html",
    reviewedBy: "compliance@example.test",
    reviewedAt: new Date("2026-09-08T12:00:00.000Z"),
  }));
  assert.throws(() => assertApprovedOfficialSource({
    sourceUrl: "https://example.com/embassy-news",
    reviewedBy: "reviewer",
    reviewedAt: new Date(),
  }), /approved government source/);
});

test("notification contracts require authenticated details and source provenance", () => {
  const preferences = mobileNotificationPreferencesResponseSchema.parse({
    ...DEFAULT_MOBILE_NOTIFICATION_PREFERENCES,
    updatedAt: "2026-09-08T12:00:00.000Z",
    requestId: "request-1",
  });
  assert.equal(preferences.quietHoursStart, "21:00");

  const notification = mobileNotificationSchema.parse({
    id: "00000000-0000-4000-8000-000000000001",
    category: "embassy",
    urgency: "active",
    title: "Procedure update reviewed",
    body: "Open the reviewed change and next-step explanation.",
    deepLink: "/notifications",
    source: {
      label: "U.S. Department of State",
      url: "https://travel.state.gov/example",
      publishedAt: null,
    },
    availableAt: "2026-09-08T12:00:00.000Z",
    readAt: null,
    createdAt: "2026-09-08T12:00:00.000Z",
  });
  assert.equal(notification.category, "embassy");
});

test("Expo delivery retries transient failures and sends only generic preview text", async () => {
  const bodies: string[] = [];
  let attempts = 0;
  const gateway = new ExpoMobilePushGateway(async (_url, init) => {
    attempts += 1;
    bodies.push(String(init?.body));
    if (attempts < 2) throw new Error("temporary network failure");
    return new Response(JSON.stringify({ data: { status: "ok", id: "ticket-1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await gateway.send({
    expoPushToken: "ExponentPushToken[test-token]",
    notificationId: "00000000-0000-4000-8000-000000000001",
    deepLink: "/notifications",
  });
  assert.equal(attempts, 2);
  assert.equal(bodies.every((body) => body.includes(GENERIC_LOCK_SCREEN_NOTIFICATION.body)), true);
  assert.equal(bodies.every((body) => !/visa|passport|investment/i.test(body)), true);
});
