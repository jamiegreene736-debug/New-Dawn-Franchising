/**
 * Broker Outreach Sequence Service
 * Manages the expanded omnichannel sequence for broker leads (more steps, earlier value + explicit commission follow-ups).
 *
 * Runs in two variants selected at init: the BROKER track (referral-partner
 * pitch) and the CLIENT track (direct-to-investor pitch, no referral-fee
 * language). Postcards (Lob) were retired — the channel is gone from new
 * sequences and legacy Lob events are neutralized at execution time.
 *
 * Sequence:
 *   Day  0 — LinkedIn connection request
 *   Day  1 — Email Touch 1 (soft intro)
 *   Day  1 — SMS trigger (if email opened <24hr)
 *   Day  2 — LinkedIn DM (if connected)
 *   Day  3 — Email Touch 2 (credibility + social proof)
 *   Day  4 — Email Touch 2b (early value teaser)
 *   Day  5 — HeyGen video email (if tag=heygen_flow)
 *   Day  7 — Email Touch 3 (the key offer for the track)
 *   Day  7 — SMS trigger (if email opened <4hr)
 *   Day  9 — Email Touch 4 — Real client outcomes (sooner proof)
 *   Day 10 — WhatsApp (if no reply on any channel)
 *   Day 14 — Email Touch 5 — Case Study Email (if tag=heygen_flow)
 *   Day 17 — Email Touch 6 — Checking in on your E-2 pipeline
 *   Day 21 — Final breakup email
 */

import { db } from "./db";
import {
  outreachLeads, outreachSequenceEvents, linkedinQueue,
  type OutreachLead, type OutreachSequenceEvent,
} from "@shared/schema";
import { eq, and, lte, inArray, sql, or } from "drizzle-orm";
import { sendAgentSms } from "./agent-sms-service";
import { sendEmailFromSender } from "./email-service";
import { randomUUID } from "crypto";
import type { TrackId } from "@shared/campaign-tracks";

// ─── Claude helper ────────────────────────────────────────────────────────────

async function callClaude(system: string, user: string, maxTokens = 600): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) return "";
  const d = await res.json() as any;
  return (d.content as any[]).filter(b => b.type === "text").map(b => b.text).join("").trim();
}

// ─── Messaging helpers (Quo for SMS, Meta WhatsApp API for WhatsApp) ──────────

const SMS_FROM_NUMBER = "+18084606509";
const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";

async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const key = process.env.QUO_API_KEY;
  if (!key) return { success: false, error: "QUO_API_KEY not configured" };
  const cleanTo = to.replace(/\D/g, "");
  const phone = cleanTo.startsWith("1") ? `+${cleanTo}` : `+1${cleanTo}`;
  try {
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key },
      body: JSON.stringify({ from: SMS_FROM_NUMBER, to: [phone], content: body }),
    });
    if (!res.ok) { const e = await res.json() as any; return { success: false, error: e.message || `Quo error ${res.status}` }; }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function sendWhatsApp(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const { sendWhatsAppMessage } = await import("./meta-whatsapp-service");
  const result = await sendWhatsAppMessage(to, body);
  return { success: result.success, error: result.error };
}

// ─── Email helper ─────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string; subject: string; html: string; text?: string;
}): Promise<{ success: boolean; error?: string }> {
  return sendEmailFromSender("dylan@newdawnfranchising.com", opts.to, opts.subject, opts.html);
}

function trackingPixel(token: string): string {
  const base = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
  return `<img src="${base}/api/track/open/${token}" width="1" height="1" style="display:none" alt="" />`;
}

// ─── Sequence definition ──────────────────────────────────────────────────────

interface EventDef {
  day: number;
  channel: "email" | "sms" | "whatsapp" | "linkedin" | "heygen";
  touchName: string;
  condition?: "heygen_flow" | "linkedin_connected" | "sms_trigger_1" | "sms_trigger_7" | "no_reply";
}

const SEQUENCE_EVENTS: EventDef[] = [
  { day: 0,  channel: "linkedin",  touchName: "Day 0 — LinkedIn Connection Request" },
  { day: 1,  channel: "email",     touchName: "Touch 1 — Soft Intro Email" },
  { day: 1,  channel: "sms",       touchName: "Day 1 SMS — Email Open Trigger", condition: "sms_trigger_1" },
  { day: 2,  channel: "linkedin",  touchName: "Day 2 — LinkedIn DM",              condition: "linkedin_connected" },
  { day: 3,  channel: "email",     touchName: "Touch 2 — Credibility & Social Proof" },
  { day: 4,  channel: "email",     touchName: "Touch 2b — The Referral Opportunity for Brokers" },
  { day: 5,  channel: "heygen",    touchName: "Day 5 — HeyGen AI Video Email",    condition: "heygen_flow" },
  { day: 7,  channel: "email",     touchName: "Touch 3 — Referral Fee Reveal" },
  { day: 7,  channel: "sms",       touchName: "Day 7 SMS — Email Open Trigger",  condition: "sms_trigger_7" },
  { day: 9,  channel: "email",     touchName: "Touch 4 — Real client outcomes" },
  { day: 10, channel: "whatsapp",  touchName: "Day 10 — WhatsApp Follow-Up",     condition: "no_reply" },
  { day: 14, channel: "email",     touchName: "Day 14 — Case Study Email",        condition: "heygen_flow" },
  { day: 17, channel: "email",     touchName: "Touch 6 — Checking in on your E-2 pipeline" },
  { day: 21, channel: "email",     touchName: "Day 21 — Final Breakup Email" },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // 9 AM
  return d;
}

// ─── Initialize sequence ──────────────────────────────────────────────────────

export async function initializeSequence(leadId: string, track?: TrackId): Promise<void> {
  const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found: " + leadId);
  if (lead.sequenceStartedAt) return; // already initialized

  // Which pitch this lead receives: "broker" (referral-partner) or "client"
  // (direct-to-investor). Caller wins; otherwise fall back to the lead's stored
  // track, then "broker" for backward compatibility.
  const sequenceTrack: TrackId =
    track ?? ((lead as any).sequenceTrack === "client" ? "client" : "broker");

  // Postcards were retired, so there is no longer a Lob branch — every lead runs
  // the HeyGen-eligible flow (the HeyGen video still gates on the heygen_flow tag).
  const flow = "heygen_flow";

  const now = new Date();

  // Create all events as SCHEDULED
  const events = SEQUENCE_EVENTS.map(def => {
    const scheduledAt = addDays(now, def.day);

    // SMS triggers: schedule slightly after the email so cron can detect overdue
    if (def.condition === "sms_trigger_1") scheduledAt.setTime(addDays(now, 2).getTime()); // expires after Day 2
    if (def.condition === "sms_trigger_7") scheduledAt.setTime(addDays(now, 8).getTime()); // expires after Day 8

    return {
      leadId,
      day: def.day,
      channel: def.channel,
      touchName: def.touchName,
      status: "scheduled" as const,
      scheduledAt,
      metadata: { condition: def.condition ?? null, flow, track: sequenceTrack } as any,
    };
  });

  await db.insert(outreachSequenceEvents).values(events);

  // Update lead
  await db.update(outreachLeads)
    .set({ sequenceStartedAt: now, sequenceFlow: flow, sequenceTrack, tags: sql`array_append(tags, ${flow})` as any })
    .where(eq(outreachLeads.id, leadId));

  console.log(`[BrokerSequence] Initialized ${events.length} events for ${lead.fullName} (flow: ${flow}, track: ${sequenceTrack})`);
}

// ─── Check if lead has replied on any channel ─────────────────────────────────

async function hasReplied(leadId: string): Promise<boolean> {
  const replied = await db.select({ status: outreachSequenceEvents.status })
    .from(outreachSequenceEvents)
    .where(and(eq(outreachSequenceEvents.leadId, leadId), eq(outreachSequenceEvents.status, "replied")))
    .limit(1);
  const [lead] = await db.select({ status: outreachLeads.status }).from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
  return replied.length > 0 || lead?.status === "replied";
}

// ─── Pause / Cancel sequence ──────────────────────────────────────────────────

export async function pauseSequence(leadId: string, reason: string): Promise<void> {
  await db.update(outreachSequenceEvents)
    .set({ status: "paused", notes: reason, updatedAt: new Date() })
    .where(and(eq(outreachSequenceEvents.leadId, leadId), eq(outreachSequenceEvents.status, "scheduled")));
  await db.update(outreachLeads)
    .set({ sequencePaused: true, sequencePausedReason: reason, status: "replied" })
    .where(eq(outreachLeads.id, leadId));
  const [lead] = await db.select({ fullName: outreachLeads.fullName }).from(outreachLeads).where(eq(outreachLeads.id, leadId)).limit(1);
  await sendAgentSms("outreach", `⏸️ Sequence paused for ${lead?.fullName ?? leadId}\nReason: ${reason}\nAll future touches halted. Review in Agent > Pipeline.`).catch(() => {});
}

export async function cancelSequence(leadId: string, reason: string): Promise<void> {
  await db.update(outreachSequenceEvents)
    .set({ status: "cancelled", notes: reason, updatedAt: new Date() })
    .where(and(eq(outreachSequenceEvents.leadId, leadId), eq(outreachSequenceEvents.status, "scheduled")));
  await db.update(outreachLeads)
    .set({ sequencePaused: true, sequencePausedReason: reason, optedOut: true, status: "dead", tags: sql`array_append(tags, 'Do Not Contact')` as any })
    .where(eq(outreachLeads.id, leadId));
}

// ─── Update event status ──────────────────────────────────────────────────────

async function markEvent(
  id: string,
  status: OutreachSequenceEvent["status"],
  extras: Partial<Pick<OutreachSequenceEvent, "notes" | "metadata" | "executedAt">> = {}
): Promise<void> {
  await db.update(outreachSequenceEvents)
    .set({ status, updatedAt: new Date(), executedAt: extras.executedAt ?? new Date(), ...extras })
    .where(eq(outreachSequenceEvents.id, id));
}

// ─── Email open tracking ──────────────────────────────────────────────────────

export async function handleEmailOpen(trackingToken: string): Promise<void> {
  const [event] = await db.select().from(outreachSequenceEvents)
    .where(sql`metadata->>'trackingToken' = ${trackingToken}`)
    .limit(1);
  if (!event) return;
  if (event.status === "opened" || event.status === "clicked") return; // already tracked

  await markEvent(event.id, "opened");

  // Find linked SMS trigger event
  const meta = event.metadata as any;
  const smsTriggerEventId: string | undefined = meta?.smsTriggerEventId;
  if (!smsTriggerEventId) return;

  const [smsEvent] = await db.select().from(outreachSequenceEvents).where(eq(outreachSequenceEvents.id, smsTriggerEventId)).limit(1);
  if (!smsEvent || smsEvent.status !== "scheduled") return;

  // Check time window: Day 1 trigger = 24hr, Day 7 trigger = 4hr
  const isDay7 = event.touchName.includes("Touch 3");
  const windowHours = isDay7 ? 4 : 24;
  const openedAt = new Date();
  const emailSentAt = event.executedAt ?? event.scheduledAt;
  const hoursSinceSent = (openedAt.getTime() - emailSentAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceSent > windowHours) {
    await markEvent(smsEvent.id, "skipped", { notes: `Email opened ${Math.round(hoursSinceSent)}hr after send — outside ${windowHours}hr trigger window`, executedAt: new Date() });
    return;
  }

  // Fire SMS within 1 hour
  const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, event.leadId)).limit(1);
  if (!lead?.phone) {
    await markEvent(smsEvent.id, "failed", { notes: "No phone number on file", executedAt: new Date() });
    return;
  }

  const firstName = lead.fullName.split(" ")[0];
  const track: TrackId = (lead as any).sequenceTrack === "client" ? "client" : "broker";
  const smsBody = isDay7
    ? (track === "client"
        ? `Hey ${firstName} — saw you opened. Quick note: your investment is fully escrowed (full refund if the visa is denied), you direct the business while a team runs day-to-day, and you can live anywhere in the US. Happy to hop on a quick call this week — Dylan`
        : `Hey ${firstName} — saw you opened. Quick note: brokers earn an average commission of 12.5% of $225,000 ($28,125 per client) — fully escrowed, zero risk, paid when visa clears. Happy to hop on a quick call this week — Dylan`)
    : (track === "client"
        ? `Hey ${firstName}, Dylan here from New Dawn. Just emailed about our E-2 platform (PM, Telecom, Insurance) — direct a US business without the daily ops, live anywhere. Worth a look?`
        : `Hey ${firstName}, Dylan here from New Dawn. Just emailed about our E-2 platform (PM, Telecom, Insurance) for clients who want to direct a US business without daily ops. Worth a look?`);

  const result = await sendSms(lead.phone, smsBody);
  await markEvent(smsEvent.id, result.success ? "sent" : "failed", {
    notes: result.success ? "Fired after email open within trigger window" : result.error,
    executedAt: new Date(),
  });
}

// ─── Draft email content with Claude ─────────────────────────────────────────

async function draftEmail(lead: OutreachLead, touchNumber: number, track: TrackId = "broker"): Promise<{ subject: string; html: string; text: string }> {
  const firstName = lead.fullName.split(" ")[0];
  const location = [lead.company, lead.category?.replace(/_/g, " ")].filter(Boolean).join(" — ");

  // Broker track — pitches the referral partnership (mentions the 12.5% / $28,125 fee).
  const brokerInstructions: Record<number, string> = {
    1: `Touch 1 — Soft intro, ~120 words. Warm, curious tone. Reference something specific about their brokerage or market (${location}). Ask ONE genuine question about the type of clients they work with. Zero pitch. Zero mention of visa amounts or fees. Subject should feel personal, not like a campaign (e.g. "Quick question, ${firstName}").`,
    2: `Touch 2 — ~150 words. Credibility + social proof. Say you wanted to follow up. Introduce the concept briefly: you help international investors get E-2 Visas through New Dawn's multi-vertical platform (Property Management, Telecom, or Insurance) — the first franchise designed specifically for E-2. Drop trust signals naturally: Forbes 30 Under 30 recognition, escrow-protected funds (client gets full refund if visa denied), established brand. Still zero referral fee mention. Soft CTA: "Happy to send over a one-pager if helpful."`,
    3: `Touch 3 — ~180 words. "The Reveal". Subject: "Here's what's in it for you, ${firstName}" or "The part I haven't mentioned yet". Reveal the referral fee clearly as an average commission of 12.5% of $225,000 — that's $28,125 per client referred. Reinforce zero risk: funds held in escrow until visa clears, client gets full refund if denied. Mention clients choose their vertical (PM/Telecom/Insurance). Include Calendly link: ${CALENDLY}. Light urgency: opportunities structured for E-2 are limited.`,
    4: `Touch 2b / 4 — Broker Referral Opportunity, ~140 words. Early but clear teaser of the money: "Brokers in our program earn an average commission of 12.5% of $225,000 ($28,125 per successful referral)." Zero risk, escrowed, paid on visa approval. Clients get to choose Property Management, Telecom or Insurance. Soft CTA to reply or book a short call. Keep warm and professional.`,
    5: `Touch 4 / 5 — Real client outcomes, ~150 words. Brief positive example of a broker-referred client who chose a vertical, invested $225K, got E-2 visa, and is now directing a real operating business. Re-mention escrow protection and that referring brokers earn the 12.5% commission. End with Calendly link: ${CALENDLY}.`,
    6: `Touch 6 — Pipeline check-in, ~120 words. Friendly follow up: "Any E-2 clients exploring US business options right now?" Remind of the choice of three verticals, the director-level model, and that brokers earn an average commission of 12.5% of $225,000 per referred client. Offer to send one-pager or jump on 15 min call. Include Calendly: ${CALENDLY}.`,
    14: `Case study email — ~160 words. Brief anonymized success story: a client who came through a broker referral, invested $225K in one of our three E-2 verticals (e.g. Property Management or Telecom), got their E-2 Visa, and is now directing operations in the US. Reinforce escrow protection. End with Calendly link: ${CALENDLY} and: "Even if the timing isn't right now, I'd love to be your go-to when it is."`,
    21: `Final breakup email — ~100 words. Subject: "Closing the loop, ${firstName}". Gracious, no guilt. Won't follow up again after this. Leave the door open. Re-include the referral fee (average commission of 12.5% of $225,000) and Calendly link: ${CALENDLY} one final time. Must feel genuinely human, not automated.`,
  };

  // Client track — written DIRECTLY to the E-2 investor candidate. Pitches the
  // franchise itself. NEVER mentions referral fees, commissions, or a broker portal.
  const clientInstructions: Record<number, string> = {
    1: `Touch 1 — Soft intro, ~120 words. Warm, curious tone, written to the investor themselves. Reference their situation/market (${location}) if useful. Ask ONE genuine question about what they're looking for in a U.S. business or their E-2 timeline. Zero hard pitch. Zero mention of dollar amounts. Subject should feel personal (e.g. "Quick question, ${firstName}").`,
    2: `Touch 2 — ~150 words. Credibility + social proof, written to the investor. Briefly: New Dawn helps international investors get E-2 Visas through a multi-vertical platform (Property Management, Telecom, or Insurance) — the first built specifically for E-2. Trust signals: Forbes 30 Under 30, YOUR investment held in escrow with full refund if the visa is denied. Soft CTA: "Happy to send over a one-pager if helpful." NO referral fees.`,
    3: `Touch 3 — ~180 words. How the investment works FOR THE INVESTOR. Subject: "How your $225K is structured — and protected". Explain: the qualifying $225,000 investment funds a real operating U.S. business and satisfies E-2 requirements; held in escrow; financing available; you stay in control as the Director while a team runs daily ops; you can live anywhere in the U.S. Include Calendly: ${CALENDLY}. NEVER mention referral fees/commissions/broker portal.`,
    4: `Touch 4 — Why it fits the investor, ~140 words. Reinforce the director model and choice of three verticals (Property Management, Telecom, or Insurance), escrow protection, and live-anywhere freedom. Soft CTA to reply or book a short call. Warm and professional. NO referral fees.`,
    5: `Touch 4 / 5 — Real investor outcomes, ~150 words. Brief anonymized success story of an investor who invested $225K in one of the three verticals, got their E-2 visa, and now directs a real operating business while living where they want. Re-mention escrow protection. End with Calendly: ${CALENDLY}. NO referral fees.`,
    6: `Touch 6 — Check-in, ~120 words. Friendly: "Where are you in exploring your E-2 options right now?" Remind of the three verticals, the director model, escrow protection, and live-anywhere freedom. Offer a one-pager or a 15-min call. Include Calendly: ${CALENDLY}. NO referral fees.`,
    14: `Case study email — ~160 words. Anonymized success story of an investor who invested $225K in one of the three E-2 verticals, got their E-2 Visa, and now directs operations in the U.S. Reinforce escrow protection. End with Calendly: ${CALENDLY} and: "Even if the timing isn't right now, I'd love to be your resource when it is." NO referral fees.`,
    21: `Final breakup email — ~100 words. Subject: "Closing the loop, ${firstName}". Gracious, no guilt, written to the investor. Won't follow up again. Leave the door open. Re-include Calendly: ${CALENDLY} one final time. Must feel genuinely human. NO referral fees.`,
  };

  const instructions = track === "client" ? clientInstructions : brokerInstructions;
  const instruction = instructions[touchNumber] ?? instructions[1];

  const system = track === "client"
    ? `You are drafting outreach emails on behalf of Dylan Delaney at New Dawn Franchising (newdawnfranchising.com), written DIRECTLY to a prospective E-2 investor. Dylan is Forbes 30 Under 30 listed. He helps international investors get E-2 Visas through New Dawn's multi-vertical franchise platform (Property Management, Telecom, or Insurance) — the first built specifically for E-2 Treaty Investor Visa requirements. Write in Dylan's warm, confident, never-salesy voice. CRITICAL: never mention referral fees, commissions, broker payouts, or a broker portal — this email goes to the investor, not a referral partner. Reply with JSON: {"subject":"...","body":"plain text email body, no HTML tags"}.`
    : `You are drafting outreach emails on behalf of Dylan Delaney at New Dawn Franchising (newdawnfranchising.com). Dylan is Forbes 30 Under 30 listed. He helps international investors get E-2 Visas through New Dawn's multi-vertical franchise platform (Property Management, Telecom, or Insurance) — the first built specifically for E-2 Treaty Investor Visa requirements. Write in Dylan's warm, confident, never-salesy voice. Reply with JSON: {"subject":"...","body":"plain text email body, no HTML tags"}.`;

  const raw = await callClaude(system, `Lead: ${lead.fullName}, ${lead.title ?? ""}, ${location}\n\n${instruction}`);

  let subject = `Quick question, ${firstName}`;
  let body = raw;
  try {
    const parsed = JSON.parse(raw);
    subject = parsed.subject ?? subject;
    body = parsed.body ?? raw;
  } catch { /* use raw as body */ }

  const token = randomUUID();
  const pixel = trackingPixel(token);
  const html = `<html><body style="font-family:Arial,sans-serif;line-height:1.7;color:#222;max-width:600px;margin:auto;padding:20px">
${body.split("\n").map(l => l.trim() ? `<p>${l}</p>` : "").join("")}
${pixel}
</body></html>`;

  return { subject, html, text: body };
}

function draftLinkedInMessage(lead: OutreachLead, touchNumber: number, track: TrackId = "broker"): string {
  const firstName = lead.fullName.split(" ")[0];
  if (touchNumber === 0) {
    const location = lead.company ? `at ${lead.company}` : "";
    return `Hi ${firstName} — I came across your work${location} and wanted to reach out. I'm Dylan Delaney, founder of New Dawn Franchising. Really impressed by what you're building. Would love to connect!`.slice(0, 300);
  }
  if (track === "client") {
    return `Hi ${firstName}, sent you an email too — didn't want it to get buried. Thought this might be relevant if you're exploring an E-2 qualifying US business (choice of PM, Telecom or Insurance) you'd direct while a team runs day-to-day. Escrow-protected, live anywhere in the US. Happy to chat when it suits you.`;
  }
  return `Hi ${firstName}, sent you an email too — didn't want it to get buried. Thought this might be relevant for any of your clients eyeing an E-2 qualifying US business (choice of PM, Telecom or Insurance). Brokers earn average 12.5% commission on referred investments. Happy to chat when it suits you.`;
}

function draftWhatsApp(lead: OutreachLead, track: TrackId = "broker"): string {
  const firstName = lead.fullName.split(" ")[0];
  if (track === "client") {
    return `Hey ${firstName}, following up on your E-2 options. Choose Property Management, Telecom or Insurance — $225K, you direct while a team executes, escrow protected, live anywhere in the US. 20 min? ${CALENDLY} — Dylan`;
  }
  return `Hey ${firstName}, following up on the E-2 referral. Clients choose Property Management, Telecom or Insurance — $225K, they direct while teams execute, escrow protected. Brokers earn an average commission of 12.5% of $225,000 ($28,125 per client). 20 min? ${CALENDLY} — Dylan`;
}

// ─── Execute individual event ─────────────────────────────────────────────────

async function executeEvent(event: OutreachSequenceEvent, lead: OutreachLead): Promise<void> {
  const meta = (event.metadata ?? {}) as any;
  const condition: string | null = meta.condition ?? null;
  const flow: string = meta.flow ?? lead.sequenceFlow ?? "";
  const track: TrackId = meta.track ?? ((lead as any).sequenceTrack === "client" ? "client" : "broker");
  const firstName = lead.fullName.split(" ")[0];

  // Postcards retired: neutralize any legacy scheduled Lob events so cron doesn't
  // reprocess them forever (they no longer match an execution branch below).
  if (event.channel === "lob") {
    await markEvent(event.id, "skipped", { notes: "Postcard/letter step retired (Lob removed)", executedAt: new Date() });
    return;
  }

  // Evaluate conditions before running
  if (condition === "lob_enabled") {
    await markEvent(event.id, "skipped", { notes: "Postcard/letter step retired (Lob removed)", executedAt: new Date() });
    return;
  }
  if (condition === "heygen_flow" && flow !== "heygen_flow") {
    await markEvent(event.id, "skipped", { notes: "Lead not on HeyGen flow — skipping HeyGen touch", executedAt: new Date() });
    return;
  }
  if (condition === "linkedin_connected" && !lead.linkedinConnected) {
    await markEvent(event.id, "skipped", { notes: "LinkedIn not yet connected", executedAt: new Date() });
    return;
  }
  if (condition === "sms_trigger_1" || condition === "sms_trigger_7") {
    // These fire only via email open event — if we hit them in cron, they're overdue → skip
    await markEvent(event.id, "skipped", { notes: "Email not opened within trigger window", executedAt: new Date() });
    return;
  }
  if (condition === "no_reply") {
    const replied = await hasReplied(lead.id);
    if (replied) {
      await markEvent(event.id, "skipped", { notes: "Lead replied on another channel — skipping", executedAt: new Date() });
      return;
    }
  }

  // Check if sequence is paused
  if (lead.sequencePaused || lead.optedOut) {
    await markEvent(event.id, lead.optedOut ? "cancelled" : "paused", { notes: "Sequence paused/cancelled", executedAt: new Date() });
    return;
  }

  // ─── Execute by channel ───────────────────────────────────────────────────

  if (event.channel === "linkedin") {
    const msg = draftLinkedInMessage(lead, event.day, track);
    const isConnectionRequest = event.day === 0;
    const actionType = isConnectionRequest ? "connection_request" : "dm";
    const token = randomUUID().replace(/-/g, "");
    const base = process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";
    const approvalUrl = `${base}/approve/linkedin/${token}`;

    // Queue in DB
    await db.insert(linkedinQueue).values({
      leadId: lead.id,
      sequenceEventId: event.id,
      leadName: lead.fullName,
      leadLinkedinUrl: lead.linkedinUrl ?? null,
      leadCompany: lead.company ?? null,
      leadTitle: lead.category ?? null,
      type: actionType,
      message: msg,
      status: "pending",
      approvalToken: token,
    });

    // Mark the sequence event as pending (not sent yet)
    await markEvent(event.id, "sent", {
      notes: `LinkedIn ${actionType} queued — awaiting Dylan's confirmation: "${msg.slice(0, 80)}..."`,
      metadata: { ...meta, linkedinMessage: msg, approvalToken: token } as any,
      executedAt: new Date(),
    });

    // SMS alert to Dylan via outreach agent number
    const label = isConnectionRequest ? "🔗 Connection Request" : "💬 LinkedIn DM";
    const smsBody = `${label} queued for ${lead.fullName}${lead.company ? ` · ${lead.company}` : ""}\n\nMessage: "${msg.slice(0, 140)}..."\n\nLinkedIn: ${lead.linkedinUrl ?? "no URL"}\n\nTap to confirm you sent it:\n${approvalUrl}`;
    await sendAgentSms("outreach", smsBody, { triggerType: "linkedin_queue" }).catch(() => {});
    return;
  }

  if (event.channel === "whatsapp") {
    const waNr = lead.whatsapp || lead.phone;
    if (!waNr) {
      await markEvent(event.id, "skipped", { notes: "No WhatsApp / phone number on file", executedAt: new Date() });
      return;
    }
    const body = draftWhatsApp(lead, track);
    const result = await sendWhatsApp(waNr, body);
    await markEvent(event.id, result.success ? "sent" : "failed", {
      notes: result.error,
      metadata: { ...meta, message: body } as any,
      executedAt: new Date(),
    });
    return;
  }

  if (event.channel === "heygen") {
    if (!lead.email) {
      await markEvent(event.id, "failed", { notes: "No email for HeyGen delivery", executedAt: new Date() });
      return;
    }
    // Create HeyGen video for this lead
    const { generateHeygenVideo } = await import("./heygen-service") as any;
    const script = track === "client"
      ? `Hi ${firstName}, this is Dylan Delaney from New Dawn Franchising. I wanted to personally reach out because our E-2 Visa franchise model could be a great fit for you. We help international investors secure their visa and operate a real US business (Property Management, Telecom or Insurance) while local teams execute day-to-day. We were recognized by Forbes 30 Under 30, your investment is held in escrow with full refund if the visa is denied, and you stay in control as the director while living anywhere in the US. I'd love to connect for 20 minutes. Book a time at ${CALENDLY}. Looking forward to speaking with you.`
      : `Hi ${firstName}, this is Dylan Delaney from New Dawn Franchising. I wanted to personally reach out because I believe you may have clients who could benefit from our E-2 Visa franchise investment model. We help international investors secure their visa and operate a real US business (Property Management, Telecom or Insurance) while local teams execute day-to-day. We were recognized by Forbes 30 Under 30, funds held in escrow with full refund if visa denied, and referring brokers earn an average commission of 12.5% of $225,000 ($28,125 per client). I'd love to connect for 20 minutes. Book a time at ${CALENDLY}. Looking forward to speaking with you.`;

    let videoUrl = "";
    let heygenId = "";
    try {
      const video = await generateHeygenVideo({ leadName: lead.fullName, script, leadId: lead.id });
      videoUrl = video?.videoUrl ?? "";
      heygenId = video?.id ?? "";
    } catch (e: any) {
      console.log("[BrokerSequence] HeyGen error:", e.message);
    }

    const token = randomUUID();
    const thumbnail = videoUrl
      ? `<a href="${videoUrl}"><img src="https://placehold.co/560x315/0f172a/fff?text=▶+Watch+Dylan%27s+personal+video" style="max-width:100%;border-radius:8px" /></a>`
      : "";

    const html = `<html><body style="font-family:Arial,sans-serif;line-height:1.7;color:#222;max-width:600px;margin:auto;padding:20px">
<p>Hi ${firstName},</p>
<p>I made this for you — a quick personal video explaining what we do and why it may be relevant ${track === "client" ? "for you" : "for your clients"}.</p>
${thumbnail}
${videoUrl ? `<p><a href="${videoUrl}" style="color:#1a2a4a">▶ Watch the video</a></p>` : ""}
<p>The short version: we help international investors get E-2 Visas through a proven multi-vertical franchise model (Property Management, Telecom or Insurance). ${track === "client" ? "You stay in control as the director, your investment is held in escrow — zero risk." : "Brokers earn an average commission of 12.5% of $225,000 ($28,125 per referral). Funds are held in escrow — zero risk."}</p>
<p>I'd love 20 minutes on a call: <a href="${CALENDLY}">${CALENDLY}</a></p>
${trackingPixel(token)}
</body></html>`;

    const result = await sendEmail({
      to: lead.email,
      subject: `I made this for you, ${firstName}`,
      html,
      text: `Hi ${firstName},\n\nI made a personal video for you. Watch it here: ${videoUrl || CALENDLY}\n\nDylan Delaney · New Dawn Franchising\n${CALENDLY}`,
    });

    await markEvent(event.id, result.success ? "sent" : "failed", {
      notes: result.success ? `HeyGen video email sent${videoUrl ? ` — video: ${videoUrl}` : " (video pending render)"}` : result.error,
      metadata: { ...meta, trackingToken: token, heygenVideoId: heygenId, videoUrl } as any,
      executedAt: new Date(),
    });
    return;
  }

  if (event.channel === "email") {
    if (!lead.email) {
      await markEvent(event.id, "failed", { notes: "No email address on file", executedAt: new Date() });
      return;
    }

    // Map touch name → touch number (extended for new steps; Touch 3 kept for SMS trigger + reveal instruction)
    let touchNum = 1;
    if (event.touchName.includes("Touch 2") || event.touchName.includes("Credibility")) touchNum = 2;
    else if (event.touchName.includes("Touch 3") || event.touchName.includes("Reveal")) touchNum = 3;
    else if (event.touchName.includes("Touch 2b") || event.touchName.includes("Referral Opportunity") || event.touchName.includes("for Brokers")) touchNum = 4;
    else if (event.touchName.includes("Touch 4") || event.touchName.includes("Real client outcomes")) touchNum = 5;
    else if (event.touchName.includes("Touch 6") || event.touchName.includes("Checking in on your E-2 pipeline")) touchNum = 6;
    else if (event.touchName.includes("Case Study") || event.day === 14) touchNum = 14;
    else if (event.touchName.includes("Final") || event.day === 21) touchNum = 21;

    const { subject, html, text } = await draftEmail(lead, touchNum, track);
    const token = randomUUID();

    // Embed tracking token into HTML (for email open pixel)
    const htmlWithTracking = html.replace(
      /src="[^"]*\/api\/track\/open\/[^"]*"/,
      `src="${process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com"}/api/track/open/${token}"`
    );

    // Find matching SMS trigger event and link it
    const smsTriggerCondition = touchNum === 1 ? "sms_trigger_1" : touchNum === 3 ? "sms_trigger_7" : null;
    let smsTriggerEventId: string | undefined;
    if (smsTriggerCondition) {
      const [smsEvent] = await db.select({ id: outreachSequenceEvents.id })
        .from(outreachSequenceEvents)
        .where(and(
          eq(outreachSequenceEvents.leadId, lead.id),
          sql`metadata->>'condition' = ${smsTriggerCondition}`,
          eq(outreachSequenceEvents.status, "scheduled"),
        ))
        .limit(1);
      smsTriggerEventId = smsEvent?.id;
      if (smsEvent) {
        await db.update(outreachSequenceEvents)
          .set({ metadata: { ...(smsEvent as any).metadata, smsTriggerEventId: undefined, linkedEmailToken: token } as any })
          .where(eq(outreachSequenceEvents.id, smsEvent.id));
      }
    }

    const result = await sendEmail({ to: lead.email, subject, html: htmlWithTracking, text });
    await markEvent(event.id, result.success ? "sent" : "failed", {
      notes: result.error,
      metadata: { ...meta, subject, trackingToken: token, smsTriggerEventId } as any,
      executedAt: new Date(),
    });
  }
}

// ─── Force-execute a single event (manual override, bypasses all condition checks) ───

export async function forceExecuteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  const [event] = await db.select().from(outreachSequenceEvents)
    .where(eq(outreachSequenceEvents.id, eventId)).limit(1);
  if (!event) return { success: false, message: "Event not found" };

  const [lead] = await db.select().from(outreachLeads)
    .where(eq(outreachLeads.id, event.leadId)).limit(1);
  if (!lead) return { success: false, message: "Lead not found" };

  if (lead.optedOut) return { success: false, message: "Lead has opted out — cannot send" };

  // Reset event to scheduled so executeEvent can mark it as sent/failed
  await db.update(outreachSequenceEvents)
    .set({ status: "scheduled", scheduledAt: new Date(), updatedAt: new Date() })
    .where(eq(outreachSequenceEvents.id, eventId));

  const freshEvent = { ...event, status: "scheduled", scheduledAt: new Date() } as OutreachSequenceEvent;

  // Build a version of the event with no conditions so executeEvent won't skip it
  const meta = (freshEvent.metadata ?? {}) as any;
  const forceEvent: OutreachSequenceEvent = {
    ...freshEvent,
    metadata: {
      ...meta,
      condition: null,               // bypass all condition guards
      _manualOverride: true,
    } as any,
  };

  try {
    await executeEvent(forceEvent, lead);
    const [updated] = await db.select({ status: outreachSequenceEvents.status, notes: outreachSequenceEvents.notes })
      .from(outreachSequenceEvents).where(eq(outreachSequenceEvents.id, eventId)).limit(1);
    return { success: true, message: `Executed: ${updated?.status ?? "sent"} — ${updated?.notes ?? ""}` };
  } catch (err: any) {
    await db.update(outreachSequenceEvents)
      .set({ status: "failed", notes: err.message, updatedAt: new Date() })
      .where(eq(outreachSequenceEvents.id, eventId));
    return { success: false, message: err.message };
  }
}

// ─── Process due events (cron) ────────────────────────────────────────────────

export async function processSequenceEvents(): Promise<void> {
  const now = new Date();

  // Get all scheduled events that are due
  const dueEvents = await db.select().from(outreachSequenceEvents)
    .where(and(
      eq(outreachSequenceEvents.status, "scheduled"),
      lte(outreachSequenceEvents.scheduledAt, now),
    ))
    .limit(50);

  if (dueEvents.length === 0) return;
  console.log(`[BrokerSequence] Processing ${dueEvents.length} due event(s)`);

  // Load unique leads
  const leadIds = [...new Set(dueEvents.map(e => e.leadId))];
  const leads = await db.select().from(outreachLeads).where(inArray(outreachLeads.id, leadIds));
  const leadMap = new Map(leads.map(l => [l.id, l]));

  for (const event of dueEvents) {
    const lead = leadMap.get(event.leadId);
    if (!lead) { await markEvent(event.id, "failed", { notes: "Lead not found", executedAt: new Date() }); continue; }
    try {
      await executeEvent(event, lead);
    } catch (err: any) {
      console.error(`[BrokerSequence] Error executing event ${event.id}:`, err.message);
      await markEvent(event.id, "failed", { notes: err.message?.slice(0, 300), executedAt: new Date() });
    }
  }
}

// ─── Get timeline for a lead ──────────────────────────────────────────────────

export async function getLeadTimeline(leadId: string): Promise<OutreachSequenceEvent[]> {
  return db.select().from(outreachSequenceEvents)
    .where(eq(outreachSequenceEvents.leadId, leadId))
    .orderBy(outreachSequenceEvents.scheduledAt);
}
