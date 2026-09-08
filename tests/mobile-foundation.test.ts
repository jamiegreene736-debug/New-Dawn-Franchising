import assert from "node:assert/strict";
import test from "node:test";

import { readRequiredEnvironmentValue } from "../server/runtime-config";
import { readApplicationRuntimeProfile } from "../server/runtime-profile";
import { runMobileIdentityQualityDryRun } from "../server/mobile/identity-quality";
import {
  mobileApiErrorSchema,
  mobileStatusResponseSchema,
} from "../shared/mobile/contracts";

type RuntimeModule = typeof import("../mobile/src/config/runtime");
type MessagesModule = typeof import("../mobile/src/i18n/messages");
type WelcomeFunnelModule = typeof import("../mobile/src/analytics/welcome-funnel");
type E2OverviewModule = typeof import("../mobile/src/content/e2-overview");

const loadedRuntimeModule = await import("../mobile/src/config/runtime") as RuntimeModule & { default?: RuntimeModule };
const loadedMessagesModule = await import("../mobile/src/i18n/messages") as MessagesModule & { default?: MessagesModule };
const loadedWelcomeFunnelModule = await import("../mobile/src/analytics/welcome-funnel") as WelcomeFunnelModule & { default?: WelcomeFunnelModule };
const loadedE2OverviewModule = await import("../mobile/src/content/e2-overview") as E2OverviewModule & { default?: E2OverviewModule };
const { createRuntimeConfig } = loadedRuntimeModule.default ?? loadedRuntimeModule;
const { hasTranslationParity, translate } = loadedMessagesModule.default ?? loadedMessagesModule;
const { trackWelcomeFunnelEvent, welcomeFunnelEvents } = loadedWelcomeFunnelModule.default ?? loadedWelcomeFunnelModule;
const { getE2OverviewContent, officialE2Sources } = loadedE2OverviewModule.default ?? loadedE2OverviewModule;

test("required server configuration fails closed", () => {
  assert.equal(readRequiredEnvironmentValue("SESSION_SECRET", { SESSION_SECRET: " secure-value " }), "secure-value");
  assert.throws(
    () => readRequiredEnvironmentValue("SESSION_SECRET", {}),
    /SESSION_SECRET is missing/,
  );
});

test("mobile staging runtime disables every legacy side-effect surface", () => {
  assert.deepEqual(
    readApplicationRuntimeProfile({
      APP_RUNTIME_MODE: "mobile-staging",
      RAILWAY_ENVIRONMENT_NAME: "staging",
    }),
    {
      mode: "mobile-staging",
      legacySessionEnabled: false,
      legacyStartupWritesEnabled: false,
      legacyRoutesEnabled: false,
      backgroundJobsEnabled: false,
      staticWebsiteEnabled: false,
      providerWarmupsEnabled: false,
    },
  );
  assert.throws(
    () => readApplicationRuntimeProfile({
      APP_RUNTIME_MODE: "mobile-staging",
      RAILWAY_ENVIRONMENT_NAME: "production",
    }),
    /only run in the Railway staging environment/,
  );
  assert.throws(
    () => readApplicationRuntimeProfile({ APP_RUNTIME_MODE: "preview" }),
    /must be full or mobile-staging/,
  );
});

test("mobile runtime remains isolated unless connected mode is complete", () => {
  assert.deepEqual(createRuntimeConfig({}), { mode: "prototype", apiBaseUrl: null });
  assert.deepEqual(
    createRuntimeConfig({ appMode: "connected", apiBaseUrl: "https://example.com/" }),
    { mode: "connected", apiBaseUrl: "https://example.com" },
  );
  assert.throws(
    () => createRuntimeConfig({ appMode: "connected" }),
    /API_BASE_URL is required/,
  );
});

test("English and Spanish controlled navigation content have key parity", () => {
  assert.equal(hasTranslationParity(), true);
  assert.equal(translate("en", "nav.home"), "Home");
  assert.equal(translate("es", "nav.home"), "Inicio");
  assert.equal(translate("en", "welcome.investorTitle"), "Explore business ownership");
  assert.equal(translate("es", "welcome.partnerTitle"), "Referir a posibles inversionistas");
});

test("welcome funnel analytics use a fixed payload-free event allowlist", () => {
  const events = Object.values(welcomeFunnelEvents);
  assert.equal(new Set(events).size, events.length);
  assert.deepEqual(events, [
    "welcome.investor_selected",
    "welcome.partner_selected",
    "welcome.attorney_selected",
    "welcome.e2_overview_selected",
    "welcome.sign_in_selected",
  ]);

  const recorded: string[] = [];
  trackWelcomeFunnelEvent(welcomeFunnelEvents.investorSelected, (event) => recorded.push(event));
  assert.deepEqual(recorded, ["welcome.investor_selected"]);
});

test("E-2 education remains bilingual, sourced, and time-bounds the temporary H-1B payment", () => {
  const duringProclamation = new Date("2026-09-08T16:00:00Z");
  const afterProclamation = new Date("2026-09-21T04:01:01Z");
  const english = getE2OverviewContent("en", duringProclamation);
  const spanish = getE2OverviewContent("es", duringProclamation);

  assert.equal(english.steps.length, spanish.steps.length);
  assert.equal(english.comparisons.length, spanish.comparisons.length);
  assert.match(english.comparisons[1].detail, /\$100,000/);
  assert.doesNotMatch(getE2OverviewContent("en", afterProclamation).comparisons[1].detail, /\$100,000/);
  assert.equal(Object.values(officialE2Sources).every((source) => source.url.startsWith("https://")), true);
});

test("mobile status contract accepts only versioned responses", () => {
  const status = mobileStatusResponseSchema.parse({
    apiVersion: "v1",
    availability: "prelaunch",
    minimumAppVersion: "1.0.0",
    requestId: "request-123",
  });

  assert.equal(status.apiVersion, "v1");
  assert.throws(() => mobileStatusResponseSchema.parse({ ...status, apiVersion: "v2" }));
});

test("mobile API errors require a safe stable code and request ID", () => {
  const response = mobileApiErrorSchema.parse({
    error: {
      code: "CONTENT_NOT_APPROVED",
      message: "Content is not available.",
      requestId: "request-456",
      retryable: false,
    },
  });

  assert.equal(response.error.retryable, false);
});

test("identity quality reporting runs inside a read-only transaction and returns aggregates only", async () => {
  const queries: string[] = [];
  const aggregateRows = [{
    tableName: "crm_clients",
    total: 417,
    missingEmail: 8,
    usableEmailRows: 409,
    normalizedUnique: 395,
    duplicateGroups: 12,
    duplicateExcess: 14,
  }];
  const client = {
    async query(queryText: string) {
      queries.push(queryText);
      return {
        command: "SELECT",
        rowCount: queryText.includes("identity_quality") ? aggregateRows.length : null,
        oid: 0,
        fields: [],
        rows: queryText.includes("identity_quality") ? aggregateRows : [],
      };
    },
  };

  const result = await runMobileIdentityQualityDryRun(client);

  assert.deepEqual(result, aggregateRows);
  assert.equal(queries[0], "BEGIN TRANSACTION READ ONLY");
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(Object.hasOwn(result[0], "email"), false);
});

test("identity quality reporting rolls back when validation fails", async () => {
  const queries: string[] = [];
  const client = {
    async query(queryText: string) {
      queries.push(queryText);
      return {
        command: "SELECT",
        rowCount: queryText.includes("identity_quality") ? 1 : null,
        oid: 0,
        fields: [],
        rows: queryText.includes("identity_quality") ? [{ tableName: "crm_clients", total: -1 }] : [],
      };
    },
  };

  await assert.rejects(() => runMobileIdentityQualityDryRun(client));
  assert.equal(queries.at(-1), "ROLLBACK");
});
