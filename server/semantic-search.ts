/**
 * semantic-search.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Semantic ("find people like this") search over our OWN CRM contacts, so the
 * AI search can answer questions like "immigration attorneys we've already
 * spoken to" or "pipeline contacts similar to my best referral partners"
 * instead of only hitting external providers.
 *
 * Uses pgvector when available (embeddings via OpenAI text-embedding-3-small,
 * stored on contacts.embedding). When the `vector` extension or embeddings are
 * NOT present (e.g. the DB role can't CREATE EXTENSION), it degrades gracefully
 * to a keyword ILIKE search so the feature always returns something useful.
 *
 * Embeddings are generated lazily and in small batches on demand — there is no
 * required migration or backfill cron. The first few searches simply fall back
 * to keyword search while the index warms up.
 */

import { pool } from "./db";
import { createLazyOpenAIClient } from "./openai-client";

const openai = createLazyOpenAIClient();

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const BACKFILL_BATCH = 25;

let vectorReady: boolean | null = null;

/** Detect (once) whether pgvector + the contacts.embedding column are usable. */
async function vectorAvailable(): Promise<boolean> {
  if (vectorReady !== null) return vectorReady;
  try {
    const ext = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
    if (ext.rowCount === 0) { vectorReady = false; return false; }
    const col = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'embedding'`,
    );
    vectorReady = (col.rowCount ?? 0) > 0;
  } catch {
    vectorReady = false;
  }
  return vectorReady;
}

function contactText(c: { firstName?: string; lastName?: string; jobTitle?: string | null; firmName?: string | null; country?: string | null; personaType?: string | null; notes?: string | null }): string {
  return [
    `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
    c.jobTitle,
    c.firmName,
    c.country,
    c.personaType,
    c.notes,
  ].filter(Boolean).join(" · ");
}

async function embed(text: string): Promise<number[] | null> {
  const input = (text || "").trim();
  if (!input) return null;
  try {
    const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: input.slice(0, 8000) });
    const vec = resp.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBED_DIMS ? vec : null;
  } catch (err: any) {
    console.error("[semantic-search] embed failed:", err?.message || err);
    return null;
  }
}

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Embed up to BACKFILL_BATCH contacts that don't yet have an embedding. Safe to
 * call opportunistically; returns the number indexed. No-op without pgvector.
 */
export async function backfillContactEmbeddings(): Promise<number> {
  if (!(await vectorAvailable())) return 0;
  const { rows } = await pool.query(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", job_title AS "jobTitle",
            firm_name AS "firmName", country, persona_type AS "personaType", notes
       FROM contacts
      WHERE embedding IS NULL
      LIMIT $1`,
    [BACKFILL_BATCH],
  );
  let indexed = 0;
  for (const c of rows) {
    const vec = await embed(contactText(c));
    if (!vec) continue;
    try {
      await pool.query(`UPDATE contacts SET embedding = $1::vector WHERE id = $2`, [toVectorLiteral(vec), c.id]);
      indexed++;
    } catch (err: any) {
      console.error("[semantic-search] store embedding failed:", err?.message || err);
    }
  }
  return indexed;
}

export interface CrmMatch {
  id: string;
  fullName: string;
  jobTitle: string | null;
  firmName: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  personaType: string | null;
  leadScore: number;
  status: string;
  notes: string | null;
  similarity: number | null; // 0-1 cosine similarity when vector search ran; null for keyword
  matchType: "semantic" | "keyword";
}

function mapRow(r: any, matchType: "semantic" | "keyword", similarity: number | null): CrmMatch {
  return {
    id: r.id,
    fullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    jobTitle: r.jobTitle ?? null,
    firmName: r.firmName ?? null,
    country: r.country ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    linkedinUrl: r.linkedinUrl ?? null,
    personaType: r.personaType ?? null,
    leadScore: r.leadScore ?? 0,
    status: r.status ?? "new",
    notes: r.notes ?? null,
    similarity,
    matchType,
  };
}

const SELECT_COLS = `id, first_name AS "firstName", last_name AS "lastName", job_title AS "jobTitle",
  firm_name AS "firmName", country, email, phone, linkedin_url AS "linkedinUrl",
  persona_type AS "personaType", lead_score AS "leadScore", status, notes`;

async function keywordSearch(query: string, limit: number): Promise<CrmMatch[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2).slice(0, 6);
  if (terms.length === 0) return [];
  const likeCols = `(coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(job_title,'') || ' ' || coalesce(firm_name,'') || ' ' ||
    coalesce(country,'') || ' ' || coalesce(persona_type,'') || ' ' || coalesce(notes,''))`;
  const where = terms.map((_, i) => `${likeCols} ILIKE $${i + 1}`).join(" AND ");
  const params = terms.map((t) => `%${t}%`);
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM contacts WHERE ${where} ORDER BY lead_score DESC LIMIT ${Number(limit)}`,
    params,
  );
  return rows.map((r) => mapRow(r, "keyword", null));
}

/**
 * Search our CRM contacts for the natural-language query. Uses pgvector
 * similarity when available, otherwise keyword ILIKE. Always returns results
 * (or an empty array) — never throws into the caller.
 */
export async function searchCrmContacts(query: string, limit = 10): Promise<CrmMatch[]> {
  const q = (query || "").trim();
  if (!q) return [];

  if (await vectorAvailable()) {
    try {
      // Opportunistically warm the index, then run the similarity search.
      await backfillContactEmbeddings();
      const qvec = await embed(q);
      if (qvec) {
        const { rows } = await pool.query(
          `SELECT ${SELECT_COLS}, 1 - (embedding <=> $1::vector) AS similarity
             FROM contacts
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT ${Number(limit)}`,
          [toVectorLiteral(qvec)],
        );
        if (rows.length > 0) {
          return rows.map((r) => mapRow(r, "semantic", typeof r.similarity === "number" ? r.similarity : null));
        }
      }
    } catch (err: any) {
      console.error("[semantic-search] vector search failed, falling back to keyword:", err?.message || err);
    }
  }

  return keywordSearch(q, limit);
}
