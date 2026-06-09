/**
 * Partner Outreach Sequence Service — v4.1
 * 8-touch sequence for professional partners: immigration attorneys, wealth managers,
 * business advisors, E-2 consultants, immigration consultants, and other professionals.
 *
 * Channels: LinkedIn · Email · Lob (physical letter) — NO SMS, WhatsApp, or HeyGen
 *
 * Step 1  Day  0  LinkedIn Connection Request
 * Step 2  Day  1  Email 1 — Soft Intro
 * Step 3  Day  2  LinkedIn DM (if linkedin_connected)
 * Step 4  Day  4  Lob Premium Letter (if lob_enabled)
 * Step 5  Day  7  Email 2 — Opportunity + Escrow
 * Step 6  Day 10  Email 3 — Loom Video Email
 * Step 7  Day 14  Email 4 — Partnership Structure (fee reveal)
 * Step 8  Day 21  Breakup Email (if no_reply)
 */

import { db } from "./db";
import {
  partnerLeads, partnerSequenceEvents, linkedinQueue,
  type PartnerLead, type PartnerSequenceEvent,
} from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { sendEmailFromSender } from "./email-service";
import { randomUUID } from "crypto";
import { sendAgentSms } from "./agent-sms-service";

const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";
const FDD_LINK = "https://newdawnfranchising.com/fdd-request";
const APP_BASE = () => process.env.APP_BASE_URL ?? "https://newdawnfranchising.replit.app";

// ─── Claude helper ────────────────────────────────────────────────────────────

async function callClaude(system: string, user: string, maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) return "";
  const d = await res.json() as any;
  return (d.content as any[]).filter(b => b.type === "text").map(b => b.text).join("").trim();
}

// ─── Sequence definition ──────────────────────────────────────────────────────

interface EventDef {
  day: number;
  channel: "email" | "linkedin" | "lob";
  touchName: string;
  condition?: "lob_enabled" | "linkedin_connected" | "no_reply";
}

const SEQUENCE_EVENTS: EventDef[] = [
  { day:  0, channel: "linkedin", touchName: "Step 1 — LinkedIn Connection Request" },
  { day:  1, channel: "email",    touchName: "Step 2 — Email 1: Soft Intro" },
  { day:  2, channel: "linkedin", touchName: "Step 3 — LinkedIn DM",            condition: "linkedin_connected" },
  { day:  4, channel: "lob",      touchName: "Step 4 — Lob Premium Letter",     condition: "lob_enabled" },
  { day:  7, channel: "email",    touchName: "Step 5 — Email 2: Opportunity + Escrow" },
  { day: 10, channel: "email",    touchName: "Step 6 — Email 3: Loom Video" },
  { day: 14, channel: "email",    touchName: "Step 7 — Email 4: Partnership Structure" },
  { day: 21, channel: "email",    touchName: "Step 8 — Breakup Email",           condition: "no_reply" },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ─── Initialize sequence ──────────────────────────────────────────────────────

export async function initializePartnerSequence(leadId: string): Promise<void> {
  const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Partner lead not found: " + leadId);
  if (lead.sequenceStartedAt) return;

  const hasAddress = !!(lead.mailingAddress && lead.mailingAddress.trim().length > 10);
  const flow = hasAddress ? "lob_enabled" : "standard";
  const variant = ["A", "B", "C"][Math.floor(Math.random() * 3)];

  const now = new Date();
  const events = SEQUENCE_EVENTS.map(def => ({
    leadId,
    day: def.day,
    channel: def.channel,
    touchName: def.touchName,
    status: "scheduled" as const,
    scheduledAt: addDays(now, def.day),
    metadata: { condition: def.condition ?? null, flow } as any,
  }));

  await db.insert(partnerSequenceEvents).values(events);
  await db.update(partnerLeads)
    .set({
      sequenceStartedAt: now,
      sequenceFlow: flow,
      subjectVariant: variant,
      status: "active",
      tags: sql`array_append(tags, ${flow})` as any,
    })
    .where(eq(partnerLeads.id, leadId));

  console.log(`[PartnerSequence] Initialized ${events.length} events for ${lead.fullName} (flow:${flow}, variant:${variant})`);
}

// ─── Pause / Cancel ───────────────────────────────────────────────────────────

export async function pausePartnerSequence(leadId: string, reason: string): Promise<void> {
  await db.update(partnerSequenceEvents)
    .set({ status: "paused", notes: reason, updatedAt: new Date() })
    .where(and(eq(partnerSequenceEvents.leadId, leadId), eq(partnerSequenceEvents.status, "scheduled")));
  await db.update(partnerLeads)
    .set({ sequencePaused: true, sequencePausedReason: reason, status: "replied" })
    .where(eq(partnerLeads.id, leadId));
}

export async function cancelPartnerSequence(leadId: string, reason: string): Promise<void> {
  await db.update(partnerSequenceEvents)
    .set({ status: "cancelled", notes: reason, updatedAt: new Date() })
    .where(and(eq(partnerSequenceEvents.leadId, leadId), eq(partnerSequenceEvents.status, "scheduled")));
  await db.update(partnerLeads)
    .set({ sequencePaused: true, sequencePausedReason: reason, optedOut: true, status: "dead" })
    .where(eq(partnerLeads.id, leadId));
}

// ─── Has replied ──────────────────────────────────────────────────────────────

async function hasReplied(leadId: string): Promise<boolean> {
  const [lead] = await db.select({ status: partnerLeads.status }).from(partnerLeads)
    .where(eq(partnerLeads.id, leadId)).limit(1);
  if (lead?.status === "replied" || lead?.status === "booked" || lead?.status === "converted") return true;
  const events = await db.select({ status: partnerSequenceEvents.status })
    .from(partnerSequenceEvents)
    .where(and(eq(partnerSequenceEvents.leadId, leadId), eq(partnerSequenceEvents.status, "replied")))
    .limit(1);
  return events.length > 0;
}

// ─── Mark event ───────────────────────────────────────────────────────────────

async function markEvent(
  id: string,
  status: PartnerSequenceEvent["status"],
  extras: Partial<Pick<PartnerSequenceEvent, "notes" | "metadata" | "executedAt">> = {}
): Promise<void> {
  await db.update(partnerSequenceEvents)
    .set({ status, updatedAt: new Date(), executedAt: extras.executedAt ?? new Date(), ...extras })
    .where(eq(partnerSequenceEvents.id, id));
}

// ─── Audience type helpers ────────────────────────────────────────────────────

function audienceLabel(type: string): string {
  const map: Record<string, string> = {
    immigration_attorney: "immigration attorney",
    wealth_manager: "wealth manager",
    business_advisor: "business advisor",
    e2_consultant: "E-2 visa consultant",
    immigration_consultant: "immigration consultant",
    other: "professional",
  };
  return map[type] ?? "professional";
}

// ─── Subject line selection ───────────────────────────────────────────────────

function pickSubject(
  options: { A: string; B: string; C: string },
  variant: string
): string {
  return options[variant as "A" | "B" | "C"] ?? options.A;
}

function subjectForStep(step: number, lead: PartnerLead): string {
  const firstName = lead.fullName.split(" ")[0];
  const type = lead.audienceType ?? "other";
  const v = lead.subjectVariant ?? "A";

  if (step === 2) {
    const byType: Record<string, { A: string; B: string; C: string }> = {
      immigration_attorney: { A: "A question about your E-2 caseload", B: "For the E-2 clients who don't have a business yet", C: "A resource for your E-2 practice" },
      e2_consultant:        { A: "A question about your E-2 caseload", B: "For the E-2 clients who don't have a business yet", C: "A resource for your E-2 practice" },
      wealth_manager:       { A: "For international clients seeking U.S. residency through investment", B: "A U.S. investment with a full refund if the visa isn't approved", C: `${firstName} — an E-2 investment structured around capital protection` },
      business_advisor:     { A: "For your international entrepreneur clients", B: "A U.S. franchise built specifically for E-2 visa investors", C: `${firstName} — an operating business your clients can step into` },
      immigration_consultant: { A: "A qualifying E-2 investment for your clients — with a refund guarantee", B: "When E-2 clients need a business, here's your answer", C: `${firstName} — a resource for your E-2 pathway clients` },
      other:                { A: "For clients who want to live and invest in the U.S.", B: "A U.S. franchise investment — with a full refund if the visa isn't approved", C: `${firstName} — something that might be useful for your international clients` },
    };
    return pickSubject(byType[type] ?? byType.other, v);
  }
  if (step === 5) {
    const byType: Record<string, { A: string; B: string; C: string }> = {
      immigration_attorney: { A: "How our structure maps to the four E-2 requirements", B: `${firstName}, a short framework for evaluating E-2 businesses`, C: "Why USCIS approves our petitions" },
      e2_consultant:        { A: "How our structure maps to the four E-2 requirements", B: `${firstName}, a short framework for evaluating E-2 businesses`, C: "Why USCIS approves our petitions" },
      wealth_manager:       { A: "The investment structure your E-2 clients need", B: "Capital protection + U.S. residency pathway — how it works", C: `${firstName}, how the escrow protection works` },
      business_advisor:     { A: "How the franchise works — and why it's built for E-2", B: `${firstName}, the business model behind the visa`, C: "An operating U.S. business your clients can step into" },
      immigration_consultant: { A: "How the investment protection works for your E-2 clients", B: "A qualifying E-2 business — with a refund if denied", C: `${firstName}, what to tell E-2 clients who need a business` },
      other:                { A: "How the E-2 visa investment works — and how it's protected", B: "A U.S. business investment with a full refund if the visa isn't approved", C: `${firstName}, a quick explainer on what we've built` },
    };
    return pickSubject(byType[type] ?? byType.other, v);
  }
  if (step === 6) return `A 60-second video for you, ${firstName}`;
  if (step === 7) {
    const byType: Record<string, { A: string; B: string; C: string }> = {
      immigration_attorney: { A: "How we work with attorneys' offices", B: "A partnership framework for your E-2 clients", C: `${firstName}, curious if this would fit your practice` },
      wealth_manager:       { A: "A partnership arrangement for advisors who work with us", B: `${firstName} — what the partner structure looks like`, C: "For advisors whose clients invest in New Dawn" },
      business_advisor:     { A: "What the partnership looks like — in plain numbers", B: `${firstName}, here's what we pay partners on approval`, C: "The commercial side of working with New Dawn" },
      e2_consultant:        { A: "What the partnership looks like — in plain numbers", B: `${firstName}, here's what we pay partners on approval`, C: "The commercial side of working with New Dawn" },
      immigration_consultant: { A: "What the partnership looks like — in plain numbers", B: `${firstName}, here's what we pay partners on approval`, C: "The commercial side of working with New Dawn" },
      other:                { A: "What the partnership looks like — in plain numbers", B: `${firstName}, here's what we pay partners on approval`, C: "The commercial side of working with New Dawn" },
    };
    return pickSubject(byType[type] ?? byType.other, v);
  }
  if (step === 8) {
    return pickSubject({ A: "Closing the loop", B: "Last note from me", C: "Should I close your file?" }, v);
  }
  return `Quick note, ${firstName}`;
}

// ─── AI Email drafter ─────────────────────────────────────────────────────────

async function draftEmail(lead: PartnerLead, step: number): Promise<{ subject: string; html: string; text: string }> {
  const firstName = lead.fullName.split(" ")[0];
  const firmName = lead.company ?? lead.title ?? "your firm";
  const type = lead.audienceType ?? "other";
  const spanish = lead.spanishFlag === true;
  const subject = subjectForStep(step, lead);

  const openingLine = spanish ? `Hola, ${firstName},` : `${firstName},`;
  const closingLine = spanish ? "Un cordial saludo," : "Best,";

  const SYSTEM = `You are drafting outreach emails on behalf of Dylan Delaney at New Dawn Franchising.

ABOUT NEW DAWN FRANCHISING:
- The first franchise system designed specifically for E-2 visa investors
- $225,000 minimum investment — a property management franchise in El Paso, Texas
- Investor retains full ownership and controls all bank accounts and key decisions
- An approved territory manager handles day-to-day operations ("develop and direct" standard)
- FDD-registered, bona fide enterprise, non-marginal, in-house immigration counsel
- Buy-back program after ~4 years

ESCROW PROTECTION (most distinctive feature — use it):
- Client's $225,000 sits in escrow (attorney of their choosing)
- Business operates ~4 months, building operational history
- If E-2 visa approved → escrow releases
- If denied after required two attempts → client gets FULL $225,000 refund
- CORRECT framing: "If their visa isn't approved, they get their full $225,000 franchise investment back."
- Do NOT say "risk-free" — standard E-2 petition costs (~$3,000 business plan, filing fees) are the client's responsibility
- New Dawn is newly launched — never imply a track record of approvals

PARTNER FEE (Step 7 ONLY — never in earlier steps):
- 12.5% of franchise package price, paid on E-2 visa approval
- At $225,000 minimum: $28,125 per approved client
- NEVER call it a "referral fee" — always "partner fee" or "partnership arrangement"
- For immigration_attorney: frame as co-education and marketing partnership; push specifics to a call (bar rules vary by state)

SENDER: Dylan Delaney, Founding Member & Franchise Development Manager
PHONE: (346) 597-9994 | EMAIL: franchising@newdawnfranchising.com | WEB: newdawnfranchising.com

TONE & STYLE RULES:
1. Professional but warm — smart colleague, not salesperson
2. Lead with the partner's problem, not the product
3. Short sentences. No filler ("I hope this email finds you well," "reaching out," "synergies")
4. Never fabricate client names, approval rates, or case histories
5. One strong point per touch — not a product brochure
6. Do not use these banned phrases: "I hope this finds you well", "I wanted to reach out", "touching base", "following up on my previous", "I trust this email finds you", "synergies", "game-changer", "revolutionary"

Respond ONLY with JSON: {"subject":"...","body":"plain text email body, use \\n for line breaks, no HTML tags"}`;

  const audienceProfiles: Record<string, string> = {
    immigration_attorney: `Audience: Licensed immigration attorneys doing E-2 work. They think in USCIS petition terms — substantiality, at-risk capital, bona fide enterprise, develop and direct. Their core problem: qualified treaty-country investors come ready but without a U.S. business. Finding an E-2-defensible business is a months-long side project. Use E-2 petition language. You are showing them how New Dawn maps to the standard — not teaching them immigration law. Problem framing: "Your E-2 clients come in ready — but don't have a qualifying business. We are that business."`,
    wealth_manager: `Audience: Wealth managers and private client advisors with HNW international clients wanting U.S. market access. They think in asset allocation, risk profile, capital protection, and exit strategy. Core problem: international HNW clients want U.S. residency + real investment — but most visa-qualifying structures are too passive (EB-5), too risky, or too complex. Use financial language: "capital protection," "structured investment," "exit strategy," "risk-adjusted." Avoid heavy immigration jargon. Problem framing: "Your international clients want U.S. residency and a real U.S. investment. We give them both — with a full refund if the visa isn't approved."`,
    business_advisor: `Audience: Business advisors, franchise consultants, relocation advisors who work with entrepreneurs. Core problem: international entrepreneur clients want a U.S. business presence but don't know where to start. Most franchise options weren't designed with immigration in mind. Use business language: "operating business," "franchise model," "territory," "operational from day one." Problem framing: "Your international entrepreneur clients need a U.S. business that works on day one — and that's structured to support their visa. We built exactly that."`,
    e2_consultant: `Audience: Specialist E-2 visa consultants who understand the E-2 standard extremely well. Core problem: they spend significant time sourcing qualifying businesses for clients — time-intensive with no guaranteed outcome. A pre-structured, FDD-registered, E-2-specific franchise saves them and their clients months. Use E-2-specific language — they know it. Also speak to the time-saving efficiency. Problem framing: "You help clients qualify for E-2 visas — we give you a pre-built, E-2-specific business to put them into, with a full refund structure if it doesn't go through."`,
    immigration_consultant: `Audience: Immigration consultants (non-attorney) who advise on visa pathways. Core problem: E-2 clients need a qualifying business but most consultants aren't equipped to source one. Use accessible immigration language: "E-2 visa pathway," "qualifying investment," "treaty country," "visa approval." Less technical than attorney track. Focus on client journey. Problem framing: "When E-2 clients ask you about qualifying businesses, you now have an answer — one with a full refund if their visa isn't approved."`,
    other: `Audience: Professionals who work with internationally-minded clients but don't fit neatly into other categories (CPAs, real estate professionals, relocation specialists, bank relationship managers). Core problem: they occasionally encounter clients interested in U.S. visa through investment but have no ready answer. Use plain, accessible business language. No immigration jargon unless their background suggests familiarity. Lead with simplicity, protection, and upside. Problem framing: "If you ever work with international clients who want to live and invest in the U.S., we may be exactly what they're looking for."`,
  };

  const stepInstructions: Record<number, string> = {
    2: `Step 2 — Email 1 (Soft Intro), ~130 words max.
Opening line: "${openingLine}"
- Introduce Dylan briefly ("I'll keep this short because I know your inbox is full.")
- Apply the audience-specific problem framing
- Introduce the escrow protection as the hook ("There's also a protection built into our model...")
- CTA: "If it'd be useful, I'm happy to send over our FDD and a short E-2 suitability summary. Just reply 'send it' and I'll get it over."
- Closing line: "${closingLine}"
- NO partner fee mention`,

    5: `Step 5 — Email 2 (The Opportunity + Escrow), ~200 words max.
Opening line: "${openingLine}"
Opening sentence: "Following up on my earlier note with something more substantive."
- Apply audience-specific framing paragraph (how the E-2 requirements map)
- Cover all 4 requirements in 4 bullet points:
  • Substantial & at-risk: $225K minimum, genuinely committed, capital at risk
  • Bona fide enterprise: real operating property management business, FDD-registered, assigned territory
  • Develop and direct: investor controls bank accounts + key decisions; territory manager handles day-to-day
  • The escrow protection: $225K in escrow ~4 months while business builds history; full refund if denied
- One final sentence about in-house immigration attorney available for a deeper conversation
${spanish ? '- Add on its own line before closing: "Con gusto lo conversamos en español si lo prefiere."' : ""}
- FDD CTA: "Would it be useful if I sent over the FDD? → ${FDD_LINK}"
- Closing line: "${closingLine}"
- NO partner fee mention`,

    6: `Step 6 — Loom Video Email, ~80 words max.
Opening line: "${openingLine}"
- One line: "I've sent you a couple of emails and figured a short video was better than another one landing in your inbox."
- Placeholder: "[VIDEO THUMBNAIL — 60-sec intro from Dylan]"
${spanish ? '- Add on its own line: "Con gusto lo conversamos en español si lo prefiere."' : ""}
- Dual CTA: book a call (${CALENDLY}) OR request FDD first (${FDD_LINK})
- Closing line: "${closingLine}"
- NO partner fee mention`,

    7: `Step 7 — Email 3 (Partnership Structure / Fee Reveal), ~180 words max.
Opening line: "${openingLine}"
Opening: "One more note, then I'll stop filling your inbox."
- Introduce partnership arrangement: "When a client you introduce invests in New Dawn and their E-2 visa is approved, we pay a partner fee of 12.5% of their franchise package price. At our $225,000 starting package, that's $28,125. If your client takes a larger package, the fee scales with it at 12.5%."
- Add: "The fee is tied to visa approval — not to the introduction. That's intentional: you're compensated when your client succeeds."
- Apply audience-specific closing paragraph:
  ${type === "immigration_attorney" ? 'For immigration_attorney: "The arrangement is structured as a co-education and marketing partnership — not a client referral fee — and the specifics of how it works for your firm depend on your state bar\'s guidelines. That\'s exactly why I\'d rather walk through it on a call than try to cover everything here."' : ""}
  ${type === "wealth_manager" ? 'For wealth_manager: "It\'s a clean, straightforward arrangement — no complexity, no ongoing obligations. You introduce qualifying clients, we do the work, you\'re compensated when they get approved. Happy to walk through the details on a call."' : ""}
  ${["business_advisor", "e2_consultant", "immigration_consultant"].includes(type) ? 'For this audience type: "It\'s a simple, transparent arrangement. You bring qualifying clients, we execute everything on our side, and you\'re paid when their visa comes through. Happy to walk through the full details on a call."' : ""}
  ${type === "other" ? 'For other: "It\'s as simple as it sounds. If someone you know qualifies and invests, you\'re paid when their visa is approved. No complexity, no ongoing obligations. Happy to walk through the details on a quick call."' : ""}
- CTA: "If any of this is worth twenty minutes: ${CALENDLY}"
- Closing line: "${closingLine}"`,

    8: `Step 8 — Breakup Email, ~100 words max.
Opening line: "${openingLine}"
Opening: "I've reached out a few times and don't want to keep crowding your inbox, so I'll leave it here."
- "If New Dawn is ever useful for a client of yours — now or a year from now — my door is open. You can reply to this email any time and it'll come straight to me."
- "Wishing you and ${firmName} a strong year."
- Closing line: "${closingLine}"
- Keep it genuinely warm and human — not passive-aggressive`,
  };

  const audienceProfile = audienceProfiles[type] ?? audienceProfiles.other;
  const stepInstruction = stepInstructions[step] ?? stepInstructions[2];

  const userPrompt = `Lead details:
- Name: ${lead.fullName} (use "${firstName}" in salutation)
- Title: ${lead.title ?? "unknown"}
- Firm: ${firmName}
- City: ${lead.city ?? "unknown"}
- Audience type: ${type} — ${audienceLabel(type)}
- Spanish flag: ${spanish}

${audienceProfile}

Draft this specific step:
${stepInstruction}

Required subject line (use exactly): "${subject}"

Return JSON only: {"subject":"...","body":"..."}`;

  const raw = await callClaude(SYSTEM, userPrompt, 900);

  let body = raw;
  let subj = subject;
  try {
    const parsed = JSON.parse(raw);
    subj = parsed.subject ?? subject;
    body = parsed.body ?? raw;
  } catch {
    // strip any JSON-like wrapper if present
    const match = raw.match(/"body"\s*:\s*"([\s\S]*?)"\s*\}/);
    if (match) body = match[1].replace(/\\n/g, "\n");
  }

  const token = randomUUID();
  const pixel = `<img src="${APP_BASE()}/api/track/open/${token}" width="1" height="1" style="display:none" alt="" />`;

  const html = `<html><body style="font-family:Arial,sans-serif;line-height:1.7;color:#222;max-width:600px;margin:auto;padding:20px">
${body.split("\n").map(l => l.trim() ? `<p style="margin:0 0 12px">${l}</p>` : "").join("")}
${pixel}
</body></html>`;

  return { subject: subj, html, text: body };
}

// ─── Draft LinkedIn message ───────────────────────────────────────────────────

function draftLinkedIn(lead: PartnerLead, isConnection: boolean): string {
  const firstName = lead.fullName.split(" ")[0];
  const type = lead.audienceType ?? "other";

  if (isConnection) {
    const byType: Record<string, string> = {
      immigration_attorney: `Hi ${firstName} — I lead franchise development at New Dawn Franchising, a property management franchise built specifically for E-2 visa investors. Would value connecting with attorneys doing E-2 work. No pitch — just think we're solving a problem you likely see often.`,
      wealth_manager: `Hi ${firstName} — I lead franchise development at New Dawn Franchising, a U.S. franchise built specifically for international investors pursuing E-2 visas. Think it might be relevant for clients seeking U.S. residency through investment. Would value connecting.`,
      business_advisor: `Hi ${firstName} — I lead franchise development at New Dawn Franchising, a U.S. operating franchise built for international entrepreneurs pursuing an E-2 visa. Think it could be a fit for clients you work with. Would value connecting.`,
      e2_consultant: `Hi ${firstName} — I lead franchise development at New Dawn Franchising — the first franchise built specifically around E-2 visa requirements. Think there could be real synergy with your work. Would value connecting.`,
      immigration_consultant: `Hi ${firstName} — I lead franchise development at New Dawn Franchising, a U.S. franchise investment built specifically for E-2 visa applicants — including a full refund structure if the visa isn't approved. Think it could be useful for your clients. Would value connecting.`,
      other: `Hi ${firstName} — I lead franchise development at New Dawn Franchising, a U.S. franchise built for international investors pursuing an E-2 visa — with a full refund if the visa isn't approved. If you ever work with internationally-minded clients, think it could be worth a conversation.`,
    };
    return (byType[type] ?? byType.other).slice(0, 300);
  }

  const base = `Thanks for connecting, ${firstName}. Sent you a note by email — quick intro to what we've built and a protection structure I think you'll find interesting for your clients. No rush on it. Happy to chat here if that's easier.`;
  if (lead.spanishFlag) return base + " Un saludo.";
  return base;
}

// ─── Execute individual event ─────────────────────────────────────────────────

async function executeEvent(event: PartnerSequenceEvent, lead: PartnerLead): Promise<void> {
  const meta = (event.metadata ?? {}) as any;
  const condition: string | null = meta.condition ?? null;
  const flow: string = meta.flow ?? lead.sequenceFlow ?? "standard";
  const firstName = lead.fullName.split(" ")[0];

  // Evaluate conditions
  if (condition === "lob_enabled" && flow !== "lob_enabled") {
    await markEvent(event.id, "skipped", { notes: "No mailing address — skipping Lob touch", executedAt: new Date() });
    return;
  }
  if (condition === "linkedin_connected" && !lead.linkedinConnected) {
    await markEvent(event.id, "skipped", { notes: "LinkedIn not yet connected — skipping DM", executedAt: new Date() });
    return;
  }
  if (condition === "no_reply") {
    const replied = await hasReplied(lead.id);
    if (replied) {
      await markEvent(event.id, "skipped", { notes: "Lead replied on another channel — skipping breakup email", executedAt: new Date() });
      return;
    }
  }

  if (lead.sequencePaused || lead.optedOut) {
    await markEvent(event.id, lead.optedOut ? "cancelled" : "paused", { notes: "Sequence paused/cancelled", executedAt: new Date() });
    return;
  }

  // ─── LinkedIn ────────────────────────────────────────────────────────────
  if (event.channel === "linkedin") {
    const isConnection = event.touchName.includes("Connection");
    const msg = draftLinkedIn(lead, isConnection);
    const actionType = isConnection ? "connection_request" : "dm";
    const token = randomUUID().replace(/-/g, "");
    const approvalUrl = `${APP_BASE()}/approve/linkedin/${token}`;

    await db.insert(linkedinQueue).values({
      leadId: lead.id,
      sequenceEventId: event.id,
      leadName: lead.fullName,
      leadLinkedinUrl: lead.linkedinUrl ?? null,
      leadCompany: lead.company ?? null,
      leadTitle: lead.audienceType ?? null,
      type: actionType,
      message: msg,
      status: "pending",
      approvalToken: token,
    } as any);

    await markEvent(event.id, "sent", {
      notes: `LinkedIn ${actionType} queued — "${msg.slice(0, 80)}..."`,
      metadata: { ...meta, linkedinMessage: msg, approvalToken: token } as any,
      executedAt: new Date(),
    });

    const label = isConnection ? "🔗 Partner LinkedIn Connection" : "💬 Partner LinkedIn DM";
    const smsBody = `${label} queued for ${lead.fullName}${lead.company ? ` · ${lead.company}` : ""}\n\nMessage: "${msg.slice(0, 140)}"\n\nLinkedIn: ${lead.linkedinUrl ?? "no URL"}\n\nTap to confirm you sent it:\n${approvalUrl}`;
    await sendAgentSms("outreach", smsBody, { triggerType: "partner_linkedin_queue" }).catch(() => {});
    return;
  }

  // ─── Lob Letter ──────────────────────────────────────────────────────────
  if (event.channel === "lob") {
    const { sendPartnerLetter } = await import("./lob-service") as any;
    const result = await sendPartnerLetter(lead);
    await markEvent(event.id, result.success ? "sent" : "failed", {
      notes: result.success
        ? `Partner letter dispatched via Lob${result.demoMode ? " (demo mode)" : ""}. ID: ${result.lobId}. Address: ${lead.mailingAddress}`
        : `Lob error: ${result.error}`,
      metadata: { ...meta, lobId: result.lobId } as any,
      executedAt: new Date(),
    });
    return;
  }

  // ─── Email ───────────────────────────────────────────────────────────────
  if (event.channel === "email") {
    if (!lead.email) {
      await markEvent(event.id, "failed", { notes: "No email address on file", executedAt: new Date() });
      return;
    }

    // Map touch name to step number
    let step = 2;
    if (event.touchName.includes("Step 5") || event.touchName.includes("Opportunity")) step = 5;
    else if (event.touchName.includes("Step 6") || event.touchName.includes("Loom")) step = 6;
    else if (event.touchName.includes("Step 7") || event.touchName.includes("Partnership")) step = 7;
    else if (event.touchName.includes("Step 8") || event.touchName.includes("Breakup")) step = 8;

    const { subject, html, text } = await draftEmail(lead, step);

    const result = await sendEmailFromSender(
      "dylan@newdawnfranchising.com",
      lead.email,
      subject,
      html,
    );

    await markEvent(event.id, result.success ? "sent" : "failed", {
      notes: result.success ? `Email sent — subject: "${subject}"` : result.error,
      metadata: { ...meta, subject } as any,
      executedAt: new Date(),
    });

    if (result.success) {
      console.log(`[PartnerSequence] Step ${step} email sent to ${lead.fullName} <${lead.email}> — "${subject}"`);
    } else {
      console.error(`[PartnerSequence] Email failed for ${lead.fullName}: ${result.error}`);
    }
  }
}

// ─── Main cron processor ──────────────────────────────────────────────────────

export async function processPartnerSequence(): Promise<void> {
  const now = new Date();

  const dueEvents = await db.select({
    event: partnerSequenceEvents,
    lead: partnerLeads,
  })
    .from(partnerSequenceEvents)
    .innerJoin(partnerLeads, eq(partnerSequenceEvents.leadId, partnerLeads.id))
    .where(and(
      eq(partnerSequenceEvents.status, "scheduled"),
      lte(partnerSequenceEvents.scheduledAt, now),
    ));

  if (dueEvents.length === 0) return;
  console.log(`[PartnerSequence] Processing ${dueEvents.length} due event(s)`);

  for (const { event, lead } of dueEvents) {
    try {
      await executeEvent(event, lead);
    } catch (err: any) {
      console.error(`[PartnerSequence] Error on event ${event.id} (${event.touchName}):`, err.message);
      await markEvent(event.id, "failed", { notes: `Error: ${err.message}`, executedAt: new Date() });
    }
  }
}
