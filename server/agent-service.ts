import { db } from "./db";
import { agentLeads, agentMessages, agentDailyBatches, agentForumPosts, agentSettings, agentRunLogs, agentDnc } from "../shared/schema";
import { eq, and, sql, desc, lt, isNull, or } from "drizzle-orm";
import { sendEmailFromSender } from "./email-service";
import { verifyEmail } from "./zerobounce-service";
import { lookupPhone } from "./twilio-lookup";
import { extractPhoneFromText } from "./people-finder";
import { seamlessFindPeople } from "./seamless-service";
import { hunterFindEmail } from "./hunter-service";
import { ImapFlow } from "imapflow";
import { monitorReddit, monitorQuora } from "./apify-service";
import { scanForumsForOpportunities } from "./forum-scanner";
import {
  notifyPreparationComplete, notifyDailyBriefSent,
  notifyBatchExecuted, notifyApprovalDeadline,
} from "./slack-service";
import { sendAgentSms } from "./agent-sms-service";
import { buildLanguageInstructions, getLanguageLabel } from "./language-detection";
import { createLazyOpenAIClient } from "./openai-client";

const openai = createLazyOpenAIClient();

const DYLAN_EMAIL = "dylan@newdawnfranchising.com";
const FROM_EMAIL = "dylan@newdawnfranchising.com";
const BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || "https://newdawnfranchising.replit.app";
const AGENT_PORTAL = `${BASE_URL}/agent`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

async function getSettings() {
  const rows = await db.select().from(agentSettings).limit(1);
  return rows[0] ?? null;
}

async function logRun(type: string, status: string, summary?: any, tasks?: any[]) {
  await db.insert(agentRunLogs).values({
    runType: type,
    status,
    summary: summary ?? null,
    tasksLog: tasks ? tasks : null,
    completedAt: status !== "running" ? new Date() : null,
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── DNC Check ──────────────────────────────────────────────────────────────

export async function isOnDnc(email?: string | null, phone?: string | null, domain?: string | null): Promise<boolean> {
  const conditions: any[] = [];
  if (email) conditions.push(eq(agentDnc.email, email));
  if (phone) conditions.push(eq(agentDnc.phone, phone));
  if (domain) {
    const d = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    conditions.push(eq(agentDnc.domain, d));
  }
  if (conditions.length === 0) return false;
  const rows = await db.select().from(agentDnc).where(or(...conditions)).limit(1);
  return rows.length > 0;
}

export async function addToDnc(email?: string, phone?: string, domain?: string, reason?: string) {
  await db.insert(agentDnc).values({ email, phone, domain, reason });
}

// Lift suppression for an address — used when the user deliberately resends to
// a contact (e.g. a manual "Reprocess"), so the address can receive mail again.
export async function removeFromDnc(email?: string | null) {
  if (!email) return;
  await db.delete(agentDnc).where(eq(agentDnc.email, email));
}

// ─── Lead Score (AI) ────────────────────────────────────────────────────────

async function scoreLeadWithAI(lead: any, settings: any): Promise<{ score: number; reasoning: string }> {
  try {
    const prompt = `Score this REFERRAL PARTNER lead for New Dawn Franchising on a scale of 0-100.
New Dawn Franchising sells US property management franchises (~$225K investment) as an E-2 Treaty Investor Visa pathway.
WE ARE NOT pitching the recipient on buying a franchise. We are finding people who REFER wealthy international clients to us.
Higher scores = more likely to be a strong referral partner who regularly works with high-net-worth foreign nationals seeking US residency/investment options.

Lead info:
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title || "Unknown"}
- Company: ${lead.company || "Unknown"}
- Country: ${lead.country || "Unknown"}
- Source: ${lead.source}
- Notes: ${lead.notes || "None"}

IDEAL referral partners (score 70-100):
- Immigration attorneys and law firms (E-2/EB-5 specialty)
- Business brokers and M&A advisors working with international buyers
- Franchise brokers and franchise consultants
- Wealth managers, private bankers, financial advisors serving HNW international clients
- International relocation consultants
- Chambers of commerce for expat/immigrant communities (Korean, Chinese, Mexican, Indian, etc.)
- International real estate agents handling commercial/investment properties

POOR fit (score 0-30 — these people need referrals themselves, they don't give them):
- Random CEOs, founders, entrepreneurs in unrelated industries (IT, construction, retail, manufacturing)
- Startup founders or tech company executives
- Print shop owners, restaurant owners, EV charging businesses
- Anyone whose business has nothing to do with finance, immigration, relocation, or professional services for HNW individuals

Scoring criteria:
- Referral partner fit (do they serve wealthy foreign nationals regularly?): 0-40 pts
- Industry relevance (immigration, finance, brokerage, relocation): 0-30 pts
- Geographic network in E-2 treaty countries: 0-20 pts
- Seniority/decision-maker status: 0-10 pts

Reply with JSON: {"score": number, "reasoning": "2 sentences max"}`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 150,
    });
    return JSON.parse(res.choices[0].message.content || '{"score":50,"reasoning":"Default score"}');
  } catch {
    return { score: 50, reasoning: "Could not score at this time." };
  }
}

// ─── Message Drafting (AI) ──────────────────────────────────────────────────

async function draftOutreachEmail(lead: any, touchNumber: number, settings: any): Promise<{ subject: string; body: string }> {
  const voiceSamples = (settings?.dylanVoiceSamples ?? []).join("\n\n");
  const calendly = settings?.calendlyLink || "https://calendly.com/dylan-newdawn/intro";
  const bio = settings?.dylanBio || "Dylan Delaney, Director of Franchise Development at New Dawn Franchising, helps wealthy foreign nationals buy US property management franchises (~$225K investment) as an E-2 Treaty Investor Visa pathway. New Dawn works with referral partners — immigration attorneys, business brokers, wealth managers, and relocation consultants — who introduce their international clients looking for a US visa-qualifying investment.";

  const touchInstructions: Record<number, string> = {
    1: `Touch 1 — Soft intro to a REFERRAL PARTNER. Max 120 words. Dylan introduces himself and explains that he works with professionals like them whose clients are wealthy foreign nationals seeking US investment opportunities. He's NOT asking them to buy anything — he wants to explore whether their clients might benefit from New Dawn's franchise-based E-2 visa pathway. Ask ONE genuine question about their international client base. No pitch. Warm, collegial tone (professional to professional).`,
    2: `Touch 2 — Value add for a REFERRAL PARTNER. Max 160 words. Share something genuinely useful: how the E-2 franchise pathway works for their clients, a success story of a client who got their E-2 visa through a franchise purchase, or key data about the property management franchise opportunity ($225K investment, turnkey, qualifies for E-2 visa). Position this as a tool they can offer their clients. Still no hard ask.`,
    3: `Touch 3 — Direct ask for a REFERRAL PARTNER. Max 180 words. Invite them to a 20-minute Zoom call with Dylan to see if there's a fit for referring clients. Include the Calendly link: ${calendly}. Light urgency (limited El Paso territories available). Frame as: "I'd love to show you exactly how this works so you can decide if it's something worth mentioning to your clients."`,
    4: `Touch 4 — Final breakup for a REFERRAL PARTNER. Max 100 words. "I'll leave the door open" tone. Not needy. Acknowledge they're busy. Leave on good terms — if they ever have a client looking for a US visa-qualifying investment, Dylan's the person to call. Include Calendly link in case they change their mind.`,
  };

  const prohibitedPhrases = (settings?.prohibitedPhrases ?? []).join(", ");

  const langInstructions = buildLanguageInstructions(lead.country);
  const langLabel = getLanguageLabel(lead.country);
  const langBlock = langInstructions
    ? `\n━━━ LOCALIZATION — READ THIS FIRST ━━━\n${langInstructions}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    : "";

  const systemPrompt = `You are drafting outreach emails on behalf of Dylan Delaney at New Dawn Franchising (newdawnfranchising.com).
${langBlock}
${bio}

Dylan's writing style (use these as examples):
${voiceSamples || "Warm, direct, professional but never stiff. Short sentences. Asks questions. Never salesy. Writes like a smart peer, not a marketer."}

Hard rules:
- Never make up facts about the lead
- Never promise visa approval
- Never say "passive income", "hands-free", or "AI-powered"
- Always sign as: Dylan Delaney | Director of Franchise Development | New Dawn Franchising | newdawnfranchising.com | (346) 597-9994
- Include unsubscribe line at bottom: "Not a fit? Just reply UNSUBSCRIBE and I'll never reach out again."
- Never mention this was AI-generated
${prohibitedPhrases ? `- Never say: ${prohibitedPhrases}` : ""}

Reply with JSON: {"subject": "...", "body": "full email body as plain text (no HTML)"}`;

  const userPrompt = `Draft an outreach email for this lead. Write in ${langLabel}.
${touchInstructions[touchNumber] || touchInstructions[1]}

Lead:
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title || "Business owner"}
- Company: ${lead.company || "unknown"}
- Country: ${lead.country || "unknown"}
- Source: ${lead.source}
- Notes: ${lead.notes || "None"}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });

  return JSON.parse(res.choices[0].message.content || '{"subject":"Following up","body":"Hi there,\n\nJust reaching out.\n\nDylan"}');
}

async function draftWhatsAppMessage(lead: any, settings: any): Promise<string> {
  const calendly = settings?.calendlyLink || "https://calendly.com/dylan-newdawn/intro";
  const langInstructions = buildLanguageInstructions(lead.country);
  const langLabel = getLanguageLabel(lead.country);
  const langNote = langInstructions
    ? `\n\nLOCALIZATION:\n${langInstructions}`
    : "";
  const prompt = `Write a brief WhatsApp follow-up message from Dylan Delaney (New Dawn Franchising) to ${lead.firstName} ${lead.lastName} (${lead.title || "professional"} in ${lead.country || "their country"}). Write in ${langLabel}. Max 3 sentences. Warm and professional peer-to-peer tone — this is a referral partner, not a prospect buying anything. Mention you sent an email about potential client referral opportunities (wealthy clients seeking US visa-qualifying investments). Invite them to grab 20 min on Zoom: ${calendly}. Sign as Dylan. Include an opt-out line in ${langLabel}.${langNote}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
  });
  return res.choices[0].message.content || `Hey ${lead.firstName}, this is Dylan from New Dawn Franchising. Just following up on my email about franchise investment opportunities in the US. Would love to grab 20 min on Zoom if you're open: ${calendly} - Reply STOP to opt out.`;
}

// ─── Seamless.AI Lead Discovery ──────────────────────────────────────────────

export async function discoverLeadsFromSeamless(maxLeads = 20): Promise<number> {
  if (!process.env.SEAMLESS_API_KEY) {
    console.warn("[Seamless] SEAMLESS_API_KEY not set — skipping discovery");
    return 0;
  }

  const settings = await getSettings();
  // Seamless expects full country names, not abbreviations
  const countryMap: Record<string, string> = {
    "UAE": "United Arab Emirates",
    "UK": "United Kingdom",
    "KSA": "Saudi Arabia",
    "USA": "United States",
    "HK": "Hong Kong",
  };
  const rawCountries = settings?.targetCountries?.length
    ? settings.targetCountries
    : [
        // Latin America (huge E-2 demand, Spanish outreach auto-triggered)
        "Mexico", "Colombia", "Brazil", "Argentina",
        // Asia-Pacific (South Korea is the #1 E-2 country by volume)
        "South Korea", "Japan", "Taiwan", "India", "Philippines", "Vietnam",
        // Middle East
        "United Arab Emirates", "Saudi Arabia", "Israel",
        // Europe
        "Germany", "United Kingdom", "France", "Italy", "Turkey",
        // Other high-volume E-2 countries
        "Canada", "China",
      ];
  const countries = rawCountries.map((c: string) => countryMap[c] || c);

  const titles = [
    // Immigration & visa professionals
    "Immigration Attorney", "Immigration Lawyer", "Visa Consultant", "Immigration Consultant",
    "E-2 Visa Attorney", "EB-5 Attorney", "Immigration Law Partner",
    // Business & franchise brokers
    "Business Broker", "Franchise Broker", "Franchise Consultant", "Franchise Advisor",
    "M&A Advisor", "Mergers and Acquisitions Advisor",
    // Wealth & financial advisors to HNW clients
    "Wealth Manager", "Private Banker", "Financial Advisor", "Investment Advisor",
    "International Financial Advisor", "Private Wealth Advisor",
    // Relocation & international mobility
    "Relocation Consultant", "Global Mobility Consultant", "International Relocation Specialist",
    // Chamber & trade association leaders
    "Chamber of Commerce Director", "Executive Director", "President",
  ];

  let discovered = 0;
  try {
    console.log(`[Seamless] Searching for leads in: ${countries.slice(0, 3).join(", ")}...`);

    // enrich=true runs the research+poll step so emails/phones come back.
    const people = await seamlessFindPeople(
      { titles, countries, limit: Math.min(maxLeads, 25) },
      { enrich: true },
    );
    console.log(`[Seamless] Got ${people.length} people from API`);

    let skippedNoEmail = 0, skippedDnc = 0, skippedExisting = 0;
    for (const p of people) {
      let email = p.email;
      // Seamless search frequently returns no email; recover it via Hunter from
      // the person's company domain before giving up (mirrors people-finder).
      if (!email && p.domain && p.firstName && p.lastName) {
        try {
          const hunter = await hunterFindEmail(p.firstName, p.lastName, p.domain);
          if (hunter?.email) email = hunter.email;
        } catch { /* ignore — fall through to skip */ }
      }
      if (!email) { skippedNoEmail++; continue; }
      if (await isOnDnc(email, null, null)) { skippedDnc++; continue; }

      const existing = await db.select().from(agentLeads).where(eq(agentLeads.email, email)).limit(1);
      if (existing.length > 0) { skippedExisting++; continue; }

      await db.insert(agentLeads).values({
        firstName: p.firstName,
        lastName: p.lastName,
        email,
        phone: p.phone,
        linkedinUrl: p.linkedinUrl,
        company: p.company,
        title: p.jobTitle,
        country: p.country,
        source: "seamless",
        sourceUrl: p.linkedinUrl,
        aiScore: 0,
      });
      discovered++;
    }
    console.log(`[Seamless] Saved ${discovered} new leads. Skipped: ${skippedNoEmail} no-email, ${skippedDnc} DNC, ${skippedExisting} existing.`);
  } catch (e) {
    console.error("[Seamless] Discovery error:", e);
  }
  return discovered;
}

// ─── Enrich & Score Leads ────────────────────────────────────────────────────

export async function enrichAndScoreNewLeads(): Promise<number> {
  const settings = await getSettings();
  const unscored = await db.select().from(agentLeads)
    .where(and(eq(agentLeads.aiScore, 0), eq(agentLeads.dnc, false)))
    .limit(30);

  let processed = 0;
  for (const lead of unscored) {
    // Step 1: ZeroBounce email cross-reference — skip invalid emails immediately
    if (lead.email) {
      const zbResult = await verifyEmail(lead.email);
      if (zbResult.status === "invalid") {
        await db.update(agentLeads)
          .set({
            dnc: true,
            tags: ["invalid_email"],
            researchDossier: { scoringReasoning: `ZeroBounce: email invalid (${zbResult.subStatus || "hard bounce"})` },
            updatedAt: new Date(),
          })
          .where(eq(agentLeads.id, lead.id));
        await addToDnc(lead.email, undefined, undefined, `ZeroBounce: ${zbResult.subStatus || "invalid"}`);
        console.log(`[Agent] ZeroBounce rejected ${lead.email} (${zbResult.subStatus})`);
        processed++;
        continue;
      }
    }

    // Step 2a: If no phone, try SerpAPI to find one
    let resolvedPhone = lead.phone;
    if (!resolvedPhone && lead.firstName && (lead.company || lead.title)) {
      const serpKey = process.env.SERPAPI_KEY;
      if (serpKey) {
        try {
          const name = `${lead.firstName} ${lead.lastName || ""}`.trim();
          const ctx = lead.company || lead.title || "";
          const q = `"${name}" "${ctx}" phone contact`;
          const params = new URLSearchParams({ engine: "google", q, api_key: serpKey, num: "5" });
          const res = await fetch(`https://serpapi.com/search.json?${params}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const json = await res.json() as {
              organic_results?: Array<{ snippet?: string; title?: string }>;
              knowledge_graph?: { phone?: string };
            };
            const kgPhone = json.knowledge_graph?.phone;
            if (kgPhone && kgPhone.replace(/\D/g, "").length >= 7) {
              resolvedPhone = kgPhone.trim();
            } else {
              const snippets = (json.organic_results || [])
                .map(r => `${r.title || ""} ${r.snippet || ""}`).join(" ");
              resolvedPhone = extractPhoneFromText(snippets) || null;
            }
            if (resolvedPhone) {
              console.log(`[Agent] SerpAPI phone found for ${name}: ${resolvedPhone}`);
              await db.update(agentLeads).set({ phone: resolvedPhone, updatedAt: new Date() }).where(eq(agentLeads.id, lead.id));
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Step 2b: Twilio phone lookup — validate type and determine WhatsApp eligibility
    let phoneMeta: Record<string, unknown> = {};
    if (resolvedPhone) {
      const twResult = await lookupPhone(resolvedPhone);
      if (twResult.nationalFormat || twResult.valid) {
        const whatsappEligible = twResult.valid && (twResult.type === "mobile" || twResult.type === "voip");
        phoneMeta = {
          phoneType: twResult.type,
          phoneValid: twResult.valid,
          phoneFormatted: twResult.nationalFormat || resolvedPhone,
          whatsappEligible,
        };
        // Update stored phone with Twilio-formatted version
        if (twResult.nationalFormat && twResult.nationalFormat !== resolvedPhone) {
          await db.update(agentLeads).set({ phone: twResult.nationalFormat, updatedAt: new Date() }).where(eq(agentLeads.id, lead.id));
        }
      }
    }

    // Step 3: AI scoring
    const { score, reasoning } = await scoreLeadWithAI(lead, settings);
    const tags: string[] = [];
    if (score >= 75) tags.push("hot");
    else if (score >= 50) tags.push("warm");
    else tags.push("cold");
    if (phoneMeta.whatsappEligible) tags.push("whatsapp_eligible");

    await db.update(agentLeads)
      .set({
        aiScore: score,
        tags,
        researchDossier: { scoringReasoning: reasoning, ...phoneMeta },
        updatedAt: new Date(),
      })
      .where(eq(agentLeads.id, lead.id));
    processed++;
  }
  return processed;
}

// ─── Stage Today's Messages ──────────────────────────────────────────────────

export async function stageOutreachForToday(batchId: string): Promise<number> {
  const settings = await getSettings();
  if (settings?.agentPaused) return 0;

  const now = new Date();
  const today = todayStr();
  let staged = 0;

  // 1. New leads ready for Touch 1 (score ≥ 40, never contacted, has email)
  const newLeads = await db.select().from(agentLeads)
    .where(and(
      eq(agentLeads.stage, "new"),
      eq(agentLeads.dnc, false),
      isNull(agentLeads.lastContactedAt),
    ))
    .orderBy(desc(agentLeads.aiScore))
    .limit(settings?.maxEmailsPerDay || 80);

  const maxNew = Math.min(newLeads.length, 15);
  for (let i = 0; i < maxNew; i++) {
    const lead = newLeads[i];
    if (!lead.email) continue;
    if (await isOnDnc(lead.email)) continue;

    const draft = await draftOutreachEmail(lead, 1, settings);
    await db.insert(agentMessages).values({
      leadId: lead.id,
      dailyBatchId: batchId,
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      status: "staged",
      touchNumber: 1,
    });
    staged++;
  }

  // 2. Follow-ups due today (Touch 2/3/4)
  const followUpLeads = await db.select().from(agentLeads)
    .where(and(
      eq(agentLeads.dnc, false),
      lt(agentLeads.nextFollowUpAt, now),
    ))
    .limit(20);

  for (const lead of followUpLeads) {
    if (!lead.email) continue;
    if (await isOnDnc(lead.email)) continue;

    const nextTouch = (lead.sequenceStage || 0) + 1;
    if (nextTouch > 4) continue;

    const draft = await draftOutreachEmail(lead, nextTouch, settings);
    await db.insert(agentMessages).values({
      leadId: lead.id,
      dailyBatchId: batchId,
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      status: "staged",
      touchNumber: nextTouch,
    });
    staged++;
  }

  // 3. WhatsApp follow-ups (leads who didn't reply to email Touch 1 after 5 days)
  const whatsappCandidates = await db.select().from(agentLeads)
    .where(and(
      eq(agentLeads.dnc, false),
      eq(agentLeads.sequenceStage, 1),
    ))
    .limit(settings?.maxWhatsappPerDay || 30);

  let waCount = 0;
  for (const lead of whatsappCandidates) {
    if (!lead.phone || waCount >= 5) continue;
    if (await isOnDnc(null, lead.phone)) continue;
    // Skip phones known to be landlines (not WhatsApp-capable)
    const dossier = (lead.researchDossier as Record<string, unknown> | null) || {};
    if (dossier.phoneType === "landline") continue;

    const daysSinceContact = lead.lastContactedAt
      ? Math.floor((now.getTime() - new Date(lead.lastContactedAt).getTime()) / 86400000)
      : 0;
    if (daysSinceContact < 5) continue;

    const msg = await draftWhatsAppMessage(lead, settings);
    await db.insert(agentMessages).values({
      leadId: lead.id,
      dailyBatchId: batchId,
      channel: "whatsapp",
      body: msg,
      status: "staged",
      touchNumber: 1,
    });
    staged++;
    waCount++;
  }

  await db.update(agentDailyBatches).set({ totalStaged: staged }).where(eq(agentDailyBatches.id, batchId));
  return staged;
}

// ─── Build & Send Briefing Email ─────────────────────────────────────────────

export async function sendDailyBrief(batchId: string): Promise<boolean> {
  // Idempotency: don't re-send if already sent
  const batchCheck = await db.select({ briefEmailSentAt: agentDailyBatches.briefEmailSentAt })
    .from(agentDailyBatches).where(eq(agentDailyBatches.id, batchId)).limit(1);
  if (batchCheck[0]?.briefEmailSentAt) {
    console.log("[Agent] Brief already sent for this batch — skipping");
    return false;
  }

  const settings = await getSettings();
  const toEmail = settings?.approvalEmail || FROM_EMAIL;

  const messages = await db.select().from(agentMessages)
    .where(and(eq(agentMessages.dailyBatchId, batchId), eq(agentMessages.status, "staged")))
    .limit(50);

  if (messages.length === 0) {
    console.log("[Agent] No staged messages for batch — skipping brief");
    return false;
  }

  const dateStr = formatDateLong();
  const subject = `NDF Agent Daily Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;

  const emailGroups = messages.filter(m => m.channel === "email");
  const waGroups = messages.filter(m => m.channel === "whatsapp");

  let itemsHtml = "";
  let idx = 1;

  if (emailGroups.length > 0) {
    itemsHtml += `<h3 style="color:#1a2a4a;margin:20px 0 8px;">📧 EMAILS (${emailGroups.length})</h3>`;
    for (const msg of emailGroups) {
      const lead = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
      const l = lead[0];
      const preview = msg.body.split("\n").slice(0, 2).join(" ").substring(0, 120);
      itemsHtml += `<div style="background:#f8f9ff;border-left:3px solid #4a6fa5;padding:10px 14px;margin:6px 0;border-radius:0 4px 4px 0;">
        <strong>#${idx}. ${l ? `${l.firstName} ${l.lastName}` : "Unknown"}</strong>${l?.title ? `, ${l.title}` : ""}${l?.company ? ` @ ${l.company}` : ""}${l?.country ? ` (${l.country})` : ""} — Touch ${msg.touchNumber}<br/>
        <em style="color:#6b7280;font-size:13px;">Subject: ${msg.subject || "(no subject)"}</em><br/>
        <span style="color:#374151;font-size:13px;">"${preview}..."</span>
      </div>`;
      idx++;
    }
  }

  if (waGroups.length > 0) {
    itemsHtml += `<h3 style="color:#1a2a4a;margin:20px 0 8px;">💬 WHATSAPP (${waGroups.length})</h3>`;
    for (const msg of waGroups) {
      const lead = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
      const l = lead[0];
      itemsHtml += `<div style="background:#f0fff4;border-left:3px solid #22c55e;padding:10px 14px;margin:6px 0;border-radius:0 4px 4px 0;">
        <strong>#${idx}. ${l ? `${l.firstName} ${l.lastName}` : "Unknown"}</strong>${l?.country ? ` (${l.country})` : ""} — WhatsApp<br/>
        <span style="color:#374151;font-size:13px;">"${msg.body.substring(0, 120)}..."</span>
      </div>`;
      idx++;
    }
  }

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e;">
  <div style="background:#1a2a4a;padding:20px 28px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:18px;font-weight:700;">🤖 NDF AI Agent</span>
    <span style="color:#a0b4d0;font-size:14px;margin-left:12px;">Daily Outreach Brief</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;color:#374151;">Hi Dylan,</p>
    <p style="margin:0 0 16px;color:#374151;">Here's what the agent has queued for <strong>${dateStr}</strong>. Reply <strong style="color:#16a34a;">YES</strong> to send everything, or <strong style="color:#dc2626;">NO</strong> to hold. You can reply <em>"YES but skip #3"</em> or <em>"YES but edit #2: [new text]"</em>.</p>

    <div style="background:#fef9c3;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin:0 0 20px;">
      <strong>TOTAL: ${messages.length} message${messages.length !== 1 ? "s" : ""} ready</strong> (${emailGroups.length} email${emailGroups.length !== 1 ? "s" : ""}, ${waGroups.length} WhatsApp)
    </div>

    ${itemsHtml}

    <div style="margin:28px 0 20px;display:flex;gap:12px;">
      <a href="${AGENT_PORTAL}?approve=${batchId}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:15px;">✅ Approve in Portal</a>
      <a href="${AGENT_PORTAL}?hold=${batchId}" style="display:inline-block;background:#6b7280;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;font-size:15px;">⏸ Hold</a>
    </div>

    <p style="font-size:13px;color:#9ca3af;margin:16px 0 0;">
      Or reply YES / NO to this email.<br/>
      View all leads &amp; messages: <a href="${AGENT_PORTAL}" style="color:#4a6fa5;">${AGENT_PORTAL}</a><br/>
      <em>Approval deadline: 2:00 PM — after that, batch is held until tomorrow.</em>
    </p>
  </div>
</div>`;

  await sendEmailFromSender(DYLAN_EMAIL, toEmail, subject, html, undefined, undefined, { skipUnsubscribe: true });
  await db.update(agentDailyBatches).set({
    briefEmailSentAt: new Date(),
    briefSubject: subject,
    briefBody: html,
  }).where(eq(agentDailyBatches.id, batchId));

  // SMS notification to Dylan — quick heads-up with portal link
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const smsText = `🤖 NDF Agent Daily Brief — ${today}\n${messages.length} message${messages.length !== 1 ? "s" : ""} queued (${emailGroups.length} email${emailGroups.length !== 1 ? "s" : ""}, ${waGroups.length} WhatsApp).\nTap to review & approve:\n${AGENT_PORTAL}?s=approval-inbox`;
  sendAgentSms("outreach", smsText, { triggerType: "daily_brief" }).catch(e =>
    console.error("[Agent] Brief SMS error:", e.message)
  );

  // Slack notification
  notifyDailyBriefSent({
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    staged: messages.length,
    discovered: 0,
    forumPosts: 0,
    approveUrl: AGENT_PORTAL,
    portalUrl: AGENT_PORTAL,
  }).catch(() => {});

  return true;
}

// ─── IMAP Reply Listener ─────────────────────────────────────────────────────

const processedMessageIds = new Set<string>();

export async function pollForApprovalReply(): Promise<void> {
  const today = todayStr();
  const batch = await db.select().from(agentDailyBatches)
    .where(and(eq(agentDailyBatches.batchDate, today), eq(agentDailyBatches.approvalStatus, "pending")))
    .limit(1);

  if (!batch[0]) return;

  const password = process.env.GMAIL_APP_PASSWORD_DYLAN;
  if (!password) return;

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: DYLAN_EMAIL, pass: password },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const expectedSubject = `RE: NDF Agent Daily Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;

      for await (const msg of client.fetch(
        { since: new Date(new Date().setHours(0, 0, 0, 0)) },
        { envelope: true, bodyParts: ["TEXT"] }
      )) {
        const msgId = msg.envelope?.messageId || String(msg.seq);
        if (processedMessageIds.has(msgId)) continue;

        const subject = msg.envelope?.subject || "";
        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";

        if (!subject.toLowerCase().includes("ndf agent daily brief")) continue;
        if (fromAddr !== FROM_EMAIL.toLowerCase() && fromAddr !== "dylan@newdawnfranchising.com") continue;

        processedMessageIds.add(msgId);

        const textPart = msg.bodyParts?.get("TEXT");
        const rawBody = textPart ? Buffer.from(textPart).toString("utf8") : "";
        const body = rawBody.replace(/\r\n/g, "\n").trim().toUpperCase();

        await parseAndActOnReply(batch[0].id, body, rawBody);
        break;
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (e) {
    console.error("[Agent] IMAP poll error:", e);
    if (client) {
      try { await client.logout(); } catch {}
    }
  }
}

async function parseAndActOnReply(batchId: string, upperBody: string, rawBody: string) {
  const skipPattern = /YES\s+BUT\s+SKIP\s+#?([\d,\s]+)/i;
  const editPattern = /YES\s+BUT\s+EDIT\s+#?(\d+):\s*(.+)/i;

  let approval: "approved" | "held" = "held";
  let skipped: number[] = [];

  if (upperBody.startsWith("YES") || upperBody === "YES") {
    approval = "approved";

    const skipMatch = rawBody.match(skipPattern);
    if (skipMatch) {
      skipped = skipMatch[1].split(/[\s,]+/).filter(Boolean).map(Number);
    }

    const editMatch = rawBody.match(editPattern);
    if (editMatch) {
      const itemNum = parseInt(editMatch[1]);
      const newText = editMatch[2].trim();
      const msgs = await db.select().from(agentMessages)
        .where(eq(agentMessages.dailyBatchId, batchId))
        .orderBy(agentMessages.createdAt);
      const targetMsg = msgs[itemNum - 1];
      if (targetMsg) {
        await db.update(agentMessages).set({ body: newText }).where(eq(agentMessages.id, targetMsg.id));
      }
    }
  } else if (upperBody.startsWith("NO")) {
    approval = "held";
  } else {
    return;
  }

  await db.update(agentDailyBatches).set({
    approvalStatus: approval,
    approvedAt: new Date(),
    approvedBy: "email_reply",
    replyBody: rawBody,
    skippedItems: skipped,
  }).where(eq(agentDailyBatches.id, batchId));

  if (approval === "approved") {
    executeBatch(batchId, skipped).catch(e => console.error("[Agent] Batch execution error:", e));
  }
}

// ─── Execute Batch ───────────────────────────────────────────────────────────

export async function executeBatch(batchId: string, skippedItems: number[] = []): Promise<void> {
  const batch = await db.select().from(agentDailyBatches).where(eq(agentDailyBatches.id, batchId)).limit(1);
  if (!batch[0]) return;

  if (batch[0].executedAt) {
    console.warn("[Agent] Batch already executed, skipping (idempotency)");
    return;
  }

  await db.update(agentDailyBatches).set({ approvalStatus: "executing" }).where(eq(agentDailyBatches.id, batchId));

  const messages = await db.select().from(agentMessages)
    .where(and(eq(agentMessages.dailyBatchId, batchId), eq(agentMessages.status, "staged")))
    .orderBy(agentMessages.createdAt);

  let sent = 0, failed = 0;
  const settings = await getSettings();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (skippedItems.includes(i + 1)) {
      await db.update(agentMessages).set({ status: "held" }).where(eq(agentMessages.id, msg.id));
      continue;
    }

    if (await isOnDnc(null, null, null)) {
      await db.update(agentMessages).set({ status: "held" }).where(eq(agentMessages.id, msg.id));
      continue;
    }

    try {
      await db.update(agentMessages).set({ status: "executing" }).where(eq(agentMessages.id, msg.id));

      if (msg.channel === "email") {
        const lead = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
        if (!lead[0]?.email) throw new Error("No email address");
        if (await isOnDnc(lead[0].email)) throw new Error("On DNC");

        const bodyWithFooter = `${msg.body}\n\n---\nNew Dawn Franchising LLC | 1100 Montana Ave, El Paso, TX 79902\nnewdawnfranchising.com | (346) 597-9994\n\nNot a fit? Reply UNSUBSCRIBE and I'll remove you immediately.`;

        await sendEmailFromSender(DYLAN_EMAIL, lead[0].email, msg.subject || "Following up", bodyWithFooter.replace(/\n/g, "<br/>"));

        const touchDays: Record<number, number> = { 1: 4, 2: 5, 3: 7, 4: 0 };
        const nextTouchDays = touchDays[msg.touchNumber] || 0;
        const nextFollowUp = nextTouchDays > 0 ? new Date(Date.now() + nextTouchDays * 86400000) : null;

        await db.update(agentLeads).set({
          lastContactedAt: new Date(),
          sequenceStage: msg.touchNumber,
          stage: "contacted",
          nextFollowUpAt: nextFollowUp,
          updatedAt: new Date(),
        }).where(eq(agentLeads.id, msg.leadId));

        await db.update(agentMessages).set({ status: "sent", sentAt: new Date() }).where(eq(agentMessages.id, msg.id));
        sent++;

        const delay = randomInt(30000, 90000);
        await sleep(delay);

      } else if (msg.channel === "whatsapp") {
        const lead = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
        if (!lead[0]?.phone) throw new Error("No phone");

        const { sendWhatsAppMessage } = await import("./meta-whatsapp-service");
        const result = await sendWhatsAppMessage(lead[0].phone, msg.body);
        if (!result.success) throw new Error(result.error || "Meta WhatsApp send failed");

        await db.update(agentMessages).set({ status: "sent", sentAt: new Date() }).where(eq(agentMessages.id, msg.id));
        await db.update(agentLeads).set({ lastContactedAt: new Date(), updatedAt: new Date() }).where(eq(agentLeads.id, msg.leadId));
        sent++;

        const delay = randomInt(60000, 180000);
        await sleep(delay);
      }
    } catch (e: any) {
      console.error(`[Agent] Send failed for message ${msg.id}:`, e.message);
      await db.update(agentMessages).set({ status: "failed", errorMessage: e.message }).where(eq(agentMessages.id, msg.id));
      failed++;
    }
  }

  await db.update(agentDailyBatches).set({
    approvalStatus: "executed",
    executedAt: new Date(),
    totalSent: sent,
    totalFailed: failed,
    executionSummary: { sent, failed, total: messages.length },
  }).where(eq(agentDailyBatches.id, batchId));

  await sendExecutionConfirmation(batchId, sent, failed, settings);

  // Slack notification
  const approvedBy = batch[0].approvedBy || "portal";
  notifyBatchExecuted({
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    sent, failed,
    approvedBy,
    portalUrl: AGENT_PORTAL,
  }).catch(() => {});
}

async function sendExecutionConfirmation(batchId: string, sent: number, failed: number, settings: any) {
  const toEmail = settings?.approvalEmail || FROM_EMAIL;
  const date = formatDateLong();
  const subject = `✅ Agent Executed — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })} | ${sent} message${sent !== 1 ? "s" : ""} sent`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
  <div style="background:#1a2a4a;padding:20px 28px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:18px;font-weight:700;">🤖 NDF AI Agent</span>
    <span style="color:#a0b4d0;font-size:14px;margin-left:12px;">Execution Confirmed</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">Hi Dylan,</p>
    <p style="margin:0 0 20px;">Done. Here's what went out today (${date}):</p>
    <div style="background:#f0fff4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 4px 4px 0;margin:0 0 20px;">
      <div style="font-size:16px;">✅ <strong>${sent}</strong> message${sent !== 1 ? "s" : ""} sent${failed > 0 ? ` (${failed} failed)` : " (0 failed)"}</div>
    </div>
    <a href="${AGENT_PORTAL}" style="display:inline-block;background:#1a2a4a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">Track replies in real time →</a>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">— Your AI Agent at New Dawn Franchising</p>
  </div>
</div>`;

  await sendEmailFromSender(DYLAN_EMAIL, toEmail, subject, html, undefined, undefined, { skipUnsubscribe: true });
  await db.update(agentDailyBatches).set({ confirmationSentAt: new Date() }).where(eq(agentDailyBatches.id, batchId));
}

// ─── Main Preparation Run (6 AM) ─────────────────────────────────────────────

export async function runDailyPreparation(): Promise<void> {
  const settings = await getSettings();
  if (settings?.agentPaused) {
    console.log("[Agent] Paused — skipping daily preparation");
    return;
  }

  const today = todayStr();
  const idempotencyKey = `prep-${today}`;

  const existing = await db.select().from(agentDailyBatches)
    .where(eq(agentDailyBatches.idempotencyKey, idempotencyKey)).limit(1);

  let batch: typeof existing[0];

  if (existing[0]) {
    if (existing[0].approvalStatus !== "preparing") {
      // Already completed (pending/failed/held/executed) — skip
      console.log("[Agent] Preparation already ran today, skipping");
      return;
    }
    // Stuck in "preparing" — allow retry after 5 minutes (catches server-crash mid-run)
    const ageMs = Date.now() - new Date(existing[0].createdAt).getTime();
    if (ageMs < 5 * 60 * 1000) {
      console.log("[Agent] Preparation still running (< 5 min old) — skipping");
      return;
    }
    console.log("[Agent] Previous preparation stuck in 'preparing' for >5 min — retrying same batch");
    batch = existing[0];
  } else {
    const [newBatch] = await db.insert(agentDailyBatches).values({
      batchDate: today,
      approvalStatus: "preparing",
      idempotencyKey,
    }).returning();
    batch = newBatch;
  }

  const runLog: string[] = [];

  try {
    runLog.push(`[${new Date().toISOString()}] Starting daily preparation for ${today}`);

    const discovered = await discoverLeadsFromSeamless(settings?.maxLeadsPerDay || 50);
    runLog.push(`[${new Date().toISOString()}] Discovered ${discovered} new leads from Seamless`);

    const scored = await enrichAndScoreNewLeads();
    runLog.push(`[${new Date().toISOString()}] Scored ${scored} leads`);

    const staged = await stageOutreachForToday(batch.id);
    runLog.push(`[${new Date().toISOString()}] Staged ${staged} messages for approval`);

    // Monitor forums for reply opportunities
    let forumPosts = 0;
    try {
      const [redditPosts, quoraPosts] = await Promise.all([
        monitorReddit(),
        monitorQuora(),
      ]);

      for (const post of redditPosts) {
        await db.insert(agentForumPosts).values({
          platform: `Reddit r/${post.subreddit}`,
          postUrl: post.url,
          postTitle: post.title,
          postBody: post.body,
          author: post.author,
          status: "pending",
          dailyBatchId: batch.id,
        }).onConflictDoNothing();
        forumPosts++;
      }
      for (const q of quoraPosts) {
        await db.insert(agentForumPosts).values({
          platform: "Quora",
          postUrl: q.url,
          postTitle: q.title,
          postBody: q.body || "",
          author: q.author || "",
          status: "pending",
          dailyBatchId: batch.id,
        }).onConflictDoNothing();
        forumPosts++;
      }
      runLog.push(`[${new Date().toISOString()}] Found ${forumPosts} forum posts worth engaging`);

      // Scan forum accounts for AI-drafted reply opportunities
      try {
        const scanned = await scanForumsForOpportunities();
        if (scanned > 0) {
          forumPosts += scanned;
          runLog.push(`[${new Date().toISOString()}] Forum accounts scan drafted ${scanned} new replies`);
        }
      } catch (se: any) {
        runLog.push(`[${new Date().toISOString()}] Forum account scan error (non-fatal): ${se.message}`);
      }
    } catch (fe: any) {
      runLog.push(`[${new Date().toISOString()}] Forum monitoring error (non-fatal): ${fe.message}`);
    }

    await db.update(agentDailyBatches).set({
      approvalStatus: "pending",
      totalStaged: staged,
    }).where(eq(agentDailyBatches.id, batch.id));

    await logRun("preparation", "completed", { discovered, scored, staged, forumPosts }, []);
    runLog.push(`[${new Date().toISOString()}] Preparation complete`);

    // Slack notification
    notifyPreparationComplete({ date: today, discovered, scored, staged, forumPosts }).catch(() => {});

    // SMS status to Dylan — always send so he knows the agent ran
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const prepSms = staged > 0
      ? `🤖 Outreach Agent prep done — ${dateLabel}\n✅ ${staged} message${staged !== 1 ? "s" : ""} staged for approval (${discovered} leads found, ${forumPosts} forum posts).\nFull brief sent to email. Approve at:\nnewdawnfranchising.replit.app/agent`
      : `🤖 Outreach Agent prep done — ${dateLabel}\n⚠️ 0 messages staged today (${discovered} leads found, ${forumPosts} forum posts).\nSeamless may need more credits for new lead discovery. Existing leads checked.\nnewdawnfranchising.replit.app/agent`;
    sendAgentSms("outreach", prepSms, { triggerType: "prep_complete" }).catch(() => {});
  } catch (e: any) {
    runLog.push(`[${new Date().toISOString()}] ERROR: ${e.message}`);
    await logRun("preparation", "failed", { error: e.message }, []);
    await db.update(agentDailyBatches).set({ approvalStatus: "failed" }).where(eq(agentDailyBatches.id, batch.id));
    // Notify Dylan of failure
    sendAgentSms("outreach",
      `⚠️ Outreach Agent prep FAILED — ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\nError: ${e.message?.slice(0, 120) ?? "Unknown error"}\nCheck logs at: newdawnfranchising.replit.app/agent`,
      { triggerType: "prep_error" }
    ).catch(() => {});
  }
}

// ─── Send Daily Brief (7 AM) ─────────────────────────────────────────────────

export async function runDailyBrief(): Promise<void> {
  const today = todayStr();
  const batch = await db.select().from(agentDailyBatches)
    .where(and(eq(agentDailyBatches.batchDate, today), eq(agentDailyBatches.approvalStatus, "pending")))
    .limit(1);

  if (!batch[0]) {
    console.log("[Agent] No pending batch to brief today");
    return;
  }

  const sent = await sendDailyBrief(batch[0].id);
  console.log(`[Agent] Daily brief sent: ${sent}`);
}

// ─── 2 PM Deadline ───────────────────────────────────────────────────────────

export async function runApprovalDeadlineCheck(): Promise<void> {
  const today = todayStr();
  const batch = await db.select().from(agentDailyBatches)
    .where(and(eq(agentDailyBatches.batchDate, today), eq(agentDailyBatches.approvalStatus, "pending")))
    .limit(1);

  if (!batch[0]) return;

  await db.update(agentDailyBatches).set({ approvalStatus: "held" }).where(eq(agentDailyBatches.id, batch[0].id));
  await db.update(agentMessages).set({ status: "held" })
    .where(and(eq(agentMessages.dailyBatchId, batch[0].id), eq(agentMessages.status, "staged")));

  console.log("[Agent] 2PM deadline reached — batch held");

  // Slack notification
  notifyApprovalDeadline({
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    staged: batch[0].totalStaged || 0,
    portalUrl: AGENT_PORTAL,
  }).catch(() => {});
}

// ─── Portal Approval ─────────────────────────────────────────────────────────

export async function portalApprove(batchId: string, skipItems: number[] = []): Promise<void> {
  const batch = await db.select().from(agentDailyBatches).where(eq(agentDailyBatches.id, batchId)).limit(1);
  if (!batch[0] || batch[0].approvalStatus === "executed") return;

  await db.update(agentDailyBatches).set({
    approvalStatus: "approved",
    approvedAt: new Date(),
    approvedBy: "portal",
    skippedItems: skipItems,
  }).where(eq(agentDailyBatches.id, batchId));

  executeBatch(batchId, skipItems).catch(e => console.error("[Agent] Execution error:", e));
}

export async function portalHold(batchId: string): Promise<void> {
  await db.update(agentDailyBatches).set({ approvalStatus: "held" }).where(eq(agentDailyBatches.id, batchId));
  await db.update(agentMessages).set({ status: "held" })
    .where(and(eq(agentMessages.dailyBatchId, batchId), eq(agentMessages.status, "staged")));
}

// ─── Send a single agent message (used by approval inbox) ────────────────────

export async function sendSingleAgentMessage(messageId: string): Promise<{ ok: boolean; channel: string }> {
  const [msg] = await db.select().from(agentMessages).where(eq(agentMessages.id, messageId)).limit(1);
  if (!msg) throw new Error("Message not found");
  if (msg.status === "sent") return { ok: true, channel: msg.channel };
  if (!["staged", "held"].includes(msg.status)) throw new Error(`Cannot send message with status "${msg.status}"`);

  await db.update(agentMessages).set({ status: "executing" }).where(eq(agentMessages.id, messageId));

  try {
    if (msg.channel === "email") {
      const [lead] = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
      if (!lead?.email) throw new Error("No email address for lead");
      if (await isOnDnc(lead.email)) throw new Error("Lead is on DNC list");

      const bodyWithFooter = `${msg.body}\n\n---\nNew Dawn Franchising LLC | 1100 Montana Ave, El Paso, TX 79902\nnewdawnfranchising.com | (346) 597-9994\n\nNot a fit? Reply UNSUBSCRIBE and I'll remove you immediately.`;
      await sendEmailFromSender(DYLAN_EMAIL, lead.email, msg.subject || "Following up", bodyWithFooter.replace(/\n/g, "<br/>"));

      await db.update(agentLeads).set({
        lastContactedAt: new Date(), sequenceStage: msg.touchNumber, stage: "contacted",
        updatedAt: new Date(),
      }).where(eq(agentLeads.id, msg.leadId));

    } else if (msg.channel === "whatsapp") {
      const [lead] = await db.select().from(agentLeads).where(eq(agentLeads.id, msg.leadId)).limit(1);
      if (!lead?.phone) throw new Error("No phone number for lead");

      const { sendWhatsAppMessage } = await import("./meta-whatsapp-service");
      const result = await sendWhatsAppMessage(lead.phone, msg.body);
      if (!result.success) throw new Error(result.error || "WhatsApp send failed");

      await db.update(agentLeads).set({ lastContactedAt: new Date(), updatedAt: new Date() }).where(eq(agentLeads.id, msg.leadId));
    }

    await db.update(agentMessages).set({ status: "sent", sentAt: new Date() }).where(eq(agentMessages.id, messageId));
    return { ok: true, channel: msg.channel };

  } catch (e: any) {
    await db.update(agentMessages).set({ status: "failed", errorMessage: e.message }).where(eq(agentMessages.id, messageId));
    throw e;
  }
}

// ─── Manual Lead Import ──────────────────────────────────────────────────────

export async function importLeadManually(data: {
  firstName: string; lastName: string; email?: string; phone?: string;
  company?: string; title?: string; country?: string; linkedinUrl?: string; notes?: string; source?: string;
}): Promise<string> {
  const [lead] = await db.insert(agentLeads).values({
    ...data,
    source: data.source || "manual",
    aiScore: 0,
  }).returning({ id: agentLeads.id });
  return lead.id;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getAgentStats() {
  const today = todayStr();

  const [totalLeads] = await db.select({ count: sql<number>`count(*)` }).from(agentLeads);
  const [todayBatch] = await db.select().from(agentDailyBatches)
    .where(eq(agentDailyBatches.batchDate, today)).limit(1);

  const [sentToday] = await db.select({ count: sql<number>`count(*)` }).from(agentMessages)
    .where(and(eq(agentMessages.status, "sent"), sql`sent_at::date = CURRENT_DATE`));
  const [repliedToday] = await db.select({ count: sql<number>`count(*)` }).from(agentMessages)
    .where(and(sql`replied_at IS NOT NULL`, sql`replied_at::date = CURRENT_DATE`));

  const recentActivity = await db.select().from(agentRunLogs)
    .orderBy(desc(agentRunLogs.createdAt)).limit(10);

  const upcomingFollowUps = await db.select().from(agentLeads)
    .where(and(
      sql`next_follow_up_at IS NOT NULL`,
      sql`next_follow_up_at <= NOW() + INTERVAL '48 hours'`,
      eq(agentLeads.dnc, false),
    ))
    .orderBy(agentLeads.nextFollowUpAt)
    .limit(10);

  return {
    totalLeads: Number(totalLeads.count),
    todayBatch: todayBatch || null,
    sentToday: Number(sentToday.count),
    repliedToday: Number(repliedToday.count),
    recentActivity,
    upcomingFollowUps,
  };
}
