/**
 * Website-inbound CRM leads: contact form, FDD request, brochure gates,
 * chat widget, and embassy-checker capture. Newsletter footer signups are
 * excluded — they already have their own tag / source.
 */

export const WEBSITE_LEADS_LIST_NAME = "Website Leads";

export const WEBSITE_LEAD_SOURCES = [
  "website",
  "brochure-investor",
  "partner-broker",
] as const;

export type WebsiteLeadSource = (typeof WEBSITE_LEAD_SOURCES)[number];

export const WEBSITE_LEAD_SOURCE_LABELS: Record<WebsiteLeadSource, string> = {
  website: "Website",
  "brochure-investor": "Investor brochure",
  "partner-broker": "Partner / broker",
};

const WEBSITE_SOURCE_SET = new Set<string>(WEBSITE_LEAD_SOURCES);

const NEWSLETTER_RE = /\[Newsletter Signup\]/i;
const PARTNER_BROKER_RE = /\[Partner\s*\/\s*Broker/i;
const INVESTOR_BROCHURE_RE = /\[Investor Brochure\]/i;
const WEBSITE_FORM_MARKER_RE =
  /Visitor type:|\[FDD Request\]|\[Chat Widget\]|\[Investor Brochure\]|\[Partner\s*\/\s*Broker|\[Embassy Checker\]/i;

export function isWebsiteLeadSource(source?: string | null): boolean {
  return !!source && WEBSITE_SOURCE_SET.has(source);
}

export function websiteLeadSourceLabel(source?: string | null): string | null {
  if (!source || !isWebsiteLeadSource(source)) return null;
  return WEBSITE_LEAD_SOURCE_LABELS[source as WebsiteLeadSource];
}

export function hasWebsiteFormMarker(text?: string | null): boolean {
  return !!text && WEBSITE_FORM_MARKER_RE.test(text);
}

export function isNewsletterSignup(text?: string | null): boolean {
  return !!text && NEWSLETTER_RE.test(text);
}

/**
 * Infer a CRM `leadSource` from a website form message.
 * Returns null for newsletter signups (not sales leads).
 * Unmarked rows from the public `leads` table still count as "website".
 */
export function inferWebsiteLeadSourceFromMessage(message?: string | null): WebsiteLeadSource | null {
  const m = (message || "").trim();
  if (isNewsletterSignup(m)) return null;
  if (PARTNER_BROKER_RE.test(m)) return "partner-broker";
  if (INVESTOR_BROCHURE_RE.test(m)) return "brochure-investor";
  return "website";
}

export function isWebsiteCrmClient(client: {
  leadSource?: string | null;
  notes?: string | null;
}): boolean {
  if (isWebsiteLeadSource(client.leadSource)) return true;
  if (client.leadSource === "newsletter" || isNewsletterSignup(client.notes)) return false;
  return hasWebsiteFormMarker(client.notes);
}
