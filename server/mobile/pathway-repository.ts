import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import {
  mobilePathwayMilestoneKeySchema,
  mobilePathwayMilestoneSchema,
  mobilePathwayMilestoneStateSchema,
  mobilePathwayOwnerSchema,
  type MobilePathwayMilestone,
  type MobilePathwayMilestoneKey,
  type MobilePathwayOwner,
  type MobilePathwayResponse,
} from "@shared/mobile/contracts";

export const MOBILE_PATHWAY_VERSION = "2026.1";

export const INITIAL_MOBILE_PATHWAY: ReadonlyArray<{
  key: MobilePathwayMilestoneKey;
  owner: MobilePathwayOwner;
  state: "available" | "not_started";
}> = [
  { key: "initial_readiness", owner: "investor", state: "available" },
  { key: "counsel_consultation", owner: "shared", state: "not_started" },
  { key: "business_model_review", owner: "shared", state: "not_started" },
  { key: "fdd_review", owner: "shared", state: "not_started" },
  { key: "territory_operating_plan", owner: "shared", state: "not_started" },
  { key: "entity_investment_business_plan", owner: "shared", state: "not_started" },
  { key: "visa_preparation", owner: "independent_counsel", state: "not_started" },
  { key: "launch_training", owner: "shared", state: "not_started" },
];

type QueryClient = Pick<PoolClient, "query">;

const pathwayRowSchema = z.object({
  pathwayVersion: z.string().min(1).max(32),
  key: mobilePathwayMilestoneKeySchema,
  sequence: z.number().int().min(1).max(100),
  owner: mobilePathwayOwnerSchema,
  state: mobilePathwayMilestoneStateSchema,
  updatedAt: z.date(),
});

export async function initializeInvestorPathway(
  client: QueryClient,
  identityId: string,
  requestId: string,
  now: Date,
): Promise<void> {
  const instanceResult = await client.query<{ id: string }>(
    `insert into mobile_pathway_instances
       (identity_id, pathway_version, created_at, updated_at)
     values ($1, $2, $3, $3)
     on conflict (identity_id) do nothing
     returning id`,
    [identityId, MOBILE_PATHWAY_VERSION, now],
  );
  const instanceId = instanceResult.rows[0]?.id;
  if (!instanceId) return;

  for (const [index, milestone] of INITIAL_MOBILE_PATHWAY.entries()) {
    const milestoneResult = await client.query<{ id: string }>(
      `insert into mobile_pathway_milestones
         (pathway_instance_id, milestone_key, sequence, owner, state, updated_at)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [instanceId, milestone.key, index + 1, milestone.owner, milestone.state, now],
    );
    const milestoneId = z.string().uuid().parse(milestoneResult.rows[0]?.id);
    await client.query(
      `insert into mobile_pathway_events
         (milestone_id, actor_identity_id, event_type, state_before, state_after,
          request_id, reason, occurred_at, recorded_at)
       values ($1, $2, 'pathway.initialized', null, $3, $4, 'Initial pilot pathway', $5, $5)`,
      [milestoneId, identityId, milestone.state, requestId, now],
    );
  }
}

export class PostgresMobilePathwayRepository {
  constructor(private readonly pool: Pool) {}

  async readPath(identityId: string): Promise<Omit<MobilePathwayResponse, "requestId"> | null> {
    const result = await this.pool.query(
      `select i.pathway_version as "pathwayVersion", m.milestone_key as key,
              m.sequence, m.owner, m.state, m.updated_at as "updatedAt"
         from mobile_pathway_instances i
         join mobile_pathway_milestones m on m.pathway_instance_id = i.id
        where i.identity_id = $1
        order by m.sequence`,
      [identityId],
    );
    if (result.rows.length === 0) return null;
    const rows = z.array(pathwayRowSchema).parse(result.rows);
    const milestones = rows.map(toMilestone);
    return {
      pathwayVersion: rows[0].pathwayVersion,
      completedMilestones: milestones.filter((milestone) => milestone.state === "completed").length,
      totalMilestones: milestones.length,
      milestones,
    };
  }

  async readMilestone(
    identityId: string,
    milestoneKey: MobilePathwayMilestoneKey,
  ): Promise<{ pathwayVersion: string; milestone: MobilePathwayMilestone } | null> {
    const result = await this.pool.query(
      `select i.pathway_version as "pathwayVersion", m.milestone_key as key,
              m.sequence, m.owner, m.state, m.updated_at as "updatedAt"
         from mobile_pathway_instances i
         join mobile_pathway_milestones m on m.pathway_instance_id = i.id
        where i.identity_id = $1 and m.milestone_key = $2`,
      [identityId, milestoneKey],
    );
    const row = result.rows[0] ? pathwayRowSchema.parse(result.rows[0]) : null;
    return row ? { pathwayVersion: row.pathwayVersion, milestone: toMilestone(row) } : null;
  }
}

function toMilestone(row: z.infer<typeof pathwayRowSchema>): MobilePathwayMilestone {
  return mobilePathwayMilestoneSchema.parse({
    key: row.key,
    sequence: row.sequence,
    owner: row.owner,
    state: row.state,
    updatedAt: row.updatedAt.toISOString(),
  });
}
