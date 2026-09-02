import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOBILE_MIGRATION_ENUMS,
  MOBILE_MIGRATION_PREREQUISITE_TABLES,
  MOBILE_MIGRATION_TABLES,
} from "../shared/mobile/migration";

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";
const FORBIDDEN_STATEMENT_START = /^(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE|MERGE|COPY|GRANT|REVOKE|CALL|DO\b|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b)/i;
const MOBILE_NAME = "mobile_[a-z0-9_]+";

const CREATE_TYPE_PATTERN = new RegExp(
  `^CREATE TYPE "public"\."(${MOBILE_NAME})" AS ENUM\\([^;]+\\);$`,
  "s",
);
const CREATE_TABLE_PATTERN = new RegExp(
  `^CREATE TABLE "(${MOBILE_NAME})" \\([\\s\\S]+\\);$`,
);
const ALTER_TABLE_PATTERN = new RegExp(
  `^ALTER TABLE "(${MOBILE_NAME})" ADD CONSTRAINT "(${MOBILE_NAME})" FOREIGN KEY \\("[a-z0-9_]+"\\) REFERENCES "public"\."(${MOBILE_NAME}|crm_clients)"\\("id"\\) ON DELETE (?:cascade|restrict|set null|no action) ON UPDATE no action;$`,
  "i",
);
const CREATE_INDEX_PATTERN = new RegExp(
  `^CREATE (?:UNIQUE )?INDEX "(${MOBILE_NAME})" ON "(${MOBILE_NAME})" USING btree \\([\\s\\S]+\\);$`,
);

export type MobileMigrationVerification = {
  files: readonly string[];
  sha256: string;
  statementCount: number;
  createdTables: readonly string[];
  createdEnums: readonly string[];
  externalReferences: readonly string[];
};

type SqlVerification = Omit<MobileMigrationVerification, "files" | "sha256">;

function requireExactlyOneTerminator(statement: string, source: string): void {
  const terminators = statement.match(/;/g)?.length ?? 0;
  if (terminators !== 1 || !statement.endsWith(";")) {
    throw new Error(`${source}: each migration statement must have one trailing semicolon`);
  }
}

export function verifyMobileMigrationSql(sql: string, source = "migration"): SqlVerification {
  if (/\/\*|\*\/|--(?!> statement-breakpoint)/.test(sql)) {
    throw new Error(`${source}: SQL comments are not permitted in the reviewed migration package`);
  }

  const statements = sql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    throw new Error(`${source}: migration contains no statements`);
  }

  const createdTables = new Set<string>();
  const createdEnums = new Set<string>();
  const externalReferences = new Set<string>();

  statements.forEach((statement, index) => {
    const statementSource = `${source} statement ${index + 1}`;
    requireExactlyOneTerminator(statement, statementSource);

    if (FORBIDDEN_STATEMENT_START.test(statement)) {
      throw new Error(`${statementSource}: data writes, destructive SQL, and executable SQL are forbidden`);
    }

    const typeMatch = statement.match(CREATE_TYPE_PATTERN);
    if (typeMatch) {
      createdEnums.add(typeMatch[1]);
      return;
    }

    const tableMatch = statement.match(CREATE_TABLE_PATTERN);
    if (tableMatch) {
      createdTables.add(tableMatch[1]);
      return;
    }

    const alterMatch = statement.match(ALTER_TABLE_PATTERN);
    if (alterMatch) {
      const [, alteredTable, , referencedTable] = alterMatch;
      if (referencedTable === "crm_clients") {
        externalReferences.add(referencedTable);
      }
      if (!alteredTable.startsWith("mobile_")) {
        throw new Error(`${statementSource}: core tables may only be referenced, never altered`);
      }
      return;
    }

    const indexMatch = statement.match(CREATE_INDEX_PATTERN);
    if (indexMatch) {
      const [, indexName, indexedTable] = indexMatch;
      if (!indexName.startsWith("mobile_") || !indexedTable.startsWith("mobile_")) {
        throw new Error(`${statementSource}: indexes must remain inside the mobile namespace`);
      }
      return;
    }

    throw new Error(`${statementSource}: statement is outside the mobile-only allowlist`);
  });

  return {
    statementCount: statements.length,
    createdTables: [...createdTables].sort(),
    createdEnums: [...createdEnums].sort(),
    externalReferences: [...externalReferences].sort(),
  };
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string): void {
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} mismatch: expected ${normalizedExpected.join(", ")}; received ${normalizedActual.join(", ")}`,
    );
  }
}

export async function verifyMobileMigrationDirectory(
  migrationDirectory: string,
): Promise<MobileMigrationVerification> {
  const files = (await readdir(migrationDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error("No SQL migration files were found");
  }

  const digest = createHash("sha256");
  const createdTables = new Set<string>();
  const createdEnums = new Set<string>();
  const externalReferences = new Set<string>();
  let statementCount = 0;

  for (const fileName of files) {
    const sql = await readFile(path.join(migrationDirectory, fileName), "utf8");
    digest.update(fileName);
    digest.update("\0");
    digest.update(sql);

    const result = verifyMobileMigrationSql(sql, fileName);
    statementCount += result.statementCount;
    result.createdTables.forEach((table) => createdTables.add(table));
    result.createdEnums.forEach((enumName) => createdEnums.add(enumName));
    result.externalReferences.forEach((table) => externalReferences.add(table));
  }

  const tables = [...createdTables].sort();
  const enums = [...createdEnums].sort();
  const references = [...externalReferences].sort();
  assertExactSet(tables, MOBILE_MIGRATION_TABLES, "Created mobile tables");
  assertExactSet(enums, MOBILE_MIGRATION_ENUMS, "Created mobile enums");
  assertExactSet(references, MOBILE_MIGRATION_PREREQUISITE_TABLES, "External references");

  return {
    files,
    sha256: digest.digest("hex"),
    statementCount,
    createdTables: tables,
    createdEnums: enums,
    externalReferences: references,
  };
}

async function main(): Promise<void> {
  const migrationDirectory = path.resolve(process.cwd(), "migrations/mobile");
  const result = await verifyMobileMigrationDirectory(migrationDirectory);
  console.log(JSON.stringify({
    mode: "static-verification-only",
    databaseConnected: false,
    ...result,
  }, null, 2));
}

const executedDirectly = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown migration verification error";
    console.error(`[mobile-migration-safety] ${message}`);
    process.exitCode = 1;
  });
}
