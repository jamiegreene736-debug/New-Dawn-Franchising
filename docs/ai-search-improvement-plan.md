# AI Search Improvement Plan — Matching (and Beating) Alta "Katie"

**Goal:** Upgrade the CRM's AI search / lead-research capability so it is at least as good
as Alta HQ's AI SDR "Katie," tailored to New Dawn Franchising's E-2 visa franchise
business.

**Status:** Planning only — no functional code changes yet. This document is the agreed
scope before implementation begins.

---

## 1. Where we are today

We currently run **two parallel AI search systems**:

| System | File(s) | Engine | What it does |
|---|---|---|---|
| **Lead Research Agent** (conversational) | `server/lead-research-agent.ts`, `client/src/components/lead-research-agent.tsx`, route `POST /api/crm/lead-research/agent` (`server/routes.ts:1656`) | Claude Sonnet 4.6 + tool use (`search_people`, `analyze_icp`) | Chat assistant that translates a request into structured filters and runs a multi-provider people search. |
| **Seamless AI Search panel** (one-shot) | `server/seamless-prospects.ts`, `client/src/components/seamless-search-panel.tsx`, route `POST /api/crm/prospects/seamless-search` (`server/routes.ts:1677`) | GPT-4o-mini for NL→filter parsing, then provider search | Free-text query → JSON filters → Seamless/Apollo/Origami search, grouped by company. |

**Data providers wired up:** Seamless.AI, Apollo.io, Origami, SerpAPI, Hunter.io, Whitepages.
**CRM data:** `contacts`, `crm_clients`, `prospects`, `prospect_lists`, `prospect_list_members` (`shared/schema.ts`).

### Current limitations (the gap to close)
1. **No semantic / vector search** — purely keyword + structured filters. No embeddings, no RAG over our own CRM data or saved knowledge.
2. **No buying-intent / signal layer** — searches are static descriptions; nothing watches for funding, hiring, relocation, visa-research, news, or web-intent signals.
3. **No fit/intent scoring at search time** — results are returned ungraded; no "why this matches" explanation or confidence.
4. **No search over our own CRM** — the agent only queries external providers; it can't answer "who in my pipeline looks like X" or dedupe against existing contacts/clients.
5. **No caching / cost control** — identical queries re-hit paid APIs; reveals are manual and uncached.
6. **Shallow agent loop** — hard cap of 4 rounds, fixed prompts, no memory of prior searches in a session, no saved-search / monitoring.
7. **No outreach handoff from search** — finding people and contacting them are disconnected; no draft → sequence → schedule loop driven by the search results.
8. **Thin observability** — no logging of what was searched, what matched, conversion of searched→added→contacted→booked.

---

## 2. What "Katie" (Alta) does — the benchmark

From Alta's product material, Katie's strength is being a **signal-driven, scoring, multi-channel SDR**, not just a search box:

- **Monitors 50+ data sources** (CRM + external) to surface high-intent prospects from **hiring trends, funding events, tech-stack adoption, news**, etc.
- **ICP definition + automated prospecting** — builds prospect lists from buying signals, not just static filters.
- **Lead scoring & intent detection** — ranks/scores by *fit* and *buying intent* so reps focus on the best leads at the right time.
- **Multi-channel outreach** — personalized email + LinkedIn (+ phone via companion agent "Alex"), with fast, timed follow-up.
- **Personalization at scale** — messages tuned to persona data and prior campaign performance.
- **Real-time optimization** — reacts to buyer signals, launches timed outreach, learns from engagement.
- **24/7 autonomous operation** with CRM sync.

**Takeaway:** The differentiator is the pipeline **Signals → Score → Personalize → Multichannel outreach → Learn**, all closed-loop with the CRM. Our search is the front of that funnel; we need to build the rest and make the front semantic + intent-aware.

---

## 3. Target architecture

```
                 ┌─────────────────────────────────────────────────┐
   User query →  │  Unified AI Search / SDR Agent (Claude, tools)   │
                 │  - semantic intent parse + structured filters    │
                 │  - session memory + saved searches               │
                 └───────────────┬─────────────────────────────────┘
                                 │ tools
        ┌────────────────────────┼─────────────────────────────────┐
        ▼                        ▼                ▼                  ▼
 search_external          search_crm        score_leads        draft_outreach
 (Seamless/Apollo/   (pgvector semantic   (fit + intent     (email/LinkedIn,
  Origami/SerpAPI)    over our contacts/   model, ranked,    persona-aware,
                      clients/notes)       explained)        → sequence)
        │                        │                │                  │
        └────────────┬───────────┴────────────────┴──────────────────┘
                     ▼
            Signals ingestion (scheduled): news, funding, hiring, web-intent,
            visa/relocation keywords → writes signal rows + re-scores ICP matches
                     ▼
            Closed loop: saved search → daily monitor → new matches →
            auto-score → suggested/auto outreach → CRM activity + analytics
```

Key technology additions:
- **`pgvector`** extension on the existing Postgres (Drizzle) for embeddings/semantic search over our own data — no new infra.
- **Embeddings** via OpenAI `text-embedding-3-small` (cheap) or Voyage; stored on `contacts`/`crm_clients`/notes.
- **A `lead_signals` table** + scheduled jobs to populate intent signals.
- **A `lead_scores` table** (or columns) with fit score, intent score, composite, and an explanation string.
- **Unify the two AI systems** behind one agent so there's a single, consistent "AI search."

---

## 4. Phased implementation plan

### Phase 0 — Foundations & unification (low risk, high leverage)
- [ ] **Consolidate** the two systems: make the Seamless panel's NL box call the same agent, or extract a shared `parseQuery()` + `providerSearch()` core so prompts/filters don't drift. Single source of truth in `server/seamless-prospects.ts`.
- [ ] **Upgrade the agent loop** in `lead-research-agent.ts`: raise `MAX_ROUNDS` (with a token/-time budget guard), add session memory of prior searches, and stream partial results to the UI.
- [ ] **Add search telemetry**: log query, parsed filters, provider, result count, and downstream conversion (added → contacted → booked) to a `search_events` table for analytics and prompt tuning.
- [ ] **Result caching**: cache provider search responses (keyed by normalized filters) with a short TTL to cut cost and latency; cache reveals permanently per contact.

### Phase 1 — Search our own CRM semantically (RAG / pgvector)
- [ ] Enable `pgvector`; add `embedding vector(1536)` columns (or a `lead_embeddings` table) for `contacts`, `crm_clients`, and key note/activity text.
- [ ] Backfill + on-write embedding generation (queue) using `text-embedding-3-small`.
- [ ] New agent tool **`search_crm`**: semantic + filter hybrid search over our own data ("find pipeline clients similar to my best closed deals," "immigration attorneys we've already met").
- [ ] **Dedupe at search time**: cross-reference external results against existing `contacts`/`crm_clients` so the agent flags "already in CRM" and avoids re-adding.

### Phase 2 — Buying-intent / signal layer (the core Katie differentiator)
- [ ] New table **`lead_signals`** (contactId/clientId, type, source, payload, detectedAt, weight).
- [ ] Scheduled ingestion jobs (cron/worker) for signals relevant to **New Dawn's ICP**:
  - **Investor signals:** business-for-sale / exit activity, relocation intent, "E-2 visa"/"buy US business" web & news mentions, LinkedIn role changes from treaty countries, family-office activity.
  - **Referral-partner signals:** immigration-law-firm news, attorney role changes, new E-2/EB-5 practice pages, content/posts about investor visas.
  - Generic firmographic signals where available via providers (funding, hiring, headcount growth).
- [ ] **News/web monitoring** via SerpAPI / news API, keyed off the ICP keyword set already encoded in `ICP_SUMMARY`.
- [ ] Signals feed scoring (Phase 3) and surface as "why now" badges in the UI.

### Phase 3 — Fit + intent scoring with explanations
- [ ] **`lead_scores`**: `fitScore` (how well they match ICP — title/country/firmographics/treaty-country eligibility), `intentScore` (recency/weight of signals), `composite`, and an LLM-generated **`explanation`** ("UK-based founder researching US business ownership; treaty-country eligible; matched 2 relocation signals this week").
- [ ] Scoring uses a transparent rubric + the existing `ICP_SUMMARY` so it's tuned to E-2 economics (treaty countries, ~$225k investable, exclude US-based).
- [ ] **Rank search results by composite score** and show the explanation + signal badges in both UIs — this is the visible quality jump over keyword search.
- [ ] Re-score nightly as new signals arrive.

### Phase 4 — Close the loop: search → personalized multichannel outreach
- [ ] New agent tool **`draft_outreach`**: persona-aware email + LinkedIn message generation using the contact's data, matched signals ("congrats on the funding / saw you're exploring US options"), and New Dawn positioning. Reuse the campaign infra already in the repo (the recent campaign/automation work — `#80`–`#84`).
- [ ] **One-click handoff** from a search result to: add to Contacts → enroll in the right two-track sequence (broker vs. client, which already exists) → schedule.
- [ ] **Meeting scheduling** link/flow in the generated outreach.
- [ ] Personalization learns from campaign performance (which subject lines/angles convert) — feed `search_events` + campaign analytics back into the drafting prompt.

### Phase 5 — Autonomy & monitoring (24/7 "Katie" parity)
- [ ] **Saved searches / ICP watchlists**: persist a search; a scheduled job re-runs it, scores new matches, and queues them.
- [ ] **Daily digest / inbox**: "12 new high-intent prospects matched your 'UK founders exploring US business' search" with one-click approve→outreach.
- [ ] Optional **auto-pilot mode** (guardrailed): for high-confidence matches, auto-draft and queue outreach for human approval (then optionally fully auto), mirroring Katie's autonomous operation.
- [ ] **Analytics dashboard**: searched → matched → added → contacted → replied → booked, plus signal-source effectiveness, to prove ROI and tune scoring.

---

## 5. How this beats Katie for *this* business
Katie is a generic GTM SDR. Our edge is **domain specialization**:
- Scoring and signals encode **E-2 treaty-country eligibility** and the franchise economics (~$225k, escrow, money-back-if-denied) — generic tools don't understand this ICP.
- Two-audience model (**investors + referral partners**) with audience-specific signals and the existing **two-track (broker/client) campaigns**.
- Self-hosted on our own Postgres/Drizzle stack — no per-seat SDR-tool pricing, full data ownership, and tight CRM integration we already have.

---

## 6. Risks, dependencies, and cost notes
- **API keys / quotas:** intent ingestion and embeddings add OpenAI/SerpAPI/news-API spend — mitigate with caching, batching, and `text-embedding-3-small`.
- **Provider ToS:** confirm LinkedIn/web monitoring stays within provider terms; prefer official provider signals where available.
- **Data quality:** scoring is only as good as the signal feeds — start with 2–3 high-signal sources, expand iteratively.
- **Sequencing:** Phases 0–1 are safe, additive, and shippable independently. Phases 2–3 deliver the biggest perceived quality jump. Phase 4–5 reach full Katie parity.
- **Compliance:** outreach automation must respect the existing legal disclaimers (`#81`) and anti-spam/consent rules.

---

## 7. Suggested first deliverable (if approved)
Ship **Phase 0 + a thin slice of Phase 1 and Phase 3**:
1. Unify the two AI systems behind one agent core + add caching and telemetry.
2. Add `search_crm` semantic search over existing contacts (pgvector).
3. Add fit-score + "why this matches" explanation to ranked results in both UIs.

That alone moves the AI search from "keyword filter builder" to "explained, CRM-aware, ranked recommendations" — the most visible step toward Katie-level quality.
