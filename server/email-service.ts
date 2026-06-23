import nodemailer from "nodemailer";
import type { CrmTemplateGroup } from "@shared/crm-template-groups";
import { buildUnsubscribeHeaders, htmlToPlainText, unsubscribeUrl } from "./unsubscribe-service";

// ─── Sender Profiles ──────────────────────────────────────────────────────────
// Each profile maps an email address to its Gmail App Password env var name.
// To add a new sender: add their Google Workspace App Password as an env var,
// then add a new entry here.
export interface SenderProfile {
  email: string;
  name: string;
  envVar: string; // name of the env var holding the Gmail App Password
}

export const ALL_SENDER_PROFILES: SenderProfile[] = [
  { email: "franchising@newdawnfranchising.com", name: "New Dawn Franchising", envVar: "GMAIL_APP_PASSWORD_FRANCHISING" },
  { email: "dylan@newdawnfranchising.com", name: "Dylan – New Dawn Franchising", envVar: "GMAIL_APP_PASSWORD_DYLAN" },
  { email: "info@newdawnfranchising.com", name: "New Dawn Franchising — Info", envVar: "GMAIL_APP_PASSWORD_INFO" },
  { email: "support@newdawnfranchising.com", name: "New Dawn Franchising Support", envVar: "GMAIL_APP_PASSWORD_SUPPORT" },
];

// Resolve the actual password for a sender.
// Dylan's account accepts either GMAIL_APP_PASSWORD_DYLAN or the base GMAIL_APP_PASSWORD.
export function getSenderPassword(profile: SenderProfile): string | undefined {
  const raw = profile.email === "dylan@newdawnfranchising.com"
    ? (process.env.GMAIL_APP_PASSWORD_DYLAN || process.env.GMAIL_APP_PASSWORD)
    : process.env[profile.envVar];
  // Gmail app passwords are 16 contiguous chars. Strip any whitespace (the display
  // format shows 4 spaced groups, and pasted env values often carry a trailing
  // newline/space) so SMTP auth uses the exact credential Gmail expects.
  const clean = raw?.replace(/\s+/g, "");
  return clean || undefined;
}

export function getAvailableSenders(): SenderProfile[] {
  // franchising@ is the primary sender — always included (even before its app password
  // is confirmed) so the UI has at least one option; the actual send surfaces any error.
  const others = ALL_SENDER_PROFILES.slice(1).filter((p) => !!getSenderPassword(p));
  return [ALL_SENDER_PROFILES[0], ...others];
}

export function getSenderProfile(email: string): SenderProfile | undefined {
  return ALL_SENDER_PROFILES.find((p) => p.email.toLowerCase() === email.toLowerCase());
}

// ─── Transporter Cache ────────────────────────────────────────────────────────
const transporterCache = new Map<string, nodemailer.Transporter>();

function getTransporter(senderEmail: string): nodemailer.Transporter {
  if (transporterCache.has(senderEmail)) {
    return transporterCache.get(senderEmail)!;
  }
  const profile = getSenderProfile(senderEmail);
  if (!profile) {
    throw new Error(`No sender profile found for ${senderEmail}`);
  }
  const password = getSenderPassword(profile);
  if (!password) {
    throw new Error(`No Gmail App Password configured for ${senderEmail} — set ${profile.envVar} (or GMAIL_APP_PASSWORD for dylan@)`);
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: password },
    // Bounded timeouts so a slow/unreachable SMTP connection fails fast instead
    // of hanging the caller (e.g. a manual "Send Due Now").
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  transporterCache.set(senderEmail, transporter);
  return transporter;
}

// Default sender for system emails (signatures, drip campaigns, etc.)
const DEFAULT_SENDER = "franchising@newdawnfranchising.com";

// ─── Email Attachment ─────────────────────────────────────────────────────────
interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

// ─── Core Send Function ───────────────────────────────────────────────────────
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  trackingPixelUrl?: string,
  attachments?: EmailAttachment[],
  options?: { skipSignature?: boolean; skipUnsubscribe?: boolean }
): Promise<{ success: boolean; error?: string }> {
  return sendEmailFromSender(DEFAULT_SENDER, to, subject, html, trackingPixelUrl, attachments, options);
}

export async function sendEmailFromSender(
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  trackingPixelUrl?: string,
  attachments?: EmailAttachment[],
  // skipUnsubscribe: omit List-Unsubscribe headers + the text-part unsubscribe
  // line. Pass this for genuinely transactional 1:1 mail (FDD receipts, wire
  // instructions, internal alerts) where an "unsubscribe" affordance is wrong.
  options?: { skipSignature?: boolean; skipUnsubscribe?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = getSenderProfile(fromEmail);
    const transport = getTransporter(fromEmail);

    // Build a unified HTML email. All content — body + signature — lives inside
    // ONE container so Gmail cannot structurally detect a "signature block" to collapse.
    // Gmail's collapse algorithm looks for visually or structurally separate blocks
    // at the end of an email. A single continuous container defeats that detection.
    let finalHtml = html;

    if (!options?.skipSignature) {
      const baseUrl = "https://www.newdawnfranchising.com";
      const sigHtml = finalHtml.includes(SIGNATURE_SENTINEL)
        ? ""  // Signature already embedded (e.g. signature-service emails)
        : buildEmailSignature(fromEmail, baseUrl);

      // Extract inner content — strip any outer <html>/<body> envelope
      let bodyContent = finalHtml
        .replace(/<html[^>]*>/gi, "")
        .replace(/<\/html>/gi, "")
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<body[^>]*>/gi, "")
        .replace(/<\/body>/gi, "")
        .trim();

      // Convert plain text to paragraphs if no HTML tags present
      if (!/<[a-z][\s\S]*>/i.test(bodyContent)) {
        bodyContent = bodyContent
          .split(/\n{2,}/)
          .map(p => p.trim())
          .filter(Boolean)
          .map(p => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br>")}</p>`)
          .join("\n");
      }

      // Wrap everything in one unified container — body content + signature flow together.
      // Tracking pixel (if any) goes at the very end inside the body, invisible.
      const pixelHtml = trackingPixelUrl
        ? `\n<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
        : "";

      // Link-click tracking: rewrite every outgoing http(s) link to the click
      // redirect derived from the open-pixel URL (…/track/open/<id> → …/track/click/<id>).
      // Together with the pixel this means every tracked send records opens AND clicks.
      let innerHtml = `${bodyContent}\n${sigHtml}`;
      if (trackingPixelUrl && trackingPixelUrl.includes("/api/track/open/")) {
        const clickBase = trackingPixelUrl.replace("/api/track/open/", "/api/track/click/");
        innerHtml = innerHtml.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url) =>
          `href="${clickBase}?u=${encodeURIComponent(url)}"`
        );
      }

      finalHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#222222;max-width:600px;margin:0 auto;padding:24px 20px;">
${innerHtml}
</div>${pixelHtml}
</body>
</html>`;
    }

    // Deliverability headers. A real From-aligned Reply-To, a plain-text part
    // (multipart/alternative), and one-click List-Unsubscribe (RFC 8058) — the
    // latter is effectively required by Gmail/Yahoo bulk-sender rules.
    const recipientAddr = (to.match(/<([^>]+)>/)?.[1] || to).trim();
    // Only a single, well-formed recipient gets an unsubscribe link: the token is
    // bound to ONE address, so a comma-list send would hand every recipient the
    // first one's (invalid-for-them) link. The regex also rejects malformed
    // addresses that only contain "@".
    const oneRecipient = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(recipientAddr);
    let textBody = htmlToPlainText(finalHtml);
    const extraHeaders: Record<string, string> = {};
    if (!options?.skipUnsubscribe && oneRecipient) {
      Object.assign(extraHeaders, buildUnsubscribeHeaders(recipientAddr));
      textBody += `\n\n—\nNot interested? Unsubscribe: ${unsubscribeUrl(recipientAddr)}`;
    }

    const info = await transport.sendMail({
      from: `"${profile?.name || "New Dawn Franchising"}" <${fromEmail}>`,
      to,
      replyTo: fromEmail,
      subject,
      html: finalHtml,
      text: textBody,
      ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/pdf",
      })),
    });

    // nodemailer resolves even when the SMTP server ACCEPTS the connection but
    // REJECTS the recipient — the address lands in `info.rejected` and the mail
    // is never delivered. Treat that as a failure (otherwise it shows "Sent" but
    // never arrives). Also log messageId + SMTP response so deliveries are traceable.
    const rejected = (info?.rejected || []) as string[];
    const accepted = (info?.accepted || []) as string[];
    if (rejected.length > 0 || accepted.length === 0) {
      const reason = `SMTP did not accept recipient${rejected.length ? ` (rejected: ${rejected.join(", ")})` : " (no accepted recipients)"}${info?.response ? ` — ${info.response}` : ""}`;
      console.error(`[Email] ${fromEmail} → ${to} NOT delivered: ${reason}`);
      return { success: false, error: reason };
    }
    console.log(`[Email] Sent ${fromEmail} → ${to} | messageId=${info?.messageId || "?"} | ${info?.response || "accepted"}`);
    return { success: true };
  } catch (err: any) {
    console.error(`Email send error from ${fromEmail}:`, err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

export function getTrackingPixelUrl(baseUrl: string, sendId: string): string {
  // First-party tracking domain: if EMAIL_TRACKING_DOMAIN is set (e.g.
  // link.send.newdawnfranchising.com, a CNAME → this app), open/click links ride
  // the sending org's own domain instead of the brand root — better trust and it
  // isolates link reputation. Falls back to baseUrl so behaviour is unchanged
  // until the DNS + env are in place. The click URL is derived from this in
  // sendEmailFromSender (…/track/open/<id> → …/track/click/<id>).
  const td = process.env.EMAIL_TRACKING_DOMAIN?.trim();
  const base = td ? (/^https?:\/\//i.test(td) ? td.replace(/\/$/, "") : `https://${td.replace(/\/$/, "")}`) : baseUrl;
  return `${base}/api/track/open/${sendId}`;
}

// ─── Email Signature Builder ───────────────────────────────────────────────────
interface SignerInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string | null;
  photoKey?: string;        // filename under /public (served at /<file>)
  whatsappUrl?: string;
  calendlyUrl?: string;
  usePhoto?: boolean;       // true = show headshot instead of logo
}

// Calendly URL is fetched once asynchronously and cached
let _dylanCalendlyUrl: string | null = null;
export async function cacheDylanCalendlyUrl(): Promise<void> {
  if (_dylanCalendlyUrl) return;
  try {
    const { getCalendlyUser } = await import("./calendly-service");
    const user = await getCalendlyUser();
    if (user?.scheduling_url) {
      _dylanCalendlyUrl = user.scheduling_url;
      console.log("[Email] Calendly URL cached:", _dylanCalendlyUrl);
    }
  } catch {
    // Calendly not configured — use default
  }
}

const SIGNER_MAP: Record<string, SignerInfo> = {
  // Company-branded signature (logo, no personal headshot) for the shared franchising@ inbox.
  "franchising@newdawnfranchising.com": {
    name: "New Dawn Franchising",
    title: "Franchise Development",
    email: "franchising@newdawnfranchising.com",
    phone: "(346) 597-9994",
    linkedin: "https://www.linkedin.com/company/new-dawn-franchising",
    photoKey: "dylan-headshot-email.jpg",
    whatsappUrl: "https://wa.me/13465979994",
    usePhoto: false,
  },
  "dylan@newdawnfranchising.com": {
    name: "Dylan Delaney",
    title: "Director of Franchise Development",
    email: "dylan@newdawnfranchising.com",
    phone: "(346) 597-9994",
    linkedin: "https://www.linkedin.com/in/dylanmdelaney",
    photoKey: "dylan-headshot-email.jpg",
    whatsappUrl: "https://wa.me/13465979994",
    calendlyUrl: "https://calendly.com",
    usePhoto: true,
  },
};

const DEFAULT_SIGNER: SignerInfo = {
  name: "Dylan Delaney",
  title: "Director of Franchise Development",
  email: "dylan@newdawnfranchising.com",
  phone: "(346) 597-9994",
  linkedin: "https://www.linkedin.com/in/dylanmdelaney",
  whatsappUrl: "https://wa.me/13465979994",
  calendlyUrl: "https://calendly.com/dylan-newdawnfranchising",
  usePhoto: true,
};

// Sentinel used to detect if signature is already present — prevents double-appending
export const SIGNATURE_SENTINEL = 'data-ndf-sig="1"';

export function buildEmailSignature(senderEmail: string, baseUrl: string): string {
  const signer = SIGNER_MAP[senderEmail.toLowerCase()] ?? DEFAULT_SIGNER;
  const logoUrl = `${baseUrl}/email-logo.png`;

  // usePhoto gates the Calendly "Book a Call" button; the headshot is driven
  // independently by photoKey so a signer can show a photo without a Book-a-Call CTA.
  const calendlyUrl = signer.usePhoto
    ? (_dylanCalendlyUrl || signer.calendlyUrl || "https://calendly.com")
    : null;
  const whatsappUrl = signer.whatsappUrl || null;
  const photoUrl = signer.photoKey
    ? `${baseUrl}/${signer.photoKey}`
    : null;

  // Buttons row (Calendly + WhatsApp + LinkedIn + Website)
  const buttons: string[] = [];

  if (calendlyUrl) {
    buttons.push(
      `<td style="padding-right:6px;">` +
      `<a href="${calendlyUrl}" style="display:inline-block;background:#006BFF;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 13px;border-radius:4px;white-space:nowrap;">` +
      `&#128197; Book a Call</a></td>`
    );
  }

  if (whatsappUrl) {
    buttons.push(
      `<td style="padding-right:6px;">` +
      `<a href="${whatsappUrl}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 13px;border-radius:4px;white-space:nowrap;">` +
      `&#128172; WhatsApp</a></td>`
    );
  }

  if (signer.linkedin) {
    buttons.push(
      `<td style="padding-right:6px;">` +
      `<a href="${signer.linkedin}" style="display:inline-block;background:#0077b5;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;padding:6px 13px;border-radius:4px;white-space:nowrap;">` +
      `in LinkedIn</a></td>`
    );
  }

  buttons.push(
    `<td>` +
    `<a href="https://www.newdawnfranchising.com" style="display:inline-block;background:#0a1628;color:#c9a84c;text-decoration:none;font-size:11px;font-weight:700;padding:6px 13px;border-radius:4px;white-space:nowrap;">` +
    `Our Website</a></td>`
  );

  // Left column: headshot (Dylan) — no border-radius/object-fit (not email-safe)
  const leftCol = photoUrl
    ? `<td style="padding-right:16px;vertical-align:top;width:76px;">
        <img src="${photoUrl}" width="72" height="72" alt="${signer.name}"
          style="display:block;width:72px;height:72px;border-radius:4px;" />
      </td>`
    : `<td style="padding-right:16px;vertical-align:middle;width:76px;">
        <img src="${logoUrl}" width="72" alt="New Dawn Franchising"
          style="display:block;width:72px;height:auto;" />
      </td>`;

  // No visual separator — signature flows as part of the same unified email container.
  // Gmail's collapse detection is defeated by keeping everything in one structural block.
  return `
<table ${SIGNATURE_SENTINEL} cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:28px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    ${leftCol}
    <td style="vertical-align:top;">
      <p style="margin:0;padding:0;font-size:15px;font-weight:700;color:#0a1628;line-height:1.3;">${signer.name}</p>
      <p style="margin:2px 0 0;padding:0;font-size:10px;font-weight:700;color:#b8922e;text-transform:uppercase;letter-spacing:0.8px;">${signer.title}</p>
      <p style="margin:6px 0 0;padding:0;font-size:12px;color:#555555;">New Dawn Franchising LLC &middot; El Paso, TX</p>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:5px;">
        <tr>
          <td style="padding-right:10px;font-size:12px;">
            <a href="tel:+13465979994" style="color:#1a2b4e;text-decoration:none;">${signer.phone}</a>
          </td>
          <td style="padding-left:10px;border-left:1px solid #cccccc;font-size:12px;">
            <a href="mailto:${signer.email}" style="color:#1a2b4e;text-decoration:none;">${signer.email}</a>
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:10px;">
        <tr>
          ${buttons.join("\n          ")}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ─── Built-in Email Templates ─────────────────────────────────────────────────
export interface EmailTemplate {
  id: string;
  label: string;
  subject: string;
  bodyHtml: string;
  group: CrmTemplateGroup;
  signatureRequest?: boolean;
}

export const CRM_EMAIL_TEMPLATES: EmailTemplate[] = [
  // ── Broker / Referral Partner ─────────────────────────────────────────────
  {
    id: "broker_intro",
    label: "Step 1: Referral Partner Introduction",
    group: "1 — Pitch the Broker",
    subject: "E-2 franchise referral partnership — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>I'm {{senderName}} with <strong>New Dawn Franchising</strong>. We built a multi-vertical franchise platform specifically for <strong>E-2 Treaty Investor Visa</strong> applicants — and I wanted to introduce a referral opportunity that may be relevant for your clients.</p>
<p>New Dawn offers three recurring-revenue franchise verticals investors can choose from:</p>
<ul>
  <li><strong>Property Management</strong> — long-term rental operations with local execution teams</li>
  <li><strong>Telecom</strong> — recurring-service operations with centralized systems and oversight dashboards</li>
  <li><strong>Insurance</strong> — compliant supervision, client service, and recurring revenue</li>
</ul>
<p>The model is simple: <em>You Own It. You Direct It. We Run It.</em> Your client is the legal owner and executive director; our approved local teams handle day-to-day execution. Investment starts at <strong>$225,000</strong>, structured to support E-2 visa requirements.</p>
<p>We offer competitive referral commissions, a dedicated broker portal, and full FDD documentation for every introduction. Would you be open to a 15-minute call to explore a partnership?</p>`,
  },
  {
    id: "broker_followup",
    label: "Step 2: Broker Follow-Up",
    group: "1 — Pitch the Broker",
    subject: "Quick follow-up — E-2 franchise option for your clients",
    bodyHtml: `<p>Hi {{name}},</p>
<p>I wanted to follow up on my note about <strong>New Dawn Franchising</strong>. I know your calendar is full, so I'll keep this brief.</p>
<p>For immigration attorneys, business brokers, and wealth advisors, our platform solves a common client need: a <strong>real, operating U.S. business</strong> that meets E-2 substantiality requirements — without requiring the investor to run daily operations themselves.</p>
<p>Highlights your clients typically care about:</p>
<ul>
  <li>Franchise investment from <strong>$225,000</strong> with financing options available</li>
  <li>Proprietary owner dashboards and operational reporting across every vertical</li>
  <li>In-house E-2 immigration, finance, real estate, and legal support</li>
  <li>In-house buy-back pathway available after approximately 4 years</li>
  <li>Investors can live anywhere in the U.S. while maintaining executive oversight</li>
</ul>
<p>Happy to send our FDD and investor overview, or jump on a short call whenever works for you.</p>`,
  },
  {
    id: "broker_partnership",
    label: "Step 3: Referral Partnership Details",
    group: "1 — Pitch the Broker",
    subject: "Referral partnership details — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Thank you for your interest in partnering with New Dawn Franchising. Here's a quick overview of how our <strong>Referring Broker Program</strong> works:</p>
<ul>
  <li><strong>Competitive referral commissions</strong> for qualified investor introductions</li>
  <li><strong>Dedicated broker portal</strong> to track referrals and manage client progress</li>
  <li><strong>Marketing materials</strong> and FDD support for your practice</li>
  <li><strong>No exclusivity required</strong> — partner alongside your existing relationships</li>
</ul>
<p>When you refer a client, we handle discovery, FDD delivery, franchise agreement execution, and E-2 coordination — while keeping you informed at every milestone. Your client selects from Property Management, Telecom, or Insurance based on their goals and E-2 strategy.</p>
<p>Would you like me to send the partnership agreement and commission schedule for review?</p>`,
  },
  {
    id: "broker_referral_thanks",
    label: "Step 4: Thank You for Client Referral",
    group: "1 — Pitch the Broker",
    subject: "Thank you for the referral — {{name}}",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Thank you for introducing your client to <strong>New Dawn Franchising</strong>. We truly value referral partners who trust us with their clients' E-2 investment journey.</p>
<p>I've reached out to your client directly and will keep you updated as they move through our process:</p>
<ol>
  <li>Discovery call and vertical selection (Property Management, Telecom, or Insurance)</li>
  <li>FDD delivery and 14-day review period</li>
  <li>Franchise Agreement execution</li>
  <li>E-2 visa application coordination</li>
</ol>
<p>You'll receive updates through the broker portal as milestones are reached. Please don't hesitate to reach out if you or your client have any questions along the way.</p>`,
  },

  // ── Investor — Intro & Discovery ────────────────────────────────────────
  {
    id: "investor_intro",
    label: "Step 1: E-2 Franchise Introduction",
    group: "2 — Pitch the Investor",
    subject: "E-2 visa franchise opportunity — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>I'm {{senderName}} with <strong>New Dawn Franchising</strong> — the first franchise platform built specifically for <strong>E-2 Treaty Investor Visa</strong> applicants.</p>
<p>We offer three recurring-revenue franchise verticals:</p>
<ul>
  <li><strong>Property Management</strong></li>
  <li><strong>Telecom</strong></li>
  <li><strong>Insurance</strong></li>
</ul>
<p>The model: <em>You Own It. You Direct It. We Run It.</em> You are the legal owner and sole signatory on U.S. bank accounts. Approved local teams manage daily execution while you maintain executive control, review reports, and make key decisions — from anywhere in the United States.</p>
<p>Franchise investment starts at <strong>$225,000</strong>, covering your franchise license, training, proprietary technology platform, and operational setup. Financing options are available through our affiliated lending partners.</p>
<p>Would you have 15 minutes for an introductory call? I'm happy to send our FDD and walk you through which vertical is the strongest fit for your goals.</p>`,
  },
  {
    id: "investor_broker_referred",
    label: "Step 2: Warm Intro (Broker Referred)",
    group: "2 — Pitch the Investor",
    subject: "Introduction from your advisor — New Dawn E-2 franchise",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Your advisor connected us, and I wanted to reach out personally. I'm {{senderName}} with <strong>New Dawn Franchising</strong>.</p>
<p>New Dawn is a multi-vertical franchisor built for E-2 investors. You choose from <strong>Property Management</strong>, <strong>Telecom</strong>, or <strong>Insurance</strong> — each structured with recurring revenue, documented operating systems, and the supervisory control USCIS expects.</p>
<p>As the franchise owner, you direct the enterprise. Our local teams handle day-to-day operations. Investment starts at <strong>$225,000</strong>, and we provide in-house support across E-2 immigration, finance, real estate, and legal.</p>
<p>I'd welcome a conversation to understand your timeline, citizenship, and investment goals — then walk you through the vertical that best fits your E-2 strategy. Would a 15-minute call this week work for you?</p>`,
  },
  {
    id: "investor_discovery_invite",
    label: "Step 3: Schedule Discovery Call",
    group: "2 — Pitch the Investor",
    subject: "Let's find your best E-2 franchise fit — 15-minute call?",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Thank you for your interest in <strong>New Dawn Franchising</strong>. The next step is a brief discovery call where we can:</p>
<ul>
  <li>Review your E-2 visa timeline and investment goals</li>
  <li>Compare our three verticals — Property Management, Telecom, and Insurance</li>
  <li>Walk through the $225,000 investment structure and financing options</li>
  <li>Answer questions about owner oversight, local operations, and proprietary technology</li>
</ul>
<p>There's no commitment on this call — it's simply a chance to determine whether New Dawn is the right fit before we send the Franchise Disclosure Document (FDD).</p>
<p>Please reply with a few times that work for you, or use the scheduling link in my signature to book directly.</p>`,
  },
  {
    id: "investor_vertical_guide",
    label: "Step 4: Vertical Comparison (PM / Telecom / Insurance)",
    group: "2 — Pitch the Investor",
    subject: "Property Management vs. Telecom vs. Insurance — which fits you?",
    bodyHtml: `<p>Hi {{name}},</p>
<p>One of the most common questions we hear: <em>which New Dawn vertical is right for me?</em></p>
<p>Here's a quick comparison:</p>
<ul>
  <li><strong>Property Management</strong> — Long-term rental management with local execution teams and owner-level reporting. Strong fit for investors who want tangible, recurring revenue tied to real assets.</li>
  <li><strong>Telecom</strong> — Recurring-service operations supported by centralized systems, sales workflows, and oversight dashboards. Strong fit for investors comfortable with technology-driven recurring revenue.</li>
  <li><strong>Insurance</strong> — Compliant supervision, client service, and recurring revenue in the insurance sector. Strong fit for investors who value regulated, relationship-based business models.</li>
</ul>
<p>All three verticals share the same owner-director structure, proprietary technology, E-2 compliance framework, and local operations support. The FDD and discovery process help us compare options against your goals, market preferences, and operational comfort.</p>
<p>Happy to walk through this on a call — which vertical initially interests you most?</p>`,
  },
  {
    id: "meeting_followup",
    label: "Step 5: Post-Discovery Call Follow-Up",
    group: "2 — Pitch the Investor",
    subject: "Great speaking with you — next steps",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Thank you for taking the time to speak with me today. I enjoyed learning more about your background, timeline, and E-2 goals.</p>
<p>As discussed, the next step is for me to send your <strong>Franchise Disclosure Document (FDD)</strong>. The FDD provides full transparency on the franchise model, financials, investment structure, and terms for your chosen vertical.</p>
<p><strong>Important:</strong> Under U.S. franchise law, you must have a minimum of <strong>14 calendar days</strong> to review the FDD before signing any agreement or making any payment. We encourage you to review it carefully with a franchise attorney.</p>
<p>I'll be in touch shortly with the FDD package. In the meantime, please reach out with any questions.</p>`,
  },

  // ── FDD & Legal Milestones ────────────────────────────────────────────────
  {
    id: "fdd_cover",
    label: "Step 1: FDD Package Cover Email",
    group: "3 — FDD & Receipt",
    subject: "Your Franchise Disclosure Document — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Please find attached your <strong>Franchise Disclosure Document (FDD)</strong> from New Dawn Franchising LLC.</p>
<p><strong>Please read before proceeding:</strong></p>
<ul>
  <li>Federal law requires a minimum of <strong>14 calendar days</strong> to review the FDD before signing any agreement or making any payment</li>
  <li>We strongly recommend reviewing the FDD with a franchise attorney</li>
  <li>The last page is the <strong>FDD Receipt</strong> — you'll receive a separate email with a secure link to sign electronically</li>
  <li>Signing the receipt acknowledges receipt only; it does not commit you to anything</li>
</ul>
<p>The FDD covers all three verticals (Property Management, Telecom, and Insurance) so you can compare investment structures and make an informed decision. I'm happy to walk through any section on a call.</p>`,
  },
  {
    id: "fdd_receipt_request",
    label: "Step 2: FDD Receipt — Send Signature Request",
    group: "3 — FDD & Receipt",
    subject: "Action Required: Please Sign Your FDD Receipt — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>As part of the franchise disclosure process, we need you to electronically sign the <strong>FDD Receipt</strong> — the last page of the Franchise Disclosure Document.</p>
<p>Signing the receipt simply <strong>acknowledges that you received the document</strong>. It does not commit you to anything, and does not start any payment or agreement obligation.</p>
<p>You will receive a separate email momentarily with a secure, personalised link to review and sign the receipt electronically. The process takes less than 2 minutes.</p>
<p>Once signed, federal law requires a <strong>14-day waiting period</strong> before any franchise agreement may be executed or funds transferred. We welcome that time for you to continue reviewing with your attorney.</p>
<p>Please don't hesitate to reach out if you have any questions.</p>`,
    signatureRequest: true,
  },
  {
    id: "waiting_period_checkin",
    label: "Step 3: 14-Day FDD Review Check-In",
    group: "3 — FDD & Receipt",
    subject: "Checking in — any questions on the FDD?",
    bodyHtml: `<p>Hi {{name}},</p>
<p>I hope you've had a chance to begin reviewing the Franchise Disclosure Document. We're now midway through your 14-day review period, and I wanted to check in.</p>
<p>This is a good time to:</p>
<ul>
  <li>Consult with a franchise attorney if you haven't already</li>
  <li>Confirm which vertical — Property Management, Telecom, or Insurance — is the strongest fit</li>
  <li>Discuss financing options with our affiliated lending partners if needed</li>
  <li>Prepare questions for our next call</li>
</ul>
<p>Once the 14-day period is complete, we can move forward with the Franchise Agreement and begin E-2 visa application coordination. I'm here to make this process as smooth as possible.</p>`,
  },
  {
    id: "franchise_agreement_cover",
    label: "Step 4: Franchise Agreement Cover Email",
    group: "3 — FDD & Receipt",
    subject: "Your Franchise Agreement — New Dawn Franchising",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Your 14-day FDD review period is complete. Please find attached your <strong>Franchise Agreement</strong> for the vertical you've selected.</p>
<p>Before signing, please review the agreement carefully with your franchise attorney. Key items to confirm:</p>
<ul>
  <li>Franchise territory and vertical selection</li>
  <li>Total investment amount and payment schedule</li>
  <li>Owner oversight responsibilities and reporting structure</li>
  <li>E-2 visa coordination timeline with our immigration partners</li>
</ul>
<p>You'll receive a separate email with a secure link to sign the agreement electronically. Once executed, we'll provide wire transfer instructions for your franchise fee and begin onboarding immediately.</p>
<p>Congratulations on reaching this milestone — we're excited about the possibility of welcoming you to New Dawn Franchising.</p>`,
  },

  // ── Closing & Onboarding ──────────────────────────────────────────────────
  {
    id: "wire_instructions",
    label: "Step 1: Wire Transfer Instructions",
    group: "4 — Close the Deal",
    subject: "Wire transfer instructions — franchise fee",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Congratulations on executing your Franchise Agreement! We are thrilled to welcome you to the New Dawn Franchising family.</p>
<p>Please find the wire transfer instructions for your franchise fee below. Once your wire is received and confirmed, we will send a receipt and begin your onboarding immediately.</p>
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:20px;margin:16px 0;">
  <p style="margin:0;font-weight:bold;">Wire Transfer Details</p>
  <p style="margin:8px 0 0;">Beneficiary: New Dawn Franchising LLC<br>
  Bank: [Your Bank Name]<br>
  Routing Number: [Routing Number]<br>
  Account Number: [Account Number]<br>
  Reference: {{name}} — Franchise Fee</p>
</div>
<p><strong>Important:</strong> Please email us the wire confirmation number as soon as the transfer is initiated so we can track and confirm receipt promptly. Investor funds are held in escrow by a third-party attorney and released per the terms in your FDD.</p>`,
  },
  {
    id: "e2_visa_next_steps",
    label: "Step 2: E-2 Visa Application Next Steps",
    group: "4 — Close the Deal",
    subject: "E-2 visa next steps — your New Dawn franchise",
    bodyHtml: `<p>Hi {{name}},</p>
<p>Now that your franchise agreement is in place, here's how we coordinate your <strong>E-2 visa application</strong>:</p>
<ol>
  <li><strong>Business plan preparation</strong> — You work with a business plan writer of your choice to prepare your USCIS-compliant E-2 business plan; if you'd like, we can refer an experienced E-2 business plan writer</li>
  <li><strong>Immigration attorney coordination</strong> — We connect you with experienced E-2 immigration counsel to file your petition</li>
  <li><strong>Document package</strong> — Franchise agreement, FDD receipt, escrow documentation, and operational overview compiled for USCIS</li>
  <li><strong>Owner oversight framework</strong> — Reporting structure and supervisory controls documented for your petition</li>
</ol>
<p>As the franchise owner, you maintain legal ownership, bank account signatory authority, and executive decision-making — exactly as the E-2 visa requires. Our local teams handle daily execution while you direct the enterprise.</p>
<p>I'll schedule a coordination call with our immigration partners shortly. Please share your preferred timeline and current citizenship so we can plan accordingly.</p>`,
  },
  {
    id: "closing_congratulations",
    label: "Step 3: Welcome — You're Officially In",
    group: "4 — Close the Deal",
    subject: "Welcome to New Dawn Franchising — you're officially in!",
    bodyHtml: `<p>Hi {{name}},</p>
<p><strong>Congratulations!</strong> Your franchise fee has been received and your onboarding is officially underway. Welcome to New Dawn Franchising.</p>
<p>Here's what happens next:</p>
<ul>
  <li><strong>Training & orientation</strong> — Franchise systems, proprietary technology platform, and owner dashboard walkthrough</li>
  <li><strong>Operations setup</strong> — Local team assignment and territory launch for your selected vertical</li>
  <li><strong>E-2 petition progress</strong> — Ongoing coordination with immigration counsel until visa approval</li>
  <li><strong>Executive reporting</strong> — Owner dashboards, operational reports, and supervisory oversight tools activated</li>
</ul>
<p>You now own and direct a real, operating U.S. business — with the team and technology to support your E-2 journey from day one. Headquartered in El Paso, Texas, with the flexibility to live anywhere in the United States while maintaining executive control.</p>
<p>We're honoured to have you as part of the New Dawn Franchising Group of Companies. Please don't hesitate to reach out at any point.</p>`,
  },

  // ── Nurture & Re-Engagement ───────────────────────────────────────────────
  {
    id: "reengagement",
    label: "Re-Engagement Check-In",
    group: "5 — Follow-Up",
    subject: "Checking in — still exploring E-2 franchise options?",
    bodyHtml: `<p>Hi {{name}},</p>
<p>I wanted to check in — it's been a little while since we last connected, and I wanted to see how your E-2 planning is progressing.</p>
<p>New Dawn Franchising continues to offer our multi-vertical platform — Property Management, Telecom, and Insurance — starting at <strong>$225,000</strong>, structured specifically for E-2 investors who want to own and direct a real U.S. business without managing daily operations themselves.</p>
<p>If your timeline or situation has changed, I'd love to reconnect. Even if now isn't the right time, I'm happy to answer questions or send updated materials for your planning.</p>
<p>Would a quick 15-minute call this week be helpful?</p>`,
  },
  {
    id: "gentle_breakup",
    label: "Final Check-In (Last Touch)",
    group: "5 — Follow-Up",
    subject: "Last note from New Dawn — here if you need us",
    bodyHtml: `<p>Hi {{name}},</p>
<p>This will be my last email for now — I don't want to clutter your inbox.</p>
<p>If you or any of your clients are ever looking for an <strong>E-2 qualifying franchise</strong> across Property Management, Telecom, or Insurance, please keep New Dawn Franchising in mind.</p>
<p><strong>Quick recap:</strong></p>
<ul>
  <li>Investment from $225,000 with financing options</li>
  <li>You own and direct; our teams run daily operations</li>
  <li>Proprietary technology, in-house E-2 immigration support, and buy-back pathway</li>
  <li>FDD available on request — franchising@newdawnfranchising.com</li>
</ul>
<p>Wishing you the best with your plans. My door is always open if timing changes.</p>`,
  },
];
