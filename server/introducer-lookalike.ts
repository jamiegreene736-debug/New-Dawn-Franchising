/**
 * Lookalikes of introducers who already replied or booked, plus SerpAPI
 * discovery of firms publishing new E-2 / investor-visa practice pages.
 */

import { pool } from "./db";
import { apolloLookalikeCompaniesWithContacts } from "./apollo-service";
import { searchByFreeQuery } from "./prospect-search";
import { rememberNamedAccount, normalizeDomain, type NamedAccount } from "./named-accounts";

export interface LookalikeFirm {
  name: string;
  domain: string | null;
}

/**
 * Companies of people who replied to drip email or booked a meeting
 * in the last 60 days — the seeds we should clone.
 */
export async function repliedPartnerSeeds(limit = 8): Promise<{ name: string; domain: string | null }[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (lower(coalesce(p.company, c.firm_name, ol.company, '')))
              coalesce(p.company, c.firm_name, ol.company) AS name,
              coalesce(p.website, c.website_url, ol.website) AS website
         FROM (
           SELECT e.prospect_id, e.prospect_email
             FROM drip_sends s
             JOIN drip_enrollments e ON e.id = s.enrollment_id
            WHERE s.channel = 'email'
              AND s.status = 'replied'
              AND s.created_at > now() - interval '60 days'
           UNION
           SELECT NULL::varchar, m.invitee_email
             FROM meetings m
            WHERE m.invitee_email IS NOT NULL
              AND m.created_at > now() - interval '60 days'
           UNION
           SELECT NULL::varchar, ol2.email
             FROM outreach_leads ol2
            WHERE ol2.status IN ('replied', 'converted', 'active')
              AND ol2.company IS NOT NULL
              AND ol2.created_at > now() - interval '60 days'
         ) hits
         LEFT JOIN prospects p ON p.id = hits.prospect_id
         LEFT JOIN contacts c ON lower(c.email) = lower(hits.prospect_email)
         LEFT JOIN outreach_leads ol ON lower(ol.email) = lower(hits.prospect_email)
        WHERE coalesce(p.company, c.firm_name, ol.company, '') <> ''
        ORDER BY lower(coalesce(p.company, c.firm_name, ol.company, ''))
        LIMIT $1`,
      [limit],
    );
    return rows.map((r: { name: string; website: string | null }) => ({
      name: String(r.name),
      domain: normalizeDomain(r.website),
    }));
  } catch (e) {
    console.warn("[Lookalike] seed query failed:", (e as Error).message);
    return [];
  }
}

export async function rememberLookalikeFirms(maxSeeds = 5): Promise<NamedAccount[]> {
  if (!process.env.APOLLO_API_KEY) return [];
  const seeds = await repliedPartnerSeeds(maxSeeds);
  const added: NamedAccount[] = [];
  for (const seed of seeds) {
    try {
      const result = await apolloLookalikeCompaniesWithContacts({
        referenceCompany: seed.domain || seed.name,
        niche: "immigration attorney E-2 investor visa",
      });
      for (const org of result.companies ?? []) {
        const domain = normalizeDomain(org.domain || org.website || "");
        if (!domain) continue;
        added.push(rememberNamedAccount({
          name: org.name || domain,
          domain,
          country: org.country || "United States",
          category: "immigration_attorney",
          city: org.city ?? undefined,
        }));
      }
    } catch (e) {
      console.warn(`[Lookalike] Apollo failed for ${seed.name}:`, (e as Error).message);
    }
  }
  if (added.length) {
    console.log(`[Lookalike] Remembered ${added.length} firms similar to ${seeds.length} replied partner(s).`);
  }
  return added;
}

/** SerpAPI sweep for firms publishing new E-2 / investor-visa practice content. */
export async function discoverFirmsFromSignals(maxResults = 12): Promise<NamedAccount[]> {
  if (!process.env.SERPAPI_KEY) return [];
  const queries = [
    `E-2 treaty investor visa attorney practice United States`,
    `"E-2 visa" "immigration attorney" (Houston OR Miami OR Dallas OR "Los Angeles") -site:reddit.com`,
    `investor visa immigration law firm United States`,
  ];
  const added: NamedAccount[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    try {
      const results = await searchByFreeQuery(q, 6);
      for (const r of results) {
        const domain = normalizeDomain(r.website || r.sourceUrl || "");
        if (!domain || seen.has(domain)) continue;
        if (/(linkedin|facebook|youtube|wikipedia|reddit|gov)\./.test(domain)) continue;
        seen.add(domain);
        added.push(rememberNamedAccount({
          name: (r.name || domain).slice(0, 120),
          domain,
          country: "United States",
          category: "immigration_attorney",
        }));
        if (added.length >= maxResults) return added;
      }
    } catch (e) {
      console.warn("[Lookalike] signal firm search failed:", (e as Error).message);
    }
  }
  if (added.length) console.log(`[Lookalike] Signal sweep added ${added.length} firm domain(s).`);
  return added;
}
