import { storage } from "./storage";
import {
  BROKER_TRACK,
  BROKER_2_TRACK,
  CLIENT_TRACK,
  BROKER_CAMPAIGN_NAME,
  BROKER_2_CAMPAIGN_NAME,
  CLIENT_CAMPAIGN_NAME,
  withSpacing,
  type CampaignTrackStep,
  type TrackId,
} from "@shared/campaign-tracks";

// Re-export for any caller that still references the broker campaign name.
export const GROK_CAMPAIGN_NAME = BROKER_CAMPAIGN_NAME;

const BROKER_DESCRIPTION =
  "Broker outreach from Dylan: short, reply-focused emails about client fit, owner responsibilities, and written materials for independent review.";

const BROKER_2_DESCRIPTION =
  "Professional-partner outreach from Dylan with concise questions and document-led follow-ups. Emails avoid unsubstantiated investment or visa promises.";

const CLIENT_DESCRIPTION =
  "Investor outreach from Dylan: franchise interests, owner responsibilities, and disclosure materials. Client emails do not use partner or referral-fee language.";

/**
 * Create or re-sync a single track's drip campaign.
 *
 * - If the campaign already exists (matched by exact name), re-sync each step's
 *   content (subject/body/type/name/delay) by stepOrder so template improvements
 *   reach the seeded campaign without a manual DB edit, and backfill audienceType.
 * - Otherwise create it with all steps.
 *
 * LOAD-BEARING: BROKER_CAMPAIGN_NAME stays exactly "Grok Campaign" so the broker
 * track reuses the already-seeded campaign + its enrollments. Steps are matched
 * by stepOrder (never reordered) for the same reason.
 */
export async function seedTrackCampaign(
  name: string,
  description: string,
  audienceType: TrackId,
  steps: CampaignTrackStep[],
): Promise<void> {
  const existing = await storage.getDripCampaigns();
  const found = existing.find((c) => c.name === name);

  if (found) {
    if ((found as any).audienceType !== audienceType) {
      await storage.updateDripCampaign(found.id, { audienceType } as any);
    }

    const dbSteps = await storage.getDripSteps(found.id);
    let updated = 0;
    for (const def of steps) {
      const body = withSpacing(def.bodyHtml);
      const match = dbSteps.find((s) => s.stepOrder === def.stepOrder);
      if (!match) {
        await storage.createDripStep({
          campaignId: found.id,
          stepOrder: def.stepOrder,
          delayDays: def.delayDays,
          stepType: def.stepType,
          stepName: def.stepName,
          priority: def.priority,
          subject: def.subject,
          bodyHtml: body,
        });
        updated++;
        continue;
      }
      if (
        match.bodyHtml !== body ||
        match.subject !== def.subject ||
        match.stepType !== def.stepType ||
        match.stepName !== def.stepName ||
        match.delayDays !== def.delayDays
      ) {
        await storage.updateDripStep(match.id, {
          bodyHtml: body,
          subject: def.subject,
          stepType: def.stepType,
          stepName: def.stepName,
          delayDays: def.delayDays,
          priority: def.priority,
        });
        updated++;
      }
    }
    if (updated > 0) console.log(`[Drip] "${name}" re-synced ${updated} step(s).`);
    return;
  }

  const campaign = await storage.createDripCampaign({
    name,
    description,
    isActive: true,
    audienceType,
  } as any);

  for (const step of steps) {
    await storage.createDripStep({
      campaignId: campaign.id,
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      stepType: step.stepType,
      stepName: step.stepName,
      priority: step.priority,
      subject: step.subject,
      bodyHtml: withSpacing(step.bodyHtml),
    });
  }

  console.log(`[Drip] "${name}" created with ${steps.length} steps.`);
}

/**
 * Seed all three outreach tracks:
 *   • "Grok Campaign"               — legacy broker referral-partner pitch (audience: broker)
 *   • "Grok 2.0 - for brokers"      — Grok 2.0 broker referral-partner pitch (audience: broker)
 *   • "Grok Campaign 2.0 - Clients" — direct-to-E-2-investor pitch (audience: client)
 */
export async function seedGrokCampaign(): Promise<void> {
  try {
    await seedTrackCampaign(BROKER_CAMPAIGN_NAME, BROKER_DESCRIPTION, "broker", BROKER_TRACK);
    await seedTrackCampaign(BROKER_2_CAMPAIGN_NAME, BROKER_2_DESCRIPTION, "broker", BROKER_2_TRACK);
    await seedTrackCampaign(CLIENT_CAMPAIGN_NAME, CLIENT_DESCRIPTION, "client", CLIENT_TRACK);
  } catch (err) {
    console.error(`[Drip] Failed to seed Grok campaigns:`, err);
  }
}
