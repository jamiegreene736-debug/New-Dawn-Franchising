import { storage } from "./storage";

const DEFAULT_CAMPAIGN_NAME = "E-2 Visa Professional Outreach";

export const DEFAULT_STEPS = [
  {
    "stepOrder": 1,
    "delayDays": 0,
    "subject": "E-2 clients still choosing a business",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>I'm Dylan at New Dawn Franchising. We work with people comparing U.S. franchise businesses as part of their E-2 planning.</p><p>Do you work with clients who are still choosing a business?</p><p>Best,<br/>Dylan</p>"
  },
  {
    "stepOrder": 2,
    "delayDays": 3,
    "subject": "A short overview for your review",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>Following up on my note about New Dawn. I can send a short overview of our Property Management, Insurance, and Telecom franchise options, including the owner's role.</p><p>Would that be useful for your review?</p><p>Best,<br/>Dylan</p>"
  },
  {
    "stepOrder": 3,
    "delayDays": 7,
    "subject": "What your client would manage",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.</p><p>Would you like that outline?</p><p>Best,<br/>Dylan</p>"
  },
  {
    "stepOrder": 4,
    "delayDays": 14,
    "subject": "Documents before a recommendation",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.</p><p>Would you like me to send those?</p><p>Best,<br/>Dylan</p>"
  },
  {
    "stepOrder": 5,
    "delayDays": 21,
    "subject": "Should I close the loop?",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>I'll close the loop after this note. If franchise options become relevant to a client, you can reach me by replying here.</p><p>Should I leave this with you for now?</p><p>Best,<br/>Dylan</p>"
  }
];

export async function seedDefaultCampaign() {
  try {
    const existing = await storage.getDripCampaigns();
    if (existing.length > 0) {
      return;
    }

    const campaign = await storage.createDripCampaign({
      name: DEFAULT_CAMPAIGN_NAME,
      description: "5-email outreach sequence for immigration attorneys, E-2 visa consultants, and related professionals. Introduces the multi-vertical E-2 franchise platform and referral partnership program.",
      isActive: true,
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
