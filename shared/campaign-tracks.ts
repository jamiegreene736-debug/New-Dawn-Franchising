import { reviewedEmailSteps } from "./outreach-copy";
/**
 * Two-track outreach content — the single source of truth for the New Dawn
 * Franchising "Grok Campaign" voice across every surface that can fire a
 * "Send now" action:
 *
 *   • server/grok-campaign.ts        → seeds three drip campaigns (broker v1, broker v2, client)
 *   • client/.../crm-client-detail   → the per-contact "Send Now" override tab
 *   • client/.../email-campaigns     → audience label on the bulk launcher
 *   • server/broker-sequence-service → the automated omnichannel engine
 *
 * BROKER_TRACK is the existing, well-liked referral-partner pitch ("refer your
 * E-2 clients, earn the commission"). CLIENT_TRACK is the same warm, confident
 * voice but written DIRECTLY to the E-2 investor candidate — it pitches the
 * franchise itself and deliberately carries NO referral-fee language.
 *
 * There are intentionally NO postcard / Lob steps in either track.
 *
 * Importable from both client and server via the `@shared/*` path alias.
 */

export type TrackId = "broker" | "client";

export type TrackStepType =
  | "linkedin_connect"
  | "email"
  | "sms"
  | "linkedin_message"
  | "call";

export interface CampaignTrackStep {
  stepOrder: number;
  delayDays: number;
  stepType: TrackStepType;
  stepName: string;
  priority: "High" | "Medium" | "Low";
  /** Email subject. Empty string for non-email channels. */
  subject: string;
  /** Rich HTML body — used by the drip seed + the email send path. */
  bodyHtml: string;
  /** Plain-text body — used by the override compose box, SMS, LinkedIn, calls. */
  bodyText: string;
}

export const BROKER_CAMPAIGN_NAME = "Grok Campaign"; // keep exact: preserves existing enrollments
export const BROKER_2_CAMPAIGN_NAME = "Grok 2.0 - for brokers";
export const CLIENT_CAMPAIGN_NAME = "Grok Campaign 2.0 - Clients";

export const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";
export const WEBSITE = "https://www.newdawnfranchising.com";

export const EMAIL_STYLE =
  `font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e; line-height: 1.6;`;

/**
 * Inject explicit spacing into the email HTML. Bare <p>/<ul>/<li>/<h3> tags
 * render "clumped" because email clients and the admin preview (Tailwind reset)
 * zero out default margins. Adding inline margins guarantees readable spacing
 * everywhere the body is shown or sent.
 */
export function withSpacing(html: string): string {
  return html
    .replace(/<p>/g, '<p style="margin:0 0 16px 0;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px 0; padding-left:22px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px 0; padding-left:22px;">')
    .replace(/<li>/g, '<li style="margin:0 0 8px 0;">')
    .replace(/<h3 style="([^"]*)">/g, '<h3 style="$1; margin:24px 0 10px 0; font-size:17px;">');
}

// ─────────────────────────────────────────────────────────────────────────────
// BROCHURE LINKS — multilingual download links for the email steps.
//
// Links let recipients choose whether to retrieve a brochure. Delivery and
// inbox placement still require independent verification.
//
// The six brochures are already published at /brochures (see client/public/brochures)
// in the three languages New Dawn translates — English, Spanish, and Traditional
// Chinese. We surface all three inline (mirroring the EN · ES · 中文 selector on the
// site) so the reader self-selects rather than us guessing their language.
//   • investor — the 6-page E-2 investor brochure (end-consumer / forward-to-client)
//   • partner  — the 1-page broker / referral-partner one-pager
export type BrochureEmailKind = "investor" | "partner";

const BROCHURE_EMAIL_LANGS: { code: "en" | "es" | "zh-TW"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh-TW", label: "中文" },
];

/** Absolute URL of a hosted brochure PDF (first-party, on the sending domain). */
export function brochureFileUrl(kind: BrochureEmailKind, code: "en" | "es" | "zh-TW"): string {
  return `${WEBSITE}/brochures/${kind}-brochure-${code}.pdf`;
}

/** Inline HTML brochure block — a labeled row of EN · ES · 中文 download links. */
export function brochureLinksHtml(kind: BrochureEmailKind, label: string): string {
  const links = BROCHURE_EMAIL_LANGS
    .map(
      (l) =>
        `<a href="${brochureFileUrl(kind, l.code)}" style="color:#1a1a2e; font-weight:600; text-decoration:underline;">${l.label}</a>`,
    )
    .join(' &nbsp;·&nbsp; ');
  return `<p style="margin:16px 0; padding:12px 16px; background:#f6f7fb; border-left:3px solid #c9a227; border-radius:4px;"><strong>${label}:</strong> ${links}</p>`;
}

/** Plain-text equivalent for the override compose box / text part of the email. */
export function brochureLinksText(kind: BrochureEmailKind, label: string): string {
  const links = BROCHURE_EMAIL_LANGS.map((l) => `  ${l.label}: ${brochureFileUrl(kind, l.code)}`).join('\n');
  return `${label}:\n${links}`;
}

/** Replace the {{name}} / {{firstName}} merge tokens with a concrete value. */
export function renderTrackText(text: string, name: string): string {
  return (text || "")
    .replace(/\{\{\s*firstName\s*\}\}/gi, name)
    .replace(/\{\{\s*name\s*\}\}/gi, name);
}

// ─────────────────────────────────────────────────────────────────────────────
// BROKER TRACK — referral-partner pitch (immigration attorneys, business
// brokers, E-2 consultants). Lifted verbatim from the original Grok Campaign so
// the tone the operator likes is preserved, plus a plain-text rendering of each
// step for the override compose box.
// ─────────────────────────────────────────────────────────────────────────────

const BROKER_TRACK_SOURCE: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I came across your work helping clients with U.S. business and visa pathways. I'm with New Dawn Franchising, built specifically for E-2 Treaty Investor Visa candidates. Would love to connect and explore whether we can be a resource for your pipeline."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I came across your work helping clients with U.S. business and visa pathways. I'm with New Dawn Franchising, built specifically for E-2 Treaty Investor Visa candidates. Would love to connect and explore whether we can be a resource for your pipeline."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
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
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Quick Intro",
    priority: "Low",
    subject: "New Dawn E-2 intro",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 franchise platform — clients choose PM, Insurance, or Telecom contracts ($225K), direct the business while we run ops, and can live anywhere in the U.S. Worth a look? ${WEBSITE}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 franchise platform — clients choose PM, Insurance, or Telecom contracts ($225K), direct the business while we run ops, and can live anywhere in the U.S. Worth a look? ${WEBSITE}`,
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
"Hi {{name}} — sent you an email as well so it doesn't get buried. We built New Dawn specifically for E-2 candidates: $225K qualifying investment, choice of Property Management, Insurance, or Telecom contracts, and a director model where your client oversees strategy while our team runs day-to-day. Happy to share a one-pager if helpful for anyone in your pipeline."`,
    bodyText: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — sent you an email as well so it doesn't get buried. We built New Dawn specifically for E-2 candidates: $225K qualifying investment, choice of Property Management, Insurance, or Telecom contracts, and a director model where your client oversees strategy while our team runs day-to-day. Happy to share a one-pager if helpful for anyone in your pipeline."`,
  },
  {
    stepOrder: 5,
    delayDays: 3,
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
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "What your client would manage",
    priority: "High",
    subject: "What your client would manage",
    bodyHtml: `<p>Hi {{firstName}},</p><p>One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.</p><p>Would you like that outline?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.

Would you like that outline?

Best,
Dylan`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Documents before a recommendation",
    priority: "High",
    subject: "Documents before a recommendation",
    bodyHtml: `<p>Hi {{firstName}},</p><p>You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.</p><p>Would you like me to send those?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.

Would you like me to send those?

Best,
Dylan`,
  },
  {
    stepOrder: 8,
    delayDays: 7,
    stepType: "call",
    stepName: "Call — Referral Partnership Discussion",
    priority: "High",
    subject: "",
    bodyHtml: `Call {{name}} to discuss the New Dawn broker referral partnership.

Talking points:
• Referral commission: $225,000 × 12.5% = $28,125 per qualified client
• Client funds held in escrow until visa clears
• Three verticals: Property Management, Insurance, Telecom (VOIP)
• Director model — client oversees, New Dawn runs day-to-day ops
• Proprietary AI platform for growth automation and reporting
• Structured buy-back program for client exit
• Book follow-up: ${CALENDLY}`,
    bodyText: `Call {{name}} to discuss the New Dawn broker referral partnership.

Talking points:
• Referral commission: $225,000 × 12.5% = $28,125 per qualified client
• Client funds held in escrow until visa clears
• Three verticals: Property Management, Insurance, Telecom (VOIP)
• Director model — client oversees, New Dawn runs day-to-day ops
• Proprietary AI platform for growth automation and reporting
• Structured buy-back program for client exit
• Book follow-up: ${CALENDLY}`,
  },
  {
    stepOrder: 9,
    delayDays: 10,
    stepType: "email",
    stepName: "What would you need to evaluate?",
    priority: "Medium",
    subject: "What would you need to evaluate?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?</p><p>A quick reply is enough; I can send the relevant information.</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?

A quick reply is enough; I can send the relevant information.

Best,
Dylan`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Questions about the investment terms",
    priority: "Medium",
    subject: "Questions about the investment terms",
    bodyHtml: `<p>Hi {{firstName}},</p><p>If New Dawn is relevant to a client, I can provide the written investment and exit terms for their advisers to review. I would rather you evaluate the documents than rely on a summary in an email.</p><p>Would those be useful?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

If New Dawn is relevant to a client, I can provide the written investment and exit terms for their advisers to review. I would rather you evaluate the documents than rely on a summary in an email.

Would those be useful?

Best,
Dylan`,
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Pipeline Check-In",
    priority: "Low",
    subject: "E-2 pipeline check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Any E-2 clients exploring U.S. business options right now? We offer PM, Insurance, or Telecom contracts — $225K, director model, escrow protected. Brokers earn $28,125/referral. Happy to chat: ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn. Any E-2 clients exploring U.S. business options right now? We offer PM, Insurance, or Telecom contracts — $225K, director model, escrow protected. Brokers earn $28,125/referral. Happy to chat: ${CALENDLY}`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "How an introduction would work",
    priority: "Medium",
    subject: "How an introduction would work",
    bodyHtml: `<p>Hi {{firstName}},</p><p>If a client wants to explore New Dawn, we can first discuss their business interests and operating role, then provide the relevant franchise materials for independent review.</p><p>Would a brief outline of that process help?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

If a client wants to explore New Dawn, we can first discuss their business interests and operating role, then provide the relevant franchise materials for independent review.

Would a brief outline of that process help?

Best,
Dylan`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Should I close the loop?",
    priority: "Low",
    subject: "Should I close the loop?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I'll close the loop after this note. If franchise options become relevant to a client, you can reach me by replying here.</p><p>Should I leave this with you for now?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I'll close the loop after this note. If franchise options become relevant to a client, you can reach me by replying here.

Should I leave this with you for now?

Best,
Dylan`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT TRACK (Grok 2.0) — written DIRECTLY to the E-2 investor candidate.
// Centers on what clients want: obtain & renew an E-2 visa, live anywhere in
// the U.S., day-to-day operating systems, FDD Item 19 ROI, a structured exit,
// and escrow-protected funds until visa approval.
// LOAD-BEARING: NO referral-fee / commission / broker-portal language.
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_TRACK_SOURCE: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I help international investors secure and renew the E-2 Treaty Investor Visa through New Dawn Franchising: a real U.S. business you direct, live anywhere, and exit on your terms. Would love to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I help international investors secure and renew the E-2 Treaty Investor Visa through New Dawn Franchising: a real U.S. business you direct, live anywhere, and exit on your terms. Would love to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Still comparing U.S. business options?",
    priority: "High",
    subject: "Still comparing U.S. business options?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I'm Dylan at New Dawn Franchising. We offer Property Management, Insurance, and Telecom franchise options.</p><p>Are you currently comparing U.S. businesses to own and actively direct?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I'm Dylan at New Dawn Franchising. We offer Property Management, Insurance, and Telecom franchise options.

Are you currently comparing U.S. businesses to own and actively direct?

Best,
Dylan`,
  },
  {
    stepOrder: 3,
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Quick Intro",
    priority: "Low",
    subject: "New Dawn E-2 intro",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 pathway — get & renew your visa, live anywhere in the U.S., escrow-protected $225K, proven ops systems, and a clear exit plan. Worth a look? ${WEBSITE}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 pathway — get & renew your visa, live anywhere in the U.S., escrow-protected $225K, proven ops systems, and a clear exit plan. Worth a look? ${WEBSITE}`,
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
"Hi {{name}} — sent you an email so it doesn't get buried. New Dawn is built around what E-2 investors actually want: obtain & renew the visa, live anywhere in the U.S., escrow-protected funds until approval, proven day-to-day ops, FDD Item 19 financials, and a structured exit. Happy to share a one-pager."`,
    bodyText: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — sent you an email so it doesn't get buried. New Dawn is built around what E-2 investors actually want: obtain & renew the visa, live anywhere in the U.S., escrow-protected funds until approval, proven day-to-day ops, FDD Item 19 financials, and a structured exit. Happy to share a one-pager."`,
  },
  {
    stepOrder: 5,
    delayDays: 3,
    stepType: "email",
    stepName: "Which business interests you?",
    priority: "High",
    subject: "Which business interests you?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I can send a short overview of our franchise options and the responsibilities of an owner.</p><p>Which is most relevant to you: Property Management, Insurance, or Telecom?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I can send a short overview of our franchise options and the responsibilities of an owner.

Which is most relevant to you: Property Management, Insurance, or Telecom?

Best,
Dylan`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Your role as the owner",
    priority: "High",
    subject: "Your role as the owner",
    bodyHtml: `<p>Hi {{firstName}},</p><p>Before comparing franchise options, it helps to understand what you would manage each week and where the operating team would support you.</p><p>Would you like an outline of the owner's responsibilities?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

Before comparing franchise options, it helps to understand what you would manage each week and where the operating team would support you.

Would you like an outline of the owner's responsibilities?

Best,
Dylan`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Franchise documents for review",
    priority: "High",
    subject: "Franchise documents for review",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I can send the franchise disclosure materials so you and your advisers can review the investment, obligations, and available financial disclosures.</p><p>Would you like a copy?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I can send the franchise disclosure materials so you and your advisers can review the investment, obligations, and available financial disclosures.

Would you like a copy?

Best,
Dylan`,
  },
  {
    stepOrder: 8,
    delayDays: 7,
    stepType: "call",
    stepName: "Call — E-2 Discovery Discussion",
    priority: "High",
    subject: "",
    bodyHtml: `Call {{name}} to discuss their E-2 goals with New Dawn.

Talking points (client-centered):
• Obtain E-2 visa — $225,000 qualifying investment (financing available)
• Renew long-term — operating enterprise with renewal-ready reporting
• Live anywhere in the U.S. — director model, not tied to one location
• Escrow guarantee — funds held until visa approval; refund framework in FDD
• Day-to-day ops — approved local teams run PM, Insurance, or Telecom
• ROI — FDD Item 19 Financial Performance Representation
• Exit plan — structured buy-back program when ready to transition
• Book follow-up: ${CALENDLY}`,
    bodyText: `Call {{name}} to discuss their E-2 goals with New Dawn.

Talking points (client-centered):
• Obtain E-2 visa — $225,000 qualifying investment (financing available)
• Renew long-term — operating enterprise with renewal-ready reporting
• Live anywhere in the U.S. — director model, not tied to one location
• Escrow guarantee — funds held until visa approval; refund framework in FDD
• Day-to-day ops — approved local teams run PM, Insurance, or Telecom
• ROI — FDD Item 19 Financial Performance Representation
• Exit plan — structured buy-back program when ready to transition
• Book follow-up: ${CALENDLY}`,
  },
  {
    stepOrder: 9,
    delayDays: 10,
    stepType: "email",
    stepName: "What would help you compare?",
    priority: "Medium",
    subject: "What would help you compare?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>Which question matters most as you compare businesses: your operating role, the investment terms, or the available locations?</p><p>Reply with whichever is most useful and I can point you to the relevant information.</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

Which question matters most as you compare businesses: your operating role, the investment terms, or the available locations?

Reply with whichever is most useful and I can point you to the relevant information.

Best,
Dylan`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Reviewing the longer-term terms",
    priority: "Medium",
    subject: "Reviewing the longer-term terms",
    bodyHtml: `<p>Hi {{firstName}},</p><p>The written agreement matters as much as the initial pitch. I can help you locate the renewal, transfer, and exit provisions for independent review.</p><p>Would that help your comparison?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

The written agreement matters as much as the initial pitch. I can help you locate the renewal, transfer, and exit provisions for independent review.

Would that help your comparison?

Best,
Dylan`,
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Check-In",
    priority: "Low",
    subject: "E-2 check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Where are you in your E-2 planning? We help investors get & renew the visa, live anywhere in the U.S., escrow-protected funds, FDD Item 19 ROI, proven ops, and a clear exit. Happy to chat: ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn. Where are you in your E-2 planning? We help investors get & renew the visa, live anywhere in the U.S., escrow-protected funds, FDD Item 19 ROI, proven ops, and a clear exit. Happy to chat: ${CALENDLY}`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "Your next step",
    priority: "Medium",
    subject: "Your next step",
    bodyHtml: `<p>Hi {{firstName}},</p><p>If you are still exploring New Dawn, we can start with your preferred industry and how involved you want to be in operating the business.</p><p>Are you actively comparing options, or is this for later?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

If you are still exploring New Dawn, we can start with your preferred industry and how involved you want to be in operating the business.

Are you actively comparing options, or is this for later?

Best,
Dylan`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Should I close the loop?",
    priority: "Low",
    subject: "Should I close the loop?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I'll make this my last follow-up. If you want to revisit the franchise options later, you can reply here and reach me directly.</p><p>Should I leave this with you for now?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I'll make this my last follow-up. If you want to revisit the franchise options later, you can reply here and reach me directly.

Should I leave this with you for now?

Best,
Dylan`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BROKER 2.0 TRACK — same 13-step omnichannel structure as CLIENT_TRACK, but
// written to referral partners (immigration attorneys, E-2 consultants, wealth
// managers, business brokers). Centers on what brokers need: a credible E-2
// solution for their clients, commission ($28,125 / 12.5%), escrow alignment,
// broker portal, FDD Item 19 talking points, and a complete client lifecycle.
// LOAD-BEARING: mirrors CLIENT_TRACK stepOrder/delayDays/stepTypes exactly.
// ─────────────────────────────────────────────────────────────────────────────

// REWRITTEN 2026-08 for reply-rate, not click-rate. The old copy read like a
// brochure: money-led subject lines ("$28,125" — a spam-filter trigger and a
// too-good-to-be-true signal to attorneys), 300+-word bodies, 6+ links per
// email competing with the CTA, and a buried "15-minute call" ask. Production
// data showed near-zero human engagement. The new copy is short and
// conversational, keeps dollar figures out of subjects, strips almost every
// link (brochures/FDD are offered as a "reply and I'll send it" — the reply IS
// the goal), asks ONE question per email, and signs off "Dylan" (the send path
// auto-appends his full signature, so a long sign-off block would double up).
const BROKER_2_TRACK_SOURCE: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I work with attorneys whose E-2 clients are ready to file but still need a qualifying U.S. business. That's the gap we fill. Would be glad to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I work with attorneys whose E-2 clients are ready to file but still need a qualifying U.S. business. That's the gap we fill. Would be glad to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
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
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Broker Intro",
    priority: "Low",
    subject: "New Dawn broker intro",
    bodyHtml: `Hi {{name}}, it's Dylan from New Dawn Franchising — I emailed you yesterday about E-2 client referrals. No pitch here, just didn't want it buried. Happy to answer anything by text or email.`,
    bodyText: `Hi {{name}}, it's Dylan from New Dawn Franchising — I emailed you yesterday about E-2 client referrals. No pitch here, just didn't want it buried. Happy to answer anything by text or email.`,
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
"Hi {{name}} — emailed you as well so it doesn't get buried. Short version: we run an escrow-protected E-2 franchise platform and pay referral partners 12.5% per placement. If an E-2 client ever needs a qualifying U.S. business, I'd love to be your first call."`,
    bodyText: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — emailed you as well so it doesn't get buried. Short version: we run an escrow-protected E-2 franchise platform and pay referral partners 12.5% per placement. If an E-2 client ever needs a qualifying U.S. business, I'd love to be your first call."`,
  },
  {
    stepOrder: 5,
    delayDays: 3,
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
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "What your client would manage",
    priority: "High",
    subject: "What your client would manage",
    bodyHtml: `<p>Hi {{firstName}},</p><p>One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.</p><p>Would you like that outline?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

One question worth resolving early is what the franchise owner actually does each week. I can share the division of responsibilities between the owner and the operating team.

Would you like that outline?

Best,
Dylan`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Documents before a recommendation",
    priority: "High",
    subject: "Documents before a recommendation",
    bodyHtml: `<p>Hi {{firstName}},</p><p>You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.</p><p>Would you like me to send those?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

You may prefer to review the documents before discussing a client introduction. I can share the franchise disclosure materials and help identify where the operating model and investment terms are described.

Would you like me to send those?

Best,
Dylan`,
  },
  {
    stepOrder: 8,
    delayDays: 7,
    stepType: "call",
    stepName: "Call — Broker Referral Partnership Discussion",
    priority: "High",
    subject: "",
    bodyHtml: `Call {{name}} to discuss the New Dawn broker referral partnership.

Talking points (broker-centered):
• Open with their practice, not our pitch — what E-2 clients do they see?
• Escrow: $225K held until visa approval; refund framework documented in the FDD
• Director model: client directs from anywhere in the U.S.; local teams run daily ops (PM / Insurance / Telecom)
• Renewal-ready: recurring revenue + documented operating activity for every renewal filing
• Structured buy-back exit, documented in the FDD
• Referral fee: 12.5% — $28,125 per qualified placement, paid when the visa clears
• No exclusivity — we work alongside their existing relationships
• Broker portal for registering + tracking referrals: ${WEBSITE}/broker-portal
• Book follow-up: ${CALENDLY}`,
    bodyText: `Call {{name}} to discuss the New Dawn broker referral partnership.

Talking points (broker-centered):
• Open with their practice, not our pitch — what E-2 clients do they see?
• Escrow: $225K held until visa approval; refund framework documented in the FDD
• Director model: client directs from anywhere in the U.S.; local teams run daily ops (PM / Insurance / Telecom)
• Renewal-ready: recurring revenue + documented operating activity for every renewal filing
• Structured buy-back exit, documented in the FDD
• Referral fee: 12.5% — $28,125 per qualified placement, paid when the visa clears
• No exclusivity — we work alongside their existing relationships
• Broker portal for registering + tracking referrals: ${WEBSITE}/broker-portal
• Book follow-up: ${CALENDLY}`,
  },
  {
    stepOrder: 9,
    delayDays: 10,
    stepType: "email",
    stepName: "What would you need to evaluate?",
    priority: "Medium",
    subject: "What would you need to evaluate?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?</p><p>A quick reply is enough; I can send the relevant information.</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I want to make this useful to your practice. Is the main question the owner's responsibilities, the investment structure, or the available businesses?

A quick reply is enough; I can send the relevant information.

Best,
Dylan`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Questions about the investment terms",
    priority: "Medium",
    subject: "Questions about the investment terms",
    bodyHtml: `<p>Hi {{firstName}},</p><p>If New Dawn is relevant to a client, I can provide the written investment and exit terms for their advisers to review. I would rather you evaluate the documents than rely on a summary in an email.</p><p>Would those be useful?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

If New Dawn is relevant to a client, I can provide the written investment and exit terms for their advisers to review. I would rather you evaluate the documents than rely on a summary in an email.

Would those be useful?

Best,
Dylan`,
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Pipeline Check-In",
    priority: "Low",
    subject: "E-2 pipeline check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn again. If an E-2 client ever asks "what business should I buy?", I'd like to be your first text. Anything I can answer in the meantime?`,
    bodyText: `Hi {{name}}, Dylan from New Dawn again. If an E-2 client ever asks "what business should I buy?", I'd like to be your first text. Anything I can answer in the meantime?`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "How an introduction would work",
    priority: "Medium",
    subject: "How an introduction would work",
    bodyHtml: `<p>Hi {{firstName}},</p><p>If a client wants to explore New Dawn, we can first discuss their business interests and operating role, then provide the relevant franchise materials for independent review.</p><p>Would a brief outline of that process help?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

If a client wants to explore New Dawn, we can first discuss their business interests and operating role, then provide the relevant franchise materials for independent review.

Would a brief outline of that process help?

Best,
Dylan`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Should I close the loop?",
    priority: "Low",
    subject: "Should I close the loop?",
    bodyHtml: `<p>Hi {{firstName}},</p><p>I'll close the loop after this note. If franchise options become relevant to a client, you can reach me by replying here.</p><p>Should I leave this with you for now?</p><p>Best,<br/>Dylan</p>`,
    bodyText: `Hi {{firstName}},

I'll close the loop after this note. If franchise options become relevant to a client, you can reach me by replying here.

Should I leave this with you for now?

Best,
Dylan`,
  },
];

export const BROKER_TRACK = reviewedEmailSteps(BROKER_TRACK_SOURCE, "broker");

export const BROKER_2_TRACK = reviewedEmailSteps(BROKER_2_TRACK_SOURCE, "broker");

export const CLIENT_TRACK = reviewedEmailSteps(CLIENT_TRACK_SOURCE, "client");

export const CAMPAIGN_TRACKS: Record<TrackId, CampaignTrackStep[]> = {
  broker: BROKER_2_TRACK,
  client: CLIENT_TRACK,
};

export function getTrackSteps(track: TrackId): CampaignTrackStep[] {
  return CAMPAIGN_TRACKS[track] ?? BROKER_2_TRACK;
}

export function campaignNameForTrack(track: TrackId): string {
  if (track === "client") return CLIENT_CAMPAIGN_NAME;
  return BROKER_2_CAMPAIGN_NAME;
}
