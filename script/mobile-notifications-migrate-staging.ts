import { readFile } from "node:fs/promises";
import path from "node:path";

import { pool } from "../server/db";
import { verifyMobileMigrationSql } from "./mobile-migration-safety";

const APPROVED_PROJECT_ID = "270761d2-9eda-42a7-b350-95cb89f2d16c";
const APPROVED_STAGING_ENVIRONMENT_ID = "8b13ef91-c513-49a0-90d8-bc351b1f48ec";
const MIGRATION_FILE = "0002_mobile_notifications.sql";
const BASE_TABLE_COUNT = 13;
const NOTIFICATION_TABLES = [
  "mobile_notification_preferences",
  "mobile_push_devices",
  "mobile_notification_reminders",
  "mobile_notifications",
] as const;
const NOTIFICATION_ENUMS = [
  "mobile_notification_category",
  "mobile_notification_platform",
  "mobile_notification_urgency",
  "mobile_reminder_kind",
] as const;

function assertApprovedTarget(): void {
  if (
    process.env.RAILWAY_PROJECT_ID !== APPROVED_PROJECT_ID
    || process.env.RAILWAY_ENVIRONMENT_ID !== APPROVED_STAGING_ENVIRONMENT_ID
    || process.env.RAILWAY_ENVIRONMENT_NAME !== "staging"
  ) {
    throw new Error("Refusing migration: target is not the approved isolated New Dawn staging environment");
  }
}

function assertExact(actual: readonly string[], expected: readonly string[], label: string): void {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} did not match the reviewed notification migration`);
  }
}

async function main(): Promise<void> {
  assertApprovedTarget();
  const migrationPath = path.resolve(process.cwd(), "migrations/mobile", MIGRATION_FILE);
  const sql = await readFile(migrationPath, "utf8");
  const verification = verifyMobileMigrationSql(sql, MIGRATION_FILE);
  assertExact(verification.createdTables, NOTIFICATION_TABLES, "Created tables");
  assertExact(verification.createdEnums, NOTIFICATION_ENUMS, "Created enums");
  assertExact(verification.externalReferences, [], "External references");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(hashtext('new_dawn_mobile_notifications_v1'))");
    const existingResult = await client.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name like 'mobile_%'
      order by table_name;
    `);
    const existing = new Set(existingResult.rows.map((row) => row.table_name));
    const presentNotificationTables = NOTIFICATION_TABLES.filter((table) => existing.has(table));

    if (presentNotificationTables.length === NOTIFICATION_TABLES.length) {
      await client.query("ROLLBACK");
      console.log(JSON.stringify({
        result: "already-applied",
        project: process.env.RAILWAY_PROJECT_NAME,
        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
        notificationTableCount: presentNotificationTables.length,
      }));
      return;
    }
    if (presentNotificationTables.length > 0 || existing.size !== BASE_TABLE_COUNT) {
      throw new Error(
        `Refusing migration: expected ${BASE_TABLE_COUNT} base tables and zero notification tables; found ${existing.size} and ${presentNotificationTables.length}`,
      );
    }

    await client.query(sql);
    const readback = await client.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name;
    `, [NOTIFICATION_TABLES]);
    assertExact(readback.rows.map((row) => row.table_name), NOTIFICATION_TABLES, "Staging readback");
    await client.query("COMMIT");
    console.log(JSON.stringify({
      result: "applied",
      project: process.env.RAILWAY_PROJECT_NAME,
      environment: process.env.RAILWAY_ENVIRONMENT_NAME,
      notificationTableCount: readback.rowCount,
      containsCustomerData: false,
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown notification migration error";
  console.error(`[mobile-notifications-migrate-staging] ${message}`);
  process.exitCode = 1;
});
