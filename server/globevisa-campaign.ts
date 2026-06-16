import { seedTrackCampaign } from "./grok-campaign";
import { EMAIL_STYLE, WEBSITE, CALENDLY, type CampaignTrackStep } from "@shared/campaign-tracks";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBEVISA — E-2 REFERRAL PARTNERSHIP
//
// A referral-partner (broker) sequence aimed specifically at GlobeVisa, the
// citizenship/residency-by-investment consultancy (est. 2002, 30+ offices,
// 110,000+ HNW/UHNW investor clients). Their treaty-country investor clients who
// want the United States are the exact E-2 profile.
//
// The whole sequence is built around ONE message GlobeVisa cares about most:
// the commission. Every step restates that a referred client earns them
// $225,000 × 12.5% = $28,125 — paid when the visa clears, on clients they've
// already won, with zero fulfilment work.
// ─────────────────────────────────────────────────────────────────────────────

export const GLOBEVISA_CAMPAIGN_NAME = "GlobeVisa — E-2 Referral Partnership";

const GLOBEVISA_DESCRIPTION =
  "6-step omnichannel referral-partner sequence for GlobeVisa (citizenship/residency-by-investment consultancy). LinkedIn → email → SMS → call across 12 days. Centred on the referral commission ($28,125 = 12.5% of the $225K investment per placement) and how GlobeVisa's treaty-country HNW investor clients are the ideal E-2 fit — pure added revenue on clients they already advise.";

const SIGNATURE_HTML = `<p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>franchising@newdawnfranchising.com</p>`;
const SIGNATURE_TEXT = `Best regards,\nDylan Delaney\nNew Dawn Franchising\n${WEBSITE}\nfranchising@newdawnfranchising.com`;

export const GLOBEVISA_TRACK: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}} at GlobeVisa.

Suggested note (300 chars max):
"Hi {{name}} — I follow GlobeVisa's work in citizenship & residency by investment. Many of your investor clients also want a U.S. option. We run an E-2 franchise platform and pay referral partners $28,125 per placement. Would love to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}} at GlobeVisa.

Suggested note (300 chars max):
"Hi {{name}} — I follow GlobeVisa's work in citizenship & residency by investment. Many of your investor clients also want a U.S. option. We run an E-2 franchise platform and pay referral partners $28,125 per placement. Would love to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Touch 1 — Partnership Intro + Commission Hook",
    priority: "High",
    subject: "Earn $28,125 per client GlobeVisa already advises — E-2 referral partnership",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>GlobeVisa has built one of the world's leading citizenship- and residency-by-investment practices — 30+ offices and 110,000+ high-net-worth clients advised on their next passport, residency, or relocation.</p>
  <p>Here's where we fit. A large share of your investor clients want the <strong>United States</strong> — but EB-5's $800,000+ outlay and multi-year queues don't suit everyone. The <strong>E-2 Treaty Investor Visa</strong> does. At <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> we give your treaty-country clients a turnkey, qualifying U.S. business ($225,000) that they direct — without running day-to-day operations.</p>
  <p>You advise. We deliver. You earn:</p>
  <p style="font-size: 18px; color: #c9a227;"><strong>$225,000 × 12.5% = $28,125</strong> per referred client</p>
  <p>That's a referral commission on clients you've <em>already won</em> — no fulfilment work, no added headcount, paid when the visa clears. Your client gets a clean, fast E-2 pathway; you get a new revenue line on a conversation that today ends at EB-5.</p>
  <p>Would you be open to a 15-minute call this week to see if it fits your pipeline? You can grab a time here: <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

GlobeVisa has built one of the world's leading citizenship- and residency-by-investment practices — 30+ offices and 110,000+ high-net-worth clients.

Here's where we fit. A large share of your investor clients want the United States — but EB-5's $800,000+ outlay and multi-year queues don't suit everyone. The E-2 Treaty Investor Visa does. At New Dawn Franchising we give your treaty-country clients a turnkey, qualifying U.S. business ($225,000) that they direct without running day-to-day operations.

You advise. We deliver. You earn:
$225,000 × 12.5% = $28,125 per referred client

That's a referral commission on clients you've already won — no fulfilment work, paid when the visa clears.

Open to a 15-minute call this week? ${CALENDLY}

${SIGNATURE_TEXT}`,
  },
  {
    stepOrder: 3,
    delayDays: 2,
    stepType: "email",
    stepName: "Touch 2 — The Commission Math",
    priority: "High",
    subject: "{{name}}, the math: 10 GlobeVisa referrals = $281,250",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>Quick follow-up — because for a practice GlobeVisa's size, the numbers are the story.</p>
  <p>You earn <strong>$28,125</strong> on every qualified client you refer (12.5% of the $225,000 investment), paid when the visa clears, with full visibility in our partner portal:</p>
  <ul>
    <li>5 referrals / year → <strong>$140,625</strong></li>
    <li>10 referrals / year → <strong>$281,250</strong></li>
    <li>25 referrals / year → <strong>$703,125</strong></li>
  </ul>
  <p>Those are conservative against your client volume — and it's revenue left on the table today every time a client asks about the U.S. and the conversation stops at EB-5.</p>
  <p>The E-2 route is faster and far cheaper for treaty-country investors — exactly the clients you already advise. No conflict with your existing CBI/RBI programs; it simply adds a U.S. option, and a new commission line, to the menu you already offer.</p>
  <p>15 minutes to walk you through it? <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

Quick follow-up — because for a practice GlobeVisa's size, the numbers are the story.

You earn $28,125 on every qualified client you refer (12.5% of the $225,000 investment), paid when the visa clears, tracked in our partner portal:
- 5 referrals/year  -> $140,625
- 10 referrals/year -> $281,250
- 25 referrals/year -> $703,125

The E-2 route is faster and far cheaper for treaty-country investors — exactly the clients you already advise. No conflict with your CBI/RBI programs; it just adds a U.S. option and a new commission line.

15 minutes to walk you through it? ${CALENDLY}

${SIGNATURE_TEXT}`,
  },
  {
    stepOrder: 4,
    delayDays: 4,
    stepType: "sms",
    stepName: "Day 4 SMS — Commission Nudge",
    priority: "Low",
    subject: "New Dawn E-2 partnership",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Following up — your E-2-eligible investor clients get a turnkey $225K U.S. business, and GlobeVisa earns $28,125 per referral. Pure upside on clients you already advise. Quick call? ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Following up — your E-2-eligible investor clients get a turnkey $225K U.S. business, and GlobeVisa earns $28,125 per referral. Pure upside on clients you already advise. Quick call? ${CALENDLY}`,
  },
  {
    stepOrder: 5,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 3 — Why Your Clients Fit + How It Works",
    priority: "Medium",
    subject: "Why GlobeVisa's clients are the perfect E-2 fit, {{name}}",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>A bit more on why this works so well for GlobeVisa specifically:</p>
  <ul>
    <li>Your clients are <strong>treaty-country HNW investors</strong> — the exact E-2 profile.</li>
    <li>They want <strong>speed and certainty</strong>; E-2 delivers both versus EB-5.</li>
    <li>They want to <strong>direct, not operate</strong> — our director model lets the client own strategy while our U.S. team runs day-to-day.</li>
    <li>Three contract-based verticals — <strong>Property Management, Insurance, or Telecom</strong> — on an escrow-protected $225,000 investment.</li>
  </ul>
  <p>For you it's effortless: you introduce the client, we handle fulfilment, and you collect <strong>$28,125</strong> (12.5%) per qualified placement — tracked in your partner portal. It sits alongside your CBI/RBI programs as a simple add-on, not a competitor.</p>
  <p>Worth a quick call to set up the partnership? <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

A bit more on why this works so well for GlobeVisa specifically:
- Your clients are treaty-country HNW investors — the exact E-2 profile.
- They want speed and certainty; E-2 delivers both versus EB-5.
- They want to direct, not operate — our director model lets the client own strategy while our U.S. team runs day-to-day.
- Three contract-based verticals (Property Management, Insurance, Telecom) on an escrow-protected $225,000 investment.

For you it's effortless: you introduce the client, we handle fulfilment, and you collect $28,125 (12.5%) per qualified placement — tracked in your partner portal.

Worth a quick call to set up the partnership? ${CALENDLY}

${SIGNATURE_TEXT}`,
  },
  {
    stepOrder: 6,
    delayDays: 12,
    stepType: "call",
    stepName: "Day 12 — Partner Call",
    priority: "Medium",
    subject: "Call GlobeVisa re: E-2 referral partnership",
    bodyHtml: `Call {{name}} at GlobeVisa to close the referral partnership.

Talking points:
- GlobeVisa is a top CBI/RBI consultancy (110k+ clients, 30+ offices) — a huge base of E-2-eligible treaty-country investors.
- Lead with the commission: $28,125 (12.5% of the $225K investment) per referred client, paid when the visa clears, tracked in the partner portal.
- It's pure added revenue on clients they already advise — zero fulfilment work on their side.
- E-2 vs EB-5: faster, far cheaper, fits clients who don't want the $800K+ EB-5 path.
- No conflict with their CBI/RBI programs — it adds a U.S. option to the menu.
- Offer: send the partner agreement + one-pager today and book onboarding.
- Calendly: ${CALENDLY}`,
    bodyText: `Call {{name}} at GlobeVisa to close the referral partnership.

Talking points:
- GlobeVisa is a top CBI/RBI consultancy (110k+ clients, 30+ offices) — a huge base of E-2-eligible treaty-country investors.
- Lead with the commission: $28,125 (12.5% of the $225K investment) per referred client, paid when the visa clears, tracked in the partner portal.
- It's pure added revenue on clients they already advise — zero fulfilment work on their side.
- E-2 vs EB-5: faster, far cheaper, fits clients who don't want the $800K+ EB-5 path.
- No conflict with their CBI/RBI programs — it adds a U.S. option to the menu.
- Offer: send the partner agreement + one-pager today and book onboarding.
- Calendly: ${CALENDLY}`,
  },
];

/** Seed the GlobeVisa referral-partnership campaign (idempotent, broker audience). */
export async function seedGlobevisaCampaign(): Promise<void> {
  try {
    await seedTrackCampaign(GLOBEVISA_CAMPAIGN_NAME, GLOBEVISA_DESCRIPTION, "broker", GLOBEVISA_TRACK);
  } catch (err) {
    console.error("[Drip] Failed to seed GlobeVisa campaign:", err);
  }
}
