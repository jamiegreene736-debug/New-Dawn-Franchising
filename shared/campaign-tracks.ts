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
// DELIVERABILITY: we LINK to the hosted PDFs, we never ATTACH them. These steps
// send as cold drip mail over Gmail SMTP on a domain that's being actively warmed
// (see the DNSBL monitor, List-Unsubscribe headers, and warmup engine). A binary
// PDF attachment on cold outreach is one of the strongest spam/quarantine signals
// there is — corporate mail gateways routinely defang or block it — and it would
// undermine all of that warmup work. A first-party https:// link to a PDF on the
// SAME domain we send from carries sender trust instead of risk, keeps the message
// light, and lets the recipient open the brochure on their terms.
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

export const BROKER_TRACK: CampaignTrackStep[] = [
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
    stepName: "Touch 1 — Partnership Intro",
    priority: "High",
    subject: "E-2 referral partnership for your clients — New Dawn Franchising",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>I'm reaching out from <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> — the first franchise platform built specifically for <strong>E-2 Treaty Investor Visa</strong> candidates who need a real, operating U.S. business they can direct without running day-to-day operations themselves.</p>
  <p>Many immigration attorneys, visa consultants, and business brokers we work with have clients looking for exactly this: a qualifying $225,000 investment, recurring-revenue contracts, and the flexibility to live anywhere in the United States while a proven team executes locally.</p>
  <p>We offer clients a choice of three verticals — each built on long-term contracts:</p>
  <ul>
    <li><strong>Property Management</strong> — recurring management agreements</li>
    <li><strong>Insurance</strong> — agency and policy contracts</li>
    <li><strong>Telecom (VOIP)</strong> — business communications contracts</li>
  </ul>
  <p>If you refer E-2 candidates, I'd welcome a brief conversation about how we can support your practice — and how referring brokers earn meaningful commissions on every qualified placement.</p>
  <p>Would you be open to a 15-minute call this week?</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Dear {{name}},

I'm reaching out from New Dawn Franchising — the first franchise platform built specifically for E-2 Treaty Investor Visa candidates who need a real, operating U.S. business they can direct without running day-to-day operations themselves.

Many immigration attorneys, visa consultants, and business brokers we work with have clients looking for exactly this: a qualifying $225,000 investment, recurring-revenue contracts, and the flexibility to live anywhere in the United States while a proven team executes locally.

Clients choose one of three contract-based verticals: Property Management, Insurance, or Telecom (VOIP).

If you refer E-2 candidates, I'd welcome a brief conversation about how we can support your practice — and how referring brokers earn meaningful commissions on every qualified placement.

Would you be open to a 15-minute call this week?

Best regards,
Dylan Delaney
New Dawn Franchising
${WEBSITE}
dylan@newdawnfranchising.com`,
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
    stepName: "Touch 2 — Trust & Team Credibility",
    priority: "High",
    subject: "Who's behind New Dawn — VC, Google, and Forbes 30 Under 30",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Following up on my note about <strong>New Dawn Franchising</strong>. Before diving into the referral structure, I wanted to share why professionals trust us with their E-2 clients.</p>
  <p>Our leadership team brings together operators and investors from some of the most respected names in venture capital, technology, and franchise law:</p>
  <ul>
    <li><strong>Tom Meister</strong> — former executive at unicorn-backed online lenders (Funding Circle, Zilch); leads Grizzly Peak Ventures</li>
    <li><strong>Kamal Obbad</strong> — Harvard graduate, Forbes 30 Under 30, former Google PM, Khosla Ventures–backed founder (Nebula Genomics)</li>
    <li><strong>Chris von Pohlot</strong> — Columbia-educated fintech entrepreneur; founder of Altbanc (alternative lending)</li>
    <li><strong>Zachary Bohlender</strong> — franchise and corporate attorney (Wilson Sonsini, Brightpoint Law)</li>
    <li><strong>Kevin Quinn</strong> — former Google PM and CTO of Nebula Genomics; leads our technology infrastructure</li>
    <li><strong>Jeffrey Tung</strong> — private equity operator and SMB growth specialist</li>
  </ul>
  <p>Equally important for your clients: <strong>investment funds are held in escrow</strong> with structured protections — so capital is safeguarded throughout the E-2 process.</p>
  <p>Happy to send our investor overview or jump on a short call: <a href="${CALENDLY}">book a time here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

Following up on my note about New Dawn Franchising. Before diving into the referral structure, I wanted to share why professionals trust us with their E-2 clients.

Our leadership team brings together operators and investors from respected names in venture capital, technology, and franchise law — including a Forbes 30 Under 30 honoree and former Google product leaders, plus franchise and corporate counsel.

Equally important for your clients: investment funds are held in escrow with structured protections, so capital is safeguarded throughout the E-2 process.

Happy to send our investor overview or jump on a short call: ${CALENDLY}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Touch 3 — Director Model & Three Verticals",
    priority: "High",
    subject: "How the E-2 director model works — PM, Insurance, or Telecom",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I wanted to explain how New Dawn works for E-2 visa candidates — because the structure is what makes this different from a typical franchise pitch.</p>
  <h3 style="color: #c9a227;">The Director Model</h3>
  <p><strong>Your client remains the Director</strong> — they set strategy, review performance, and maintain executive oversight. <strong>Our approved local teams handle day-to-day operations</strong> in their chosen vertical. That means your client can live anywhere in the United States while the business runs professionally on the ground.</p>
  <h3 style="color: #c9a227;">Three Contract-Based Verticals</h3>
  <p>Based on client preference, investors choose one of three recurring-revenue models:</p>
  <ul>
    <li><strong>Long-Term Property Management Contracts</strong> — stable, recurring fee income from managed properties</li>
    <li><strong>Insurance Contracts</strong> — agency commissions and policy renewals</li>
    <li><strong>Telecom (VOIP) Contracts</strong> — business communications services with recurring billing</li>
  </ul>
  <p>Each vertical is structured to meet E-2 Treaty Investor requirements: a real, operating enterprise with documented revenue and active management — not passive investment.</p>
  <p>Investment packages start at <strong>$225,000</strong> with financing options available.</p>
  <p>Would a 15-minute walkthrough be helpful for your practice?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

I wanted to explain how New Dawn works for E-2 visa candidates — because the structure is what makes this different from a typical franchise pitch.

The Director Model: your client remains the Director — they set strategy, review performance, and keep executive oversight, while our approved local teams handle day-to-day operations in their chosen vertical. Your client can live anywhere in the United States while the business runs professionally on the ground.

Three contract-based verticals: Long-Term Property Management, Insurance, or Telecom (VOIP) — each a recurring-revenue model structured to meet E-2 requirements (a real, operating enterprise with documented revenue and active management, not passive investment).

Investment packages start at $225,000 with financing options available.

Would a 15-minute walkthrough be helpful for your practice?

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — Referral Fee & Escrow Protection",
    priority: "High",
    subject: "Here's what's in it for you, {{name}} — $28,125 per referred client",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I haven't mentioned this yet, but I think it's worth being direct: <strong>referring brokers earn a 12.5% referral commission on every qualified placement</strong>.</p>
  <p>On our standard $225,000 investment package, that works out to:</p>
  <p style="font-size: 18px; color: #c9a227;"><strong>$225,000 × 12.5% = $28,125</strong> per referred client</p>
  <p>Here's how the partnership is structured:</p>
  <ul>
    <li><strong>Commission paid when the visa clears</strong> — aligned incentives for everyone</li>
    <li><strong>Client funds held in escrow</strong> — capital is protected throughout the process</li>
    <li><strong>Dedicated broker portal</strong> — track referrals, clients, and commission status in real time</li>
    <li><strong>Marketing materials provided</strong> — one-pagers, decks, and client-facing resources</li>
    <li><strong>No exclusivity required</strong> — partner alongside your existing referral relationships</li>
  </ul>
  <p>If you have even one E-2 client per year exploring U.S. business options, this could be a meaningful revenue stream for your practice.</p>
  <p>Book a quick call: <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Hi {{name}},

I haven't mentioned this yet, but I think it's worth being direct: referring brokers earn a 12.5% referral commission on every qualified placement.

On our standard $225,000 investment package, that's $225,000 × 12.5% = $28,125 per referred client.

How the partnership is structured:
- Commission paid when the visa clears — aligned incentives for everyone
- Client funds held in escrow — capital is protected throughout the process
- Dedicated broker portal — track referrals, clients, and commission status in real time
- Marketing materials provided — one-pagers, decks, and client-facing resources
- No exclusivity required — partner alongside your existing referral relationships

If you have even one E-2 client per year exploring U.S. business options, this could be a meaningful revenue stream for your practice.

Book a quick call: ${CALENDLY}

Best regards,
Dylan Delaney
New Dawn Franchising
dylan@newdawnfranchising.com`,
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
    stepName: "Touch 5 — Proprietary AI & Location Freedom",
    priority: "Medium",
    subject: "Proprietary AI + live anywhere in the U.S. — built for E-2 directors",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>One thing that sets New Dawn apart from other E-2 qualifying opportunities: we've built <strong>proprietary AI tooling</strong> to help franchise directors automate growth, monitor contract performance, and scale operations without being on-site every day.</p>
  <p>Combined with our director model, this means your clients can:</p>
  <ul>
    <li><strong>Live anywhere in the United States</strong> — Miami, Austin, New York, or abroad between embassy appointments</li>
    <li><strong>Maintain real executive control</strong> — dashboards, reporting, and strategic oversight</li>
    <li><strong>Delegate daily execution</strong> — our approved teams handle tenant calls, policy servicing, or telecom provisioning</li>
    <li><strong>Scale with AI-assisted workflows</strong> — lead generation, contract renewals, and performance analytics</li>
  </ul>
  <p>Whether your client prefers Property Management, Insurance, or Telecom contracts, the technology layer is the same: built by operators from <strong>Google</strong> and <strong>Khosla Ventures</strong>–backed ventures, not outsourced to a generic franchise CRM.</p>
  <p>Happy to walk you through a live demo on a quick call.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

One thing that sets New Dawn apart from other E-2 qualifying opportunities: we've built proprietary AI tooling to help franchise directors automate growth, monitor contract performance, and scale operations without being on-site every day.

Combined with our director model, your clients can live anywhere in the U.S., keep real executive control (dashboards, reporting, strategic oversight), delegate daily execution to our approved teams, and scale with AI-assisted workflows.

Whether your client prefers Property Management, Insurance, or Telecom contracts, the technology layer is the same — built by operators from Google and Khosla Ventures–backed ventures, not outsourced to a generic franchise CRM.

Happy to walk you through a live demo on a quick call.

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Touch 6 — Buy-Back Program & Exit Strategy",
    priority: "Medium",
    subject: "Structured exit — our in-house buy-back program for E-2 investors",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When your clients evaluate an E-2 qualifying investment, exit strategy matters as much as entry. That's why New Dawn has <strong>structured buy-back programs</strong> in place — giving investors a clear path when they're ready to transition out of the business.</p>
  <p>This reduces risk for everyone in the referral chain:</p>
  <ul>
    <li><strong>Investors</strong> know there's a defined exit, not an open-ended obligation</li>
    <li><strong>Brokers</strong> can confidently present a complete lifecycle story to skeptical clients</li>
    <li><strong>Attorneys</strong> can document a real operating enterprise with both entry and exit mechanics</li>
  </ul>
  <p>Pair that with <strong>escrow-protected funds</strong>, the director model, and choice of three contract-based verticals (Property Management, Insurance, or Telecom), and you have a referral opportunity that's genuinely differentiated in the E-2 space.</p>
  <p>Referring brokers earn <strong>$28,125</strong> (12.5% of $225,000) per qualified placement.</p>
  <p>Want me to send the partnership agreement overview?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

When your clients evaluate an E-2 qualifying investment, exit strategy matters as much as entry. That's why New Dawn has structured buy-back programs in place — giving investors a clear path when they're ready to transition out of the business.

This reduces risk for everyone in the referral chain: investors know there's a defined exit, brokers can present a complete lifecycle story, and attorneys can document a real operating enterprise with both entry and exit mechanics.

Pair that with escrow-protected funds, the director model, and choice of three contract-based verticals (Property Management, Insurance, or Telecom), and you have a referral opportunity that's genuinely differentiated in the E-2 space.

Referring brokers earn $28,125 (12.5% of $225,000) per qualified placement.

Want me to send the partnership agreement overview?

Best,
Dylan Delaney
New Dawn Franchising`,
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
    stepName: "Touch 7 — Client Outcomes & Social Proof",
    priority: "Medium",
    subject: "What broker-referred E-2 clients experience at New Dawn",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I wanted to share what a typical broker-referred client journey looks like at New Dawn:</p>
  <ol>
    <li><strong>Discovery call</strong> — we match the client to their preferred vertical (Property Management, Insurance, or Telecom)</li>
    <li><strong>Investment & escrow</strong> — $225,000 placed in escrow with documented protections</li>
    <li><strong>E-2 petition support</strong> — real operating business documentation for their attorney</li>
    <li><strong>Director onboarding</strong> — client assumes executive oversight; our team launches daily operations</li>
    <li><strong>Ongoing reporting</strong> — proprietary AI dashboards, contract performance, and compliance support</li>
    <li><strong>Exit optionality</strong> — structured buy-back when the client is ready to transition</li>
  </ol>
  <p>Throughout, <strong>you earn $28,125</strong> (12.5% of $225,000) when the visa clears — with full visibility in our broker portal.</p>
  <p>Even if the timing isn't right today, I'd love to be your go-to when an E-2 client needs a qualifying U.S. business.</p>
  <p><a href="${CALENDLY}">Book 20 minutes here</a> · <a href="${WEBSITE}">newdawnfranchising.com</a></p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

A typical broker-referred client journey at New Dawn:
1. Discovery call — we match the client to their preferred vertical (Property Management, Insurance, or Telecom)
2. Investment & escrow — $225,000 placed in escrow with documented protections
3. E-2 petition support — real operating business documentation for their attorney
4. Director onboarding — client assumes executive oversight; our team launches daily operations
5. Ongoing reporting — proprietary AI dashboards, contract performance, and compliance support
6. Exit optionality — structured buy-back when the client is ready to transition

Throughout, you earn $28,125 (12.5% of $225,000) when the visa clears — with full visibility in our broker portal.

Even if the timing isn't right today, I'd love to be your go-to when an E-2 client needs a qualifying U.S. business.

Book 20 minutes: ${CALENDLY} · ${WEBSITE}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Touch 8 — Final Note",
    priority: "Low",
    subject: "Closing the loop — E-2 referrals here whenever you need us",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If any of your clients are ever looking for an E-2 qualifying franchise, please keep <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> in mind.</p>
  <p><strong>Quick recap for your files:</strong></p>
  <ul>
    <li><strong>$225,000</strong> investment packages with financing available</li>
    <li><strong>Three verticals:</strong> Property Management, Insurance, or Telecom (VOIP) contracts</li>
    <li><strong>Director model:</strong> client oversees; New Dawn runs day-to-day operations</li>
    <li><strong>Live anywhere in the U.S.</strong> while the business operates professionally</li>
    <li><strong>Proprietary AI</strong> for growth automation and reporting</li>
    <li><strong>Escrow-protected</strong> client funds</li>
    <li><strong>Structured buy-back program</strong> for exit</li>
    <li><strong>Broker referral fee:</strong> $225,000 × 12.5% = <strong>$28,125</strong> per qualified client</li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
  <p>Wishing you continued success,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>El Paso, Texas</p>
</div>`,
    bodyText: `Hi {{name}},

This will be my last email in this series — I don't want to clutter your inbox.

If any of your clients are ever looking for an E-2 qualifying franchise, please keep New Dawn Franchising in mind.

Quick recap for your files:
- $225,000 investment packages with financing available
- Three verticals: Property Management, Insurance, or Telecom (VOIP)
- Director model: client oversees; New Dawn runs day-to-day operations
- Live anywhere in the U.S. while the business operates professionally
- Proprietary AI for growth automation and reporting
- Escrow-protected client funds
- Structured buy-back program for exit
- Broker referral fee: $225,000 × 12.5% = $28,125 per qualified client

Feel free to reach out anytime at dylan@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

Wishing you continued success,
Dylan Delaney
New Dawn Franchising
El Paso, Texas`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT TRACK (Grok 2.0) — written DIRECTLY to the E-2 investor candidate.
// Centers on what clients want: obtain & renew an E-2 visa, live anywhere in
// the U.S., day-to-day operating systems, FDD Item 19 ROI, a structured exit,
// and escrow-protected funds until visa approval.
// LOAD-BEARING: NO referral-fee / commission / broker-portal language.
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_TRACK: CampaignTrackStep[] = [
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
    stepName: "Touch 1 — What You Actually Want",
    priority: "High",
    subject: "Your E-2 visa goals — and how New Dawn is built around them",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>I'm reaching out from <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> — a franchise platform built specifically for international investors whose priorities go beyond just "getting a visa."</p>
  <p>Most E-2 candidates we speak with want the same things:</p>
  <ul>
    <li><strong>Obtain an E-2 visa</strong> — through a real, qualifying U.S. business investment</li>
    <li><strong>Renew it long-term</strong> — with an operating enterprise that keeps meeting E-2 requirements</li>
    <li><strong>Live anywhere in the United States</strong> — not tied to one city or state</li>
    <li><strong>A clear exit plan</strong> — so you're never locked into the franchise indefinitely</li>
    <li><strong>A reasonable return on investment</strong> — with financial performance disclosed in our FDD (Item 19)</li>
    <li><strong>Proven day-to-day systems</strong> — so you're not running tenant calls or field work yourself</li>
    <li><strong>Escrow protection</strong> — your funds held safely until your visa is approved</li>
  </ul>
  <p>New Dawn was designed around exactly that checklist. You choose one of three recurring-revenue verticals — Property Management, Insurance, or Telecom (VOIP) — and direct the business as the executive while our approved teams handle daily operations.</p>
  <p>Here's our investor brochure with the full overview — open it in whichever language you prefer:</p>
  ${brochureLinksHtml("investor", "Investor brochure (PDF)")}
  <p>Would you be open to a 15-minute call to see whether it fits what you're looking for?</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Dear {{name}},

I'm reaching out from New Dawn Franchising — a franchise platform built specifically for international investors whose priorities go beyond just "getting a visa."

Most E-2 candidates we speak with want the same things:
- Obtain an E-2 visa through a real, qualifying U.S. business investment
- Renew it long-term with an operating enterprise that keeps meeting E-2 requirements
- Live anywhere in the United States — not tied to one city or state
- A clear exit plan so you're never locked into the franchise indefinitely
- A reasonable return on investment, with financial performance disclosed in our FDD (Item 19)
- Proven day-to-day systems so you're not running tenant calls or field work yourself
- Escrow protection — your funds held safely until your visa is approved

New Dawn was designed around exactly that checklist. You choose one of three recurring-revenue verticals — Property Management, Insurance, or Telecom (VOIP) — and direct the business as the executive while our approved teams handle daily operations.

Here's our investor brochure with the full overview — open it in whichever language you prefer:
${brochureLinksText("investor", "Investor brochure (PDF)")}

Would you be open to a 15-minute call to see whether it fits what you're looking for?

Best regards,
Dylan Delaney
New Dawn Franchising
${WEBSITE}
dylan@newdawnfranchising.com`,
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
    stepName: "Touch 2 — Escrow Guarantee Until Visa Approval",
    priority: "High",
    subject: "Your investment is protected in escrow until your E-2 visa clears",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>One of the first questions every E-2 investor asks: <strong>"What happens to my money if the visa doesn't come through?"</strong></p>
  <p>We built New Dawn's process around that concern. Your qualifying <strong>$225,000 investment is held in escrow</strong> with documented protections throughout the E-2 setup — not released into the business until your visa is approved.</p>
  <p>Here's how the protection works:</p>
  <ul>
    <li><strong>Escrow-first structure</strong> — your capital is safeguarded from day one</li>
    <li><strong>Funds held until visa approval</strong> — aligned incentives for everyone involved</li>
    <li><strong>Refund framework</strong> — if your qualifying E-2 application is denied, your investment is released from escrow and returned to you (full details in the FDD)</li>
    <li><strong>Real operating business</strong> — established and running while your petition is in progress, so you have genuine enterprise documentation for your attorney</li>
  </ul>
  <p>This is intentional — you should never be in a position where your money is gone and your visa is not.</p>
  <p>Happy to walk you through the escrow arrangement on a short call: <a href="${CALENDLY}">book a time here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

One of the first questions every E-2 investor asks: "What happens to my money if the visa doesn't come through?"

We built New Dawn's process around that concern. Your qualifying $225,000 investment is held in escrow with documented protections throughout the E-2 setup — not released into the business until your visa is approved.

How the protection works:
- Escrow-first structure — your capital is safeguarded from day one
- Funds held until visa approval — aligned incentives for everyone involved
- Refund framework — if your qualifying E-2 application is denied, your investment is released from escrow and returned to you (full details in the FDD)
- Real operating business — established and running while your petition is in progress

You should never be in a position where your money is gone and your visa is not.

Happy to walk you through the escrow arrangement on a short call: ${CALENDLY}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Touch 3 — Live Anywhere & Day-to-Day Operations",
    priority: "High",
    subject: "Live anywhere in the U.S. — we run the day-to-day operations",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Most E-2 investors don't want to move to El Paso and answer tenant calls at 2 a.m. That's not what New Dawn is built for.</p>
  <h3 style="color: #c9a227;">Live Anywhere in the United States</h3>
  <p>As the <strong>Director</strong> of your franchise, you set strategy, review performance, and maintain executive oversight — but you don't have to live where the business operates. Miami, Austin, New York, or abroad between embassy appointments: the platform is designed for geographic flexibility.</p>
  <h3 style="color: #c9a227;">Proven Day-to-Day Operating Systems</h3>
  <p>Our approved local teams handle the daily execution in your chosen vertical:</p>
  <ul>
    <li><strong>Property Management</strong> — tenant relations, maintenance coordination, lease administration</li>
    <li><strong>Insurance</strong> — policy servicing, client renewals, licensed staff under your supervision</li>
    <li><strong>Telecom (VOIP)</strong> — account provisioning, billing, and customer support</li>
  </ul>
  <p>You maintain ownership control, bank-account oversight, and executive supervision — while proprietary dashboards, reporting, and AI-assisted workflows give you full visibility without being on-site every day.</p>
  <p>Each vertical is structured to meet E-2 requirements: a real, operating enterprise with documented revenue, active management, and renewal-ready reporting — not passive investment.</p>
  <p>Would a 15-minute walkthrough be helpful? <a href="${CALENDLY}">Book here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

Most E-2 investors don't want to move to El Paso and answer tenant calls at 2 a.m. That's not what New Dawn is built for.

Live Anywhere in the United States: as the Director of your franchise, you set strategy, review performance, and maintain executive oversight — but you don't have to live where the business operates. Miami, Austin, New York, or abroad between embassy appointments — the platform is designed for geographic flexibility.

Proven Day-to-Day Operating Systems: our approved local teams handle daily execution in your chosen vertical (Property Management, Insurance, or Telecom). You maintain ownership control, bank-account oversight, and executive supervision — while proprietary dashboards, reporting, and AI-assisted workflows give you full visibility without being on-site every day.

Each vertical meets E-2 requirements: a real, operating enterprise with documented revenue, active management, and renewal-ready reporting.

Would a 15-minute walkthrough be helpful? ${CALENDLY}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — FDD Item 19 & Return on Investment",
    priority: "High",
    subject: "What can you expect to earn? — see FDD Item 19",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Let's talk about the question every investor asks: <strong>"What kind of return can I expect?"</strong></p>
  <p>New Dawn's Franchise Disclosure Document (FDD) includes a <strong>Financial Performance Representation (Item 19)</strong> — the section where franchisors disclose actual or projected financial results. This is where you'll find detailed information on expected revenue, expenses, and the financial profile of the business.</p>
  <p>We don't put specific earnings figures in outreach emails (federal franchise law requires you review the FDD directly), but here's what Item 19 covers:</p>
  <ul>
    <li><strong>Expected revenue and expenses</strong> — detailed financial projections for each vertical</li>
    <li><strong>Recurring-revenue model</strong> — management fees, policy renewals, or telecom contracts that compound over time</li>
    <li><strong>Investment structure</strong> — how your $225,000 qualifying investment is allocated</li>
    <li><strong>Financing options</strong> — we work with lenders experienced in E-2 transactions</li>
  </ul>
  <p>The goal isn't just to qualify for a visa — it's to own a business with a reasonable return on investment that supports your family's long-term plans in the United States.</p>
  <p><a href="${WEBSITE}/request-fdd">Request the FDD</a> to review Item 19 in full, or <a href="${CALENDLY}">book a call</a> and we'll walk you through the numbers together.</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Hi {{name}},

Let's talk about the question every investor asks: "What kind of return can I expect?"

New Dawn's Franchise Disclosure Document (FDD) includes a Financial Performance Representation (Item 19) — detailed information on expected revenue, expenses, and the financial profile of the business.

We don't put specific earnings figures in outreach emails (federal franchise law requires you review the FDD directly), but Item 19 covers:
- Expected revenue and expenses for each vertical
- Recurring-revenue model — management fees, policy renewals, or telecom contracts that compound over time
- Investment structure — how your $225,000 qualifying investment is allocated
- Financing options — lenders experienced in E-2 transactions

The goal isn't just to qualify for a visa — it's to own a business with a reasonable return on investment that supports your family's long-term plans in the United States.

Request the FDD at ${WEBSITE}/request-fdd to review Item 19 in full, or book a call: ${CALENDLY}

Best regards,
Dylan Delaney
New Dawn Franchising
dylan@newdawnfranchising.com`,
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
    stepName: "Touch 5 — E-2 Renewal & Long-Term U.S. Life",
    priority: "Medium",
    subject: "Getting the visa is step one — renewing it is the real goal",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Most people focus on <em>getting</em> the E-2 visa. Smart investors focus on <em>keeping</em> it — and building a life in the United States that lasts.</p>
  <p>The E-2 Treaty Investor Visa is <strong>renewable indefinitely</strong> in two- to five-year increments, as long as your business continues to qualify. That means the franchise you choose isn't just a one-time ticket — it's the foundation for your family's long-term presence in America.</p>
  <p>New Dawn is structured for exactly that:</p>
  <ul>
    <li><strong>Recurring-revenue contracts</strong> — management fees, policy renewals, or telecom billing that compound year over year</li>
    <li><strong>Documented operating activity</strong> — auditable records your attorney can present at every renewal</li>
    <li><strong>Active management by you</strong> — executive oversight that satisfies the "develop and direct" requirement</li>
    <li><strong>U.S. workers employed</strong> — local teams on the ground, supporting the enterprise's credibility</li>
    <li><strong>Spouse work authorization</strong> — eligible under E-2 dependent rules</li>
  </ul>
  <p>Combined with the ability to <strong>live anywhere in the U.S.</strong> and our <strong>proprietary reporting dashboards</strong>, you get a business that supports not just your initial petition — but every renewal for years to come.</p>
  <p>Happy to discuss your long-term plans on a quick call.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

Most people focus on getting the E-2 visa. Smart investors focus on keeping it — and building a life in the United States that lasts.

The E-2 Treaty Investor Visa is renewable indefinitely in two- to five-year increments, as long as your business continues to qualify. The franchise you choose isn't just a one-time ticket — it's the foundation for your family's long-term presence in America.

New Dawn is structured for exactly that:
- Recurring-revenue contracts that compound year over year
- Documented operating activity — auditable records for every renewal
- Active management by you — executive oversight satisfying "develop and direct"
- U.S. workers employed — local teams supporting enterprise credibility
- Spouse work authorization — eligible under E-2 dependent rules

Combined with living anywhere in the U.S. and proprietary reporting dashboards, you get a business that supports not just your initial petition — but every renewal for years to come.

Happy to discuss your long-term plans on a quick call.

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Touch 6 — Structured Exit & Buy-Back Program",
    priority: "Medium",
    subject: "Your exit plan — because no investor wants to be locked in forever",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When you evaluate an E-2 qualifying investment, <strong>exit strategy matters as much as entry</strong>. No serious investor wants to be locked into a franchise indefinitely with no way out.</p>
  <p>That's why New Dawn has <strong>structured buy-back programs</strong> in place — giving you a clear, documented path when you're ready to transition out of the business.</p>
  <p>What that means for you:</p>
  <ul>
    <li><strong>A defined exit</strong> — not an open-ended obligation you'll regret in five years</li>
    <li><strong>In-house buy-back option</strong> — a structured mechanism documented in the FDD</li>
    <li><strong>Complete lifecycle story</strong> — entry, operation, renewal, and exit your attorney can document</li>
    <li><strong>Reduced risk</strong> — you know there's a way out before you commit your $225,000</li>
  </ul>
  <p>Pair that with escrow-protected funds, the director model, proven day-to-day operating systems, FDD Item 19 financial performance, and the freedom to live anywhere in the U.S. — and you have an E-2 pathway built around what you actually want, not just what a franchisor wants to sell.</p>
  <p>Want me to send the investor overview with the exit details?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

When you evaluate an E-2 qualifying investment, exit strategy matters as much as entry. No serious investor wants to be locked into a franchise indefinitely with no way out.

That's why New Dawn has structured buy-back programs in place — giving you a clear, documented path when you're ready to transition out of the business.

What that means for you:
- A defined exit — not an open-ended obligation
- In-house buy-back option — structured mechanism documented in the FDD
- Complete lifecycle story — entry, operation, renewal, and exit your attorney can document
- Reduced risk — you know there's a way out before you commit your $225,000

Pair that with escrow-protected funds, the director model, proven day-to-day operating systems, FDD Item 19 financial performance, and the freedom to live anywhere in the U.S.

Want me to send the investor overview with the exit details?

Best,
Dylan Delaney
New Dawn Franchising`,
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
    stepName: "Touch 7 — Your Complete E-2 Journey",
    priority: "Medium",
    subject: "What your E-2 journey looks like — from visa to renewal to exit",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I wanted to lay out what your complete journey with New Dawn would look like — mapped to the things you actually care about:</p>
  <ol>
    <li><strong>Discovery call</strong> — we match you to your preferred vertical (Property Management, Insurance, or Telecom) and review FDD Item 19 financial performance</li>
    <li><strong>Investment & escrow</strong> — $225,000 placed in escrow; funds held until your E-2 visa is approved</li>
    <li><strong>E-2 petition support</strong> — real operating business documentation your attorney can stand behind</li>
    <li><strong>Director onboarding</strong> — you take executive oversight; our approved teams launch day-to-day operations</li>
    <li><strong>Live anywhere</strong> — direct the business from Miami, Austin, New York, or abroad — not tied to one location</li>
    <li><strong>Ongoing operations & reporting</strong> — proprietary dashboards, contract performance, and renewal-ready documentation</li>
    <li><strong>E-2 renewals</strong> — recurring revenue and documented activity that supports indefinite visa renewal</li>
    <li><strong>Exit optionality</strong> — structured buy-back when you're ready to transition out</li>
  </ol>
  <p>Every step is designed around your goals — not ours. Even if the timing isn't right today, I'd love to be your resource when you're ready.</p>
  <p><a href="${CALENDLY}">Book 20 minutes here</a> · <a href="${WEBSITE}/request-fdd">Request the FDD</a></p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

What your complete journey with New Dawn would look like — mapped to the things you actually care about:

1. Discovery call — match to your preferred vertical and review FDD Item 19 financial performance
2. Investment & escrow — $225,000 placed in escrow; funds held until your E-2 visa is approved
3. E-2 petition support — real operating business documentation for your attorney
4. Director onboarding — you take executive oversight; our teams launch day-to-day operations
5. Live anywhere — direct the business from anywhere in the U.S., not tied to one location
6. Ongoing operations & reporting — proprietary dashboards and renewal-ready documentation
7. E-2 renewals — recurring revenue and documented activity supporting indefinite visa renewal
8. Exit optionality — structured buy-back when you're ready to transition out

Every step is designed around your goals — not ours.

Book 20 minutes: ${CALENDLY} · Request the FDD: ${WEBSITE}/request-fdd

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Touch 8 — Final Note",
    priority: "Low",
    subject: "Closing the loop — your E-2 pathway is here whenever you're ready",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If you ever decide to explore an E-2 qualifying franchise, please keep <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> in mind.</p>
  <p><strong>Quick recap — built around what you want:</strong></p>
  <ul>
    <li><strong>Obtain your E-2 visa</strong> — $225,000 qualifying investment with financing available</li>
    <li><strong>Renew long-term</strong> — operating enterprise with renewal-ready reporting</li>
    <li><strong>Live anywhere in the U.S.</strong> — director model, not tied to one city or state</li>
    <li><strong>Escrow guarantee</strong> — funds held in escrow until your visa is approved</li>
    <li><strong>Proven day-to-day systems</strong> — approved local teams run PM, Insurance, or Telecom operations</li>
    <li><strong>Reasonable ROI</strong> — FDD Item 19 Financial Performance Representation (<a href="${WEBSITE}/request-fdd">request the FDD</a>)</li>
    <li><strong>Structured exit plan</strong> — in-house buy-back program when you're ready to transition</li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
  <p>Wishing you the very best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>El Paso, Texas</p>
</div>`,
    bodyText: `Hi {{name}},

This will be my last email in this series — I don't want to clutter your inbox.

If you ever decide to explore an E-2 qualifying franchise, please keep New Dawn Franchising in mind.

Quick recap — built around what you want:
- Obtain your E-2 visa — $225,000 qualifying investment with financing available
- Renew long-term — operating enterprise with renewal-ready reporting
- Live anywhere in the U.S. — director model, not tied to one city or state
- Escrow guarantee — funds held in escrow until your visa is approved
- Proven day-to-day systems — approved local teams run PM, Insurance, or Telecom operations
- Reasonable ROI — FDD Item 19 Financial Performance Representation (request at ${WEBSITE}/request-fdd)
- Structured exit plan — in-house buy-back program when you're ready to transition

Feel free to reach out anytime at dylan@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

Wishing you the very best,
Dylan Delaney
New Dawn Franchising
El Paso, Texas`,
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

export const BROKER_2_TRACK: CampaignTrackStep[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    stepType: "linkedin_connect",
    stepName: "LinkedIn Connect Request",
    priority: "Medium",
    subject: "",
    bodyHtml: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I work with immigration attorneys & E-2 advisors on referral partnerships. New Dawn Franchising: $225K E-2 platform, escrow-protected, 12.5% broker commission ($28,125/placement). Would love to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I work with immigration attorneys & E-2 advisors on referral partnerships. New Dawn Franchising: $225K E-2 platform, escrow-protected, 12.5% broker commission ($28,125/placement). Would love to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Touch 1 — What Your E-2 Clients Need",
    priority: "High",
    subject: "A referral partner for your E-2 pipeline — and $28,125 per placement",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>I'm reaching out from <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> — a multi-vertical franchise platform built specifically for the <strong>E-2 Treaty Investor Visa</strong>. We partner with immigration attorneys, visa consultants, wealth managers, and business brokers who need a credible U.S. business solution for their clients.</p>
  <p>When your E-2 candidates ask what they actually want, the checklist is usually the same:</p>
  <ul>
    <li><strong>Obtain an E-2 visa</strong> — through a real, qualifying $225,000 U.S. business investment</li>
    <li><strong>Renew it long-term</strong> — with documented operating activity and renewal-ready reporting</li>
    <li><strong>Live anywhere in the United States</strong> — director oversight without being tied to one city</li>
    <li><strong>Proven day-to-day systems</strong> — so they're not answering tenant calls or running field ops</li>
    <li><strong>Escrow protection</strong> — client funds held safely until the visa is approved</li>
    <li><strong>A reasonable ROI</strong> — with financial performance disclosed in our FDD (Item 19)</li>
    <li><strong>A clear exit plan</strong> — structured buy-back so clients aren't locked in indefinitely</li>
  </ul>
  <p>New Dawn delivers all of that across three recurring-revenue verticals — <strong>Property Management, Insurance, or Telecom</strong> — while your client directs the business and our approved teams handle daily execution.</p>
  <p>For referring brokers, every qualified placement earns <strong>12.5% commission — $28,125</strong> on our standard $225,000 package, paid when the visa clears and funds are released from escrow.</p>
  <p>Here's the broker one-pager — open it in whichever language suits you:</p>
  ${brochureLinksHtml("partner", "Broker one-pager (PDF)")}
  <p>Would you be open to a 15-minute call to see whether this fits your practice?</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a> · <a href="${WEBSITE}/broker-portal">Broker Portal</a><br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Dear {{name}},

I'm reaching out from New Dawn Franchising — a multi-vertical franchise platform built specifically for the E-2 Treaty Investor Visa. We partner with immigration attorneys, visa consultants, wealth managers, and business brokers who need a credible U.S. business solution for their clients.

When your E-2 candidates ask what they actually want, the checklist is usually the same:
- Obtain an E-2 visa through a real, qualifying $225,000 U.S. business investment
- Renew it long-term with documented operating activity and renewal-ready reporting
- Live anywhere in the United States — director oversight without being tied to one city
- Proven day-to-day systems so they're not answering tenant calls or running field ops
- Escrow protection — client funds held safely until the visa is approved
- A reasonable ROI with financial performance disclosed in our FDD (Item 19)
- A clear exit plan — structured buy-back so clients aren't locked in indefinitely

New Dawn delivers all of that across three recurring-revenue verticals — Property Management, Insurance, or Telecom — while your client directs the business and our approved teams handle daily execution.

For referring brokers, every qualified placement earns 12.5% commission — $28,125 on our standard $225,000 package, paid when the visa clears and funds are released from escrow.

Here's the broker one-pager — open it in whichever language suits you:
${brochureLinksText("partner", "Broker one-pager (PDF)")}

Would you be open to a 15-minute call to see whether this fits your practice?

Best regards,
Dylan Delaney
New Dawn Franchising
${WEBSITE} · Broker Portal: ${WEBSITE}/broker-portal
dylan@newdawnfranchising.com`,
  },
  {
    stepOrder: 3,
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Broker Intro",
    priority: "Low",
    subject: "New Dawn broker intro",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 referral partnership — your clients get escrow-protected $225K, live-anywhere director model, FDD Item 19 ROI. You earn $28,125 (12.5%) per placement. Worth a look? ${WEBSITE}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 referral partnership — your clients get escrow-protected $225K, live-anywhere director model, FDD Item 19 ROI. You earn $28,125 (12.5%) per placement. Worth a look? ${WEBSITE}`,
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
"Hi {{name}} — sent you an email so it doesn't get buried. New Dawn is built for E-2 referral partners: your clients get obtain & renew the visa, live anywhere in the U.S., escrow-protected funds, proven day-to-day ops, FDD Item 19 financials, and a structured exit. You earn $28,125 (12.5%) per qualified placement. Happy to share a broker one-pager."`,
    bodyText: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — sent you an email so it doesn't get buried. New Dawn is built for E-2 referral partners: your clients get obtain & renew the visa, live anywhere in the U.S., escrow-protected funds, proven day-to-day ops, FDD Item 19 financials, and a structured exit. You earn $28,125 (12.5%) per qualified placement. Happy to share a broker one-pager."`,
  },
  {
    stepOrder: 5,
    delayDays: 3,
    stepType: "email",
    stepName: "Touch 2 — Escrow Protection & Commission Alignment",
    priority: "High",
    subject: "Escrow protects your clients — and aligns your $28,125 commission",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>One of the first questions your E-2 clients ask: <strong>"What happens to my money if the visa doesn't come through?"</strong> And one of the first questions referring brokers ask: <strong>"When do I actually get paid?"</strong></p>
  <p>New Dawn's escrow structure answers both:</p>
  <ul>
    <li><strong>Client funds held in escrow</strong> — the qualifying $225,000 investment is safeguarded from day one, not released into the business until the E-2 visa is approved</li>
    <li><strong>Refund framework</strong> — if a qualifying E-2 application is denied, investment funds are released from escrow and returned to the client (full details in the FDD)</li>
    <li><strong>Real operating business</strong> — established and running during the petition, giving your client's attorney genuine enterprise documentation</li>
    <li><strong>Commission paid when funds clear</strong> — your <strong>12.5% referral fee ($28,125)</strong> is paid when the visa clears and New Dawn receives funds from escrow — aligned incentives for everyone</li>
  </ul>
  <p>This is intentional. Your clients should never be in a position where their money is gone and their visa is not — and you should never be in a position where you've referred a client into an unstructured process.</p>
  <p>Track every referral in our <a href="${WEBSITE}/broker-portal">broker portal</a>. Happy to walk you through the escrow and commission flow on a short call: <a href="${CALENDLY}">book a time here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

One of the first questions your E-2 clients ask: "What happens to my money if the visa doesn't come through?" And one of the first questions referring brokers ask: "When do I actually get paid?"

New Dawn's escrow structure answers both:
- Client funds held in escrow — $225,000 safeguarded until E-2 visa approval
- Refund framework — if a qualifying E-2 application is denied, funds returned to client (details in FDD)
- Real operating business — genuine enterprise documentation for your client's attorney
- Commission paid when funds clear — your 12.5% referral fee ($28,125) paid when visa clears and funds are released

Your clients should never be in a position where their money is gone and their visa is not — and you should never refer into an unstructured process.

Track referrals in our broker portal: ${WEBSITE}/broker-portal
Book a call: ${CALENDLY}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Touch 3 — Director Model & Day-to-Day Operations",
    priority: "High",
    subject: "What to tell your clients — live anywhere, we run the day-to-day",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When you present an E-2 qualifying opportunity to skeptical clients, the objection is almost always the same: <strong>"I don't want to move to Texas and run a business myself."</strong></p>
  <p>That's exactly why New Dawn's <strong>director model</strong> resonates with referral partners:</p>
  <h3 style="color: #c9a227;">Live Anywhere in the United States</h3>
  <p>Your client is the <strong>Director</strong> — they set strategy, review performance, and maintain executive oversight. They don't have to live where the business operates. Miami, Austin, New York, or abroad between embassy appointments: the platform is designed for geographic flexibility.</p>
  <h3 style="color: #c9a227;">Proven Day-to-Day Operating Systems</h3>
  <p>Our approved local teams handle daily execution in the client's chosen vertical:</p>
  <ul>
    <li><strong>Property Management</strong> — tenant relations, maintenance coordination, lease administration</li>
    <li><strong>Insurance</strong> — policy servicing, client renewals, licensed staff under their supervision</li>
    <li><strong>Telecom</strong> — account provisioning, billing, and customer support</li>
  </ul>
  <p>Proprietary technology — owner dashboards, automated client communication, marketing, and workflow automation — gives your client full visibility without being on-site every day. This isn't off-the-shelf software; it's infrastructure built for E-2 investor oversight.</p>
  <p>Each vertical meets E-2 requirements: a real, operating enterprise with documented revenue, active management, and renewal-ready reporting.</p>
  <p>Here's the client-facing investor brochure you can forward straight to a candidate — in their language:</p>
  ${brochureLinksHtml("investor", "Investor brochure (PDF)")}
  <p>Would a 15-minute walkthrough help you present this to your next E-2 client? <a href="${CALENDLY}">Book here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

When you present an E-2 qualifying opportunity to skeptical clients, the objection is almost always: "I don't want to move to Texas and run a business myself."

That's why New Dawn's director model resonates with referral partners:

Live Anywhere in the U.S.: your client is the Director — strategy, performance review, executive oversight — without living where the business operates.

Proven Day-to-Day Operating Systems: approved local teams handle Property Management, Insurance, or Telecom execution. Proprietary technology (dashboards, automation, marketing) gives full visibility without being on-site.

Each vertical meets E-2 requirements: real operating enterprise, documented revenue, active management, renewal-ready reporting.

Here's the client-facing investor brochure you can forward straight to a candidate — in their language:
${brochureLinksText("investor", "Investor brochure (PDF)")}

Would a 15-minute walkthrough help you present this to your next E-2 client? ${CALENDLY}

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — FDD Item 19 Talking Points",
    priority: "High",
    subject: "Arm yourself with FDD Item 19 — answer your clients' ROI questions",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Your E-2 clients will ask: <strong>"What kind of return can I expect?"</strong> You need a credible answer — without overpromising.</p>
  <p>New Dawn's Franchise Disclosure Document (FDD) includes a <strong>Financial Performance Representation (Item 19)</strong> — the section where franchisors disclose actual or projected financial results. This is your best tool for ROI conversations:</p>
  <ul>
    <li><strong>Expected revenue and expenses</strong> — detailed financial projections for each vertical (Property Management, Insurance, Telecom)</li>
    <li><strong>Recurring-revenue model</strong> — management fees, policy renewals, or telecom contracts that compound over time</li>
    <li><strong>Investment structure</strong> — how the $225,000 qualifying investment is allocated</li>
    <li><strong>Financing options</strong> — we work with lenders experienced in E-2 transactions</li>
  </ul>
  <p>We don't put specific earnings figures in outreach emails (federal franchise law requires clients review the FDD directly), but <strong>you can request the FDD on behalf of your practice</strong> and walk clients through Item 19 on a discovery call.</p>
  <p>Meanwhile, your referral commission stays straightforward: <strong>$225,000 × 12.5% = $28,125</strong> per qualified placement.</p>
  <p><a href="${WEBSITE}/request-fdd">Request the FDD</a> for your files, or <a href="${CALENDLY}">book a call</a> and we'll walk you through the numbers together.</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Hi {{name}},

Your E-2 clients will ask: "What kind of return can I expect?" You need a credible answer — without overpromising.

New Dawn's FDD includes a Financial Performance Representation (Item 19) — your best tool for ROI conversations:
- Expected revenue and expenses for each vertical (Property Management, Insurance, Telecom)
- Recurring-revenue model — management fees, policy renewals, or telecom contracts
- Investment structure — how the $225,000 qualifying investment is allocated
- Financing options — lenders experienced in E-2 transactions

Request the FDD for your files at ${WEBSITE}/request-fdd. Your referral commission: $225,000 × 12.5% = $28,125 per qualified placement.

Book a call: ${CALENDLY}

Best regards,
Dylan Delaney
New Dawn Franchising
dylan@newdawnfranchising.com`,
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
• Referral commission: $225,000 × 12.5% = $28,125 per qualified client — paid when visa clears
• Client value prop: obtain & renew E-2 visa, live anywhere in U.S., director model
• Escrow guarantee — client funds held until visa approval; refund framework in FDD
• Day-to-day ops — approved local teams run PM, Insurance, or Telecom
• FDD Item 19 — financial performance talking points for client ROI conversations
• Exit plan — structured buy-back program for skeptical clients
• Broker portal — register referrals, track clients & commission status: ${WEBSITE}/broker-portal
• No exclusivity required — partner alongside existing referral relationships
• Book follow-up: ${CALENDLY}`,
    bodyText: `Call {{name}} to discuss the New Dawn broker referral partnership.

Talking points (broker-centered):
• Referral commission: $225,000 × 12.5% = $28,125 per qualified client — paid when visa clears
• Client value prop: obtain & renew E-2 visa, live anywhere in U.S., director model
• Escrow guarantee — client funds held until visa approval; refund framework in FDD
• Day-to-day ops — approved local teams run PM, Insurance, or Telecom
• FDD Item 19 — financial performance talking points for client ROI conversations
• Exit plan — structured buy-back program for skeptical clients
• Broker portal — register referrals, track clients & commission status: ${WEBSITE}/broker-portal
• No exclusivity required — partner alongside existing referral relationships
• Book follow-up: ${CALENDLY}`,
  },
  {
    stepOrder: 9,
    delayDays: 10,
    stepType: "email",
    stepName: "Touch 5 — E-2 Renewal Story For Your Clients",
    priority: "Medium",
    subject: "Help your clients think past the first visa — renewal is the real goal",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Your sharpest E-2 clients don't just ask how to <em>get</em> the visa — they ask how to <em>keep</em> it. That's the conversation that separates a credible referral from a one-time transaction.</p>
  <p>The E-2 Treaty Investor Visa is <strong>renewable indefinitely</strong> in two- to five-year increments, as long as the business continues to qualify. New Dawn is structured for exactly that long-term story:</p>
  <ul>
    <li><strong>Recurring-revenue contracts</strong> — management fees, policy renewals, or telecom billing that compound year over year</li>
    <li><strong>Documented operating activity</strong> — auditable records your client's attorney can present at every renewal</li>
    <li><strong>Active management by the investor</strong> — executive oversight satisfying the "develop and direct" requirement</li>
    <li><strong>U.S. workers employed</strong> — local teams on the ground, supporting enterprise credibility</li>
    <li><strong>Spouse work authorization</strong> — eligible under E-2 dependent rules</li>
  </ul>
  <p>When you can present a complete lifecycle — entry, operation, renewal, and exit — your clients trust the referral. And you earn <strong>$28,125</strong> for every qualified placement that closes.</p>
  <p>Happy to discuss how this fits your practice on a quick call.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

Your sharpest E-2 clients don't just ask how to get the visa — they ask how to keep it. That's the conversation that separates a credible referral from a one-time transaction.

The E-2 Treaty Investor Visa is renewable indefinitely in two- to five-year increments. New Dawn is structured for that long-term story:
- Recurring-revenue contracts that compound year over year
- Documented operating activity — auditable records for every renewal
- Active management by the investor — executive oversight satisfying "develop and direct"
- U.S. workers employed — local teams supporting enterprise credibility
- Spouse work authorization — eligible under E-2 dependent rules

When you present a complete lifecycle — entry, operation, renewal, and exit — your clients trust the referral. And you earn $28,125 for every qualified placement that closes.

Happy to discuss on a quick call.

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Touch 6 — Structured Exit For Skeptical Clients",
    priority: "Medium",
    subject: "Close skeptical clients — New Dawn has a structured exit plan",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When your E-2 clients evaluate a qualifying investment, <strong>exit strategy matters as much as entry</strong>. The clients who hesitate longest are often the ones who fear being locked into a franchise indefinitely.</p>
  <p>That's why New Dawn has <strong>structured buy-back programs</strong> — giving your clients a clear, documented path when they're ready to transition out:</p>
  <ul>
    <li><strong>A defined exit</strong> — not an open-ended obligation your client will regret in five years</li>
    <li><strong>In-house buy-back option</strong> — a structured mechanism documented in the FDD</li>
    <li><strong>Complete lifecycle story</strong> — entry, operation, renewal, and exit their attorney can document</li>
    <li><strong>Reduced risk for you</strong> — you can confidently present a full picture to skeptical referrals</li>
  </ul>
  <p>Pair that with escrow-protected funds, the director model, proven day-to-day operating systems, FDD Item 19 financial performance, and the freedom to live anywhere in the U.S. — and you have a referral opportunity that's genuinely differentiated in the E-2 space.</p>
  <p>Referring brokers earn <strong>$28,125</strong> (12.5% of $225,000) per qualified placement. Want me to send the broker partnership overview?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

When your E-2 clients evaluate a qualifying investment, exit strategy matters as much as entry. The clients who hesitate longest often fear being locked into a franchise indefinitely.

New Dawn has structured buy-back programs — a clear, documented path when clients are ready to transition out:
- A defined exit — not an open-ended obligation
- In-house buy-back option — documented in the FDD
- Complete lifecycle story — entry, operation, renewal, and exit their attorney can document
- Reduced risk for you — confidently present a full picture to skeptical referrals

Pair that with escrow-protected funds, the director model, proven day-to-day ops, FDD Item 19, and live-anywhere flexibility.

Referring brokers earn $28,125 (12.5% of $225,000) per qualified placement. Want me to send the broker partnership overview?

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Pipeline Check-In",
    priority: "Low",
    subject: "E-2 pipeline check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Any E-2 clients exploring U.S. business options? Escrow-protected $225K, director model, FDD Item 19, structured exit. You earn $28,125/referral. Register clients at ${WEBSITE}/broker-portal · ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn. Any E-2 clients exploring U.S. business options? Escrow-protected $225K, director model, FDD Item 19, structured exit. You earn $28,125/referral. Register clients at ${WEBSITE}/broker-portal · ${CALENDLY}`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "Touch 7 — The Broker Referral Journey",
    priority: "Medium",
    subject: "What a broker-referred client journey looks like — and when you get paid",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I wanted to lay out the complete broker referral journey — so you know exactly what your clients experience and when your commission lands:</p>
  <ol>
    <li><strong>You register the client</strong> — submit their details through our <a href="${WEBSITE}/broker-portal">broker portal</a> before or at first contact</li>
    <li><strong>Discovery call</strong> — we match your client to their preferred vertical (Property Management, Insurance, or Telecom) and review FDD Item 19</li>
    <li><strong>Investment & escrow</strong> — $225,000 placed in escrow; funds held until the E-2 visa is approved</li>
    <li><strong>E-2 petition support</strong> — real operating business documentation for their attorney</li>
    <li><strong>Director onboarding</strong> — your client takes executive oversight; our teams launch day-to-day operations</li>
    <li><strong>Live anywhere</strong> — your client directs the business from anywhere in the U.S.</li>
    <li><strong>Ongoing operations & reporting</strong> — proprietary dashboards and renewal-ready documentation</li>
    <li><strong>E-2 renewals</strong> — recurring revenue and documented activity supporting indefinite visa renewal</li>
    <li><strong>Your commission</strong> — <strong>$28,125</strong> (12.5% of $225,000) paid when the visa clears and funds are released from escrow</li>
    <li><strong>Exit optionality</strong> — structured buy-back when your client is ready to transition out</li>
  </ol>
  <p>Even if the timing isn't right today, I'd love to be your go-to when an E-2 client needs a qualifying U.S. business.</p>
  <p><a href="${CALENDLY}">Book 20 minutes here</a> · <a href="${WEBSITE}/broker-portal">Open the broker portal</a></p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

The complete broker referral journey — what your clients experience and when your commission lands:

1. You register the client — submit details through our broker portal before or at first contact
2. Discovery call — match to preferred vertical and review FDD Item 19
3. Investment & escrow — $225,000 placed in escrow; funds held until E-2 visa approval
4. E-2 petition support — real operating business documentation for their attorney
5. Director onboarding — client takes executive oversight; our teams launch daily ops
6. Live anywhere — client directs the business from anywhere in the U.S.
7. Ongoing operations & reporting — proprietary dashboards and renewal-ready documentation
8. E-2 renewals — recurring revenue supporting indefinite visa renewal
9. Your commission — $28,125 (12.5% of $225,000) paid when visa clears and funds release
10. Exit optionality — structured buy-back when client is ready to transition out

Even if the timing isn't right today, I'd love to be your go-to when an E-2 client needs a qualifying U.S. business.

Book 20 minutes: ${CALENDLY} · Broker portal: ${WEBSITE}/broker-portal

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Touch 8 — Final Note",
    priority: "Low",
    subject: "Closing the loop — E-2 referrals & $28,125 commission whenever you need us",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If any of your clients are ever looking for an E-2 qualifying franchise, please keep <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> in mind.</p>
  <p><strong>Quick recap for your files:</strong></p>
  <ul>
    <li><strong>For your clients:</strong> obtain & renew the E-2 visa, live anywhere in the U.S., escrow-protected $225,000 investment</li>
    <li><strong>Three verticals:</strong> Property Management, Insurance, or Telecom — recurring-revenue models</li>
    <li><strong>Director model:</strong> client oversees; New Dawn runs day-to-day operations</li>
    <li><strong>Proven systems:</strong> proprietary technology, dashboards, and renewal-ready reporting</li>
    <li><strong>ROI talking points:</strong> FDD Item 19 Financial Performance Representation (<a href="${WEBSITE}/request-fdd">request the FDD</a>)</li>
    <li><strong>Structured exit:</strong> in-house buy-back program when clients are ready to transition</li>
    <li><strong>For you:</strong> <strong>$28,125</strong> referral commission (12.5% of $225,000) per qualified placement — paid when visa clears</li>
    <li><strong>Broker portal:</strong> <a href="${WEBSITE}/broker-portal">register referrals & track commission status</a></li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
  <p>Wishing you continued success,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>El Paso, Texas</p>
</div>`,
    bodyText: `Hi {{name}},

This will be my last email in this series — I don't want to clutter your inbox.

If any of your clients are ever looking for an E-2 qualifying franchise, please keep New Dawn Franchising in mind.

Quick recap for your files:
- For your clients: obtain & renew the E-2 visa, live anywhere in the U.S., escrow-protected $225,000 investment
- Three verticals: Property Management, Insurance, or Telecom — recurring-revenue models
- Director model: client oversees; New Dawn runs day-to-day operations
- Proven systems: proprietary technology, dashboards, and renewal-ready reporting
- ROI talking points: FDD Item 19 Financial Performance Representation (request at ${WEBSITE}/request-fdd)
- Structured exit: in-house buy-back program when clients are ready to transition
- For you: $28,125 referral commission (12.5% of $225,000) per qualified placement — paid when visa clears
- Broker portal: ${WEBSITE}/broker-portal

Feel free to reach out anytime at dylan@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

Wishing you continued success,
Dylan Delaney
New Dawn Franchising
El Paso, Texas`,
  },
];

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
