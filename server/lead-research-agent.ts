/**
 * lead-research-agent.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Conversational Lead Research assistant (Origami-style). Backed by Claude with
 * tool-use so it can actually DO things in our system:
 *   • search_people  → builds prospect lists via the multi-provider search
 *                      (Seamless / Apollo / Origami)
 *   • analyze_icp    → returns New Dawn's positioning + ideal-customer profile
 *                      so it can reason about who to target / "analyze my site"
 * Drafting outreach is done directly in the reply text. Saving / enrolling found
 * people is handled by the UI (action buttons on results) so the agent never
 * writes to the DB autonomously.
 *
 * Graceful: no ANTHROPIC_API_KEY → returns a clear message. Tool/provider
 * errors are caught and surfaced as tool results, never thrown to the caller.
 */

import { type ProviderId, type LeadSearchFilters } from "./seamless-prospects";
import { cachedProviderSearch } from "./search-cache";
import { scoreProspect, type ProspectIntel } from "./lead-intelligence";
import { searchCrmContacts } from "./semantic-search";
import { logSearchEvent } from "./search-telemetry";
import { draftProspectOutreach } from "./outreach-drafter";
import type { EnrichedContact } from "./prospect-enrichment";

export interface AgentPerson {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  // ICP fit + buying-intent scoring with a human-readable "why this matches".
  intel: ProspectIntel;
  inCrm?: boolean; // true if this person already exists in our CRM
}

export interface AgentResult {
  reply: string;
  people: AgentPerson[];
  provider: ProviderId;
  error?: string;
}

const MODEL = "claude-sonnet-4-6";
const MAX_ROUNDS = 4;

const SYSTEM_PROMPT = `You are the Lead Research assistant for New Dawn Franchising, an E-2 visa franchise platform (Property Management, Telecom, Insurance) based in El Paso, Texas. You help the team find and reach their ideal customers and referral partners.

You can take real actions through tools:
- Use "search_people" to build prospect lists from external data providers when the user describes who they want to reach. Translate their description into structured filters (titles, seniorities, countries, keywords, etc.).
- Use "search_crm" to find people we ALREADY have in our CRM (e.g. "who in our pipeline looks like an immigration attorney", "investors from the UK we've talked to"). Prefer this when the user refers to existing contacts/leads rather than net-new prospecting.
- Use "analyze_icp" when they ask who to target, to analyze their business/website, or when you need context about New Dawn before searching.

Every prospect that search_people returns is automatically scored for ICP FIT and buying INTENT, and tagged hot/warm/cool. The tool result gives you each person's tier and the reasons behind it ("UK-based founder; relocation intent"). Use these to prioritise — lead with the hottest matches and briefly say WHY they're a fit.

Behaviour:
- Be concise, friendly, and action-oriented — like a sharp SDR teammate.
- When the user asks to "find" / "build a list" / "get me" prospects, CALL search_people (don't just describe what you would do).
- To find people who work at a specific company (e.g. "everyone at GlobeVisa"), set companyNames to that company and companyDomains to its likely domain (e.g. globevisa.com), and DON'T require a job title — that returns the whole company. Only add titles if the user asks for specific roles.
- If a search returns 0 results with NO error, retry once with a broader query (e.g. drop titles, or use companyDomains instead of companyNames, or vice-versa) before telling the user nothing was found.
- If a search result has an "error" field, the data provider FAILED — the company was never actually searched. Do NOT retry and do NOT guess that the company is too small, misspelled, or low on public data. Tell the user the real problem plainly. If the error is about credits, say the Seamless lead-data API is out of credits and its public-API credit balance needs topping up (this is separate from the Seamless website's credits).
- After a search, state how many you found, highlight the 2–3 HIGHEST-scoring matches (name · title · company · why they're a strong fit), and tell them they can save the results to Contacts using the buttons below the list.
- If asked to draft/write/personalize outreach to a specific person you found, CALL draft_outreach with their exact fullName and the channel (email or linkedin), then present the returned subject/body. It grounds the message in why they matched.
- Never invent contacts — only reference what search_people or search_crm returned.

New Dawn targets two audiences: (1) international E-2 investors / high-net-worth individuals from treaty countries (UK, Germany, Japan, South Korea, Mexico, India, UAE, Brazil, Canada…) exploring US business ownership; titles like Owner, Founder, CEO, Investor, Managing Director, Entrepreneur. (2) Referral partners — immigration attorneys, visa consultants, wealth managers, relocation advisors, business brokers who work with international clients.`;

const ICP_SUMMARY = `NEW DAWN FRANCHISING — POSITIONING & IDEAL CUSTOMER PROFILE
Business: The first franchise platform built from the ground up for E-2 Treaty Investor Visa candidates. Investors own and direct a real US business (Property Management, Telecom/VOIP, or Insurance) while New Dawn's teams + proprietary AI run day-to-day operations. ~$225,000 qualifying investment, funds held in escrow, money-back if the visa is denied, live anywhere in the USA, in-house buy-back exit.

PRIMARY ICP — Investors:
- High-net-worth individuals (investable assets > ~$300k) from E-2 treaty countries: UK, Germany, Japan, South Korea, Mexico, India, UAE, Brazil, Canada, France, Italy, Spain, Turkey, Taiwan.
- Titles: Owner, Founder, Co-Founder, CEO, President, Investor, Managing Director, Entrepreneur, Director.
- Signals: researching US immigration / "buy US business" / "E-2 visa" / "turnkey business USA"; relocating families; exiting a business abroad.
- Exclude: US-based individuals (they don't need E-2).

SECONDARY ICP — Referral partners (they refer investors for a 12.5% / ~$28,125 fee):
- Immigration attorneys & law firms (E-2/EB-5 practice), visa/relocation consultants, wealth managers & family offices with international clients, business brokers.
- Located anywhere, but client base must be international.

SUGGESTED SEARCHES:
- Investors: titles [Owner, Founder, CEO, Investor, Managing Director] + countries [UK, Germany, Japan, South Korea, Mexico, India] + keywords [investor, relocation, US business].
- Partners: titles [Immigration Attorney, Partner, Founder] + keywords [E-2 visa, immigration, investor visa, relocation].`;

const TOOLS = [
  {
    name: "search_people",
    description:
      "Search lead-data providers for people/contacts matching the criteria and build a prospect list. Use whenever the user wants to find prospects or build a list. To find everyone at a specific company, set companyNames (and companyDomains if you can infer the domain) and leave titles empty.",
    input_schema: {
      type: "object",
      properties: {
        companyNames: { type: "array", items: { type: "string" }, description: "Company/employer names, e.g. GlobeVisa. Use this to find people who work at a specific company." },
        companyDomains: { type: "array", items: { type: "string" }, description: "Company website domains, e.g. globevisa.com. Infer from the company name when possible." },
        titles: { type: "array", items: { type: "string" }, description: "Job titles, e.g. CEO, Owner, Investor, Immigration Attorney" },
        seniorities: { type: "array", items: { type: "string" }, description: "e.g. C-Level, VP, Director, Manager" },
        countries: { type: "array", items: { type: "string" }, description: "Countries to target, e.g. United Kingdom, Germany, Japan" },
        states: { type: "array", items: { type: "string" }, description: "US states or regions" },
        industries: { type: "array", items: { type: "string" } },
        companySizes: { type: "array", items: { type: "string" } },
        fullName: { type: "array", items: { type: "string" }, description: "Specific people by full name" },
        keywords: { type: "array", items: { type: "string" }, description: "Free-text signals/keywords" },
        mode: { type: "string", enum: ["contacts", "companies"], description: "Search people (contacts) or companies. Default contacts." },
      },
    },
  },
  {
    name: "search_crm",
    description:
      "Search people we ALREADY have in our own CRM (existing contacts/leads), by natural-language description. Use when the user asks about existing pipeline/contacts rather than finding brand-new prospects. Returns matches with their stored lead score and ICP fit.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language description of who to find in the CRM, e.g. 'immigration attorneys in the UK we've contacted'." },
      },
      required: ["query"],
    },
  },
  {
    name: "draft_outreach",
    description:
      "Write a personalized email or LinkedIn message to a specific prospect from the search results, grounded in WHY they matched (their ICP reasons / signals). Use when the user asks to draft, write, or personalize outreach to someone you found.",
    input_schema: {
      type: "object",
      properties: {
        fullName: { type: "string", description: "Exact full name of the prospect to write to (must be one of the people already found)." },
        channel: { type: "string", enum: ["email", "linkedin"], description: "Which channel to write for. Default email." },
      },
      required: ["fullName"],
    },
  },
  {
    name: "analyze_icp",
    description:
      "Get New Dawn Franchising's business positioning and ideal-customer profile (who to target, suggested search criteria). Use when asked who to target or to analyze the business/website.",
    input_schema: { type: "object", properties: {} },
  },
];

// Map an EnrichedContact (the shape providerSearch actually returns, grouped
// into companies) to an AgentPerson, reusing the ICP intel already computed in
// personToContact so we don't score twice.
function mapContact(c: EnrichedContact): AgentPerson {
  return {
    fullName: c.fullName,
    firstName: c.firstName,
    lastName: c.lastName,
    jobTitle: c.jobTitle ?? null,
    companyName: c.companyName ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    location: c.companyLocation ?? null,
    intel: {
      fitScore: c.icpFitScore ?? 0,
      intentScore: c.icpIntentScore ?? 0,
      composite: c.icpScore ?? 0,
      tier: c.icpTier ?? "low",
      audience: c.icpAudience ?? "unknown",
      reasons: c.icpReasons ?? [],
      explanation: c.icpExplanation ?? "",
    },
  };
}

function pickProvider(requested?: string): ProviderId {
  const r = (requested || "").toLowerCase();
  if (r === "apollo" || r === "origami" || r === "seamless") return r as ProviderId;
  if (process.env.SEAMLESS_API_KEY) return "seamless";
  if (process.env.APOLLO_API_KEY) return "apollo";
  if (process.env.ORIGAMI_API_KEY) return "origami";
  return "seamless";
}

export async function runLeadResearchAgent(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  requestedProvider?: string,
): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const provider = pickProvider(requestedProvider);

  if (!apiKey) {
    return { reply: "The AI assistant isn't configured yet (ANTHROPIC_API_KEY is missing). Add it in Railway to enable conversational lead research.", people: [], provider };
  }

  // Conversation must start with a user message.
  const clean = (messages || []).filter((m) => m && typeof m.content === "string" && m.content.trim());
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (clean.length === 0) return { reply: "What kind of customers are you looking for?", people: [], provider };

  // Working transcript for the Anthropic API (content blocks).
  const convo: any[] = clean.map((m) => ({ role: m.role, content: m.content }));
  const foundByKey = new Map<string, AgentPerson>();

  async function callClaude(): Promise<any> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM_PROMPT, tools: TOOLS, messages: convo }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function execTool(name: string, input: any): Promise<string> {
    if (name === "analyze_icp") return ICP_SUMMARY;
    if (name === "draft_outreach") {
      const fullName = String(input?.fullName || "").trim();
      const channel = input?.channel === "linkedin" ? "linkedin" : "email";
      if (!fullName) return JSON.stringify({ error: "fullName required" });
      // Pull the matched person (with intel) from this session's results.
      const person = Array.from(foundByKey.values()).find(
        (p) => p.fullName.toLowerCase() === fullName.toLowerCase(),
      );
      try {
        const draft = await draftProspectOutreach({
          fullName,
          firstName: person?.firstName ?? fullName.split(" ")[0],
          jobTitle: person?.jobTitle ?? null,
          companyName: person?.companyName ?? null,
          country: person?.location ?? null,
          channel,
          audience: person?.intel.audience,
          reasons: person?.intel.reasons,
          explanation: person?.intel.explanation,
        });
        return JSON.stringify({ channel: draft.channel, subject: draft.subject, body: draft.body });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "draft failed" });
      }
    }
    if (name === "search_crm") {
      const query = String(input?.query || "").trim();
      if (!query) return JSON.stringify({ error: "query required" });
      const started = Date.now();
      try {
        const matches = await searchCrmContacts(query, 15);
        for (const m of matches) {
          const key = (m.email || `${m.fullName}|${m.firmName}`).toLowerCase();
          if (!foundByKey.has(key)) {
            const intel = scoreProspect({
              jobTitle: m.jobTitle, company: m.firmName, country: m.country,
              personaType: m.personaType, email: m.email, phone: m.phone,
              linkedinUrl: m.linkedinUrl, text: [m.jobTitle, m.firmName, m.notes].filter(Boolean).join(" "),
            });
            foundByKey.set(key, {
              fullName: m.fullName, firstName: m.fullName.split(" ")[0] || m.fullName,
              lastName: m.fullName.split(" ").slice(1).join(" "), jobTitle: m.jobTitle,
              companyName: m.firmName, email: m.email, phone: m.phone, linkedinUrl: m.linkedinUrl,
              location: m.country, intel, inCrm: true,
            });
          }
        }
        void logSearchEvent({ surface: "crm-semantic", query, resultCount: matches.length, durationMs: Date.now() - started });
        const sample = matches.slice(0, 5).map((m) => `${m.fullName} — ${m.jobTitle || "?"}${m.firmName ? ` @ ${m.firmName}` : ""} (lead score ${m.leadScore})`);
        return JSON.stringify({ source: "crm", found: matches.length, matchType: matches[0]?.matchType ?? "keyword", sample });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "crm search failed" });
      }
    }
    if (name === "search_people") {
      // Map the tool's friendly names onto the REAL LeadSearchFilters fields
      // (jobTitle/contactCountry/companyName/…). Mismatched names here were the
      // bug that made the agent return nothing.
      const arr = (v: any): string[] | undefined =>
        Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : undefined;
      const filters: LeadSearchFilters = {
        jobTitle: arr(input?.titles),
        seniority: arr(input?.seniorities),
        contactCountry: arr(input?.countries),
        contactState: arr(input?.states),
        industry: arr(input?.industries),
        companySize: arr(input?.companySizes),
        companyName: arr(input?.companyNames),
        companyDomain: arr(input?.companyDomains),
        fullName: arr(input?.fullName),
        keywords: arr(input?.keywords),
      };
      const mode = input?.mode === "companies" ? "companies" : "contacts";
      const started = Date.now();
      try {
        const result = await cachedProviderSearch(provider, mode, filters, { limit: 50 });
        // A provider error (out of credits, rate-limited, unauthorized, network)
        // is NOT an empty result — the search never ran. Surface it truthfully so
        // the model stops fabricating reasons ("company too small / misspelled").
        if (result.error) {
          void logSearchEvent({ surface: "agent", provider, filters, error: `${result.error.code}: ${result.error.message}`, durationMs: Date.now() - started });
          return JSON.stringify({
            provider,
            error: result.error.message,
            code: result.error.code,
            found: 0,
            note: "DATA-PROVIDER ERROR (billing/credits, auth, rate-limit, or network) — NOT an empty result. The company was never actually searched. Tell the user this exact reason; do NOT retry and do NOT speculate that the company is too small, misspelled, or has limited public data.",
          });
        }
        // providerSearch groups people into companies; flatten back to contacts.
        const contacts: EnrichedContact[] = (result.companies || []).flatMap((c) => c.contacts || []);
        const scored: AgentPerson[] = [];
        for (const ct of contacts) {
          const key = (ct.email || `${ct.fullName}|${ct.companyName}`).toLowerCase();
          if (!foundByKey.has(key)) {
            const mapped = mapContact(ct);
            foundByKey.set(key, mapped);
            scored.push(mapped);
          }
        }
        // Lead with the highest-scoring matches so the model explains the best fits.
        scored.sort((a, b) => b.intel.composite - a.intel.composite);
        void logSearchEvent({
          surface: "agent", provider, filters, resultCount: contacts.length,
          cached: result.cached ?? null, durationMs: Date.now() - started,
        });
        const sample = scored.slice(0, 5).map(
          (p) => `[${p.intel.tier}] ${p.fullName} — ${p.jobTitle || "?"}${p.companyName ? ` @ ${p.companyName}` : ""} · ${p.intel.reasons.slice(0, 2).join(", ") || "match"}`,
        );
        return JSON.stringify({ provider, cached: result.cached ?? false, found: contacts.length, total_unique: foundByKey.size, top_matches: sample });
      } catch (e: any) {
        void logSearchEvent({ surface: "agent", provider, filters, error: e?.message, durationMs: Date.now() - started });
        return JSON.stringify({ error: e?.message || "search failed", provider });
      }
    }
    return JSON.stringify({ error: `unknown tool ${name}` });
  }

  try {
    let reply = "";
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const data = await callClaude();
      const blocks: any[] = data.content || [];
      // Capture any text the model emitted this round.
      reply = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() || reply;

      if (data.stop_reason !== "tool_use") break;

      // Append the assistant turn (with tool_use blocks) then run the tools.
      convo.push({ role: "assistant", content: blocks });
      const toolResults: any[] = [];
      for (const b of blocks) {
        if (b.type === "tool_use") {
          const out = await execTool(b.name, b.input);
          toolResults.push({ type: "tool_result", tool_use_id: b.id, content: out });
        }
      }
      convo.push({ role: "user", content: toolResults });
    }

    return {
      reply: reply || "Done.",
      people: Array.from(foundByKey.values())
        .sort((a, b) => b.intel.composite - a.intel.composite)
        .slice(0, 60),
      provider,
    };
  } catch (err: any) {
    console.error("[LeadResearchAgent] error:", err?.message || err);
    return { reply: "Sorry — I hit a problem reaching the AI service. Please try again.", people: [], provider, error: err?.message };
  }
}
