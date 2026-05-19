/**
 * Autonomous Outreach Agent Service
 * Daily loop: Source → Score → Plan → Execute → Critique
 * All message drafts require human approval before sending.
 */

import { db } from "./db";
import {
  leadCampaigns, leadSources, leadScores, outreachTouches, outreachLeads,
  voiceProfiles, outreachActivityLog,
} from "@shared/schema";
import { eq, desc, and, gte, lt, sql, count, not, inArray } from "drizzle-orm";
import { notifyDraftPending, notifyBlocker } from "./agent-sms-service";
import { buildLanguageInstructions, getLanguageLabel } from "./language-detection";
import { randomUUID } from "crypto";

const APP_BASE = () => process.env.APP_BASE_URL ?? "https://newdawnfranchising.replit.app";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5";

// ─── Claude Helper ────────────────────────────────────────────────────────────

async function callClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string,
  maxTokens = 2048,
): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
}

function stripFences(raw: string): string {
  return raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ─── System Prompts ────────────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are Dylan's head of outreach at New Dawn Franchising. Your only goal is to book qualified Zoom meetings with prospects who can realistically refer E-2 visa franchise clients. You think like a sharp BDR who deeply respects the recipient's time and inbox.

HARD RULES you will never break:
- Every message must be genuinely personalized with something specific about the recipient — no mail-merge-flavored fake personalization
- Every email must include one-click unsubscribe and a physical address (CAN-SPAM)
- WhatsApp first touches require an approved Business template; free-form only after they reply
- LinkedIn is DRAFT ONLY — a human sends it, never the agent
- Forum posts must be substantively helpful, never thinly-veiled ads
- Never impersonate Dylan in a way that misleads on material facts; the voice is his but the content must be truthful
- If a recipient asks to stop, pause the entire sequence across all channels immediately
- Respect per-channel daily send caps and per-contact cooldowns (max 1 touch per 3 days, max 5 touches per sequence)
- Respect local business hours for WhatsApp

STRATEGY PRINCIPLES:
- Reply-generating activity beats volume. One thoughtful touch > ten generic ones.
- First touches ask for a reply, not a meeting. Meetings come in touch 2 or 3 after engagement.
- Positive replies ALWAYS surface to the human before sending the booking message — never auto-book.
- When a channel is underperforming (low reply rate over the last 14 days), shift budget away from it and propose testing a new angle.
- When reply volume is high, prioritize handle_reply actions over sourcing new first touches.
- If you lack a resource (Apollo credits, approved WhatsApp template, compliance clearance for a new geo), emit request_blocker instead of guessing.

Given campaign state, recent performance, and today's top-scored leads, return a JSON array of 1–25 actions for today. Respond with ONLY valid JSON — no prose, no markdown fences.

Schema per action:
{
  "action_type": "draft_first_touch" | "draft_follow_up" | "handle_reply" | "book_meeting" | "draft_forum_engagement" | "draft_linkedin_message" | "pause_sequence" | "request_blocker",
  "contact_id": "<id or null for campaign-level actions>",
  "sequence_id": "<id or null>",
  "channel": "email" | "whatsapp" | "sms" | "linkedin_draft" | "forum_draft" | "none",
  "rationale": "<why this action now, grounded in the data — min 20 chars>",
  "expected_impact": "low" | "medium" | "high",
  "payload": { <action-specific fields> }
}

Payload examples:
- draft_first_touch: { "personalization_hook": "her recent LinkedIn post about E-2 processing times", "angle": "offer to share our franchise vetting checklist" }
- handle_reply: { "reply_id": "...", "sentiment": "interested", "suggested_response_summary": "thank, offer Calendly link, ask one qualifying question" }
- request_blocker: { "type": "credentials_needed", "service": "Apollo", "reason": "Monthly credits exhausted", "instructions_for_user": "Top up at apollo.io/billing" }`;

// ─── Planner Context Builder ───────────────────────────────────────────────────

function buildPlannerMessage(ctx: {
  campaign: Record<string, unknown>;
  weeklyPerformance: { meetings_booked: number; replies: number; touches_sent: number; reply_rate: number };
  channelStats: Record<string, { sent: number; replied: number; reply_rate: number; meetings: number }>;
  topLeads: Array<Record<string, unknown>>;
  pendingReplies: Array<{ id: string; contact_id: string; channel: string; reply_preview?: string }>;
  activeSequences: Array<{ id: string; contact_id: string; current_step: number; last_touch_days_ago: number; status: string }>;
  openBlockers: Array<{ service: string; reason: string }>;
  sendCapsRemaining: Record<string, number>;
}): string {
  const { campaign, weeklyPerformance: perf, channelStats, topLeads, pendingReplies, activeSequences, openBlockers, sendCapsRemaining } = ctx;

  const perfSummary = `
  Weekly goal: ${campaign.weekly_meeting_goal ?? campaign.weeklyMeetingGoal ?? 5} meetings
  Booked this week: ${perf.meetings_booked}
  Replies this week: ${perf.replies}
  Touches sent this week: ${perf.touches_sent}
  Reply rate: ${(perf.reply_rate * 100).toFixed(1)}%`;

  const channelBreakdown = Object.entries(channelStats)
    .map(([ch, s]) => `  ${ch}: ${s.sent} sent, ${s.replied} replied (${(s.reply_rate * 100).toFixed(1)}%), ${s.meetings} meetings`)
    .join("\n");

  const leadsList = topLeads.slice(0, 20)
    .map(l => `  - ${l.id} | ${l.fullName ?? l.first_name + " " + l.last_name}, ${l.title ?? l.job_title} @ ${l.company ?? l.firm_name} (${l.country ?? l.location ?? ""}) | score ${l.score ?? l.lead_score ?? 0} | ${l.scoreRationale ?? l.score_rationale ?? ""}`)
    .join("\n") || "  (no new leads — source more or focus on replies)";

  const repliesList = pendingReplies.slice(0, 15)
    .map(r => `  - reply_id ${r.id} | contact ${r.contact_id} | channel ${r.channel} | preview: "${(r.reply_preview ?? "").slice(0, 120)}"`)
    .join("\n") || "  (none pending)";

  const sequencesList = activeSequences.slice(0, 20)
    .map(s => `  - seq ${s.id} | contact ${s.contact_id} | step ${s.current_step}/5 | last touch ${s.last_touch_days_ago}d ago | status ${s.status}`)
    .join("\n") || "  (no active sequences)";

  const blockersList = openBlockers.length
    ? openBlockers.map(b => `  - ${b.service}: ${b.reason}`).join("\n")
    : "  (none)";

  const capsList = Object.entries(sendCapsRemaining)
    .map(([ch, remaining]) => `  ${ch}: ${remaining} sends remaining today`)
    .join("\n");

  return `CAMPAIGN
  ID: ${campaign.id}
  Name: ${campaign.name}
  Persona target: ${JSON.stringify(campaign.personaTarget ?? campaign.persona_target)}
  Channels enabled: ${JSON.stringify(campaign.channelsEnabled ?? campaign.channels_enabled)}

WEEKLY PERFORMANCE${perfSummary}

CHANNEL BREAKDOWN (last 14 days)
${channelBreakdown || "  (no data yet)"}

SEND CAPS REMAINING TODAY
${capsList}

TOP-SCORED LEADS READY FOR FIRST TOUCH
${leadsList}

PENDING REPLIES NEEDING HANDLING (prioritize these)
${repliesList}

ACTIVE SEQUENCES (candidates for follow-up)
${sequencesList}

OPEN BLOCKERS
${blockersList}

Plan today's actions. Handle pending replies first, then follow-ups on warm sequences, then first touches on top leads — within the send caps. Stop proposing actions when you've hit the caps or when additional volume would hurt reply quality.`;
}

// ─── Send Cap Enforcement ─────────────────────────────────────────────────────

type PlannedAction = {
  action_type: string;
  contact_id: string | null;
  sequence_id?: string | null;
  channel: string;
  rationale: string;
  expected_impact: string;
  payload: Record<string, unknown>;
};

const ACTION_PRIORITY: Record<string, number> = {
  handle_reply: 0,
  book_meeting: 1,
  pause_sequence: 2,
  request_blocker: 3,
  draft_follow_up: 4,
  draft_first_touch: 5,
  draft_forum_engagement: 6,
  draft_linkedin_message: 7,
};

function enforceSendCaps(
  actions: PlannedAction[],
  capsRemaining: Record<string, number>,
): { actions: PlannedAction[]; dropped: Array<{ action: PlannedAction; reason: string }> } {
  const caps = { ...capsRemaining };
  const kept: PlannedAction[] = [];
  const dropped: Array<{ action: PlannedAction; reason: string }> = [];

  const sorted = [...actions].sort(
    (a, b) => (ACTION_PRIORITY[a.action_type] ?? 99) - (ACTION_PRIORITY[b.action_type] ?? 99),
  );

  for (const action of sorted) {
    const countsAgainstCap = ["email", "whatsapp", "sms"].includes(action.channel);
    if (!countsAgainstCap) { kept.push(action); continue; }
    if ((caps[action.channel] ?? 0) > 0) {
      kept.push(action);
      caps[action.channel] -= 1;
    } else {
      dropped.push({ action, reason: `${action.channel} daily cap reached` });
    }
  }

  return { actions: kept, dropped };
}

// ─── Voice Drafter ────────────────────────────────────────────────────────────

type VoiceProfile = { toneRules?: string | null; doNotSay?: string[] | null; signatureBlock?: string | null; sampleMessages?: unknown };

type DraftChannel = "email" | "whatsapp" | "linkedin_draft";
type TouchType = "first_touch" | "follow_up" | "reply_response";

const CHANNEL_RULES: Record<DraftChannel, string> = {
  email: `CHANNEL: EMAIL
- Under 120 words in the body
- Subject line under 55 characters, no clickbait, no ALL CAPS, no emoji
- One clear ask, and that ask is a reply — not a meeting (meetings come in touch 2 or 3)
- Must end with the signature block verbatim`,
  whatsapp: `CHANNEL: WHATSAPP
- Under 400 characters
- No links in the first touch (Meta flags them)
- First touches MUST fit an approved Business template — if you're not sure which template applies, set template_name to null and flag notes_for_human
- Conversational, not formal — WhatsApp is a personal channel
- No signature block`,
  linkedin_draft: `CHANNEL: LINKEDIN DM (draft only — a human will send it)
- Under 280 characters (the sweet spot for LinkedIn reply rates)
- No links (LinkedIn deprioritizes messages with links)
- Reference something from their profile or recent activity
- End with a low-friction question
- No signature block`,
};

const OUTPUT_SCHEMA_HINT: Record<DraftChannel, string> = {
  email: `{"subject": "...", "body": "...", "personalization_hook": "...", "confidence_score": 0-100, "ymyl_flag": false, "notes_for_human": "optional"}`,
  whatsapp: `{"template_name": "<name or null>", "body": "...", "personalization_hook": "...", "confidence_score": 0-100, "notes_for_human": "optional"}`,
  linkedin_draft: `{"body": "...", "personalization_hook": "...", "confidence_score": 0-100, "notes_for_human": "optional"}`,
};

function buildVoiceSystemPrompt(profile: VoiceProfile, channel: DraftChannel = "email", country?: string | null): string {
  const doNotSay = Array.isArray(profile.doNotSay) ? profile.doNotSay : [];
  const samples = Array.isArray(profile.sampleMessages) && (profile.sampleMessages as string[]).length > 0
    ? (profile.sampleMessages as string[]).slice(0, 8).map((s, i) => `SAMPLE ${i + 1}:\n${s}`).join("\n\n")
    : "(no samples yet — use warm, direct, human tone)";

  const customBans = doNotSay.length ? `- ${doNotSay.join("\n- ")}` : "";

  const sig = channel === "email"
    ? `\nMust end with the signature block verbatim:\n---\n${profile.signatureBlock ?? "Dylan Rivera\nFounder, New Dawn Franchising\ndylan@newdawnfranchising.com"}\n---`
    : "";

  const langInstructions = buildLanguageInstructions(country);
  const langBlock = langInstructions
    ? `\n\n━━━ LOCALIZATION — READ THIS FIRST ━━━\n${langInstructions}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  return `You are writing as Dylan, founder of New Dawn Franchising. Your job is to draft outreach messages that sound indistinguishable from messages Dylan writes himself.
${langBlock}

STUDY THESE REAL SAMPLES OF DYLAN'S WRITING — match the cadence, sentence length, vocabulary, warmth, and rhythm:

${samples}

TONE RULES (from Dylan):
${profile.toneRules ?? "Warm, direct, specific, occasional dry humor, never corporate."}

BANNED PHRASES (never use any of these, or close variants):
- "I hope this email finds you well"
- "reaching out" / "reaching out to"
- "circle back" / "touch base" / "quick question"
- "synergies" / "leverage" / "unlock" / "navigate the landscape"
- "per my last email" / "just wanted to" / "following up on my previous"
- "delve" / "dive deep" / "in today's fast-paced world"
- "It's not just X, it's Y" construction
- Em-dash overuse (one per message maximum)
${customBans}

HARD REQUIREMENTS FOR EVERY FIRST TOUCH:
- Open with something specific about THIS recipient (a post, a case, a firm detail, a mutual connection) — generic openers are an automatic rejection
- State your reason for writing in one sentence
- Offer concrete value BEFORE asking for anything
- Low-friction ask: a reply, an opinion, a quick yes/no — not a meeting
- Truthful at all times. You are writing in Dylan's voice, but you will never invent facts, claim things about New Dawn that aren't established, or mislead about prior contact
${CHANNEL_RULES[channel]}${sig}

YMYL FLAG (email only): Set ymyl_flag=true if the message touches immigration law, visa eligibility, tax, or legal outcomes in a way that could be interpreted as advice. A flagged draft requires human review before sending.

CONFIDENCE SCORE: 0–100, honest assessment of how likely this specific message is to get a reply. Below 60 means the personalization is weak or the angle is off — flag it and explain in notes_for_human.

Return ONLY valid JSON matching this exact shape, no markdown fences, no prose:
${OUTPUT_SCHEMA_HINT[channel]}`;
}

// ─── Lead Context Builder ─────────────────────────────────────────────────────

function buildLeadContext(
  lead: Record<string, unknown>,
  campaign: Record<string, unknown>,
  sequenceHistory: Array<{ channel?: string | null; status?: string | null; body?: string | null; replyBody?: string | null }> = [],
): string {
  const history = sequenceHistory.length
    ? sequenceHistory.map((t, i) =>
        `  Touch ${i + 1} (${t.channel ?? "?"}, ${t.status ?? "?"}): ${(t.body ?? "(no body)").slice(0, 200)}${t.replyBody ? `\n  → THEIR REPLY: ${t.replyBody.slice(0, 300)}` : ""}`
      ).join("\n\n")
    : "  (no prior touches — this is a first touch)";

  return `LEAD
  Name: ${lead.fullName ?? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
  Title: ${lead.title ?? lead.job_title ?? "Unknown"}
  Firm: ${lead.company ?? lead.firm_name ?? "Unknown"}
  Location: ${lead.notes ?? lead.city ?? ""}${lead.country ? `, ${lead.country}` : ""}
  LinkedIn: ${lead.linkedinUrl ?? lead.linkedin_url ?? "(not available)"}
  Website: ${lead.website ?? lead.website_url ?? "(not available)"}
  Lead score: ${lead.score ?? lead.lead_score ?? "unscored"}
  Score rationale: ${lead.scoreRationale ?? lead.score_rationale ?? "(none)"}

PERSONALIZATION INTEL (use something specific from here — if nothing is specific enough, set confidence_score below 60 and explain in notes_for_human):
${lead.personalizationIntel ?? lead.personalization_intel ?? lead.notes ?? "  (none gathered — weak personalization ahead)"}

CAMPAIGN CONTEXT
  Why Dylan wants to talk to this persona: ${campaign.personaReason ?? campaign.persona_reason ?? "Referral partner for E-2 visa franchise clients"}
  What Dylan offers that's valuable to them: ${campaign.valueProposition ?? campaign.value_proposition ?? "Access to pre-vetted franchise opportunities ideal for E-2 investors, and a warm referral system that pays per closed deal"}

SEQUENCE HISTORY
${history}`;
}

// ─── Banned-Phrase Lint ───────────────────────────────────────────────────────

const GLOBAL_BANNED_PATTERNS = [
  /\bhope this (email|message) finds you well\b/i,
  /\bjust (wanted|reaching out|checking in)\b/i,
  /\bcircle back\b/i,
  /\btouch base\b/i,
  /\bper my last (email|message)\b/i,
  /\bsynerg(y|ies)\b/i,
  /\bleverage\b/i,
  /\bdelve\b/i,
  /\bunlock the\b/i,
  /\bnavigat(e|ing) the landscape\b/i,
  /\bin today'?s fast-paced\b/i,
  /it'?s not just .{1,40}, it'?s\b/i,
];

function lintForBannedPhrases(body: string, doNotSay: string[] = [], country?: string | null): string[] {
  const issues: string[] = [];
  for (const pattern of GLOBAL_BANNED_PATTERNS) {
    if (pattern.test(body)) issues.push(`banned phrase: ${pattern.source}`);
  }
  for (const phrase of doNotSay) {
    if (body.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`custom banned phrase: "${phrase}"`);
    }
  }
  // Check language-specific banned phrases
  if (country) {
    const { detectLanguageProfile } = require("./language-detection");
    const langProfile = detectLanguageProfile(country);
    if (langProfile) {
      for (const phrase of langProfile.bannedPhrases) {
        const cleanPhrase = phrase.split(" (")[0].toLowerCase();
        if (body.toLowerCase().includes(cleanPhrase)) {
          issues.push(`localization banned phrase: "${phrase}"`);
        }
      }
    }
  }
  const emDashCount = (body.match(/—/g) ?? []).length;
  if (emDashCount > 1) issues.push(`em-dash overuse: ${emDashCount} found`);
  return issues;
}

// ─── Unified Message Drafter ──────────────────────────────────────────────────

export async function draftMessage(opts: {
  campaign: typeof leadCampaigns.$inferSelect;
  lead: typeof outreachLeads.$inferSelect;
  channel: DraftChannel;
  touchType: TouchType;
  sequenceHistory?: Array<{ channel?: string | null; status?: string | null; body?: string | null; replyBody?: string | null }>;
  replyToHandle?: string | null;
  angle?: string | null;
}): Promise<{ touchId: string; subject: string | null; body: string; hook: string; notesForHuman: string | null; ymylFlag: boolean; confidenceScore: number }> {
  const { campaign, lead, channel, touchType, sequenceHistory = [], replyToHandle = null, angle = null } = opts;

  const [profile] = await db.select().from(voiceProfiles)
    .where(eq(voiceProfiles.id, campaign.voiceProfileId ?? "dylan-default")).limit(1);
  const vp = profile ?? { toneRules: null, doNotSay: null, signatureBlock: null, sampleMessages: [] };

  const leadCountry = (lead as any).country ?? null;
  const systemPrompt = buildVoiceSystemPrompt(vp, channel, leadCountry);
  const leadContext = buildLeadContext(
    lead as unknown as Record<string, unknown>,
    campaign as unknown as Record<string, unknown>,
    sequenceHistory,
  );

  const instruction =
    touchType === "first_touch"
      ? `Write a first touch for this lead. Angle suggested by the planner: ${angle ?? "(you choose the strongest angle based on the intel above)"}.`
      : touchType === "follow_up"
        ? `Write a follow-up. Reference the prior touch naturally without being pushy. Do NOT say "just following up", "per my last email", or similar. Offer new value or a new angle.`
        : `Write a response to this reply from the lead:\n\nTHEIR REPLY: ${replyToHandle ?? "(reply body not provided)"}\n\nMatch their energy and length. If they're interested, propose the Calendly link naturally (https://calendly.com/dylan-newdawnfranchising). If they have an objection, address it directly and honestly. If they said no, thank them warmly and close the sequence.`;

  const userMessage = `${leadContext}\n\n${instruction}\n\nDraft the message now and return the JSON.`;

  const doNotSay = Array.isArray(vp.doNotSay) ? vp.doNotSay : [];
  let lastError: Error | null = null;
  let draft: Record<string, unknown> | null = null;
  let lintWarnings: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const extraNote = lintWarnings.length > 0 && attempt > 1
        ? `\n\nIMPORTANT — your previous attempt had these issues, fix them:\n${lintWarnings.map(w => `- ${w}`).join("\n")}`
        : "";
      const raw = await callClaude([{ role: "user", content: userMessage + extraNote }], systemPrompt, 1200);
      const parsed = JSON.parse(stripFences(raw));
      draft = parsed;
      lintWarnings = lintForBannedPhrases(String(parsed.body ?? ""), doNotSay, leadCountry);
      if (lintWarnings.length === 0 || attempt === 3) break;
    } catch (err) {
      lastError = err as Error;
    }
  }

  if (!draft) throw new Error(`Voice drafter failed: ${lastError?.message ?? "unknown"}`);

  const stepNumber = sequenceHistory.length + 1;
  const [touch] = await db.insert(outreachTouches).values({
    contactId: lead.id,
    campaignId: campaign.id,
    channel,
    stepNumber,
    status: "awaiting_approval",
    approvalToken: randomUUID(),
    subject: (draft.subject as string) ?? null,
    body: (draft.body as string) ?? "",
    personalizationHook: (draft.personalization_hook as string) ?? null,
    confidenceScore: (draft.confidence_score as number) ?? null,
    ymylFlag: Boolean(draft.ymyl_flag),
    personalizationNotes: lintWarnings.length > 0 ? `Lint warnings: ${lintWarnings.join("; ")}` : null,
  }).returning();

  return {
    touchId: touch.id,
    subject: (draft.subject as string) ?? null,
    body: (draft.body as string) ?? "",
    hook: (draft.personalization_hook as string) ?? "",
    notesForHuman: (draft.notes_for_human as string) ?? null,
    ymylFlag: Boolean(draft.ymyl_flag),
    confidenceScore: (draft.confidence_score as number) ?? 0,
  };
}

// ─── Thin back-compat wrapper ─────────────────────────────────────────────────
export async function draftFirstTouch(
  campaign: typeof leadCampaigns.$inferSelect,
  lead: typeof outreachLeads.$inferSelect,
  channel: DraftChannel = "email",
): Promise<{ touchId: string; subject: string | null; body: string; hook: string }> {
  const result = await draftMessage({ campaign, lead, channel, touchType: "first_touch" });
  return { touchId: result.touchId, subject: result.subject, body: result.body, hook: result.hook };
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

const SCORER_SYSTEM_PROMPT = `You are a lead scoring specialist for New Dawn Franchising, an E-2 visa franchise consulting firm. Score each prospect 0–100 on how likely they are to refer E-2 visa investor clients to a franchise consultant.

Score factors:
- Persona match (40pts): Do they work with E-2 visa candidates? (immigration attorney = high, generic lawyer = medium)
- Seniority (20pts): Are they a decision-maker or partner? Not a junior associate
- Geographic fit (20pts): UAE, Saudi, Kuwait, Mexico, South Korea = ideal E-2 source countries
- Prestige/reach (10pts): Boutique with strong reputation > large generic firm
- Recency signal (10pts): Recent activity (LinkedIn posts, articles, events) about E-2 visas or US investment

Return JSON: {"score": 0-100, "breakdown": {"persona_match": 0-40, "seniority": 0-20, "geographic_fit": 0-20, "prestige": 0-10, "recency": 0-10}, "rationale": "2-3 sentences"}`;

async function scoreLead(lead: Record<string, unknown>, campaignPersona: Record<string, unknown>): Promise<{ score: number; breakdown: Record<string, number>; rationale: string }> {
  const prompt = `Score this lead for the following outreach campaign.

CAMPAIGN TARGET: ${JSON.stringify(campaignPersona)}

LEAD:
Name: ${lead.fullName}
Title: ${lead.title ?? "Unknown"}
Company: ${lead.company ?? "Unknown"}
Location: ${lead.notes ?? "Unknown"}
Category: ${lead.category ?? "Unknown"}
LinkedIn: ${lead.linkedinUrl ?? "None"}

Return the score JSON now.`;

  const raw = await callClaude([{ role: "user", content: prompt }], SCORER_SYSTEM_PROMPT, 500);
  return JSON.parse(stripFences(raw));
}

// ─── Apollo Lead Sourcing ──────────────────────────────────────────────────────

async function sourceFromApollo(
  persona: { titles?: string[]; industries?: string[]; geos?: string[]; company_size?: string },
  limit = 50,
): Promise<Record<string, unknown>[]> {
  if (!APOLLO_API_KEY) return [];
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        page: 1,
        per_page: Math.min(limit, 25),
        person_titles: persona.titles ?? ["immigration attorney", "immigration lawyer"],
        organization_industry_tag_ids: [],
        person_locations: persona.geos ?? [],
        q_keywords: "E-2 visa",
        contact_email_status: ["verified", "likely to engage"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { people?: Record<string, unknown>[] };
    return data.people ?? [];
  } catch {
    return [];
  }
}

// ─── Classify & Handle Reply ──────────────────────────────────────────────────

const REPLY_CLASSIFIER_PROMPT = `You are classifying an inbound reply to an outreach email sent by Dylan at New Dawn Franchising.

Classify the reply sentiment: "interested" | "objection" | "unsubscribe" | "out_of_office" | "cold"

Then draft Dylan's ideal response (matching his voice — warm, direct, specific, under 100 words).
If sentiment is "interested", DO NOT include a Calendly link — that surfaces for human review first.
If sentiment is "unsubscribe", draft a polite acknowledgment and DO NOT schedule any follow-ups.

Return JSON: {"sentiment": "...", "summary": "1-sentence summary", "draft_response": {"subject": "...", "body": "..."}, "recommended_action": "send_calendly"|"continue_sequence"|"pause_sequence"|"no_action"}`;

export async function handleReply(
  touchId: string,
  replyBody: string,
): Promise<{ sentiment: string; draftResponse: { subject: string; body: string } | null; action: string }> {
  const [touch] = await db.select().from(outreachTouches).where(eq(outreachTouches.id, touchId));
  if (!touch) throw new Error("Touch not found");

  const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, touch.contactId));

  const raw = await callClaude([{
    role: "user",
    content: `Original outreach subject: "${touch.subject}"
Lead: ${lead?.fullName ?? "Unknown"} at ${lead?.company ?? "Unknown"}

REPLY RECEIVED:
${replyBody}

Classify and draft the response.`,
  }], REPLY_CLASSIFIER_PROMPT, 1200);

  const result = JSON.parse(stripFences(raw)) as {
    sentiment: string; summary: string;
    draft_response: { subject: string; body: string };
    recommended_action: string;
  };

  await db.update(outreachTouches).set({
    replyBody,
    replySentiment: result.sentiment,
    replyReceivedAt: new Date(),
    status: "replied",
    updatedAt: new Date(),
  }).where(eq(outreachTouches.id, touchId));

  if (result.sentiment === "unsubscribe") {
    await db.update(outreachLeads).set({ optedOut: true }).where(eq(outreachLeads.id, touch.contactId));
    await db.update(outreachTouches).set({ status: "failed" })
      .where(and(eq(outreachTouches.contactId, touch.contactId), eq(outreachTouches.status, "awaiting_approval")));
  }

  if (result.draft_response && result.sentiment !== "unsubscribe") {
    await db.insert(outreachTouches).values({
      contactId: touch.contactId,
      campaignId: touch.campaignId,
      channel: touch.channel,
      stepNumber: (touch.stepNumber ?? 1) + 1,
      status: "awaiting_approval",
      approvalToken: randomUUID(),
      subject: result.draft_response.subject,
      body: result.draft_response.body,
      personalizationNotes: `Reply to "${touch.subject}". Sentiment: ${result.sentiment}. Action: ${result.recommended_action}`,
    });
  }

  return {
    sentiment: result.sentiment,
    draftResponse: result.draft_response ?? null,
    action: result.recommended_action,
  };
}

// ─── Daily Campaign Loop ───────────────────────────────────────────────────────

export async function runOutreachCampaignLoop(campaignId: string): Promise<{
  success: boolean;
  steps: { step: string; result: string }[];
  error?: string;
}> {
  const steps: { step: string; result: string }[] = [];

  const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
  if (!campaign) return { success: false, steps, error: "Campaign not found" };
  if (campaign.killSwitch) return { success: false, steps: [{ step: "kill_switch", result: "Kill switch active — campaign paused" }] };
  if (campaign.status !== "active") return { success: false, steps: [{ step: "status", result: `Campaign is ${campaign.status}` }] };

  const persona = (campaign.personaTarget ?? {}) as Record<string, unknown>;

  // ── Step 1: Source new leads ──────────────────────────────────────────────
  steps.push({ step: "source", result: "Sourcing leads from Apollo..." });
  try {
    const apolloLeads = await sourceFromApollo(
      persona as { titles?: string[]; industries?: string[]; geos?: string[]; company_size?: string },
      50,
    );

    let newCount = 0;
    for (const p of apolloLeads) {
      const email = (p.email as string) ?? (p.primary_email as string);
      if (!email) continue;

      const existing = await db.select({ id: outreachLeads.id }).from(outreachLeads)
        .where(eq(outreachLeads.email, email)).limit(1);
      if (existing.length > 0) continue;

      await db.insert(outreachLeads).values({
        fullName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown",
        title: (p.title as string) ?? null,
        company: (p.organization_name as string) ?? null,
        email,
        linkedinUrl: (p.linkedin_url as string) ?? null,
        category: "immigration_attorney",
        status: "new",
      });
      newCount++;
    }

    await db.insert(leadSources).values({
      campaignId,
      sourceType: "apollo",
      queryPayload: persona as Record<string, unknown>,
      lastRunAt: new Date(),
      contactsFound: newCount,
    });

    steps[steps.length - 1].result = `Sourced ${newCount} new leads from Apollo (${apolloLeads.length} total found)`;
  } catch (err) {
    steps[steps.length - 1].result = `Sourcing failed: ${(err as Error).message}`;
  }

  // ── Step 2: Score unscoredleads ──────────────────────────────────────────
  steps.push({ step: "score", result: "Scoring new leads..." });
  try {
    const unseeded = await db.select().from(outreachLeads)
      .where(and(eq(outreachLeads.status, "new"), eq(outreachLeads.optedOut, false)))
      .limit(20);

    let scored = 0;
    for (const lead of unseeded) {
      try {
        const result = await scoreLead(lead as unknown as Record<string, unknown>, persona);
        await db.insert(leadScores).values({
          contactId: lead.id,
          campaignId,
          score: result.score,
          scoreBreakdown: result.breakdown as unknown as Record<string, unknown>,
          rationale: result.rationale,
        });
        await db.update(outreachLeads).set({ score: result.score }).where(eq(outreachLeads.id, lead.id));
        scored++;
      } catch { /* skip individual scoring failures */ }
    }
    steps[steps.length - 1].result = `Scored ${scored} leads`;
  } catch (err) {
    steps[steps.length - 1].result = `Scoring failed: ${(err as Error).message}`;
  }

  // ── Step 3: Plan today's actions ─────────────────────────────────────────
  steps.push({ step: "plan", result: "Claude planning today's outreach actions..." });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    weeklyTouches,
    weeklyReplies,
    weeklyMeetings,
    recentTouchesByChannel,
    topLeads,
    pendingReplyTouches,
    activeTouches,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), gte(outreachTouches.sentAt, sevenDaysAgo))),
    db.select({ n: sql<number>`count(*)` }).from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "replied"), gte(outreachTouches.updatedAt, sevenDaysAgo))),
    db.select({ n: sql<number>`count(*)` }).from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "meeting_booked"))),
    db.select({ channel: outreachTouches.channel, status: outreachTouches.status })
      .from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), gte(outreachTouches.createdAt, fourteenDaysAgo)))
      .orderBy(desc(outreachTouches.createdAt)).limit(200),
    db.select().from(outreachLeads)
      .where(and(eq(outreachLeads.status, "new"), eq(outreachLeads.optedOut, false)))
      .orderBy(desc(outreachLeads.score)).limit(20),
    db.select().from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "replied")))
      .orderBy(desc(outreachTouches.updatedAt)).limit(15),
    db.select({ contactId: outreachTouches.contactId, stepNumber: outreachTouches.stepNumber, status: outreachTouches.status, updatedAt: outreachTouches.updatedAt })
      .from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "sent")))
      .orderBy(desc(outreachTouches.updatedAt)).limit(50),
  ]);

  // Aggregate channel stats from last 14 days
  const channelStats: Record<string, { sent: number; replied: number; reply_rate: number; meetings: number }> = {};
  for (const t of recentTouchesByChannel) {
    const ch = t.channel ?? "email";
    if (!channelStats[ch]) channelStats[ch] = { sent: 0, replied: 0, reply_rate: 0, meetings: 0 };
    if (t.status === "sent" || t.status === "replied" || t.status === "meeting_booked") channelStats[ch].sent++;
    if (t.status === "replied") channelStats[ch].replied++;
    if (t.status === "meeting_booked") channelStats[ch].meetings++;
  }
  for (const st of Object.values(channelStats)) {
    st.reply_rate = st.sent > 0 ? st.replied / st.sent : 0;
  }

  const wSent = Number(weeklyTouches[0]?.n ?? 0);
  const wReplies = Number(weeklyReplies[0]?.n ?? 0);
  const weeklyPerformance = {
    meetings_booked: Number(weeklyMeetings[0]?.n ?? 0),
    replies: wReplies,
    touches_sent: wSent,
    reply_rate: wSent > 0 ? wReplies / wSent : 0,
  };

  // Build active sequences from sent touches
  const seqMap = new Map<string, { id: string; contact_id: string; current_step: number; last_touch_days_ago: number; status: string }>();
  for (const t of activeTouches) {
    const daysAgo = Math.floor((Date.now() - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (!seqMap.has(t.contactId) || seqMap.get(t.contactId)!.current_step < (t.stepNumber ?? 1)) {
      seqMap.set(t.contactId, { id: t.contactId, contact_id: t.contactId, current_step: t.stepNumber ?? 1, last_touch_days_ago: daysAgo, status: t.status });
    }
  }

  const pendingReplies = pendingReplyTouches.map(t => ({
    id: t.id, contact_id: t.contactId, channel: t.channel ?? "email",
    reply_preview: (t.replyBody as string | null)?.slice(0, 120) ?? "",
  }));

  // Default send caps (can be configured per campaign later)
  const sendCapsRemaining: Record<string, number> = { email: 50, whatsapp: 20, sms: 30 };

  const plannerMessage = buildPlannerMessage({
    campaign: campaign as unknown as Record<string, unknown>,
    weeklyPerformance,
    channelStats,
    topLeads: topLeads as unknown as Array<Record<string, unknown>>,
    pendingReplies,
    activeSequences: Array.from(seqMap.values()),
    openBlockers: [],
    sendCapsRemaining,
  });

  let plannedActions: PlannedAction[] = [];
  let droppedByCapCount = 0;
  try {
    const raw = await callClaude([{ role: "user", content: plannerMessage }], PLANNER_SYSTEM_PROMPT, 4096);
    const parsed = JSON.parse(stripFences(raw));
    const capped = enforceSendCaps(Array.isArray(parsed) ? parsed : [], sendCapsRemaining);
    plannedActions = capped.actions;
    droppedByCapCount = capped.dropped.length;
    steps[steps.length - 1].result = `Planned ${plannedActions.length} actions${droppedByCapCount > 0 ? ` (${droppedByCapCount} dropped by cap)` : ""}`;
  } catch (err) {
    steps[steps.length - 1].result = `Planning failed: ${(err as Error).message}`;
    plannedActions = [];
  }

  // ── Step 4: Execute planned actions ──────────────────────────────────────
  let executed = 0;
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  for (const action of plannedActions) {
    try {
      // request_blocker: surface as activity log, no lead required
      if (action.action_type === "request_blocker") {
        await db.insert(outreachActivityLog).values({
          leadId: campaignId, // use campaign id as surrogate — blockers are campaign-level
          campaignId,
          channel: "none" as string,
          status: "request_blocker",
          messagePreview: JSON.stringify(action.payload).slice(0, 500),
        });
        executed++;
        continue;
      }

      if (!action.contact_id) continue;
      const [lead] = await db.select().from(outreachLeads)
        .where(eq(outreachLeads.id, action.contact_id)).limit(1);
      if (!lead || lead.optedOut) continue;

      // Per-contact cooldown: no touch in last 3 days
      const [recentTouch] = await db.select({ id: outreachTouches.id }).from(outreachTouches)
        .where(and(eq(outreachTouches.contactId, lead.id), gte(outreachTouches.createdAt, threeDaysAgo))).limit(1);
      if (recentTouch) continue;

      // Max 5 touches per lead across all campaigns
      const [touchCount] = await db.select({ n: sql<number>`count(*)` })
        .from(outreachTouches).where(eq(outreachTouches.contactId, lead.id));
      if (Number(touchCount?.n ?? 0) >= 5) continue;

      if (action.action_type === "draft_first_touch") {
        const ch = (["email", "whatsapp", "linkedin_draft"].includes(action.channel)
          ? action.channel : "email") as DraftChannel;
        await draftMessage({
          campaign, lead, channel: ch, touchType: "first_touch",
          angle: (action.payload.angle as string) ?? null,
        });
        executed++;
      } else if (action.action_type === "draft_follow_up") {
        const ch = (["email", "whatsapp", "linkedin_draft"].includes(action.channel)
          ? action.channel : "email") as DraftChannel;
        // Fetch sequence history for this lead so draftMessage has context
        const history = await db.select({
          channel: outreachTouches.channel,
          status: outreachTouches.status,
          body: outreachTouches.body,
          replyBody: outreachTouches.replyBody,
        }).from(outreachTouches)
          .where(eq(outreachTouches.contactId, lead.id))
          .orderBy(outreachTouches.stepNumber);
        await draftMessage({
          campaign, lead, channel: ch, touchType: "follow_up",
          sequenceHistory: history,
          angle: (action.payload.angle as string) ?? null,
        });
        executed++;
      } else if (action.action_type === "draft_linkedin_message") {
        const angle = (action.payload.angle as string) ?? (action.payload.personalization_hook as string) ?? null;
        await draftMessage({
          campaign, lead, channel: "linkedin_draft", touchType: "first_touch",
          angle,
        });
        executed++;
      } else if (action.action_type === "draft_forum_engagement") {
        await db.insert(outreachTouches).values({
          contactId: lead.id, campaignId, channel: "forum_draft", stepNumber: 1,
          status: "awaiting_approval",
      approvalToken: randomUUID(),
          subject: `Forum Draft — ${action.payload.forum_name ?? "VisaJourney/Reddit"}`,
          body: (action.payload.post_body as string) ?? `[Forum post draft — ${action.rationale}]`,
          personalizationNotes: action.rationale,
        });
        executed++;
      } else if (action.action_type === "pause_sequence") {
        await db.update(outreachLeads).set({ status: "nurture" as any }).where(eq(outreachLeads.id, lead.id));
        await db.update(outreachTouches).set({ status: "paused" as any, updatedAt: new Date() })
          .where(and(eq(outreachTouches.contactId, lead.id), eq(outreachTouches.status, "awaiting_approval")));
        executed++;
      }
    } catch { /* skip individual execution failures */ }
  }

  if (plannedActions.length > 0) {
    steps.push({ step: "execute", result: `Drafted ${executed} touches awaiting your approval` });
  }

  // ── Step 5: End-of-day critique ──────────────────────────────────────────
  steps.push({ step: "critique", result: "Writing daily retrospective..." });
  try {
    const [sentCount] = await db.select({ n: sql<number>`count(*)` }).from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "sent")));
    const [repliedCount] = await db.select({ n: sql<number>`count(*)` }).from(outreachTouches)
      .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "replied")));

    const critiquePrompt = `Write a 3-sentence outreach performance summary for campaign "${campaign.name}".

Stats: ${sentCount?.n ?? 0} total sent, ${repliedCount?.n ?? 0} replies, ${campaign.meetingsBookedThisWeek ?? 0}/${campaign.weeklyMeetingGoal ?? 5} meetings booked this week.
Actions drafted today: ${executed}

Include: what's working, what the reply rate suggests, top priority for tomorrow.`;

    const retro = await callClaude([{ role: "user", content: critiquePrompt }], "", 400);
    steps[steps.length - 1].result = retro;
  } catch {
    steps[steps.length - 1].result = "Critique skipped";
  }

  // ── SMS Notifications ────────────────────────────────────────────────────
  try {
    if (executed > 0) {
      const base = APP_BASE();
      // Fetch the freshly-created touches with their approval tokens
      const pendingTouches = await db.select({
        id: outreachTouches.id,
        channel: outreachTouches.channel,
        subject: outreachTouches.subject,
        approvalToken: outreachTouches.approvalToken,
        contactId: outreachTouches.contactId,
      }).from(outreachTouches)
        .where(and(eq(outreachTouches.campaignId, campaignId), eq(outreachTouches.status, "awaiting_approval")));

      for (const t of pendingTouches.slice(0, 3)) {
        const approvalUrl = t.approvalToken
          ? `${base}/approve/outreach/${t.approvalToken}`
          : `${base}/agent`;
        const label = t.subject ?? `${t.channel} outreach`;
        await notifyDraftPending(
          "outreach",
          label,
          approvalUrl,
          `Campaign: "${campaign.name}" · Tap to preview the message and approve or reject.`,
        );
        if (pendingTouches.indexOf(t) < Math.min(pendingTouches.length, 3) - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (pendingTouches.length > 3) {
        await notifyDraftPending("outreach", `${pendingTouches.length - 3} more touch(es) pending`, `${base}/agent`);
      }
    }
    // Notify on request_blocker actions
    const blockerActions = plannedActions.filter((a: any) => a.action_type === "request_blocker");
    for (const b of blockerActions.slice(0, 2)) {
      await notifyBlocker("outreach", (b.payload.service as string) ?? "Outreach blocker", b.rationale);
    }
  } catch (smsErr) {
    console.warn("[Outreach Agent SMS]", smsErr);
  }

  return { success: true, steps };
}

// ─── Approve & Send a Touch ───────────────────────────────────────────────────

export async function approveAndSendTouch(touchId: string): Promise<{ sent: boolean; channel: string; error?: string }> {
  const [touch] = await db.select().from(outreachTouches).where(eq(outreachTouches.id, touchId));
  if (!touch) throw new Error("Touch not found");

  const [lead] = await db.select().from(outreachLeads).where(eq(outreachLeads.id, touch.contactId));

  const body = touch.body ?? "";
  let deliveryError: string | undefined;

  // ── Actually deliver the message ──────────────────────────────────────────
  if (touch.channel === "whatsapp") {
    if (!lead?.phone) {
      deliveryError = "Lead has no phone number";
    } else {
      const { sendWhatsAppMessage } = await import("./meta-whatsapp-service");
      const result = await sendWhatsAppMessage(lead.phone, body);
      if (!result.success) deliveryError = result.error ?? "WhatsApp send failed";
    }
  } else if (touch.channel === "email") {
    if (!lead?.email) {
      deliveryError = "Lead has no email address";
    } else {
      const { sendEmailFromSender } = await import("./email-service");
      const DYLAN_EMAIL = "dylan@newdawnfranchising.com";
      const htmlBody = body.replace(/\n/g, "<br/>");
      const result = await sendEmailFromSender(DYLAN_EMAIL, lead.email, touch.subject ?? "Following up", htmlBody);
      if (!result) deliveryError = "Email send returned falsy result";
    }
  } else if (touch.channel === "sms") {
    if (!lead?.phone) {
      deliveryError = "Lead has no phone number";
    } else {
      // SMS via Quo outreach agent number (PNRyMRwwud = 808-460-6509)
      const QUO_API_KEY = process.env.QUO_API_KEY || "";
      const OUTREACH_PHONE_ID = "PNRyMRwwud";
      if (!QUO_API_KEY) {
        deliveryError = "QUO_API_KEY not configured";
      } else {
        const phone = lead.phone.startsWith("+") ? lead.phone : `+${lead.phone.replace(/\D/g, "")}`;
        const res = await fetch("https://api.openphone.com/v1/messages", {
          method: "POST",
          headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ content: body, from: OUTREACH_PHONE_ID, to: [phone] }),
        });
        if (!res.ok) {
          const err = await res.json() as { message?: string };
          deliveryError = err.message ?? `Quo API error ${res.status}`;
        }
      }
    }
  }
  // linkedin_draft and forum_draft are manual — no automated delivery

  const newStatus = deliveryError ? "failed" : "sent";

  await db.update(outreachTouches).set({
    status: newStatus,
    sentAt: deliveryError ? null : new Date(),
    updatedAt: new Date(),
  }).where(eq(outreachTouches.id, touchId));

  await db.insert(outreachActivityLog).values({
    leadId: touch.contactId,
    campaignId: touch.campaignId,
    channel: touch.channel,
    sentAt: deliveryError ? null : new Date(),
    status: newStatus,
    messagePreview: deliveryError ? `FAILED: ${deliveryError}` : body.slice(0, 200),
  });

  if (!deliveryError && lead?.status === "new") {
    await db.update(outreachLeads).set({ status: "active" }).where(eq(outreachLeads.id, touch.contactId));
  }

  if (deliveryError) {
    throw new Error(deliveryError);
  }

  return { sent: true, channel: touch.channel };
}

// ─── Campaign Stats ───────────────────────────────────────────────────────────

export async function getCampaignStats(campaignId: string) {
  const [campaign] = await db.select().from(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
  if (!campaign) return null;

  const [stats] = await db.select({
    totalDrafted: sql<number>`count(*)`,
    sent: sql<number>`count(*) filter (where status = 'sent')`,
    replied: sql<number>`count(*) filter (where status = 'replied')`,
    pending: sql<number>`count(*) filter (where status = 'awaiting_approval')`,
    linkedin: sql<number>`count(*) filter (where channel = 'linkedin_draft')`,
    forum: sql<number>`count(*) filter (where channel = 'forum_draft')`,
  }).from(outreachTouches).where(eq(outreachTouches.campaignId, campaignId));

  return {
    campaign,
    stats: {
      totalDrafted: Number(stats?.totalDrafted ?? 0),
      sent: Number(stats?.sent ?? 0),
      replied: Number(stats?.replied ?? 0),
      pending: Number(stats?.pending ?? 0),
      replyRate: stats?.sent ? Math.round((Number(stats.replied) / Number(stats.sent)) * 100) : 0,
      meetingsBookedThisWeek: campaign.meetingsBookedThisWeek ?? 0,
      weeklyGoal: campaign.weeklyMeetingGoal ?? 5,
      linkedinQueue: Number(stats?.linkedin ?? 0),
      forumQueue: Number(stats?.forum ?? 0),
    },
  };
}
