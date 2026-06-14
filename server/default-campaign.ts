import { storage } from "./storage";

const DEFAULT_CAMPAIGN_NAME = "E-2 Visa Professional Outreach";

const DEFAULT_STEPS = [
  {
    stepOrder: 1,
    delayDays: 0,
    subject: "Partnership Opportunity — E-2 Visa Franchise Platform for Your Clients",
    bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <p>Dear {{name}},</p>
  <p>My name is the Franchise Development Team at <strong>New Dawn Franchising</strong>, the first franchise platform built specifically for <strong>E-2 visa investors</strong>. We offer three recurring-revenue verticals: Property Management, Telecom, and Insurance.</p>
  <p>We're reaching out because we believe there's a strong opportunity for us to work together. Many of your clients are likely looking for:</p>
  <ul>
    <li>A qualifying E-2 visa business investment (packages from $225K, financing available)</li>
    <li>Director-level oversight — they direct the business while local teams run daily operations</li>
    <li>Choice of three verticals with proprietary tech for full reporting and control</li>
  </ul>
  <p>Investors choose their vertical, maintain full financial control and executive direction, while approved local teams handle day-to-day operations across the chosen industry.</p>
  <p>Would you be open to a brief call to discuss how we might create a referral partnership? We offer competitive referral commissions for professionals who introduce qualified investors.</p>
  <p>Best regards,<br/><strong>New Dawn Franchising</strong><br/>El Paso, Texas<br/>dylan@newdawnfranchising.com</p>
</div>`,
  },
  {
    stepOrder: 2,
    delayDays: 3,
    subject: "Quick follow-up — E-2 Visa franchise platform for your clients",
    bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <p>Hi {{name}},</p>
  <p>I wanted to follow up on my previous email about <strong>New Dawn Franchising</strong>. I know you're busy, so I'll keep this brief.</p>
  <p>Here's why E-2 visa professionals find our franchise particularly compelling for their clients:</p>
  <ul>
    <li><strong>Spouse visa strategy</strong> — Our model supports dual-visa household planning</li>
    <li><strong>Financing available</strong> — We work with lenders experienced in E-2 transactions</li>
    <li><strong>Buy-back program</strong> — We offer an in-house buy-back option, reducing investor risk</li>
    <li><strong>Choice of verticals</strong> — Property Management, Telecom, or Insurance — recurring revenue models built for E-2</li>
  </ul>
  <p>If you'd like, I can send you our investor overview with complete details on the three verticals, investment structure, and E-2 fit.</p>
  <p>Just reply to this email or book a call at your convenience.</p>
  <p>Best,<br/><strong>New Dawn Franchising</strong></p>
</div>`,
  },
  {
    stepOrder: 3,
    delayDays: 7,
    subject: "How New Dawn's E-2 platform works — three verticals, one model",
    bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <p>Hi {{name}},</p>
  <p>I wanted to share a bit more about how our franchise model works, in case it's helpful for any of your E-2 visa clients who are evaluating business opportunities.</p>
  <h3 style="color: #c9a227;">The New Dawn Model</h3>
  <p><strong>What the investor does:</strong></p>
  <ul>
    <li>Makes a $225K franchise investment (financing options available)</li>
    <li>Maintains full financial oversight and control</li>
    <li>Receives ongoing reporting and performance updates</li>
  </ul>
  <p><strong>What we handle for the chosen vertical:</strong></p>
  <ul>
    <li>Approved local teams manage daily operations in Property Management, Telecom, or Insurance</li>
    <li>Proprietary dashboards and reporting for full owner oversight</li>
    <li>Full training, E-2 compliance support, and operational systems</li>
  </ul>
  <p>This is designed for investors who want a real, operating U.S. business they direct — not passive — without handling day-to-day tenant calls or field work.</p>
  <p>Happy to jump on a 15-minute call anytime. Would that be helpful?</p>
  <p>Best,<br/><strong>New Dawn Franchising</strong></p>
</div>`,
  },
  {
    stepOrder: 4,
    delayDays: 14,
    subject: "Referral partnership details — New Dawn Franchising",
    bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <p>Hi {{name}},</p>
  <p>I've reached out a few times about our E-2 visa franchise opportunity, and I understand timing may not have been right. I wanted to make one more point about our <strong>Referring Broker Program</strong>.</p>
  <p>We've built a formal referral partnership for immigration attorneys, business brokers, and E-2 consultants. Here's what it includes:</p>
  <ul>
    <li><strong>Competitive referral commissions</strong> for qualified investor introductions</li>
    <li><strong>Dedicated broker portal</strong> where you can track your referrals and manage clients</li>
    <li><strong>Marketing materials</strong> we provide for you to share with prospective investors</li>
    <li><strong>No exclusivity required</strong> — partner with us alongside your other referral relationships</li>
  </ul>
  <p>If you have even one client per year looking for an E-2 qualifying business, it could be worth a conversation.</p>
  <p>Would you like me to send you the partnership agreement details?</p>
  <p>Best regards,<br/><strong>New Dawn Franchising</strong><br/>dylan@newdawnfranchising.com</p>
</div>`,
  },
  {
    stepOrder: 5,
    delayDays: 21,
    subject: "Last note from New Dawn — E-2 franchise referrals here if needed",
    bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If any of your clients are ever looking for an E-2 qualifying franchise — with choice of Property Management, Telecom, or Insurance — please keep New Dawn Franchising in mind.</p>
  <p><strong>Quick recap:</strong></p>
  <ul>
    <li>$225K investment packages with financing available</li>
    <li>Director model: clients oversee while local teams execute daily ops in their chosen vertical</li>
    <li>Proprietary tech, E-2 compliance support, and in-house buy-back program</li>
    <li>Escrow protections and spouse work authorization eligibility</li>
    <li>Competitive referral commissions for introducing investors</li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a>. We're always here.</p>
  <p>Wishing you continued success,<br/><strong>New Dawn Franchising</strong><br/>El Paso, Texas</p>
</div>`,
  },
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
