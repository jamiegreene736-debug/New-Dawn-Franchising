import type { QueryResult, QueryResultRow } from "pg";
import { z } from "zod";

import {
  MOBILE_MIGRATION_PREREQUISITE_TABLES,
  MOBILE_MIGRATION_TABLES,
} from "../../shared/mobile/migration";

const schemaObjectRowSchema = z.object({
  tableName: z.string().min(1),
  present: z.boolean(),
});

type ReadOnlyQueryClient = {
  query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
};

export type MobileSchemaReadiness = {
  prerequisites: readonly z.infer<typeof schemaObjectRowSchema>[];
  mobileTables: readonly z.infer<typeof schemaObjectRowSchema>[];
};

export const mobileSchemaReadinessQuery = `
select
  expected.table_name as "tableName",
  to_regclass(format('public.%I', expected.table_name)) is not null as present
from unnest($1::text[]) as expected(table_name)
order by expected.table_name;
`;

export async function readMobileSchemaReadiness(
  client: ReadOnlyQueryClient,
): Promise<MobileSchemaReadiness> {
  await client.query("BEGIN TRANSACTION READ ONLY");

  try {
    const expectedTables = [
      ...MOBILE_MIGRATION_PREREQUISITE_TABLES,
      ...MOBILE_MIGRATION_TABLES,
    ];
    const result = await client.query(mobileSchemaReadinessQuery, [expectedTables]);
    const rows = z.array(schemaObjectRowSchema).parse(result.rows);
    const resultByTable = new Map(rows.map((row) => [row.tableName, row]));

    const missingResults = expectedTables.filter((tableName) => !resultByTable.has(tableName));
    if (missingResults.length > 0) {
      throw new Error(`Schema readiness query omitted: ${missingResults.join(", ")}`);
    }

    const readiness = {
      prerequisites: MOBILE_MIGRATION_PREREQUISITE_TABLES.map(
        (tableName) => resultByTable.get(tableName)!,
      ),
      mobileTables: MOBILE_MIGRATION_TABLES.map(
        (tableName) => resultByTable.get(tableName)!,
      ),
    };

    await client.query("ROLLBACK");
    return readiness;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original query or validation error.
    }
    throw error;
  }
}
