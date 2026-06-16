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

const SIGNATURE_HTML = `<p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>franchising@newdawnfranchising.com</p>`;
const SIGNATURE_TEXT = `Best regards,\nDylan Delaney\nNew Dawn Franchising\n${WEBSITE}\nfranchising@newdawnfranchising.com`;

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
    stepName: "Touch 1 — China-to-USA Partnership Intro",
    priority: "High",
    subject: "A U.S. pathway for your China clients — earn $28,125 per E-2 referral",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p><strong><a href="${GLOBEVISA_WEBSITE}">GlobeVisa</a></strong> has built one of the world's leading citizenship- and residency-by-investment practices — 20+ offices in China, 110,000+ clients across 114 countries, and 100+ programs in 40 countries. Many of those clients ultimately want more than a second passport: they want to <strong>live and build in the United States</strong>.</p>
  <p>That's where <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> fits. We're the first franchise platform built specifically for <strong>E-2 Treaty Investor Visa</strong> candidates — a turnkey, qualifying U.S. business ($225,000) that your client directs without running day-to-day operations.</p>
  <p>For GlobeVisa advisors, this is a natural complement to programs you already place — especially <strong>Grenada</strong>, <strong>Türkiye</strong>, and <strong>St. Kitts &amp; Nevis</strong>, which give Chinese entrepreneurs treaty-country nationality and open the E-2 door to America.</p>
  <p>You advise. We deliver. You earn:</p>
  <p style="font-size: 18px; color: #c9a227;"><strong>$225,000 × 12.5% = $28,125</strong> per referred client</p>
  <p>That's a referral commission on clients you've <em>already won</em> — no fulfilment work, no added headcount, paid when the visa clears. Your client gets a clean China-to-USA pathway; you get a new revenue line on a conversation that today often stops at EB-5.</p>
  <p>Would you be open to a 15-minute call? <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

GlobeVisa has built one of the world's leading CBI/RBI practices — 20+ offices in China, 110,000+ clients, 100+ programs in 40 countries. Many want to live and build in the United States.

New Dawn Franchising is built for E-2 Treaty Investor Visa candidates — a turnkey $225,000 U.S. business your client directs without running day-to-day ops. It complements programs you already place (Grenada, Türkiye, St. Kitts) that give Chinese entrepreneurs treaty-country nationality.

You advise. We deliver. You earn:
$225,000 × 12.5% = $28,125 per referred client

No fulfilment work, paid when the visa clears. Open to a 15-minute call? ${CALENDLY}

${SIGNATURE_TEXT}`,
  },
  {
    stepOrder: 3,
    delayDays: 6,
    stepType: "email",
    stepName: "Touch 2 — CBI + E-2 Synergy + Commission Math",
    priority: "High",
    subject: "{{name}}, GlobeVisa CBI → New Dawn E-2 → life in America (and $28,125/referral)",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>Your China-connected clients often need <strong>two steps</strong> to reach the United States — and GlobeVisa already handles step one.</p>
  <h3 style="color: #c9a227;">Step 1 — Treaty Nationality (GlobeVisa)</h3>
  <p>Chinese nationals are not E-2 treaty-country citizens. GlobeVisa solves this — programs like <strong>Grenada</strong>, <strong>Türkiye</strong>, and <strong>St. Kitts &amp; Nevis</strong> give clients treaty-country nationality and global mobility.</p>
  <h3 style="color: #c9a227;">Step 2 — U.S. Business Investment (New Dawn)</h3>
  <p>Once a client holds treaty-country nationality, the E-2 visa requires a <strong>substantial investment in a real U.S. operating business</strong>. New Dawn provides exactly that — $225,000 across Property Management, Insurance, or Telecom, with a director model where your client oversees strategy while our team runs daily operations.</p>
  <p>And for you, the math on referrals:</p>
  <ul>
    <li>5 referrals / year → <strong>$140,625</strong></li>
    <li>10 referrals / year → <strong>$281,250</strong></li>
    <li>25 referrals / year → <strong>$703,125</strong></li>
  </ul>
  <p>Complete pathway for your files: <strong>global citizenship → U.S. business → E-2 visa → life in America</strong>. No conflict with your CBI programs — it adds a U.S. option and a new commission line.</p>
  <p>15 minutes to walk through it? <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

Your China-connected clients need two steps to reach the U.S.:

Step 1 — Treaty Nationality (GlobeVisa): Grenada, Türkiye, St. Kitts give Chinese entrepreneurs treaty-country nationality.
Step 2 — U.S. Business (New Dawn): $225K franchise in PM, Insurance, or Telecom. Client directs; we run ops.

Referral math:
- 5/year  -> $140,625
- 10/year -> $281,250
- 25/year -> $703,125

Complete pathway: global citizenship -> U.S. business -> E-2 visa -> life in America.

15 minutes? ${CALENDLY}

${SIGNATURE_TEXT}`,
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
    stepName: "Touch 3 — Director Model for Chinese Entrepreneurs",
    priority: "Medium",
    subject: "Built for Chinese entrepreneurs who want U.S. presence without daily ops",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>Your GlobeVisa clients — Chinese entrepreneurs, investors, and business owners exploring the U.S. — typically want three things:</p>
  <ol>
    <li><strong>A legitimate path to live in the United States</strong> with their family</li>
    <li><strong>A real operating business</strong> that satisfies E-2 visa requirements</li>
    <li><strong>Freedom from day-to-day management</strong> so they can focus on strategy, family, and lifestyle</li>
  </ol>
  <p>New Dawn's director model delivers all three:</p>
  <ul>
    <li><strong>What your client does:</strong> Invests $225K, sets strategy, reviews dashboards, maintains financial control</li>
    <li><strong>What we handle:</strong> Daily operations in Property Management, Insurance, or Telecom</li>
    <li><strong>Where they live:</strong> Anywhere in the United States — Miami, Los Angeles, New York, or between embassy appointments</li>
  </ul>
  <p>For you it's effortless: introduce the client, we handle fulfilment, you collect <strong>$28,125</strong> (12.5%) per qualified placement — tracked in your partner portal. It sits alongside your CBI programs as a simple add-on, not a competitor.</p>
  <p>Worth a quick call to set up the partnership? <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Dear {{name}},

Your China-connected clients want: (1) a path to live in the U.S., (2) a real E-2-qualifying business, (3) freedom from daily ops.

New Dawn's director model:
- Client invests $225K, sets strategy, maintains control
- We run daily ops in PM, Insurance, or Telecom
- Client can live anywhere in the U.S.

You introduce, we fulfil, you earn $28,125 (12.5%) per placement.

Quick call? ${CALENDLY}

${SIGNATURE_TEXT}`,
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
    stepName: "Nurture 1 — China-to-USA Pathway Note",
    priority: "Low",
    subject: "No rush, {{name}} — a quick China-to-USA pathway note for your clients",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>No agenda — just leaving something useful in your inbox.</p>
  <p>When your China-connected clients ask about the U.S., the pathway that often fits best:</p>
  <ol>
    <li><strong>GlobeVisa CBI</strong> — treaty-country nationality (Grenada, Türkiye, St. Kitts)</li>
    <li><strong>New Dawn E-2</strong> — qualifying U.S. business from $225,000, client directs, we operate</li>
    <li><strong>Life in America</strong> — E-2 visa, family relocation, live anywhere in the U.S.</li>
  </ol>
  <p>Compared to EB-5 ($800,000+, multi-year queues), E-2 is faster and far cheaper for treaty-country nationals — exactly the clients you already advise through GlobeVisa.</p>
  <p>If a client ever fits, referral partners earn <strong>$28,125</strong> (12.5% of $225,000) per placement — no pressure, just on your radar.</p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Hi {{name}},

No agenda — useful note for your China-connected clients asking about the U.S.:

1. GlobeVisa CBI — treaty nationality (Grenada, Türkiye, St. Kitts)
2. New Dawn E-2 — $225K U.S. business, client directs, we operate
3. Life in America — E-2 visa, family relocation

Faster and cheaper than EB-5. Partners earn $28,125 per placement — no pressure, just on your radar.

${SIGNATURE_TEXT}`,
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
    stepName: "Nurture 3 — Door's Open",
    priority: "Low",
    subject: "Door's open whenever a China-to-USA client comes up, {{name}}",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I'll keep this short. The partnership stands whenever the timing's right:</p>
  <ul>
    <li>Your client gets GlobeVisa CBI → New Dawn E-2 → life in the United States</li>
    <li>Turnkey, E-2-qualifying U.S. business they direct — not operate</li>
    <li>You earn <strong>$28,125</strong> (12.5% of $225,000) per qualified placement, paid when the visa clears</li>
  </ul>
  <p>No pressure — reply or grab a time and we'll set you up as a referral partner: <a href="${CALENDLY}">${CALENDLY}</a></p>
  ${SIGNATURE_HTML}
</div>`,
    bodyText: `Hi {{name}},

The partnership stands whenever timing's right:
- GlobeVisa CBI → New Dawn E-2 → life in the U.S.
- Client directs the business; we run daily ops
- You earn $28,125 per qualified placement

Reply or grab a time: ${CALENDLY}

${SIGNATURE_TEXT}`,
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