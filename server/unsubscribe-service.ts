import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Unsubscribe + email-header helpers (deliverability)
//
// Pure module — only depends on `crypto`. Kept free of app/DB imports so it can
// be imported by both email-service.ts (to build headers) and routes.ts (to
// validate one-click unsubscribes) with no import cycle. The actual suppression
// write (addToDnc) happens in the route handler.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.APP_BASE_URL || "https://www.newdawnfranchising.com").replace(/\/+$/, "");
// mailto fallback points at the franchising@ inbox (IMAP-synced + human-monitored).
const UNSUB_MAILTO = "franchising@newdawnfranchising.com";
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET || "ndf-unsub-v1";
if (!process.env.UNSUBSCRIBE_SECRET && !process.env.SESSION_SECRET) {
  console.warn(
    "[Unsubscribe] No UNSUBSCRIBE_SECRET/SESSION_SECRET set — falling back to a static signing key. Set one in production so unsubscribe tokens can't be forged.",
  );
}

function normalizeEmail(raw: string): string {
  // Accept either a bare address or a "Name <addr>" header form.
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

// Signed, per-recipient token so the public unsubscribe endpoint can't be used to
// suppress arbitrary addresses by guessing URLs.
export function unsubToken(email: string): string {
  return crypto.createHmac("sha256", SECRET).update(normalizeEmail(email)).digest("hex").slice(0, 24);
}

export function verifyUnsubToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = unsubToken(email);
  // Compare fixed-length SHA-256 digests so neither length nor content of the
  // provided token leaks through timing (timingSafeEqual requires equal lengths).
  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(token).digest();
  return crypto.timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  const e = normalizeEmail(email);
  return `${BASE_URL}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
}

// RFC 2369 + RFC 8058 headers. The https URL handles Gmail/Yahoo one-click
// (POST), the mailto is the manual fallback.
export function buildUnsubscribeHeaders(email: string): Record<string, string> {
  const url = unsubscribeUrl(email);
  const e = normalizeEmail(email);
  return {
    "List-Unsubscribe": `<mailto:${UNSUB_MAILTO}?subject=unsubscribe%20${encodeURIComponent(e)}>, <${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Plain-text alternative derived from the rendered HTML. ISPs penalise HTML-only
// mail; a sensible text/plain part improves placement and accessibility.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    // Keep anchor text and append real destinations (skip tracking/mailto noise).
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
      const t = text.replace(/<[^>]+>/g, "").trim();
      // /api/unsubscribe is skipped because the text part gets its own explicit
      // unsubscribe line — otherwise the URL would appear twice.
      const skip = !href || href.startsWith("mailto:") || href.startsWith("tel:") || /\/api\/(track|unsubscribe)\b/.test(href);
      return skip ? t : `${t} (${href})`;
    })
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&middot;/gi, "·")
    .replace(/&[a-z0-9#]+;/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Confirmation page for the GET (manual) unsubscribe path. We intentionally do
// NOT suppress on GET — link scanners/prefetchers issue GETs and would otherwise
// unsubscribe willing recipients. Suppression happens on the POST below.
export function unsubscribeConfirmPage(email: string, token: string): string {
  const safeEmail = email.replace(/[<>&"]/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#1a2b4e;">
<div style="max-width:480px;margin:8vh auto;background:#fff;border-radius:12px;padding:32px;text-align:center;border:1px solid #e5e7eb;">
<h1 style="font-size:20px;margin:0 0 8px;">Unsubscribe</h1>
<p style="color:#555;font-size:14px;margin:0 0 20px;">Stop receiving outreach emails at<br><strong>${safeEmail}</strong>?</p>
<form method="POST" action="/api/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}">
<button type="submit" style="background:#0a1628;color:#c9a84c;border:0;border-radius:6px;padding:12px 28px;font-size:14px;font-weight:700;cursor:pointer;">Unsubscribe me</button>
</form>
<p style="color:#999;font-size:12px;margin:18px 0 0;">New Dawn Franchising LLC · El Paso, TX</p>
</div></body></html>`;
}

export function invalidUnsubscribeLinkPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Invalid link</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#1a2b4e;">
<div style="max-width:480px;margin:8vh auto;background:#fff;border-radius:12px;padding:32px;text-align:center;border:1px solid #e5e7eb;">
<h1 style="font-size:20px;margin:0 0 8px;">This link is invalid or expired</h1>
<p style="color:#555;font-size:14px;margin:0;">We couldn't process this unsubscribe request. To opt out, reply to any of our emails with "unsubscribe" and we'll remove you.</p>
<p style="color:#999;font-size:12px;margin:18px 0 0;">New Dawn Franchising LLC · El Paso, TX</p>
</div></body></html>`;
}

export function unsubscribedPage(email: string): string {
  const safeEmail = email.replace(/[<>&"]/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#1a2b4e;">
<div style="max-width:480px;margin:8vh auto;background:#fff;border-radius:12px;padding:32px;text-align:center;border:1px solid #e5e7eb;">
<h1 style="font-size:20px;margin:0 0 8px;">You're unsubscribed</h1>
<p style="color:#555;font-size:14px;margin:0;">${safeEmail ? safeEmail + " has" : "You have"} been removed from our outreach list. You won't receive further campaign emails from us.</p>
<p style="color:#999;font-size:12px;margin:18px 0 0;">New Dawn Franchising LLC · El Paso, TX</p>
</div></body></html>`;
}
