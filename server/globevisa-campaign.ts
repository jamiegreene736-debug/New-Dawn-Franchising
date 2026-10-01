import { seedTrackCampaign } from "./grok-campaign";
import { EMAIL_STYLE, WEBSITE, CALENDLY, type CampaignTrackStep } from "@shared/campaign-tracks";

const GLOBEVISA_WEBSITE = "https://www.globevisa.com";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBEVISA — CHINA-TO-USA E-2 REFERRAL PARTNERSHIP
//
// A referral-partner (broker) sequence aimed at GlobeVisa advisors with
// China-connected clients who want to relocate to the United States.
// GlobeVisa (www.globevisa.com) is a citizenship/residency-by-investment
// consultancy with 20+ offices in China, 110,000+ HNW/UHNW clients, and 100+
// programs across 40 countries. New Dawn (www.newdawnfranchising.com) is the
// E-2 franchise platform that completes the U.S. business investment step.
//
// The sequence centres on the referral commission GlobeVisa cares about most:
// $225,000 × 12.5% = $28,125 per referred client — paid when the visa clears,
// on clients they've already won, with zero fulfilment work.
// ─────────────────────────────────────────────────────────────────────────────

export const GLOBEVISA_CAMPAIGN_NAME = "GlobeVisa — E-2 Referral Partnership";

const GLOBEVISA_DESCRIPTION =
  "6-step omnichannel referral-partner sequence for GlobeVisa advisors with China-connected clients seeking U.S. relocation. LinkedIn → email → SMS → call across ~3 weeks (days 1, 3, 6, 11, 16, 22). Positions New Dawn as the E-2 U.S. business complement to GlobeVisa's CBI programs (Grenada, Türkiye, St. Kitts). Centred on the $28,125 referral commission (12.5% of the $225K investment) — pure added revenue on clients GlobeVisa already advises.";

const SIGNATURE_HTML = `<p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>dylan@newdawnfranchising.com</p>`;
const SIGNATURE_TEXT = `Best regards,\nDylan Delaney\nNew Dawn Franchising\n${WEBSITE}\ndylan@newdawnfranchising.com`;

export const GLOBEVISA_TRACK: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 1,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}} at GlobeVisa.

Suggested note (300 chars max):
"Hi {{name}} — I admire GlobeVisa's work helping global citizens relocate worldwide, especially your China practice. We run an E-2 franchise platform for treaty nationals moving to the U.S. — referral partners earn $28,125/placement. Would love to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}} at GlobeVisa.

Suggested note (300 chars max):
"Hi {{name}} — I admire GlobeVisa's work helping global citizens relocate worldwide, especially your China practice. We run an E-2 franchise platform for treaty nationals moving to the U.S. — referral partners earn $28,125/placement. Would love to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 3,
    stepType: "email",
    stepName: "E-2 clients still choosing a business",
    priority: "High",
    subject: "E-2 clients still choosing a business",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I'm Dylan at New Dawn Franchising. We work with people comparing U.S. franchise businesses as part of their E-2 planning.</p><p>Do you work with clients who are still choosing a business?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I'm Dylan at New Dawn Franchising. We work with people comparing U.S. franchise businesses as part of their E-2 planning.

Do you work with clients who are still choosing a business?

Best,
Dylan`,
  },
  {
    stepOrder: 3,
    delayDays: 6,
    stepType: "email",
    stepName: "A short overview for your review",
    priority: "High",
    subject: "A short overview for your review",
    bodyHtml: `<p>Hi {{firstName}},</p><p>Following up on my note about New Dawn. I can send a short overview of our Property Management, Insurance, and Telecom franchise options, including the owner's role.</p><p>Would that be useful for your review?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

Following up on my note about New Dawn. I can send a short overview of our Property Management, Insurance, and Telecom franchise options, including the owner's role.

Would that be useful for your review?

Best,
Dylan`,
  },
  {
    stepOrder: 4,
    delayDays: 11,
    stepType: "sms",
    stepName: "Day 11 SMS — China-to-USA Nudge",
    priority: "Low",
    subject: "New Dawn E-2 partnership",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Following up — GlobeVisa CBI + our E-2 franchise = complete China-to-USA pathway for your clients. You earn $28,125 per referral, zero fulfilment work. Quick call? ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Following up — GlobeVisa CBI + our E-2 franchise = complete China-to-USA pathway for your clients. You earn $28,125 per referral, zero fulfilment work. Quick call? ${CALENDLY}`,
  },
  {
    stepOrder: 5,
    delayDays: 16,
    stepType: "email",
    stepName: "What your client would manage",
    priority: "Medium",
    subject: "What your client would manage",
    bodyHtml: `<p>Hi {{firstName}},</p><p>One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.</p><p>Would you like that outline?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.

Would you like that outline?

Best,
Dylan`,
  },
  {
    stepOrder: 6,
    delayDays: 22,
    stepType: "call",
    stepName: "Day 22 — GlobeVisa Partner Call",
    priority: "Medium",
    subject: "Call GlobeVisa re: China-to-USA E-2 referral partnership",
    bodyHtml: `Call {{name}} at GlobeVisa to close the referral partnership.

Talking points:
- GlobeVisa: 20+ China offices, 110k+ clients, top CBI/RBI consultancy — huge base of China-connected HNWIs wanting the U.S.
- Complete pathway: GlobeVisa CBI (Grenada/Türkiye/St. Kitts) → New Dawn E-2 U.S. business → life in America
- Lead with commission: $28,125 (12.5% of $225K) per referred client, paid when visa clears, tracked in partner portal
- Pure added revenue on clients they already advise — zero fulfilment work
- E-2 vs EB-5: faster, far cheaper ($225K vs $800K+), fits treaty-country nationals
- Director model: client oversees, New Dawn runs day-to-day in PM/Insurance/Telecom
- Escrow-protected funds, in-house E-2 immigration support, structured buy-back exit
- Offer: send partner agreement + one-pager today and book onboarding
- Calendly: ${CALENDLY}`,
    bodyText: `Call {{name}} at GlobeVisa to close the referral partnership.

Talking points:
- GlobeVisa: 20+ China offices, 110k+ clients — huge base of China-connected HNWIs wanting the U.S.
- Complete pathway: GlobeVisa CBI → New Dawn E-2 U.S. business → life in America
- Commission: $28,125 (12.5% of $225K) per referred client, paid when visa clears
- Zero fulfilment work — pure added revenue on clients they already advise
- E-2 vs EB-5: faster, cheaper, fits treaty-country nationals
- Offer: partner agreement + one-pager + onboarding call
- Calendly: ${CALENDLY}`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GLOBEVISA — CHINA-TO-USA NURTURE (NON-RESPONDERS)
//
// Light companion track for GlobeVisa contacts who didn't respond to the main
// 6-step sequence. Keeps the $28,125-per-referral door open without pressure.
// ─────────────────────────────────────────────────────────────────────────────

export const GLOBEVISA_NURTURE_NAME = "GlobeVisa — E-2 Nurture (Non-Responders)";

const GLOBEVISA_NURTURE_DESCRIPTION =
  "Light nurture track for GlobeVisa contacts who didn't respond to the main China-to-USA sequence. 3 soft touches (email → LinkedIn → email) over ~6 weeks (days 3, 21, 45). Keeps the complete CBI→E-2 pathway and $28,125 referral fee on their radar without pressure.";

export const GLOBEVISA_NURTURE_TRACK: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 3,
    stepType: "email",
    stepName: "Documents before a recommendation",
    priority: "Low",
    subject: "Documents before a recommendation",
    bodyHtml: `<p>Hi {{firstName}},</p><p>You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.</p><p>Would you like me to send those?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.

Would you like me to send those?

Best,
Dylan`,
  },
  {
    stepOrder: 2,
    delayDays: 21,
    stepType: "linkedin_message",
    stepName: "Nurture 2 — LinkedIn Check-In",
    priority: "Low",
    subject: "",
    bodyHtml: `Send a brief LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — no ask, just keeping New Dawn on your radar as the U.S. (E-2) complement to GlobeVisa's CBI programs. Whenever a China-connected client wants a faster route than EB-5, we handle the qualifying U.S. business end-to-end (and partners earn $28,125 per referral). Happy to send a one-pager any time."`,
    bodyText: `Send a brief LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — no ask, just keeping New Dawn on your radar as the U.S. (E-2) complement to GlobeVisa's CBI programs. Whenever a China-connected client wants a faster route than EB-5, we handle the qualifying U.S. business end-to-end (and partners earn $28,125 per referral). Happy to send a one-pager any time."`,
  },
  {
    stepOrder: 3,
    delayDays: 45,
    stepType: "email",
    stepName: "What would you need to evaluate?",
    priority: "Low",
    subject: "What would you need to evaluate?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?</p><p>A quick reply is enough; I can send the relevant information.</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?

A quick reply is enough; I can send the relevant information.

Best,
Dylan`,
  },
];

/** Seed the GlobeVisa China-to-USA referral campaign + nurture track (idempotent). */
export async function seedGlobevisaCampaign(): Promise<void> {
  try {
    await seedTrackCampaign(GLOBEVISA_CAMPAIGN_NAME, GLOBEVISA_DESCRIPTION, "broker", GLOBEVISA_TRACK);
    await seedTrackCampaign(GLOBEVISA_NURTURE_NAME, GLOBEVISA_NURTURE_DESCRIPTION, "broker", GLOBEVISA_NURTURE_TRACK);
  } catch (err) {
    console.error("[Drip] Failed to seed GlobeVisa campaign(s):", err);
  }
}