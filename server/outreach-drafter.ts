/**
 * outreach-drafter.ts  (Phase 4 — search → personalized multichannel outreach)
 * ───────────────────────────────────────────────────────────────────────────
 * Turns a scored prospect into ready-to-send, persona-aware outreach (email or
 * LinkedIn), grounded in WHY they matched (ICP reasons) and any buying-intent
 * signals ("congrats on the funding / saw you're exploring US options"). This
 * closes the loop from AI search → outreach, the heart of an Alta-Katie-style
 * SDR, and reuses New Dawn's positioning + the existing campaign infrastructure
 * for the actual send/enroll step.
 *
 * Graceful: no ANTHROPIC_API_KEY → returns a clear, still-usable fallback draft.
 */

const MODEL = "claude-sonnet-4-6";

export type OutreachChannel = "email" | "linkedin";

export interface DraftInput {
  fullName: string;
  firstName?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  country?: string | null;
  channel: OutreachChannel;
  audience?: "investor" | "partner" | "unknown";
  reasons?: string[];
  explanation?: string | null;
  signals?: Array<{ title: string; snippet?: string | null }>;
}

export interface DraftResult {
  channel: OutreachChannel;
  subject: string | null;   // null for LinkedIn
  body: string;
  fallback?: boolean;
}

const POSITIONING = `New Dawn Franchising is the first franchise platform built for E-2 Treaty Investor Visa candidates. International investors own and direct a real US business (Property Management, Telecom/VOIP, or Insurance) while New Dawn's teams + proprietary AI run day-to-day operations. ~$225,000 qualifying investment held in escrow, money-back if the visa is denied, live anywhere in the USA, in-house buy-back exit. Referral partners (immigration attorneys, visa consultants, wealth managers, business brokers) earn ~12.5% (~$28,125) per referred investor who closes.`;

function systemPrompt(channel: OutreachChannel, audience: string): string {
  const aud = audience === "partner"
    ? "This person is a potential REFERRAL PARTNER (they advise international clients who may need an E-2 path). Pitch the partnership/referral fee and how we make their clients' US move turnkey — NOT a personal investment."
    : audience === "investor"
      ? "This person is a potential INVESTOR (an international/HNW individual who may want US business ownership + an E-2 visa). Pitch the turnkey franchise + visa path."
      : "Infer from their title/company whether they're a potential investor or a referral partner, and pitch accordingly.";
  return `You are Dylan Delaney, founder of New Dawn Franchising, writing a single ${channel === "email" ? "cold email" : "LinkedIn connection message"} to one prospect.

ABOUT NEW DAWN: ${POSITIONING}

WHO YOU'RE WRITING TO: ${aud}

RULES:
- Warm, human, specific — never salesy or templated. Sound like a sharp founder who respects their time.
- Open with a genuine, specific hook drawn from the "why they matched" reasons / signals provided. If a buying-intent signal is given (e.g. relocation, exploring US business, a recent event), reference it naturally.
- ${channel === "email" ? "Keep it under ~120 words. One clear, low-friction ask (a quick reply or a 15-min call)." : "Keep it under ~300 characters (LinkedIn limit). No links. One light ask to connect."}
- Don't over-claim or give legal/immigration advice. No "I hope this email finds you well", no "just following up".
- Sign as "Dylan Delaney, New Dawn Franchising".
- Output ONLY a JSON object: ${channel === "email" ? `{"subject": string, "body": string}` : `{"body": string}`}. No prose, no code fences.`;
}

function userPrompt(input: DraftInput): string {
  const lines = [
    `Prospect: ${input.fullName}`,
    input.jobTitle ? `Title: ${input.jobTitle}` : "",
    input.companyName ? `Company: ${input.companyName}` : "",
    input.country ? `Country: ${input.country}` : "",
    input.reasons?.length ? `Why they matched: ${input.reasons.join("; ")}` : "",
    input.explanation ? `Summary: ${input.explanation}` : "",
    input.signals?.length ? `Recent signals:\n${input.signals.slice(0, 3).map((s) => `- ${s.title}${s.snippet ? ` — ${s.snippet}` : ""}`).join("\n")}` : "",
  ].filter(Boolean);
  return `${lines.join("\n")}\n\nWrite the ${input.channel} now and return the JSON.`;
}

function fallbackDraft(input: DraftInput): DraftResult {
  const first = input.firstName || input.fullName.split(" ")[0] || "there";
  const hook = input.reasons?.[0] ? ` — I noticed ${input.reasons[0].toLowerCase()}` : "";
  if (input.channel === "linkedin") {
    return {
      channel: "linkedin",
      subject: null,
      body: `Hi ${first}${hook}. I run New Dawn Franchising — we help international investors own a turnkey US business on an E-2 visa. Would love to connect. — Dylan Delaney`,
      fallback: true,
    };
  }
  return {
    channel: "email",
    subject: "A turnkey US business + E-2 visa path",
    body: `Hi ${first},\n\nI'm Dylan, founder of New Dawn Franchising${hook}. We help international investors own and direct a real US business (with our team + AI running operations) on an E-2 visa — ~$225k held in escrow, money-back if the visa is denied.\n\nWorth a quick 15-minute call to see if it fits?\n\nDylan Delaney, New Dawn Franchising`,
    fallback: true,
  };
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function draftProspectOutreach(input: DraftInput): Promise<DraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackDraft(input);
  const audience = input.audience || "unknown";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: systemPrompt(input.channel, audience),
        messages: [{ role: "user", content: userPrompt(input) }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    const parsed = JSON.parse(stripFences(text));
    const body = String(parsed.body ?? "").trim();
    if (!body) return fallbackDraft(input);
    return {
      channel: input.channel,
      subject: input.channel === "email" ? (parsed.subject ? String(parsed.subject) : null) : null,
      body,
    };
  } catch (err: any) {
    console.error("[outreach-drafter] draft failed, using fallback:", err?.message || err);
    return fallbackDraft(input);
  }
}
