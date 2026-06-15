import { storage } from "./storage";

export const GROK_CAMPAIGN_NAME = "Grok Campaign";

const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";
const WEBSITE = "https://www.newdawnfranchising.com";

const EMAIL_STYLE = `font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e; line-height: 1.6;`;

// Inject explicit spacing into the email HTML. Bare <p>/<ul>/<li>/<h3> tags
// render "clumped" because email clients and the admin preview (Tailwind reset)
// zero out default margins. Adding inline margins guarantees readable spacing
// everywhere the body is shown or sent.
function withSpacing(html: string): string {
  return html
    .replace(/<p>/g, '<p style="margin:0 0 16px 0;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px 0; padding-left:22px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px 0; padding-left:22px;">')
    .replace(/<li>/g, '<li style="margin:0 0 8px 0;">')
    .replace(/<h3 style="([^"]*)">/g, '<h3 style="$1; margin:24px 0 10px 0; font-size:17px;">');
}

const GROK_STEPS = [
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
  },
  {
    stepOrder: 3,
    delayDays: 1,
    stepType: "sms",
    stepName: "Day 1 SMS — Quick Intro",
    priority: "Low",
    subject: "New Dawn E-2 intro",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn Franchising. Just emailed about our E-2 franchise platform — clients choose PM, Insurance, or Telecom contracts ($225K), direct the business while we run ops, and can live anywhere in the U.S. Worth a look? ${WEBSITE}`,
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
  },
  {
    stepOrder: 11,
    delayDays: 17,
    stepType: "sms",
    stepName: "Day 17 SMS — Pipeline Check-In",
    priority: "Low",
    subject: "E-2 pipeline check-in",
    bodyHtml: `Hi {{name}}, Dylan from New Dawn. Any E-2 clients exploring U.S. business options right now? We offer PM, Insurance, or Telecom contracts — $225K, director model, escrow protected. Brokers earn $28,125/referral. Happy to chat: ${CALENDLY}`,
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
  },
];

export async function seedGrokCampaign() {
  try {
    const existing = await storage.getDripCampaigns();
    const found = existing.find((c) => c.name === GROK_CAMPAIGN_NAME);

    if (found) {
      // Campaign already exists — re-sync each step's content (formatting) so
      // improvements to the templates reach the already-seeded campaign without
      // a manual DB edit. Matched by stepOrder.
      const steps = await storage.getDripSteps(found.id);
      let updated = 0;
      for (const def of GROK_STEPS) {
        const match = steps.find((s) => s.stepOrder === def.stepOrder);
        if (!match) continue;
        const body = withSpacing(def.bodyHtml);
        if (match.bodyHtml !== body || match.subject !== def.subject) {
          await storage.updateDripStep(match.id, { bodyHtml: body, subject: def.subject });
          updated++;
        }
      }
      if (updated > 0) console.log(`[Drip] "${GROK_CAMPAIGN_NAME}" re-synced ${updated} step(s) with improved formatting.`);
      return;
    }

    const campaign = await storage.createDripCampaign({
      name: GROK_CAMPAIGN_NAME,
      description:
        "13-step omnichannel broker outreach sequence for E-2 visa referral partners. Covers LinkedIn, email, SMS, and call tasks across 28 days — highlighting referral fees ($28,125), escrow protection, VC-backed team, director model, three verticals (PM/Insurance/Telecom), proprietary AI, and structured buy-back exits.",
      isActive: true,
    });

    for (const step of GROK_STEPS) {
      await storage.createDripStep({
        campaignId: campaign.id,
        stepOrder: step.stepOrder,
        delayDays: step.delayDays,
        stepType: step.stepType,
        stepName: step.stepName,
        priority: step.priority,
        subject: step.subject,
        bodyHtml: withSpacing(step.bodyHtml),
      });
    }

    console.log(`[Drip] "${GROK_CAMPAIGN_NAME}" created with ${GROK_STEPS.length} steps.`);
  } catch (err) {
    console.error(`[Drip] Failed to seed "${GROK_CAMPAIGN_NAME}":`, err);
  }
}