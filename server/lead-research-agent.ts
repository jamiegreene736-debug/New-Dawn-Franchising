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

import { providerSearch, type ProviderId, type LeadSearchFilters } from "./seamless-prospects";
import type { SeamlessPerson } from "./seamless-service";

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
- Use "search_people" to build prospect lists when the user describes who they want to reach. Translate their description into structured filters (titles, seniorities, countries, keywords, etc.).
- Use "analyze_icp" when they ask who to target, to analyze their business/website, or when you need context about New Dawn before searching.

Behaviour:
- Be concise, friendly, and action-oriented — like a sharp SDR teammate.
- When the user asks to "find" / "build a list" / "get me" prospects, CALL search_people (don't just describe what you would do).
- To find people who work at a specific company (e.g. "everyone at GlobeVisa"), set companyNames to that company and companyDomains to its likely domain (e.g. globevisa.com), and DON'T require a job title — that returns the whole company. Only add titles if the user asks for specific roles.
- If a search returns 0 results, retry once with a broader query (e.g. drop titles, or use companyDomains instead of companyNames, or vice-versa) before telling the user nothing was found.
- After a search, state how many you found, name 2–3 examples (name · title · company), and tell them they can save the results to Contacts using the buttons below the list.
- If asked to draft outreach, write the email/message directly in your reply (warm, non-salesy, signed "Dylan Delaney, New Dawn Franchising").
- Never invent contacts — only reference what search_people returned.

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
    name: "analyze_icp",
    description:
      "Get New Dawn Franchising's business positioning and ideal-customer profile (who to target, suggested search criteria). Use when asked who to target or to analyze the business/website.",
    input_schema: { type: "object", properties: {} },
  },
];

function mapPerson(p: SeamlessPerson): AgentPerson {
  const location = [p.city, p.state, p.country].filter(Boolean).join(", ") || null;
  return {
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    jobTitle: p.jobTitle ?? null,
    companyName: p.company ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    linkedinUrl: p.linkedinUrl ?? null,
    location,
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
      try {
        const result: any = await providerSearch(provider, mode, filters, { limit: 50 });
        const people: SeamlessPerson[] = result?.people || [];
        for (const p of people) {
          const key = (p.email || `${p.fullName}|${p.company}`).toLowerCase();
          if (!foundByKey.has(key)) foundByKey.set(key, mapPerson(p));
        }
        const sample = people.slice(0, 5).map((p) => `${p.fullName} — ${p.jobTitle || "?"}${p.company ? ` @ ${p.company}` : ""}`);
        return JSON.stringify({ provider, found: people.length, total_unique: foundByKey.size, sample });
      } catch (e: any) {
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
      people: Array.from(foundByKey.values()).slice(0, 60),
      provider,
    };
  } catch (err: any) {
    console.error("[LeadResearchAgent] error:", err?.message || err);
    return { reply: "Sorry — I hit a problem reaching the AI service. Please try again.", people: [], provider, error: err?.message };
  }
}
