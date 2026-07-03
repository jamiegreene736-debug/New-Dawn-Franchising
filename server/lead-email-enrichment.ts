/**
 * lead-email-enrichment.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Best-effort discovery of a work email for a discovered lead that arrives with
 * a name + firm website but no address (SerpAPI yields no email; Seamless is the
 * only direct email source). The Grok broker sequence is email-led, so without
 * this step a whole day's list is un-enrollable.
 *
 * The enrichment mirrors the two-step Hunter flow used everywhere else in the
 * app (routes.ts, prospect-enrichment.ts, people-finder.ts):
 *   1. Hunter email-finder for the exact person at the firm domain.
 *   2. If that misses, fall back to the firm's known email pattern
 *      (domain-search → buildEmailFromPattern) and construct the most-likely
 *      address.
 * Either way the address is verified before enrollment (see enrolProspect), so a
 * constructed guess that doesn't deliver is filtered out rather than emailed.
 *
 * Pure + dependency-injected so the domain/name guards and the finder→pattern
 * fallback can be unit-tested without touching the network or the database.
 */

import {
  hunterFindEmail,
  hunterDomainPattern,
  buildEmailFromPattern,
} from "./hunter-service";

/** Minimal shape needed to enrich — a person's name and their firm website. */
export interface LeadNameSite {
  fullName: string;
  website?: string | null;
}

/** Injectable Hunter surface so the fallback can be exercised in tests. */
export interface EmailFinderDeps {
  findEmail: typeof hunterFindEmail;
  domainPattern: typeof hunterDomainPattern;
  buildFromPattern: typeof buildEmailFromPattern;
}

const defaultDeps: EmailFinderDeps = {
  findEmail: hunterFindEmail,
  domainPattern: hunterDomainPattern,
  buildFromPattern: buildEmailFromPattern,
};

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
// is skipped instead of guessing a bogus address (e.g. "Smith Immigration Law").
const ORG_NAME_TOKENS =
  /\b(llc|llp|pllc|inc|incorporated|corp|corporation|ltd|co|group|firm|law|legal|associates|partners|partnership|association|chamber|bureau|holdings|capital|realty|ventures|advisory)\b|&|,/i;

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

/**
 * Best-effort discover a work email for a person lead. Only attempts leads that
 * look like a real person (2+ name parts and no firm/org token) on a real firm
 * domain; returns null otherwise.
 *
 * Two-step, matching the rest of the app: try the email-finder for the exact
 * person, and if that misses (no record, or below Hunter's confidence floor)
 * fall back to the firm's email pattern to construct the most-likely address.
 * Previously this path was finder-only, so any firm the finder didn't have a
 * direct record for produced no email — and the whole list was skipped as
 * no_email even though the firm's pattern was known.
 */
export async function enrichLeadEmail(
  lead: LeadNameSite,
  deps: EmailFinderDeps = defaultDeps,
): Promise<string | null> {
  const domain = domainFromWebsite(lead.website);
  if (!domain) return null;
  const name = (lead.fullName ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  // Need a plausible person: 2+ name parts that don't read as an org/firm name.
  if (parts.length < 2 || ORG_NAME_TOKENS.test(name)) return null;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  try {
    // 1. Ask Hunter's email-finder for this exact person at the firm domain.
    const r = await deps.findEmail(firstName, lastName, domain);
    if (r?.email) return r.email;
    // 2. Finder missed — fall back to the firm's known email pattern and build
    //    the most-likely address. Still verified before enrol, so a wrong guess
    //    is dropped as undeliverable rather than emailed.
    const pattern = await deps.domainPattern(domain);
    if (pattern) return deps.buildFromPattern(firstName, lastName, domain, pattern);
    return null;
  } catch {
    return null;
  }
}
