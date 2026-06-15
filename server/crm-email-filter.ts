// Shared heuristics for filtering automated / newsletter / service mail from
// CRM email history and Gmail inbox sync. Used by gmail-sync-service and routes.

const AUTOMATED_SENDER_DOMAINS = [
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "mailchimp.com",
  "sendgrid.net",
  "constantcontact.com",
  "hubspot.com",
  "mailgun.org",
  "amazonses.com",
  "google.com",
  "accounts.google.com",
];

const AUTOMATED_SUBJECT_RE =
  /\b(welcome to|newsletter|unsubscribe|verify your|confirm your|password reset|your (receipt|invoice|statement)|notification|daily digest|out of office|automatic reply|do-?not-?reply|no-?reply|pr newswire|press release|subscription confirmed|account (created|activated)|get started with)\b/i;

const AUTOMATED_BODY_RE =
  /\b(unsubscribe|manage (your )?preferences|view in browser|email preferences|this (message|email) was sent (to|by)|pr newswire|business wire|you(?:'re| are) receiving this (email|message) because)\b/i;

/** True for newsletters, service mail, notifications, and auto-replies. */
export function isAutomatedOrBulkEmail(
  fromAddr: string,
  subject: string,
  rawHead = "",
  bodyText = "",
): boolean {
  const from = (fromAddr || "").toLowerCase();
  const subj = subject || "";
  const head = rawHead || "";
  const body = bodyText || "";

  if (/^(list-unsubscribe|list-id|precedence:\s*(bulk|list|junk)|auto-submitted:\s*(?!no)|x-auto-response-suppress|feedback-id):/im.test(head)) {
    return true;
  }

  const domain = from.split("@")[1] || "";
  if (AUTOMATED_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return true;
  }

  const local = from.split("@")[0] || "";
  if (/^(no.?reply|do.?not.?reply|donotreply|notifications?|mailer|newsletter|news|bounce|postmaster|noreply|updates?|alerts?)$/i.test(local)
    || /(via|notifications?|mailer|newsletter)@/i.test(from)) {
    return true;
  }

  if (AUTOMATED_SUBJECT_RE.test(subj)) return true;
  if (AUTOMATED_BODY_RE.test(body)) return true;

  // Forwarded vendor mail that slipped through on subject alone.
  if (/^(fwd?|re):\s*(welcome to|your .* (account|subscription)|newsletter)/i.test(subj)) return true;

  return false;
}

/** Hide automated inbound rows already stored before sync filters were tightened. */
export function shouldShowInCrmEmailHistory(email: {
  direction?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): boolean {
  if (email.direction !== "inbound") return true;
  const bodyText = email.bodyText
    || (email.bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return !isAutomatedOrBulkEmail(email.fromEmail || "", email.subject || "", "", bodyText);
}