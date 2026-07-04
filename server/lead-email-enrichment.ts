/**
 * lead-email-enrichment.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Best-effort discovery of a work email for a discovered lead that arrives with
 * a name + firm website but no address (SerpAPI yields no email; Seamless is the
 * only direct email source). The Grok broker sequence is email-led, so without
 * this step a whole day's list is un-enrollable.
 *
 * The enrichment is a multi-provider waterfall — each step only runs when the
 * previous one missed, so the common case still costs a single Hunter call:
 *   1. Hunter email-finder for the exact person at the firm domain.
 *   2. Apollo people-match (verified work email when Apollo knows the person).
 *   3. People Data Labs person-enrich (strong for international contacts).
 *   4. The firm's known email pattern (domain-search → buildEmailFromPattern):
 *      construct the most-likely address, VERIFY it, and if it doesn't deliver
 *      try the other common patterns before giving up. Previously a single
 *      wrong pattern guess was the end of the road ("undeliverable").
 *
 * Addresses verified here carry their verdict back to the caller so the enrol
 * step can reuse it instead of re-spending a verifier credit.
 *
 * This module also converts ORG-ONLY leads ("Smith Immigration Law") — which
 * can never be enriched as a person — into real people via Hunter
 * domain-search's named-mailbox results (findPeopleAtFirm).
 *
 * Pure + dependency-injected so the guards and the waterfall order can be
 * unit-tested without touching the network or the database.
 */

import {
  hunterFindEmail,
  hunterDomainSearch,
  hunterVerifyEmail,
  buildEmailFromPattern,
} from "./hunter-service";
import { apolloEnrichPerson } from "./apollo-service";
import { enrichPersonViaPdl } from "./pdl-service";

/** Minimal shape needed to enrich — a person's name and their firm website. */
export interface LeadNameSite {
  fullName: string;
  website?: string | null;
  company?: string | null;
}

/** Injectable provider surface so the waterfall can be exercised in tests. */
export interface EmailFinderDeps {
  findEmail: typeof hunterFindEmail;
  domainSearch: typeof hunterDomainSearch;
  buildFromPattern: typeof buildEmailFromPattern;
  verifyEmail: typeof hunterVerifyEmail;
  apolloEnrich: typeof apolloEnrichPerson;
  pdlEnrich: typeof enrichPersonViaPdl;
}

const defaultDeps: EmailFinderDeps = {
  findEmail: hunterFindEmail,
  domainSearch: hunterDomainSearch,
  buildFromPattern: buildEmailFromPattern,
  verifyEmail: hunterVerifyEmail,
  apolloEnrich: apolloEnrichPerson,
  pdlEnrich: enrichPersonViaPdl,
};

export type EnrichmentSource = "hunter_finder" | "apollo" | "pdl" | "hunter_pattern";

export interface EnrichedEmail {
  email: string;
  source: EnrichmentSource;
  /**
   * Verifier verdict established DURING enrichment ("valid" when a pattern
   * guess was confirmed deliverable). The enrol step can persist/reuse this so
   * the same address isn't verified twice.
   */
  verifiedStatus?: "valid";
}

// Public directories / social sites / webmail whose domain would never yield a
// person's work email via Hunter — skip enrichment for these so we don't waste
// calls or mint a bogus address (e.g. "jane.doe@linkedin.com").
const NON_FIRM_DOMAINS = new Set([
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "google.com", "goo.gl", "yelp.com", "wikipedia.org",
  "crunchbase.com", "bloomberg.com", "glassdoor.com", "indeed.com", "avvo.com",
  "justia.com", "martindale.com", "lawyers.com", "yellowpages.com", "bbb.org",
  "medium.com", "wordpress.com", "blogspot.com", "gmail.com", "yahoo.com",
  "hotmail.com", "outlook.com",
]);

// Generic leading sub-domains to peel off a deep-page URL so it still resolves to
// the firm's mail domain (careers.smithlaw.com → smithlaw.com). Kept to a known
// list so we stay correct for multi-part TLDs (we never blindly drop a label).
const GENERIC_SUBDOMAINS = new Set([
  "www", "blog", "careers", "jobs", "info", "mail", "news", "shop", "store",
  "app", "go", "get", "m", "en", "us", "about", "team", "home", "web", "portal",
  "support", "help",
]);

// Tokens that mark a firm / organisation name rather than a person. Hunter's
// email-finder needs a human first + last name, so a name carrying one of these
// is routed to the org-expansion path instead of guessing a bogus address
// (e.g. "Smith Immigration Law").
const ORG_NAME_TOKENS =
  /\b(llc|llp|pllc|inc|incorporated|corp|corporation|ltd|co|group|firm|law|legal|associates|partners|partnership|association|chamber|bureau|holdings|capital|realty|ventures|advisory)\b|&|,/i;

/** True when a lead name plausibly belongs to a human (2+ parts, no org token). */
export function looksLikePersonName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && !ORG_NAME_TOKENS.test(n);
}

/** Derive a firm domain from a website URL, or null if it's blank/non-firm. */
export function domainFromWebsite(website?: string | null): string | null {
  const raw = (website ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const labels = new URL(withScheme).hostname.toLowerCase().split(".");
    // Peel a single known generic sub-domain, but only while a domain.tld remains.
    if (labels.length >= 3 && GENERIC_SUBDOMAINS.has(labels[0])) labels.shift();
    const host = labels.join(".");
    if (!host.includes(".")) return null;
    const base = labels.slice(-2).join(".");
    if (NON_FIRM_DOMAINS.has(host) || NON_FIRM_DOMAINS.has(base)) return null;
    return host;
  } catch {
    return null;
  }
}

// The email patterns that cover the vast majority of firms, used to rescue a
// wrong primary pattern guess. Kept short — each extra candidate is a verifier
// call, so the rescue is capped at MAX_PATTERN_VERIFIES total.
const FALLBACK_PATTERNS = ["{first}.{last}", "{first}", "{f}{last}", "{first}{last}"];
const MAX_PATTERN_VERIFIES = 3;

/**
 * Best-effort discover a work email for a person lead. Only attempts leads that
 * look like a real person (2+ name parts and no firm/org token) on a real firm
 * domain; returns null otherwise (see findPeopleAtFirm for org leads).
 *
 * Waterfall: Hunter finder → Apollo match → PDL enrich → verified pattern
 * guess(es). Each provider is skipped silently when unconfigured (each service
 * returns null without its API key), so the chain degrades gracefully to the
 * old Hunter-only behaviour.
 */
export async function enrichLeadEmail(
  lead: LeadNameSite,
  deps: EmailFinderDeps = defaultDeps,
): Promise<EnrichedEmail | null> {
  const domain = domainFromWebsite(lead.website);
  if (!domain) return null;
  const name = (lead.fullName ?? "").trim();
  if (!looksLikePersonName(name)) return null;
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  try {
    // 1. Ask Hunter's email-finder for this exact person at the firm domain.
    const r = await deps.findEmail(firstName, lastName, domain);
    if (r?.email) return { email: r.email, source: "hunter_finder" };

    // 2. Apollo people-match — returns only unlocked, real addresses.
    const apollo = await deps
      .apolloEnrich({ firstName, lastName, domain, organizationName: lead.company ?? undefined })
      .catch(() => null);
    if (apollo?.email) return { email: apollo.email, source: "apollo" };

    // 3. People Data Labs person-enrich (min likelihood enforced inside).
    const pdl = await deps.pdlEnrich(firstName, lastName, domain).catch(() => null);
    if (pdl?.work_email) return { email: pdl.work_email, source: "pdl" };

    // 4. All finders missed — fall back to the firm's known email pattern and
    //    construct the most-likely address. Verify it here; if the guess is
    //    undeliverable, try the other common patterns before giving up (a
    //    single wrong guess used to sink the lead as "undeliverable").
    const domainInfo = await deps.domainSearch(domain);
    const pattern = domainInfo?.pattern;
    if (!pattern) return null;

    const candidates: string[] = [];
    const seen = new Set<string>();
    for (const p of [pattern, ...FALLBACK_PATTERNS]) {
      const email = deps.buildFromPattern(firstName, lastName, domain, p).toLowerCase();
      if (!seen.has(email)) {
        seen.add(email);
        candidates.push(email);
      }
    }

    let verifierUp = true;
    for (const candidate of candidates.slice(0, MAX_PATTERN_VERIFIES)) {
      const v = await deps.verifyEmail(candidate);
      if (!v) {
        // Verifier unavailable (no key / rate-limited) — keep the primary
        // pattern guess unverified, matching the old behaviour: the enrol step
        // fails open on verifier outages rather than dropping the lead.
        verifierUp = false;
        break;
      }
      if (v.result === "deliverable") {
        return { email: candidate, source: "hunter_pattern", verifiedStatus: "valid" };
      }
    }
    if (!verifierUp) return { email: candidates[0], source: "hunter_pattern" };
    // Every candidate verified as non-deliverable — no usable address.
    return null;
  } catch {
    return null;
  }
}

/** A real person + work email discovered at a firm's domain. */
export interface FirmPerson {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
}

// Named mailboxes below this Hunter confidence are more likely stale/scraped
// wrong than real — not worth a campaign slot.
const MIN_FIRM_PERSON_CONFIDENCE = 60;

/**
 * Expand an ORG-ONLY lead (a firm name + website, no person) into real people:
 * Hunter domain-search returns the named mailboxes it has on file for the
 * domain. Returns up to `max` people (highest confidence first), each with a
 * name + work email, ready to become contacts. Org leads used to be guaranteed
 * "no email" skips — this is where most of a SERP day's volume was dying.
 */
export async function findPeopleAtFirm(
  website: string | null | undefined,
  max = 3,
  deps: EmailFinderDeps = defaultDeps,
): Promise<FirmPerson[]> {
  const domain = domainFromWebsite(website);
  if (!domain) return [];
  try {
    const r = await deps.domainSearch(domain);
    if (!r?.emails?.length) return [];
    return r.emails
      .filter(
        (e) =>
          e.type === "personal" &&
          e.firstName &&
          e.lastName &&
          e.confidence >= MIN_FIRM_PERSON_CONFIDENCE,
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, max)
      .map((e) => ({
        fullName: `${e.firstName} ${e.lastName}`.trim(),
        firstName: e.firstName!,
        lastName: e.lastName!,
        email: e.email,
        jobTitle: e.position,
      }));
  } catch {
    return [];
  }
}
