import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_MOBILE_PATHWAY,
  MOBILE_PATHWAY_VERSION,
} from "../server/mobile/pathway-repository";
import { mobilePathwayResponseSchema } from "../shared/mobile/contracts";

test("new investor pathways begin without unsupported completion claims", () => {
  assert.equal(MOBILE_PATHWAY_VERSION, "2026.1");
  assert.equal(INITIAL_MOBILE_PATHWAY.length, 8);
  assert.equal(new Set(INITIAL_MOBILE_PATHWAY.map((milestone) => milestone.key)).size, 8);
  assert.equal(INITIAL_MOBILE_PATHWAY[0].state, "available");
  assert.equal(
    INITIAL_MOBILE_PATHWAY.some((milestone) => milestone.state === "completed"),
    false,
  );
});

test("investor pathway responses keep progress consistent with durable states", () => {
  const now = "2026-09-02T12:00:00.000Z";
  const response = mobilePathwayResponseSchema.parse({
    pathwayVersion: MOBILE_PATHWAY_VERSION,
    completedMilestones: 0,
    totalMilestones: INITIAL_MOBILE_PATHWAY.length,
    milestones: INITIAL_MOBILE_PATHWAY.map((milestone, index) => ({
      ...milestone,
      sequence: index + 1,
      updatedAt: now,
    })),
    requestId: "pathway-contract-test",
  });

  assert.equal(response.completedMilestones, 0);
  assert.equal(response.milestones[7].key, "launch_training");
});
