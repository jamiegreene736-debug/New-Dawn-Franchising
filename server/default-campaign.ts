import { reviewedEmailSteps } from "@shared/outreach-copy";
import { storage } from "./storage";

const DEFAULT_CAMPAIGN_NAME = "E-2 Visa Professional Outreach";

export const DEFAULT_STEPS = reviewedEmailSteps([0, 7, 14].map((delayDays, index) => ({
  stepOrder: index + 1, delayDays, stepType: "email", stepName: "", priority: "Medium", subject: "", bodyHtml: "", bodyText: "",
})), "broker");

export async function seedDefaultCampaign() {
  try {
    const existing = await storage.getDripCampaigns();
    if (existing.length > 0) {
      return;
    }

    const campaign = await storage.createDripCampaign({
      name: DEFAULT_CAMPAIGN_NAME,
      description: "Three-email professional review sequence for qualified referral partners.",
      isActive: false,
    });

    for (const step of DEFAULT_STEPS) {
      await storage.createDripStep({
        campaignId: campaign.id,
        ...step,
      });
    }

    console.log(`[Drip] Default campaign "${DEFAULT_CAMPAIGN_NAME}" created with ${DEFAULT_STEPS.length} steps.`);
  } catch (err) {
    console.error("[Drip] Failed to seed default campaign:", err);
  }
}
