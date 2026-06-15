/**
 * Two-track outreach content — the single source of truth for the New Dawn
 * Franchising "Grok Campaign" voice across every surface that can fire a
 * "Send now" action:
 *
 *   • server/grok-campaign.ts        → seeds two drip campaigns (broker + client)
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
export const CLIENT_CAMPAIGN_NAME = "Grok Campaign — Clients";

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
// CLIENT TRACK — written DIRECTLY to the E-2 investor candidate. Same warm,
// confident voice as the broker track, but it pitches the franchise itself.
// LOAD-BEARING: this track carries NO referral-fee / commission / broker-portal
// language — that content is broker-only.
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
"Hi {{name}} — I work with international investors exploring the E-2 Treaty Investor Visa through New Dawn Franchising: a real U.S. business you direct without running day-to-day operations. Would love to connect and share how the pathway works."`,
    bodyText: `Send a LinkedIn connection request to {{name}}.

Suggested note (300 chars max):
"Hi {{name}} — I work with international investors exploring the E-2 Treaty Investor Visa through New Dawn Franchising: a real U.S. business you direct without running day-to-day operations. Would love to connect and share how the pathway works."`,
  },
  {
    stepOrder: 2,
    delayDays: 0,
    stepType: "email",
    stepName: "Touch 1 — Your E-2 Pathway",
    priority: "High",
    subject: "Your E-2 visa pathway — own a U.S. business with New Dawn Franchising",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Dear {{name}},</p>
  <p>I'm reaching out from <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> — the first franchise platform built specifically for <strong>E-2 Treaty Investor Visa</strong> candidates who want a real, operating U.S. business they can direct without running the day-to-day themselves.</p>
  <p>If you're exploring an E-2 pathway, here's what that looks like with us: a qualifying $225,000 investment, recurring-revenue contracts, and the freedom to live anywhere in the United States while a proven team runs operations on the ground.</p>
  <p>You choose one of three verticals — each built on long-term contracts:</p>
  <ul>
    <li><strong>Property Management</strong> — recurring management agreements</li>
    <li><strong>Insurance</strong> — agency and policy contracts</li>
    <li><strong>Telecom (VOIP)</strong> — business communications contracts</li>
  </ul>
  <p>Your investment is held in escrow with structured protections throughout the E-2 process, so your capital is safeguarded from day one.</p>
  <p>Would you be open to a 15-minute call this week to see whether it's the right fit for you?</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/><a href="${WEBSITE}">www.newdawnfranchising.com</a><br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Dear {{name}},

I'm reaching out from New Dawn Franchising — the first franchise platform built specifically for E-2 Treaty Investor Visa candidates who want a real, operating U.S. business they can direct without running the day-to-day themselves.

If you're exploring an E-2 pathway, here's what that looks like with us: a qualifying $225,000 investment, recurring-revenue contracts, and the freedom to live anywhere in the United States while a proven team runs operations on the ground.

You choose one of three contract-based verticals: Property Management, Insurance, or Telecom (VOIP).

Your investment is held in escrow with structured protections throughout the E-2 process, so your capital is safeguarded from day one.

Would you be open to a 15-minute call this week to see whether it's the right fit for you?

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
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 franchise pathway — you choose PM, Insurance, or Telecom contracts ($225K), direct the business while we run ops, and can live anywhere in the U.S. Worth a look? ${WEBSITE}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 franchise pathway — you choose PM, Insurance, or Telecom contracts ($225K), direct the business while we run ops, and can live anywhere in the U.S. Worth a look? ${WEBSITE}`,
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
"Hi {{name}} — sent you an email as well so it doesn't get buried. We built New Dawn specifically for E-2 candidates: a $225K qualifying investment, choice of Property Management, Insurance, or Telecom contracts, and a director model where you oversee strategy while our team runs the day-to-day. Happy to share a one-pager if it's helpful."`,
    bodyText: `Send a LinkedIn message to {{name}} (if connected).

Suggested message:
"Hi {{name}} — sent you an email as well so it doesn't get buried. We built New Dawn specifically for E-2 candidates: a $225K qualifying investment, choice of Property Management, Insurance, or Telecom contracts, and a director model where you oversee strategy while our team runs the day-to-day. Happy to share a one-pager if it's helpful."`,
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
  <p>Following up on my note about <strong>New Dawn Franchising</strong>. Before we talk numbers, I wanted to share why investors trust us with their E-2 journey.</p>
  <p>Our leadership team brings together operators and investors from some of the most respected names in venture capital, technology, and franchise law:</p>
  <ul>
    <li><strong>Tom Meister</strong> — former executive at unicorn-backed online lenders (Funding Circle, Zilch); leads Grizzly Peak Ventures</li>
    <li><strong>Kamal Obbad</strong> — Harvard graduate, Forbes 30 Under 30, former Google PM, Khosla Ventures–backed founder (Nebula Genomics)</li>
    <li><strong>Chris von Pohlot</strong> — Columbia-educated fintech entrepreneur; founder of Altbanc (alternative lending)</li>
    <li><strong>Zachary Bohlender</strong> — franchise and corporate attorney (Wilson Sonsini, Brightpoint Law)</li>
    <li><strong>Kevin Quinn</strong> — former Google PM and CTO of Nebula Genomics; leads our technology infrastructure</li>
    <li><strong>Jeffrey Tung</strong> — private equity operator and SMB growth specialist</li>
  </ul>
  <p>Just as important for you: <strong>your investment is held in escrow</strong> with structured protections — so your capital is safeguarded throughout the E-2 process.</p>
  <p>Happy to send our investor overview or jump on a short call: <a href="${CALENDLY}">book a time here</a>.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

Following up on my note about New Dawn Franchising. Before we talk numbers, I wanted to share why investors trust us with their E-2 journey.

Our leadership team brings together operators and investors from respected names in venture capital, technology, and franchise law — including a Forbes 30 Under 30 honoree and former Google product leaders, plus franchise and corporate counsel.

Just as important for you: your investment is held in escrow with structured protections, so your capital is safeguarded throughout the E-2 process.

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
  <p>I wanted to explain how New Dawn actually works — because the structure is what makes this different from a typical franchise.</p>
  <h3 style="color: #c9a227;">The Director Model</h3>
  <p><strong>You remain the Director</strong> — you set strategy, review performance, and keep executive oversight. <strong>Our approved local teams handle day-to-day operations</strong> in your chosen vertical. That means you can live anywhere in the United States while the business runs professionally on the ground.</p>
  <h3 style="color: #c9a227;">Three Contract-Based Verticals</h3>
  <p>Based on what fits you best, you choose one of three recurring-revenue models:</p>
  <ul>
    <li><strong>Long-Term Property Management Contracts</strong> — stable, recurring fee income from managed properties</li>
    <li><strong>Insurance Contracts</strong> — agency commissions and policy renewals</li>
    <li><strong>Telecom (VOIP) Contracts</strong> — business communications services with recurring billing</li>
  </ul>
  <p>Each vertical is structured to meet E-2 Treaty Investor requirements: a real, operating enterprise with documented revenue and active management — not passive investment.</p>
  <p>Investment packages start at <strong>$225,000</strong> with financing options available.</p>
  <p>Would a 15-minute walkthrough be helpful?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

I wanted to explain how New Dawn actually works — because the structure is what makes this different from a typical franchise.

The Director Model: you remain the Director — you set strategy, review performance, and keep executive oversight, while our approved local teams handle day-to-day operations in your chosen vertical. You can live anywhere in the United States while the business runs professionally on the ground.

Three contract-based verticals: Long-Term Property Management, Insurance, or Telecom (VOIP) — each a recurring-revenue model structured to meet E-2 requirements (a real, operating enterprise with documented revenue and active management, not passive investment).

Investment packages start at $225,000 with financing options available.

Would a 15-minute walkthrough be helpful?

Best,
Dylan Delaney
New Dawn Franchising`,
  },
  {
    stepOrder: 7,
    delayDays: 7,
    stepType: "email",
    stepName: "Touch 4 — How the Investment & Escrow Work",
    priority: "High",
    subject: "How your $225K is structured — and protected — at New Dawn",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I want to be direct about the part most investors care about most: <strong>where your money goes and how it's protected</strong>.</p>
  <p>Your qualifying investment is <strong>$225,000</strong>, and it's structured to do two jobs at once — fund a real, operating U.S. business and satisfy E-2 Treaty Investor requirements.</p>
  <ul>
    <li><strong>Held in escrow</strong> — your capital is safeguarded with documented protections throughout the E-2 process</li>
    <li><strong>Financing available</strong> — we work with lenders experienced in E-2 transactions</li>
    <li><strong>A real operating enterprise</strong> — documented revenue and active management your attorney can stand behind</li>
    <li><strong>Recurring-revenue contracts</strong> — in your chosen vertical (Property Management, Insurance, or Telecom)</li>
    <li><strong>Structured buy-back</strong> — a defined path to exit when you're ready</li>
  </ul>
  <p>You stay in control as the Director while our team runs operations — and you can live anywhere in the U.S. throughout.</p>
  <p>Want me to walk you through the numbers? <a href="${CALENDLY}">Book a quick call here</a>.</p>
  <p>Best regards,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>dylan@newdawnfranchising.com</p>
</div>`,
    bodyText: `Hi {{name}},

I want to be direct about the part most investors care about most: where your money goes and how it's protected.

Your qualifying investment is $225,000, structured to do two jobs at once — fund a real, operating U.S. business and satisfy E-2 Treaty Investor requirements.

- Held in escrow — your capital is safeguarded with documented protections throughout the E-2 process
- Financing available — we work with lenders experienced in E-2 transactions
- A real operating enterprise — documented revenue and active management your attorney can stand behind
- Recurring-revenue contracts — in your chosen vertical (Property Management, Insurance, or Telecom)
- Structured buy-back — a defined path to exit when you're ready

You stay in control as the Director while our team runs operations — and you can live anywhere in the U.S. throughout.

Want me to walk you through the numbers? Book a quick call: ${CALENDLY}

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
    bodyHtml: `Call {{name}} to discuss their E-2 pathway with New Dawn.

Talking points:
• Qualifying investment: $225,000 (financing options available)
• Funds held in escrow until the visa clears
• Three verticals: Property Management, Insurance, Telecom (VOIP)
• Director model — you oversee strategy, New Dawn runs day-to-day ops
• Live anywhere in the U.S.
• Proprietary AI platform for growth automation and reporting
• Structured buy-back program for exit
• Book follow-up: ${CALENDLY}`,
    bodyText: `Call {{name}} to discuss their E-2 pathway with New Dawn.

Talking points:
• Qualifying investment: $225,000 (financing options available)
• Funds held in escrow until the visa clears
• Three verticals: Property Management, Insurance, Telecom (VOIP)
• Director model — you oversee strategy, New Dawn runs day-to-day ops
• Live anywhere in the U.S.
• Proprietary AI platform for growth automation and reporting
• Structured buy-back program for exit
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
  <p>One thing that sets New Dawn apart from other E-2 qualifying opportunities: we've built <strong>proprietary AI tooling</strong> to help you automate growth, monitor contract performance, and scale operations without being on-site every day.</p>
  <p>Combined with our director model, this means you can:</p>
  <ul>
    <li><strong>Live anywhere in the United States</strong> — Miami, Austin, New York, or abroad between embassy appointments</li>
    <li><strong>Maintain real executive control</strong> — dashboards, reporting, and strategic oversight</li>
    <li><strong>Delegate daily execution</strong> — our approved teams handle tenant calls, policy servicing, or telecom provisioning</li>
    <li><strong>Scale with AI-assisted workflows</strong> — lead generation, contract renewals, and performance analytics</li>
  </ul>
  <p>Whether you prefer Property Management, Insurance, or Telecom contracts, the technology layer is the same: built by operators from <strong>Google</strong> and <strong>Khosla Ventures</strong>–backed ventures, not outsourced to a generic franchise CRM.</p>
  <p>Happy to walk you through a live demo on a quick call.</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

One thing that sets New Dawn apart from other E-2 qualifying opportunities: we've built proprietary AI tooling to help you automate growth, monitor contract performance, and scale operations without being on-site every day.

Combined with our director model, you can live anywhere in the U.S., keep real executive control (dashboards, reporting, strategic oversight), delegate daily execution to our approved teams, and scale with AI-assisted workflows.

Whether you prefer Property Management, Insurance, or Telecom contracts, the technology layer is the same — built by operators from Google and Khosla Ventures–backed ventures, not outsourced to a generic franchise CRM.

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
  <p>When you evaluate an E-2 qualifying investment, exit strategy matters as much as entry. That's why New Dawn has <strong>structured buy-back programs</strong> in place — giving you a clear path when you're ready to transition out of the business.</p>
  <p>It means you get the best of both worlds:</p>
  <ul>
    <li><strong>A defined exit</strong> — not an open-ended obligation</li>
    <li><strong>A real operating enterprise</strong> — with both entry and exit mechanics your attorney can document</li>
    <li><strong>Escrow-protected funds</strong> — your capital safeguarded throughout</li>
  </ul>
  <p>Pair that with the director model and your choice of three contract-based verticals (Property Management, Insurance, or Telecom), and you have an E-2 pathway that's genuinely differentiated — built around a real business you control, with a clear way in and a clear way out.</p>
  <p>Want me to send the investor overview?</p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

When you evaluate an E-2 qualifying investment, exit strategy matters as much as entry. That's why New Dawn has structured buy-back programs in place — giving you a clear path when you're ready to transition out of the business.

It means you get the best of both worlds: a defined exit (not an open-ended obligation), a real operating enterprise with both entry and exit mechanics your attorney can document, and escrow-protected funds throughout.

Pair that with the director model and your choice of three contract-based verticals (Property Management, Insurance, or Telecom), and you have an E-2 pathway that's genuinely differentiated — a real business you control, with a clear way in and a clear way out.

Want me to send the investor overview?

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
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Where are you in exploring your E-2 options? We offer PM, Insurance, or Telecom contracts — $225K, director model, escrow protected, live anywhere in the U.S. Happy to chat: ${CALENDLY}`,
    bodyText: `Hi {{name}}, Dylan from New Dawn. Where are you in exploring your E-2 options? We offer PM, Insurance, or Telecom contracts — $225K, director model, escrow protected, live anywhere in the U.S. Happy to chat: ${CALENDLY}`,
  },
  {
    stepOrder: 12,
    delayDays: 21,
    stepType: "email",
    stepName: "Touch 7 — Investor Outcomes & Social Proof",
    priority: "Medium",
    subject: "What the New Dawn E-2 journey actually looks like",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>I wanted to share what your journey with New Dawn would actually look like, step by step:</p>
  <ol>
    <li><strong>Discovery call</strong> — we match you to your preferred vertical (Property Management, Insurance, or Telecom)</li>
    <li><strong>Investment & escrow</strong> — $225,000 placed in escrow with documented protections</li>
    <li><strong>E-2 petition support</strong> — real operating business documentation for your attorney</li>
    <li><strong>Director onboarding</strong> — you take executive oversight; our team launches daily operations</li>
    <li><strong>Ongoing reporting</strong> — proprietary AI dashboards, contract performance, and compliance support</li>
    <li><strong>Exit optionality</strong> — structured buy-back when you're ready to transition</li>
  </ol>
  <p>Throughout, you stay in control as the Director and can live anywhere in the United States while a proven team runs the business on the ground.</p>
  <p>Even if the timing isn't right today, I'd love to be your resource when you're ready to move forward.</p>
  <p><a href="${CALENDLY}">Book 20 minutes here</a> · <a href="${WEBSITE}">newdawnfranchising.com</a></p>
  <p>Best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising</p>
</div>`,
    bodyText: `Hi {{name}},

What your journey with New Dawn would actually look like, step by step:
1. Discovery call — we match you to your preferred vertical (Property Management, Insurance, or Telecom)
2. Investment & escrow — $225,000 placed in escrow with documented protections
3. E-2 petition support — real operating business documentation for your attorney
4. Director onboarding — you take executive oversight; our team launches daily operations
5. Ongoing reporting — proprietary AI dashboards, contract performance, and compliance support
6. Exit optionality — structured buy-back when you're ready to transition

Throughout, you stay in control as the Director and can live anywhere in the United States while a proven team runs the business on the ground.

Even if the timing isn't right today, I'd love to be your resource when you're ready to move forward.

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
    subject: "Closing the loop — your E-2 pathway is here whenever you're ready",
    bodyHtml: `<div style="${EMAIL_STYLE}">
  <p>Hi {{name}},</p>
  <p>This will be my last email in this series — I don't want to clutter your inbox.</p>
  <p>If you ever decide to explore an E-2 qualifying franchise, please keep <strong><a href="${WEBSITE}">New Dawn Franchising</a></strong> in mind.</p>
  <p><strong>Quick recap:</strong></p>
  <ul>
    <li><strong>$225,000</strong> investment packages with financing available</li>
    <li><strong>Three verticals:</strong> Property Management, Insurance, or Telecom (VOIP) contracts</li>
    <li><strong>Director model:</strong> you oversee; New Dawn runs day-to-day operations</li>
    <li><strong>Live anywhere in the U.S.</strong> while the business operates professionally</li>
    <li><strong>Proprietary AI</strong> for growth automation and reporting</li>
    <li><strong>Escrow-protected</strong> investment</li>
    <li><strong>Structured buy-back program</strong> for exit</li>
  </ul>
  <p>Feel free to reach out anytime at <a href="mailto:dylan@newdawnfranchising.com">dylan@newdawnfranchising.com</a> or <a href="${CALENDLY}">book a call</a>. We're always here.</p>
  <p>Wishing you the very best,<br/><strong>Dylan Delaney</strong><br/>New Dawn Franchising<br/>El Paso, Texas</p>
</div>`,
    bodyText: `Hi {{name}},

This will be my last email in this series — I don't want to clutter your inbox.

If you ever decide to explore an E-2 qualifying franchise, please keep New Dawn Franchising in mind.

Quick recap:
- $225,000 investment packages with financing available
- Three verticals: Property Management, Insurance, or Telecom (VOIP)
- Director model: you oversee; New Dawn runs day-to-day operations
- Live anywhere in the U.S. while the business operates professionally
- Proprietary AI for growth automation and reporting
- Escrow-protected investment
- Structured buy-back program for exit

Feel free to reach out anytime at dylan@newdawnfranchising.com or book a call: ${CALENDLY}. We're always here.

Wishing you the very best,
Dylan Delaney
New Dawn Franchising
El Paso, Texas`,
  },
];

export const CAMPAIGN_TRACKS: Record<TrackId, CampaignTrackStep[]> = {
  broker: BROKER_TRACK,
  client: CLIENT_TRACK,
};

export function getTrackSteps(track: TrackId): CampaignTrackStep[] {
  return CAMPAIGN_TRACKS[track] ?? BROKER_TRACK;
}

export function campaignNameForTrack(track: TrackId): string {
  return track === "client" ? CLIENT_CAMPAIGN_NAME : BROKER_CAMPAIGN_NAME;
}
