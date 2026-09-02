import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  verifyMobileMigrationDirectory,
  verifyMobileMigrationSql,
} from "../script/mobile-migration-safety";
import { readMobileSchemaReadiness } from "../server/mobile/schema-readiness";
import {
  MOBILE_MIGRATION_ENUMS,
  MOBILE_MIGRATION_PREREQUISITE_TABLES,
  MOBILE_MIGRATION_TABLES,
} from "../shared/mobile/migration";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("generated migration creates exactly the reviewed mobile schema", async () => {
  const result = await verifyMobileMigrationDirectory(
    path.join(repositoryRoot, "migrations/mobile"),
  );

  assert.deepEqual(result.files, ["0000_mobile_identity_foundation.sql"]);
  assert.deepEqual(result.createdTables, [...MOBILE_MIGRATION_TABLES].sort());
  assert.deepEqual(result.createdEnums, [...MOBILE_MIGRATION_ENUMS].sort());
  assert.deepEqual(result.externalReferences, [...MOBILE_MIGRATION_PREREQUISITE_TABLES]);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("migration verifier rejects data writes and destructive SQL", () => {
  assert.throws(
    () => verifyMobileMigrationSql('DELETE FROM "crm_clients";', "unsafe.sql"),
    /forbidden/,
  );
  assert.throws(
    () => verifyMobileMigrationSql('DROP TABLE "mobile_identities";', "unsafe.sql"),
    /forbidden/,
  );
});

test("migration verifier rejects changes to core tables", () => {
  assert.throws(
    () => verifyMobileMigrationSql(
      'ALTER TABLE "crm_clients" ADD COLUMN "mobile_status" text;',
      "unsafe.sql",
    ),
    /outside the mobile-only allowlist/,
  );
});

test("schema readiness inspection is aggregate-only and always rolls back", async () => {
  const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
  const expectedTables = [
    ...MOBILE_MIGRATION_PREREQUISITE_TABLES,
    ...MOBILE_MIGRATION_TABLES,
  ];
  const client = {
    async query(queryText: string, values?: readonly unknown[]) {
      queries.push({ text: queryText, values });
      const rows = queryText.includes("to_regclass")
        ? expectedTables.map((tableName) => ({
          tableName,
          present: tableName === "crm_clients",
        }))
        : [];
      return {
        command: "SELECT",
        rowCount: rows.length,
        oid: 0,
        fields: [],
        rows,
      };
    },
  };

  const result = await readMobileSchemaReadiness(client);

  assert.equal(queries[0].text, "BEGIN TRANSACTION READ ONLY");
  assert.deepEqual(queries[1].values, [expectedTables]);
  assert.equal(queries.at(-1)?.text, "ROLLBACK");
  assert.deepEqual(result.prerequisites, [{ tableName: "crm_clients", present: true }]);
  assert.equal(result.mobileTables.every((table) => table.present === false), true);
  assert.equal(Object.hasOwn(result.mobileTables[0], "rowCount"), false);
});

test("schema readiness inspection rolls back when the database response is incomplete", async () => {
  const queries: string[] = [];
  const client = {
    async query(queryText: string) {
      queries.push(queryText);
      return {
        command: "SELECT",
        rowCount: 0,
        oid: 0,
        fields: [],
        rows: [],
      };
    },
  };

  await assert.rejects(() => readMobileSchemaReadiness(client), /omitted/);
  assert.equal(queries.at(-1), "ROLLBACK");
});
