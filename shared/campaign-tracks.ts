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
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>franchising@newdawnfranchising.com</p>
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
franchising@newdawnfranchising.com`,
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
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>franchising@newdawnfranchising.com</p>
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
franchising@newdawnfranchising.com`,
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
  <p>Feel free to reach out anytime at <a href="mailto:franchising@newdawnfranchising.com">franchising@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
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

Feel free to reach out anytime at franchising@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

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
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>franchising@newdawnfranchising.com</p>
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
franchising@newdawnfranchising.com`,
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
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>franchising@newdawnfranchising.com</p>
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
franchising@newdawnfranchising.com`,
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
  <p>Feel free to reach out anytime at <a href="mailto:franchising@newdawnfranchising.com">franchising@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
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

Feel free to reach out anytime at franchising@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

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

// REWRITTEN 2026-08 for reply-rate, not click-rate. The old copy read like a
// brochure: money-led subject lines ("$28,125" — a spam-filter trigger and a
// too-good-to-be-true signal to attorneys), 300+-word bodies, 6+ links per
// email competing with the CTA, and a buried "15-minute call" ask. Production
// data showed near-zero human engagement. The new copy is short and
// conversational, keeps dollar figures out of subjects, strips almost every
// link (brochures/FDD are offered as a "reply and I'll send it" — the reply IS
// the goal), asks ONE question per email, and signs off "Dylan" (the send path
// auto-appends his full signature, so a long sign-off block would double up).
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
"Hi {{name}} — I partner with immigration attorneys and business brokers on E-2 cases. When a client needs a qualifying U.S. business, that's the gap we fill. Would love to connect."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I partner with immigration attorneys and business brokers on E-2 cases. When a client needs a qualifying U.S. business, that's the gap we fill. Would love to connect."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Touch 1 — Where Do You Send E-2 Clients?",
    priority: "High",
    subject: "Where do you send E-2 clients who need a business?",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>When one of your E-2 clients needs a qualifying U.S. business, where do you usually send them?</p>
  <p>I ask because that's the gap we fill. New Dawn Franchising runs a franchise platform built specifically for the E-2: your client's $225,000 investment is held in escrow until the visa is approved, and our local teams run the day-to-day so your client can direct the business from anywhere in the U.S.</p>
  <p>We pay referring partners a 12.5% fee per placement, and we work alongside your existing process — your client's attorney stays their attorney.</p>
  <p>If you tell me what kind of E-2 clients you see, I'll tell you straight whether we're a fit. Just reply here.</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

When one of your E-2 clients needs a qualifying U.S. business, where do you usually send them?

I ask because that's the gap we fill. New Dawn Franchising runs a franchise platform built specifically for the E-2: your client's $225,000 investment is held in escrow until the visa is approved, and our local teams run the day-to-day so your client can direct the business from anywhere in the U.S.

We pay referring partners a 12.5% fee per placement, and we work alongside your existing process — your client's attorney stays their attorney.

If you tell me what kind of E-2 clients you see, I'll tell you straight whether we're a fit. Just reply here.

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
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
    stepName: "Touch 2 — Escrow: The Money Question",
    priority: "High",
    subject: "What happens to your client's money if the visa is denied?",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>It's the first question every E-2 candidate asks — and the reason many advisors hesitate to recommend any franchise at all.</p>
  <p>Our answer: the full $225,000 sits in escrow until the visa is approved. If a qualifying application is denied, the funds are returned to your client. The refund framework is documented in our FDD, so their attorney can verify it instead of taking my word for it.</p>
  <p>Your referral fee — 12.5%, which is $28,125 per placement — is paid when the visa clears and funds release from escrow. Nobody gets paid unless your client gets their visa.</p>
  <p>Would the one-page broker summary be useful? Reply "send it" and I'll email it over (English, Spanish, or Chinese).</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

It's the first question every E-2 candidate asks — and the reason many advisors hesitate to recommend any franchise at all.

Our answer: the full $225,000 sits in escrow until the visa is approved. If a qualifying application is denied, the funds are returned to your client. The refund framework is documented in our FDD, so their attorney can verify it instead of taking my word for it.

Your referral fee — 12.5%, which is $28,125 per placement — is paid when the visa clears and funds release from escrow. Nobody gets paid unless your client gets their visa.

Would the one-page broker summary be useful? Reply "send it" and I'll email it over (English, Spanish, or Chinese).

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
  },
  {
    stepOrder: 6,
    delayDays: 5,
    stepType: "email",
    stepName: "Touch 3 — The Relocation Objection",
    priority: "High",
    subject: "The “I don't want to run a business in Texas” objection",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>The most common objection E-2 candidates raise: <em>"I don't want to move somewhere random and manage a business full-time."</em></p>
  <p>That's the problem our director model solves. Your client owns and directs the business — strategy, oversight, decisions — while our approved local teams handle the day-to-day in property management, insurance, or telecom. They can live anywhere in the U.S., and the business still produces the documented operating activity their renewals depend on.</p>
  <p>There's also a client-facing brochure you can forward straight to a candidate, in English, Spanish, or Chinese — reply and I'll send whichever you'd like.</p>
  <p>Is this an objection you hear from your clients too?</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

The most common objection E-2 candidates raise: "I don't want to move somewhere random and manage a business full-time."

That's the problem our director model solves. Your client owns and directs the business — strategy, oversight, decisions — while our approved local teams handle the day-to-day in property management, insurance, or telecom. They can live anywhere in the U.S., and the business still produces the documented operating activity their renewals depend on.

There's also a client-facing brochure you can forward straight to a candidate, in English, Spanish, or Chinese — reply and I'll send whichever you'd like.

Is this an objection you hear from your clients too?

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — The ROI Question",
    priority: "High",
    subject: "How we answer your clients' ROI question",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p><em>"What return can I expect?"</em> — your clients need a real answer to that, not marketing.</p>
  <p>Ours lives in the FDD. Item 19 discloses financial performance for each vertical, and federal franchise law means your client reviews it directly rather than relying on an email from me. You can request a copy for your own files and use it in client conversations — plenty of the attorneys and brokers we work with do exactly that.</p>
  <p>Want me to send you the FDD request link, or would 15 minutes on a call to walk the numbers together be more useful? Just reply either way.</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

"What return can I expect?" — your clients need a real answer to that, not marketing.

Ours lives in the FDD. Item 19 discloses financial performance for each vertical, and federal franchise law means your client reviews it directly rather than relying on an email from me. You can request a copy for your own files and use it in client conversations — plenty of the attorneys and brokers we work with do exactly that.

Want me to send you the FDD request link, or would 15 minutes on a call to walk the numbers together be more useful? Just reply either way.

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
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
    stepName: "Touch 5 — Renewal Is the Real Test",
    priority: "Medium",
    subject: "Getting the E-2 is the easy part",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>The E-2 renews indefinitely — but only while the business genuinely qualifies. That's where a lot of do-it-yourself E-2 investments quietly fail: thin operating activity, no U.S. employees, and nothing solid for the attorney to present at renewal time.</p>
  <p>Every New Dawn business is built for the renewal file from day one: recurring-revenue contracts, auditable operating records, local staff on the ground, and the investor in a genuine "develop and direct" role.</p>
  <p>If renewals are ever a pain point in your practice, that alone is worth a conversation. What does your renewal caseload look like these days?</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

The E-2 renews indefinitely — but only while the business genuinely qualifies. That's where a lot of do-it-yourself E-2 investments quietly fail: thin operating activity, no U.S. employees, and nothing solid for the attorney to present at renewal time.

Every New Dawn business is built for the renewal file from day one: recurring-revenue contracts, auditable operating records, local staff on the ground, and the investor in a genuine "develop and direct" role.

If renewals are ever a pain point in your practice, that alone is worth a conversation. What does your renewal caseload look like these days?

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
  },
  {
    stepOrder: 10,
    delayDays: 14,
    stepType: "email",
    stepName: "Touch 6 — The Lock-In Fear",
    priority: "Medium",
    subject: "The lock-in fear (and our answer to it)",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>Some E-2 candidates hesitate for a different reason: they're afraid of being stuck owning a franchise forever.</p>
  <p>We built a structured buy-back into the FDD — a documented exit path for when your client is ready to move on. Entry, operation, renewal, exit: the whole lifecycle in writing. In our experience that's what turns a skeptical client into a comfortable one, and it means you're never referring someone into an open-ended obligation.</p>
  <p>Happy to send the broker one-pager that lays the full picture out — want a copy?</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

Some E-2 candidates hesitate for a different reason: they're afraid of being stuck owning a franchise forever.

We built a structured buy-back into the FDD — a documented exit path for when your client is ready to move on. Entry, operation, renewal, exit: the whole lifecycle in writing. In our experience that's what turns a skeptical client into a comfortable one, and it means you're never referring someone into an open-ended obligation.

Happy to send the broker one-pager that lays the full picture out — want a copy?

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
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
    stepName: "Touch 7 — How a Referral Works",
    priority: "Medium",
    subject: "How a referral actually works, start to finish",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>In case it's ever useful, here's the whole journey when you refer a client:</p>
  <p>You introduce us (or register the referral in our broker portal). We run a discovery call, your client picks their vertical — property management, insurance, or telecom — and $225,000 goes into escrow. Their attorney files with real operating-business documentation. When the visa is approved and funds release, you're paid your 12.5% referral fee — $28,125 — and your client directs their business from wherever they live.</p>
  <p>No exclusivity, no volume requirement. One good referral is a fine place to start.</p>
  <p>Is there anyone in your pipeline this could fit?</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

In case it's ever useful, here's the whole journey when you refer a client:

You introduce us (or register the referral in our broker portal). We run a discovery call, your client picks their vertical — property management, insurance, or telecom — and $225,000 goes into escrow. Their attorney files with real operating-business documentation. When the visa is approved and funds release, you're paid your 12.5% referral fee — $28,125 — and your client directs their business from wherever they live.

No exclusivity, no volume requirement. One good referral is a fine place to start.

Is there anyone in your pipeline this could fit?

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
  },
  {
    stepOrder: 13,
    delayDays: 28,
    stepType: "email",
    stepName: "Touch 8 — Final Note",
    priority: "Low",
    subject: "Closing the loop",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This is my last email in this series — I won't keep filling your inbox.</p>
  <p>If an E-2 client ever needs a credible, escrow-protected qualifying business, we're easy to reach: just reply to any of these emails, or write <a href="mailto:franchising@newdawnfranchising.com">franchising@newdawnfranchising.com</a> and I'll take it from there. The 12.5% referral fee will be here whenever the right client is.</p>
  <p>Thanks for reading, and continued success with your practice.</p>
  <p>Best,<br/>Dylan</p>
</div>`,
    bodyText: `Hi {{name}},

This is my last email in this series — I won't keep filling your inbox.

If an E-2 client ever needs a credible, escrow-protected qualifying business, we're easy to reach: just reply to any of these emails, or write franchising@newdawnfranchising.com and I'll take it from there. The 12.5% referral fee will be here whenever the right client is.

Thanks for reading, and continued success with your practice.

Best,
Dylan Delaney
New Dawn Franchising
franchising@newdawnfranchising.com`,
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
