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

const loadedRuntimeModule = await import("../mobile/src/config/runtime") as RuntimeModule & { default?: RuntimeModule };
const loadedMessagesModule = await import("../mobile/src/i18n/messages") as MessagesModule & { default?: MessagesModule };
const { createRuntimeConfig } = loadedRuntimeModule.default ?? loadedRuntimeModule;
const { hasTranslationParity, translate } = loadedMessagesModule.default ?? loadedMessagesModule;

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
