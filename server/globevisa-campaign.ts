import { storage } from "./storage";

export const GLOBEVISA_CAMPAIGN_NAME = "GlobeVisa — China-to-USA E-2 Referral Partnership";

const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";
const NEW_DAWN_WEBSITE = "https://www.newdawnfranchising.com";
const GLOBEVISA_WEBSITE = "https://www.globevisa.com";

const EMAIL_STYLE = `font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e; line-height: 1.6;`;

const GLOBEVISA_STEPS = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I admire GlobeVisa's work helping global citizens relocate worldwide. I'm with New Dawn Franchising, built for E-2 Treaty Investor Visa candidates who need a real U.S. business. Would love to connect and explore a China-to-USA referral partnership."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Touch 1 — GlobeVisa Partnership Intro",
    priority: "High",
    subject: "A U.S. business pathway for your China clients — E-2 referral partnership",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>I'm reaching out from <strong><a href="${NEW_DAWN_WEBSITE}">New Dawn Franchising</a></strong> — the first franchise platform built specifically for <strong>E-2 Treaty Investor Visa</strong> candidates who need a real, operating U.S. business they can direct without running day-to-day operations themselves.</p>
  <p>We see a natural fit with <strong><a href="${GLOBEVISA_WEBSITE}">GlobeVisa</a></strong>. Your team has guided 110,000+ clients across 114 countries — including a deep presence in China — through citizenship and residency by investment. Many of those clients ultimately want to <strong>live and build in the United States</strong>, not just hold a second passport.</p>
  <p>That's where we come in. New Dawn gives E-2 treaty nationals a qualifying <strong>$225,000 franchise investment</strong> across three recurring-revenue verticals:</p>
  <ul>
    <li><strong>Property Management</strong> — long-term rental management contracts</li>
    <li><strong>Insurance</strong> — agency and policy renewal revenue</li>
    <li><strong>Telecom (VOIP)</strong> — business communications contracts</li>
  </ul>
  <p>Your clients direct the business; our approved local teams handle daily execution. They can live anywhere in the U.S. while maintaining executive oversight.</p>
  <p>For GlobeVisa advisors, this is a complementary service — especially for clients who already hold treaty-country nationality through programs you place (Grenada, Türkiye, St. Kitts, and others) and are ready for the U.S. business investment step.</p>
  <p>Would you be open to a brief call to explore a referral partnership?</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${NEW_DAWN_WEBSITE}">www.newdawnfranchising.com</a><br/>dylan@newdawnfranchising.com</p>
</div>`,
  },
  {
    stepOrder: 3,
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Quick Intro",
    priority: "Low",
    subject: "New Dawn E-2 intro",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about an E-2 referral partnership for GlobeVisa advisors — $225K U.S. franchise for treaty nationals, director model, three verticals. Worth a look for your China-to-USA clients? ${NEW_DAWN_WEBSITE}`,
  },
  {
    stepOrder: 4,
    delayDays: 2,
    stepType: "linkedin_message",
    stepName: "LinkedIn DM — Follow-Up",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — sent you an email as well. GlobeVisa helps clients become global citizens; New Dawn completes the U.S. side for E-2 treaty nationals — a $225K qualifying franchise in Property Management, Insurance, or Telecom. Your client directs; we run ops. Happy to share a one-pager if you have China-connected clients exploring a U.S. move."`,
  },
  {
    stepOrder: 5,
    delayDays: 3,
    stepType: "email",
    stepName: "Touch 2 — CBI + E-2 Synergy",
    priority: "High",
    subject: "From GlobeVisa CBI to U.S. residency — the E-2 bridge your clients need",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>One reason we believe GlobeVisa and New Dawn fit together: your clients often need <strong>two steps</strong> to reach the United States.</p>
  <h3 style="color: #c9a227;">Step 1 — Treaty Nationality (GlobeVisa)</h3>
  <p>Chinese nationals are not E-2 treaty-country citizens. GlobeVisa already solves this — programs like <strong>Grenada</strong>, <strong>Türkiye</strong>, and <strong>St. Kitts &amp; Nevis</strong> give clients treaty-country nationality and global mobility. With 20+ offices in China and 100+ programs across 40 countries, you're already the trusted guide for this first step.</p>
  <h3 style="color: #c9a227;">Step 2 — U.S. Business Investment (New Dawn)</h3>
  <p>Once a client holds treaty-country nationality, the E-2 visa requires a <strong>substantial, at-risk investment in a real U.S. operating business</strong>. New Dawn Franchising is built exactly for this:</p>
  <ul>
    <li><strong>$225,000</strong> franchise investment with financing available</li>
    <li><strong>Director model</strong> — client maintains executive control and bank oversight</li>
    <li><strong>Approved local teams</strong> run day-to-day operations in their chosen vertical</li>
    <li><strong>Proprietary technology</strong> for reporting, marketing, and workflow automation</li>
    <li><strong>In-house E-2 immigration support</strong> alongside franchise operations</li>
  </ul>
  <p>For GlobeVisa advisors serving China-connected entrepreneurs and HNWIs, this creates a complete pathway: <strong>global citizenship → U.S. business → E-2 visa → life in America</strong>.</p>
  <p>Happy to walk through how this works for a specific client profile: <a href="${CALENDLY}">book a time here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Touch 3 — Director Model for Chinese Entrepreneurs",
    priority: "High",
    subject: "Built for entrepreneurs who want U.S. presence without daily operations",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Your GlobeVisa clients — Chinese entrepreneurs, investors, and business owners exploring the U.S. — typically want three things:</p>
  <ol>
    <li><strong>A legitimate path to live in the United States</strong> with their family</li>
    <li><strong>A real operating business</strong> that satisfies E-2 visa requirements</li>
    <li><strong>Freedom from day-to-day management</strong> so they can focus on strategy, family, and lifestyle</li>
  </ol>
  <p>New Dawn's director model is designed for exactly this profile:</p>
  <ul>
    <li><strong>What your client does:</strong> Invests $225K, sets business strategy, reviews performance dashboards, makes executive decisions, maintains financial control</li>
    <li><strong>What we handle:</strong> Daily operations in Property Management, Insurance, or Telecom — tenant servicing, policy administration, or telecom provisioning</li>
    <li><strong>Where they live:</strong> Anywhere in the United States — Miami, Los Angeles, New York, or between embassy appointments abroad</li>
  </ul>
  <p>Each vertical generates <strong>recurring contract revenue</strong> — the kind of documented, operating income that strengthens an E-2 petition. This isn't passive investment; it's active executive direction of a real U.S. enterprise.</p>
  <p>Would a 15-minute walkthrough be helpful for your team?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — Referral Fee Reveal",
    priority: "High",
    subject: "Referral compensation for GlobeVisa advisors — $28,125 per qualified client",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I want to be direct about what a GlobeVisa–New Dawn referral partnership looks like financially.</p>
  <p><strong>Referring advisors earn a 12.5% referral commission on every qualified placement.</strong></p>
  <p>On our standard $225,000 investment package:</p>
  <p style="font-size: 18px; color: #c9a227;"><strong>$225,000 × 12.5% = $28,125</strong> per referred client</p>
  <p>Here's how the partnership is structured:</p>
  <ul>
    <li><strong>Commission paid when the E-2 visa clears</strong> — aligned incentives for everyone in the chain</li>
    <li><strong>Client funds held in escrow</strong> — capital protected throughout the process</li>
    <li><strong>Dedicated broker portal</strong> — track referrals, clients, and commission status in real time</li>
    <li><strong>Marketing materials provided</strong> — one-pagers, decks, and client-facing resources in English</li>
    <li><strong>No exclusivity required</strong> — partner alongside your existing referral relationships</li>
    <li><strong>Complements your CBI pipeline</strong> — earn on both the citizenship step and the U.S. business step</li>
  </ul>
  <p>For advisors with even a handful of China-connected clients per year exploring U.S. relocation, this adds meaningful revenue on top of your existing GlobeVisa programs.</p>
  <p>Book a quick call: <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
  },
  {
    stepOrder: 8,
    delayDays: 7,
    stepType: "call",
    stepName: "Call — GlobeVisa Referral Partnership",
    priority: "High",
    subject: "",
    bodyHtml: `Call {{name}} to discuss the GlobeVisa–New Dawn referral partnership.

Talking points:
• GlobeVisa clients with China connections wanting U.S. residency
• CBI → E-2 pathway: treaty nationality (Grenada, Türkiye, St. Kitts) + New Dawn U.S. business
• Referral commission: $225,000 × 12.5% = $28,125 per qualified client
• Three verticals: Property Management, Insurance, Telecom (VOIP)
• Director model — client oversees, New Dawn runs day-to-day ops
• Client funds held in escrow until visa clears
• Proprietary technology + in-house E-2 immigration support
• Book follow-up: ${CALENDLY}`,
  },
  {
    stepOrder: 9,
    delayDays: 10,
    stepType: "email",
    stepName: "Touch 5 — Trust, Escrow & Team Credibility",
    priority: "Medium",
    subject: "Why GlobeVisa advisors trust us with their highest-value clients",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When you refer a client from your GlobeVisa practice, reputation is everything. Here's why immigration professionals trust New Dawn with E-2 candidates:</p>
  <ul>
    <li><strong>Escrow-protected investment</strong> — client funds are safeguarded throughout the E-2 process</li>
    <li><strong>VC-backed leadership</strong> — operators from Funding Circle, Google, Khosla Ventures, and Wilson Sonsini</li>
    <li><strong>In-house E-2 immigration attorneys</strong> — franchise operations and visa documentation under one roof</li>
    <li><strong>Structured buy-back program</strong> — clear exit path when the client is ready to transition</li>
    <li><strong>Registered franchisor</strong> — FDD available, headquartered in El Paso, Texas</li>
    <li><strong>Spouse work authorization</strong> — E-2 derivative benefits for the client's family</li>
  </ul>
  <p>GlobeVisa has built trust with 110,000+ clients across 114 countries. We built New Dawn to meet the same standard for the U.S. business investment step — so your referral strengthens your client's full mobility plan, not just ours.</p>
  <p>Referring advisors earn <strong>$28,125</strong> (12.5% of $225,000) per qualified placement.</p>
  <p>Happy to send our investor overview or jump on a call: <a href="${CALENDLY}">book here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Touch 6 — Complete China-to-USA Client Journey",
    priority: "Medium",
    subject: "The full pathway: GlobeVisa global citizenship → New Dawn U.S. business → E-2 visa",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Here's what a complete China-to-USA client journey looks like when GlobeVisa and New Dawn work together:</p>
  <ol>
    <li><strong>Global citizenship planning</strong> — GlobeVisa evaluates the client and places them in a treaty-country CBI program (Grenada, Türkiye, St. Kitts, etc.)</li>
    <li><strong>Treaty nationality secured</strong> — client obtains passport/citizenship qualifying them for E-2</li>
    <li><strong>U.S. business discovery</strong> — New Dawn matches the client to Property Management, Insurance, or Telecom based on goals and market fit</li>
    <li><strong>Investment &amp; escrow</strong> — $225,000 placed in escrow with documented protections</li>
    <li><strong>E-2 petition support</strong> — real operating business documentation for their immigration attorney</li>
    <li><strong>Director onboarding</strong> — client assumes executive oversight; our team launches daily operations</li>
    <li><strong>Life in the U.S.</strong> — client and family relocate with E-2 status, living anywhere in the United States</li>
    <li><strong>Advisor commission</strong> — GlobeVisa referral partner earns <strong>$28,125</strong> when the visa clears</li>
  </ol>
  <p>This is a turnkey mobility solution your China-connected clients are already asking for — GlobeVisa handles global citizenship; New Dawn handles the U.S. enterprise.</p>
  <p><a href="${CALENDLY}">Book 20 minutes here</a> · <a href="${NEW_DAWN_WEBSITE}">newdawnfranchising.com</a></p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Pipeline Check-In",
    priority: "Low",
    subject: "China-to-USA pipeline check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Any GlobeVisa clients with China ties exploring a U.S. move? We offer E-2 franchises — $225K, director model, escrow protected. Advisors earn $28,125/referral. Happy to chat: ${CALENDLY}`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "Touch 7 — Partnership Agreement Offer",
    priority: "Medium",
    subject: "Ready to formalize our referral partnership, {{name}}?",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I've shared how New Dawn complements GlobeVisa's global mobility practice for China-connected clients heading to the United States. If the fit makes sense, I'd like to make it official.</p>
  <p>Our <strong>Referring Broker Program</strong> includes:</p>
  <ul>
    <li>Signed referral agreement with clear commission terms</li>
    <li><strong>$28,125 per qualified client</strong> (12.5% of $225,000), paid when the E-2 visa clears</li>
    <li>Broker portal access to track every referral in real time</li>
    <li>Client-facing materials you can share directly with prospects</li>
    <li>Co-branded introduction option for GlobeVisa advisor teams</li>
  </ul>
  <p>Even one referral per quarter from your China network could add $100K+ in annual commission income — on top of your existing GlobeVisa program revenue.</p>
  <p>Want me to send the partnership agreement overview?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Touch 8 — Final Note",
    priority: "Low",
    subject: "Closing the loop — U.S. E-2 referrals here whenever you need us",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If any of your GlobeVisa clients — especially China-connected entrepreneurs and investors — are ever looking for a U.S. business pathway, please keep <strong><a href="${NEW_DAWN_WEBSITE}">New Dawn Franchising</a></strong> in mind.</p>
  <p><strong>Quick recap for your files:</strong></p>
  <ul>
    <li><strong>Partnership fit:</strong> GlobeVisa CBI → New Dawn E-2 U.S. business → life in America</li>
    <li><strong>$225,000</strong> investment packages with financing available</li>
    <li><strong>Three verticals:</strong> Property Management, Insurance, or Telecom (VOIP)</li>
    <li><strong>Director model:</strong> client oversees; New Dawn runs day-to-day operations</li>
    <li><strong>Live anywhere in the U.S.</strong> while the business operates professionally</li>
    <li><strong>Escrow-protected</strong> client funds + structured buy-back exit</li>
    <li><strong>Advisor referral fee:</strong> $225,000 × 12.5% = <strong>$28,125</strong> per qualified client</li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
  <p>Wishing you continued success,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>El Paso, Texas</p>
</div>`,
  },
];

export async function seedGlobeVisaCampaign() {
  try {
    const existing = await storage.getDripCampaigns();
    if (existing.some((c) => c.name === GLOBEVISA_CAMPAIGN_NAME)) {
      return;
    }

    const campaign = await storage.createDripCampaign({
      name: GLOBEVISA_CAMPAIGN_NAME,
      description:
        "13-step omnichannel outreach sequence for GlobeVisa advisors with China-connected clients seeking U.S. relocation. Positions New Dawn as the E-2 U.S. business complement to GlobeVisa's CBI programs (Grenada, Türkiye, St. Kitts). Highlights $28,125 referral fees, escrow protection, director model, and three franchise verticals across 28 days.",
      isActive: true,
    });

    for (const step of GLOBEVISA_STEPS) {
      await storage.createDripStep({
        campaignId: campaign.id,
        stepOrder: step.stepOrder,
        delayDays: step.delayDays,
        stepType: step.stepType,
        stepName: step.stepName,
        priority: step.priority,
        subject: step.subject,
        bodyHtml: step.bodyHtml,
      });
    }

    console.log(`[Drip] "${GLOBEVISA_CAMPAIGN_NAME}" created with ${GLOBEVISA_STEPS.length} steps.`);
  } catch (err) {
    console.error(`[Drip] Failed to seed "${GLOBEVISA_CAMPAIGN_NAME}":`, err);
  }
}