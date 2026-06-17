/**
 * similar-companies.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Finds REAL companies similar to a reference company — e.g. "companies like
 * GlobeVisa", "GlobeVisa's competitors", "visa consultancies like X".
 *
 * This is the capability behind the Lead Research agent's `find_similar_companies`
 * tool. It does NOT just query our lead-data provider (Seamless): Seamless can
 * only look up a company you already name, so it can never answer "find me
 * companies LIKE this one". Instead we:
 *
 *   1. Search the live web via SerpAPI (the same provider used across the app)
 *      with a handful of competitor-discovery queries.
 *   2. Hand the real organic results (titles, snippets, links, related searches,
 *      knowledge-graph) to Claude and have it synthesize a clean, deduplicated
 *      list of genuinely-comparable companies — each with a website domain, a
 *      one-line description, and HQ location.
 *
 * The result feeds two things: the agent lists the companies to the user, and
 * each carries a `domain` so the user can immediately say "find contacts at X"
 * and the existing Seamless contact search takes over.
 *
 * Everything is defensive: no SERPAPI_KEY → fall back to the model's own
 * knowledge (flagged groundedByWeb=false); no ANTHROPIC_API_KEY or a provider
 * error → surfaced as an `error`/`note`, never thrown to the caller.
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const SERP_ENDPOINT = "https://serpapi.com/search.json";

export interface SimilarCompany {
  name: string;
  domain: string | null;
  description: string | null;
  location: string | null;
}

export interface SimilarCompaniesResult {
  reference: string;
  companies: SimilarCompany[];
  sources: string[]; // SERP result links used as evidence
  groundedByWeb: boolean; // true when live web results informed the list
  note?: string; // human-readable caveat (e.g. "web search unavailable")
  error?: string; // set only when we could not produce a list at all
}

export interface FindSimilarCompaniesOpts {
  reference: string;
  referenceDomain?: string | null;
  descriptionHint?: string | null;
  countries?: string[];
  limit?: number;
}

interface SerpHit {
  title: string;
  link: string;
  snippet: string;
}

interface SerpBundle {
  hits: SerpHit[];
  related: string[];
  knowledgeGraph: string | null;
}

// Domains that are directories / listicles / social / news, not actual peer
// companies. We strip these from the evidence's candidate-domain hints and tell
// the model to never return them as a "company".
const NON_COMPANY_HOST = [
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "tiktok.com", "wikipedia.org", "crunchbase.com", "owler.com",
  "tracxn.com", "g2.com", "capterra.com", "clutch.co", "glassdoor.com",
  "indeed.com", "trustpilot.com", "yelp.com", "reddit.com", "quora.com",
  "medium.com", "bloomberg.com", "forbes.com", "techcrunch.com", "cbinsights.com",
  "pitchbook.com", "zoominfo.com", "rocketreach.co", "apollo.io", "6sense.com",
  "similarweb.com", "semrush.com", "statista.com", "businesswire.com", "prnewswire.com",
];

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isNonCompanyHost(host: string): boolean {
  return NON_COMPANY_HOST.some((h) => host === h || host.endsWith(`.${h}`));
}

/** One SerpAPI Google query → organic hits + related searches + knowledge graph. */
async function serpSearch(query: string, num = 8): Promise<SerpBundle> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return { hits: [], related: [], knowledgeGraph: null };
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: String(num),
    hl: "en",
  });
  try {
    const res = await fetch(`${SERP_ENDPOINT}?${params}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return { hits: [], related: [], knowledgeGraph: null };
    const data: any = await res.json();
    const hits: SerpHit[] = (data.organic_results || [])
      .filter((r: any) => r && r.title && r.link)
      .map((r: any) => ({ title: String(r.title), link: String(r.link), snippet: String(r.snippet || "") }));
    const related: string[] = (data.related_searches || [])
      .map((r: any) => String(r?.query || "").trim())
      .filter(Boolean);
    const kg = data.knowledge_graph
      ? [data.knowledge_graph.title, data.knowledge_graph.type, data.knowledge_graph.description]
          .filter(Boolean)
          .join(" — ")
      : null;
    return { hits, related, knowledgeGraph: kg || null };
  } catch {
    return { hits: [], related: [], knowledgeGraph: null };
  }
}

/** Build the competitor-discovery query set for a reference company. */
function buildQueries(opts: FindSimilarCompaniesOpts): string[] {
  const ref = opts.reference.trim();
  const hint = (opts.descriptionHint || "").trim();
  const region = (opts.countries || []).filter(Boolean).join(" ");
  const queries = [
    `${ref} competitors`,
    `companies like ${ref}`,
    `${ref} alternatives`,
  ];
  if (hint) {
    queries.push(region ? `top ${hint} companies ${region}` : `top ${hint} companies`);
    queries.push(`${hint} firms similar to ${ref}`);
  } else {
    queries.push(`${ref} similar companies industry`);
  }
  // De-dupe while preserving order.
  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
}

/** Collapse all SERP bundles into a compact, deduped evidence string for the LLM. */
function buildEvidence(bundles: SerpBundle[]): { evidence: string; sources: string[]; candidateDomains: string[] } {
  const seen = new Set<string>();
  const lines: string[] = [];
  const sources: string[] = [];
  const candidateDomains = new Set<string>();
  const related = new Set<string>();
  const kg: string[] = [];

  for (const b of bundles) {
    if (b.knowledgeGraph) kg.push(b.knowledgeGraph);
    for (const q of b.related) related.add(q);
    for (const h of b.hits) {
      const key = h.link.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const host = hostOf(h.link);
      if (host && !isNonCompanyHost(host)) candidateDomains.add(host);
      sources.push(h.link);
      const snippet = h.snippet.length > 240 ? `${h.snippet.slice(0, 240)}…` : h.snippet;
      lines.push(`• ${h.title} [${host}] — ${snippet}`);
    }
  }

  const parts: string[] = [];
  if (kg.length) parts.push(`Knowledge graph: ${Array.from(new Set(kg)).join("; ")}`);
  if (lines.length) parts.push(`Search results:\n${lines.join("\n")}`);
  if (related.size) parts.push(`Related searches: ${Array.from(related).slice(0, 12).join("; ")}`);

  return {
    evidence: parts.join("\n\n"),
    sources: sources.slice(0, 30),
    candidateDomains: Array.from(candidateDomains).slice(0, 40),
  };
}

/** Pull the first balanced JSON object/array out of an LLM text response. */
function extractJson(text: string): any {
  const trimmed = text.trim();
  // Strip ```json fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  // Find the first { or [ and parse from there.
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("no JSON in model response");
  // Try whole-tail parse first, then progressively trim trailing noise.
  const tail = body.slice(start);
  try {
    return JSON.parse(tail);
  } catch {
    // Best effort: find the matching close for the opening bracket.
    const open = tail[0];
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    for (let i = 0; i < tail.length; i++) {
      if (tail[i] === open) depth++;
      else if (tail[i] === close) {
        depth--;
        if (depth === 0) return JSON.parse(tail.slice(0, i + 1));
      }
    }
    throw new Error("unbalanced JSON in model response");
  }
}

function normDomain(raw: unknown): string | null {
  let s = String(raw || "").trim();
  if (!s || /^(n\/?a|none|unknown|null)$/i.test(s)) return null;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.split("/")[0].split("?")[0].split("#")[0].trim().toLowerCase();
  return s.includes(".") ? s : null;
}

/**
 * Ask Claude to synthesize the similar-company list from the web evidence.
 * Returns a parsed, sanitized list. Throws on hard failures (no key / API error)
 * so the caller can surface a precise message.
 */
async function synthesize(
  opts: FindSimilarCompaniesOpts,
  evidence: string,
  candidateDomains: string[],
  limit: number,
): Promise<SimilarCompany[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const ref = opts.reference.trim();
  const hint = (opts.descriptionHint || "").trim();
  const region = (opts.countries || []).filter(Boolean).join(", ");

  const system = `You identify real companies that are genuinely SIMILAR to a given reference company (direct competitors and close peers in the same line of business). You return STRICT JSON only — no prose, no markdown.`;

  const instruction = [
    `Reference company: ${ref}${opts.referenceDomain ? ` (${opts.referenceDomain})` : ""}.`,
    hint ? `What it does: ${hint}.` : `Infer what it does from the evidence and your own knowledge.`,
    region ? `Prefer companies serving / based in: ${region}.` : "",
    ``,
    evidence
      ? `Live web search evidence (use it as your primary source of truth):\n${evidence}`
      : `No web search results were available — use your own knowledge of this industry.`,
    candidateDomains.length ? `\nDomains seen in the results (prefer these for matching companies): ${candidateDomains.join(", ")}` : "",
    ``,
    `Return up to ${limit} companies that are genuinely comparable to ${ref} — same industry / type of business, real organizations a customer would consider alongside it.`,
    `Rules:`,
    `- EXCLUDE ${ref} itself.`,
    `- EXCLUDE directories, listicles, marketplaces, review/aggregator sites, news outlets, social networks, and data vendors (e.g. LinkedIn, Wikipedia, Crunchbase, Owler, Tracxn, G2, Clutch, Forbes). Those are sources, not peer companies.`,
    `- Only include companies you are reasonably confident are real.`,
    `- For "domain", give the company's primary website domain (e.g. example.com), preferring one that appears in the evidence. Use null if you don't know it — never guess a fake domain.`,
    `- "description": at most 14 words on what they do.`,
    `- "location": HQ city/country if known, else null.`,
    ``,
    `Output JSON exactly: {"companies":[{"name":"...","domain":"... or null","description":"...","location":"... or null"}]}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: instruction }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  const parsed = extractJson(text);
  const rawList: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.companies) ? parsed.companies : [];

  const refLower = ref.toLowerCase();
  const refDomain = normDomain(opts.referenceDomain);
  const out: SimilarCompany[] = [];
  const seen = new Set<string>();
  for (const c of rawList) {
    const name = String(c?.name || "").trim();
    if (!name) continue;
    if (name.toLowerCase() === refLower) continue; // never echo the reference
    const domain = normDomain(c?.domain);
    if (domain && refDomain && domain === refDomain) continue;
    if (domain && isNonCompanyHost(domain)) continue;
    const key = (domain || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      domain,
      description: c?.description ? String(c.description).trim() : null,
      location: c?.location ? String(c.location).trim() : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Find companies similar to a reference company. See file header for the flow.
 * Never throws — failures come back as `{ error }` / `{ note }`.
 */
export async function findSimilarCompanies(opts: FindSimilarCompaniesOpts): Promise<SimilarCompaniesResult> {
  const reference = (opts.reference || "").trim();
  const limit = Math.min(25, Math.max(3, Math.round(opts.limit || 12)));
  const base: SimilarCompaniesResult = { reference, companies: [], sources: [], groundedByWeb: false };

  if (!reference) return { ...base, error: "No reference company was provided." };

  // 1) Live web search (parallel queries). Missing SERPAPI_KEY → empty bundles.
  let bundles: SerpBundle[] = [];
  try {
    bundles = await Promise.all(buildQueries(opts).map((q) => serpSearch(q)));
  } catch {
    bundles = [];
  }
  const { evidence, sources, candidateDomains } = buildEvidence(bundles);
  const groundedByWeb = !!evidence;

  // 2) Synthesize the list with Claude.
  try {
    const companies = await synthesize(opts, evidence, candidateDomains, limit);
    const note = !process.env.SERPAPI_KEY
      ? "Web search isn't configured (SERPAPI_KEY missing) — this list comes from the model's own knowledge, not a live web search."
      : !groundedByWeb
        ? "Live web search returned nothing usable — this list comes from the model's own knowledge."
        : undefined;
    if (companies.length === 0) {
      return { ...base, sources, groundedByWeb, note, error: `Couldn't identify companies similar to ${reference}.` };
    }
    return { reference, companies, sources, groundedByWeb, note };
  } catch (e: any) {
    return { ...base, sources, groundedByWeb, error: e?.message || "similar-company synthesis failed" };
  }
}
