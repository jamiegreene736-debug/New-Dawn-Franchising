import type { QueryResult, QueryResultRow } from "pg";
import { z } from "zod";

export const mobileIdentityQualityRowSchema = z.object({
  tableName: z.enum(["crm_clients", "contacts", "brokers", "broker_clients"]),
  total: z.number().int().nonnegative(),
  missingEmail: z.number().int().nonnegative(),
  usableEmailRows: z.number().int().nonnegative(),
  normalizedUnique: z.number().int().nonnegative(),
  duplicateGroups: z.number().int().nonnegative(),
  duplicateExcess: z.number().int().nonnegative(),
});

export type MobileIdentityQualityRow = z.infer<typeof mobileIdentityQualityRowSchema>;

type ReadOnlyQueryClient = {
  query<R extends QueryResultRow = QueryResultRow>(queryText: string): Promise<QueryResult<R>>;
};

export const mobileIdentityQualityQuery = `
with identity_quality as (
  select
    'crm_clients'::text as table_name,
    count(*)::int as total,
    count(*) filter (where email is null or trim(email) = '')::int as missing_email,
    count(*) filter (where email is not null and trim(email) <> '')::int as usable_email_rows,
    count(distinct lower(trim(email))) filter (where email is not null and trim(email) <> '')::int as normalized_unique,
    (
      select count(*)::int
      from (
        select lower(trim(email))
        from crm_clients
        where email is not null and trim(email) <> ''
        group by lower(trim(email))
        having count(*) > 1
      ) duplicate_groups
    ) as duplicate_groups
  from crm_clients

  union all

  select
    'contacts'::text,
    count(*)::int,
    count(*) filter (where email is null or trim(email) = '')::int,
    count(*) filter (where email is not null and trim(email) <> '')::int,
    count(distinct lower(trim(email))) filter (where email is not null and trim(email) <> '')::int,
    (
      select count(*)::int
      from (
        select lower(trim(email))
        from contacts
        where email is not null and trim(email) <> ''
        group by lower(trim(email))
        having count(*) > 1
      ) duplicate_groups
    )
  from contacts

  union all

  select
    'brokers'::text,
    count(*)::int,
    count(*) filter (where email is null or trim(email) = '')::int,
    count(*) filter (where email is not null and trim(email) <> '')::int,
    count(distinct lower(trim(email))) filter (where email is not null and trim(email) <> '')::int,
    (
      select count(*)::int
      from (
        select lower(trim(email))
        from brokers
        where email is not null and trim(email) <> ''
        group by lower(trim(email))
        having count(*) > 1
      ) duplicate_groups
    )
  from brokers

  union all

  select
    'broker_clients'::text,
    count(*)::int,
    count(*) filter (where email is null or trim(email) = '')::int,
    count(*) filter (where email is not null and trim(email) <> '')::int,
    count(distinct lower(trim(email))) filter (where email is not null and trim(email) <> '')::int,
    (
      select count(*)::int
      from (
        select lower(trim(email))
        from broker_clients
        where email is not null and trim(email) <> ''
        group by lower(trim(email))
        having count(*) > 1
      ) duplicate_groups
    )
  from broker_clients
)
select
  table_name as "tableName",
  total,
  missing_email as "missingEmail",
  usable_email_rows as "usableEmailRows",
  normalized_unique as "normalizedUnique",
  duplicate_groups as "duplicateGroups",
  (usable_email_rows - normalized_unique)::int as "duplicateExcess"
from identity_quality
order by table_name;
`;

export async function runMobileIdentityQualityDryRun(
  client: ReadOnlyQueryClient,
): Promise<MobileIdentityQualityRow[]> {
  await client.query("BEGIN TRANSACTION READ ONLY");

  try {
    const result = await client.query(mobileIdentityQualityQuery);
    const parsed = z.array(mobileIdentityQualityRowSchema).parse(result.rows);
    await client.query("ROLLBACK");
    return parsed;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original query or validation error.
    }
    throw error;
  }
}
