/**
 * lead-signals.ts  (Phase 2 — buying-intent signal layer)
 * ───────────────────────────────────────────────────────────────────────────
 * Detects and stores buying-intent signals for CRM contacts so the AI search /
 * scoring can prioritise "the exact moments that matter" — the core of an
 * Alta-Katie-style signal-driven SDR.
 *
 * Signals relevant to New Dawn's ICP:
 *   • Investors  — relocation intent, "buy a US business", E-2/EB-5 research,
 *                  business exits/liquidity, high-net-worth events.
 *   • Partners   — immigration-firm news, new E-2/EB-5 practice content, posts
 *                  about investor visas.
 *
 * Ingestion is best-effort web monitoring via SerpAPI (searchByFreeQuery),
 * classified with the same intent rubric the scorer uses (matchIntentSignals).
 * Signals are stored in `lead_signals` (created idempotently in ensure-schema)
 * and folded into ICP scoring in lead-intelligence.scoreProspect.
 *
 * Everything is defensive: missing SERPAPI_KEY, provider errors, or a missing
 * table degrade to a no-op rather than throwing into a cron or request.
 */

import { pool } from "./db";
import { matchIntentSignals } from "./lead-intelligence";
import { searchByFreeQuery } from "./prospect-search";

export type SignalType =
  | "news" | "funding" | "hiring" | "role_change" | "relocation"
  | "visa_research" | "business_for_sale" | "web_intent" | "other";

export interface LeadSignal {
  contactId?: string | null;
  clientId?: string | null;
  signalType: SignalType;
  source: string;
  title: string;
  url?: string | null;
  snippet?: string | null;
  weight: number;
}

// Map an intent label (from matchIntentSignals) to a coarse signal type.
function classifyType(label: string): SignalType {
  const l = label.toLowerCase();
  if (l.includes("relocation")) return "relocation";
  if (l.includes("e-2") || l.includes("eb-5") || l.includes("visa")) return "visa_research";
  if (l.includes("buy") || l.includes("for sale") || l.includes("exit")) return "business_for_sale";
  if (l.includes("expansion")) return "web_intent";
  if (l.includes("net-worth") || l.includes("net worth")) return "web_intent";
  return "news";
}

/** Insert a signal, ignoring exact duplicates (same contact + url + title). */
export async function recordSignal(sig: LeadSignal): Promise<boolean> {
  try {
    const res = await pool.query(
      `INSERT INTO lead_signals (contact_id, client_id, signal_type, source, title, url, snippet, weight)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8
       WHERE NOT EXISTS (
         SELECT 1 FROM lead_signals
          WHERE contact_id IS NOT DISTINCT FROM $1
            AND coalesce(url,'') = coalesce($6,'')
            AND title = $5
       )`,
      [
        sig.contactId ?? null, sig.clientId ?? null, sig.signalType, sig.source,
        sig.title, sig.url ?? null, sig.snippet ?? null, Math.round(sig.weight),
      ],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.error("[lead-signals] recordSignal skipped:", err?.message || err);
    return false;
  }
}

export interface StoredSignal {
  id: string;
  signalType: SignalType;
  source: string;
  title: string;
  url: string | null;
  snippet: string | null;
  weight: number;
  detectedAt: string;
}

export async function getSignalsForContact(contactId: string, limit = 20): Promise<StoredSignal[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, signal_type AS "signalType", source, title, url, snippet, weight,
              detected_at AS "detectedAt"
         FROM lead_signals
        WHERE contact_id = $1
        ORDER BY detected_at DESC
        LIMIT ${Number(limit)}`,
      [contactId],
    );
    return rows as StoredSignal[];
  } catch {
    return [];
  }
}

/** Recent signals for many contacts at once → { contactId: signals[] }. */
export async function getSignalsForContacts(contactIds: string[]): Promise<Map<string, StoredSignal[]>> {
  const map = new Map<string, StoredSignal[]>();
  const ids = contactIds.filter(Boolean);
  if (ids.length === 0) return map;
  try {
    const { rows } = await pool.query(
      `SELECT id, contact_id AS "contactId", signal_type AS "signalType", source, title, url,
              snippet, weight, detected_at AS "detectedAt"
         FROM lead_signals
        WHERE contact_id = ANY($1::varchar[])
        ORDER BY detected_at DESC`,
      [ids],
    );
    for (const r of rows as Array<StoredSignal & { contactId: string }>) {
      const arr = map.get(r.contactId) ?? [];
      arr.push(r);
      map.set(r.contactId, arr);
    }
  } catch (err: any) {
    console.error("[lead-signals] getSignalsForContacts skipped:", err?.message || err);
  }
  return map;
}

/**
 * Web-monitor one contact for fresh intent signals and store any found.
 * Best-effort; returns the number of new signals recorded.
 */
export async function ingestSignalsForContact(contact: {
  id: string; firstName?: string | null; lastName?: string | null;
  firmName?: string | null; country?: string | null; personaType?: string | null;
}): Promise<number> {
  if (!process.env.SERPAPI_KEY) return 0;
  const name = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
  if (!name) return 0;

  // Bias the query toward the signals we care about for this audience.
  const isPartner = (contact.personaType || "").toLowerCase().includes("attorney")
    || (contact.personaType || "").toLowerCase().includes("consultant");
  const intentTerms = isPartner
    ? `(E-2 visa OR EB-5 OR investor visa OR immigration)`
    : `(relocate OR "E-2 visa" OR "buy a US business" OR "selling business" OR investor visa)`;
  const query = [name, contact.firmName, contact.country, intentTerms].filter(Boolean).join(" ");

  let recorded = 0;
  try {
    const results = await searchByFreeQuery(query, 8);
    for (const r of results) {
      const text = `${r.name ?? ""} ${r.snippet ?? ""}`.trim();
      const hits = matchIntentSignals(text);
      if (hits.length === 0) continue;
      const top = hits.sort((a, b) => b.weight - a.weight)[0];
      const ok = await recordSignal({
        contactId: contact.id,
        signalType: classifyType(top.label),
        source: "serpapi-web",
        title: (r.name || top.label).slice(0, 300),
        url: r.sourceUrl ?? r.website ?? null,
        snippet: (r.snippet ?? "").slice(0, 500) || null,
        weight: top.weight,
      });
      if (ok) recorded++;
    }
  } catch (err: any) {
    console.error("[lead-signals] ingest failed for", name, err?.message || err);
  }
  return recorded;
}

/**
 * Daily ingestion sweep: monitor a batch of the most promising contacts (those
 * with a real name and an ICP-relevant persona/country) for new signals. Bounded
 * so a free SerpAPI tier isn't blown through in one run.
 */
export async function runSignalIngestion(maxContacts = 25): Promise<{ scanned: number; recorded: number }> {
  if (!process.env.SERPAPI_KEY) {
    console.log("[lead-signals] SERPAPI_KEY missing — signal ingestion skipped.");
    return { scanned: 0, recorded: 0 };
  }
  let scanned = 0;
  let recorded = 0;
  try {
    // Prioritise contacts we haven't scanned recently, highest lead score first.
    const { rows } = await pool.query(
      `SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName",
              c.firm_name AS "firmName", c.country, c.persona_type AS "personaType"
         FROM contacts c
        WHERE c.status NOT IN ('unsubscribed','bounced')
        ORDER BY c.lead_score DESC, c.updated_at DESC
        LIMIT $1`,
      [maxContacts],
    );
    for (const c of rows) {
      scanned++;
      recorded += await ingestSignalsForContact(c);
    }
  } catch (err: any) {
    console.error("[lead-signals] runSignalIngestion error:", err?.message || err);
  }
  console.log(`[lead-signals] ingestion complete — scanned ${scanned}, recorded ${recorded} new signals.`);
  try {
    const { discoverFirmsFromSignals } = await import("./introducer-lookalike");
    await discoverFirmsFromSignals();
  } catch (err: any) {
    console.warn("[lead-signals] firm discovery skipped:", err?.message || err);
  }
  return { scanned, recorded };
}
