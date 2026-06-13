import nodemailer from "nodemailer";

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
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; error?: string }> {
  return sendEmailFromSender(DEFAULT_SENDER, to, subject, html, trackingPixelUrl, attachments);
}

export async function sendEmailFromSender(
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  trackingPixelUrl?: string,
  attachments?: EmailAttachment[],
  options?: { skipSignature?: boolean }
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

    await transport.sendMail({
      from: `"${profile?.name || "New Dawn Franchising"}" <${fromEmail}>`,
      to,
      subject,
      html: finalHtml,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/pdf",
      })),
    });

    return { success: true };
  } catch (err: any) {
    console.error(`Email send error from ${fromEmail}:`, err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}

export function getTrackingPixelUrl(baseUrl: string, sendId: string): string {
  return `${baseUrl}/api/track/open/${sendId}`;
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
    whatsappUrl: "https://wa.me/13465979994",
    usePhoto: false,
  },
  "dylan@newdawnfranchising.com": {
    name: "Dylan Delaney",
    title: "Director of Franchise Development",
    email: "dylan@newdawnfranchising.com",
    phone: "(346) 597-9994",
    linkedin: "https://www.linkedin.com/in/dylanmdelaney",
    photoKey: "dylan-headshot.png",
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

  // Use real Calendly URL if cached, else fallback
  const calendlyUrl = signer.usePhoto
    ? (_dylanCalendlyUrl || signer.calendlyUrl || "https://calendly.com")
    : null;
  const whatsappUrl = signer.whatsappUrl || null;
  const photoUrl = signer.usePhoto && signer.photoKey
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
  signatureRequest?: boolean;
}

export const CRM_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "initial_outreach",
    label: "Initial Outreach",
    subject: "Franchise Opportunity — New Dawn Franchising",
    bodyHtml: `<p>Dear {{name}},</p>
<p>My name is {{senderName}}, and I'm reaching out from <strong>New Dawn Franchising</strong>. We operate a proven property management franchise in El Paso, Texas, specifically designed for E-2 visa investors looking for a director-led, compliant US business.</p>
<p>Our franchise offers:</p>
<ul>
  <li>A fully operational business from day one</li>
  <li>Proprietary systems, branding, and training</li>
  <li>Exclusive territory rights in El Paso, TX</li>
  <li>Immigration attorney network and E-2 visa support</li>
</ul>
<p>I'd love to schedule a 30-minute call to learn more about your goals and answer any questions you may have. Would you be open to a brief conversation this week?</p>`,
  },
  {
    id: "meeting_followup",
    label: "Meeting Follow-Up",
    subject: "Great speaking with you — Next steps",
    bodyHtml: `<p>Dear {{name}},</p>
<p>Thank you for taking the time to speak with me today. It was a pleasure learning more about your background and investment goals.</p>
<p>As discussed, the next step is for me to send you our <strong>Franchise Disclosure Document (FDD)</strong>, which provides full transparency on our business, financials, and franchise terms. Federal law requires that you have 14 days to review the FDD before signing anything or making any payments — we welcome that time for you to review with an attorney.</p>
<p>I will be in touch shortly with the FDD package. In the meantime, please don't hesitate to reach out with any questions.</p>
<p>Looking forward to potentially welcoming you to the New Dawn family!</p>`,
  },
  {
    id: "fdd_cover",
    label: "FDD Package Cover Email",
    subject: "Your Franchise Disclosure Document — New Dawn Franchising",
    bodyHtml: `<p>Dear {{name}},</p>
<p>Please find attached your <strong>Franchise Disclosure Document (FDD)</strong> from New Dawn Franchising LLC.</p>
<p><strong>Important — Please Read:</strong></p>
<p>Under US franchise law (FTC Franchise Rule), you must have a minimum of <strong>14 calendar days</strong> to review this document before signing any agreement or making any payment. We encourage you to review it carefully and consult with a franchise attorney.</p>
<p>The last page of the FDD is the <strong>FDD Receipt</strong>. You will receive a separate email with a secure link to sign this electronically. Signing the receipt simply acknowledges you received the document — it does not commit you to anything.</p>
<p>Please feel free to send any questions my way. I'm happy to walk you through any section on a call.</p>`,
  },
  {
    id: "waiting_period_checkin",
    label: "14-Day Period Check-In",
    subject: "Checking in — Any questions on the FDD?",
    bodyHtml: `<p>Dear {{name}},</p>
<p>I hope you've had a chance to begin reviewing the Franchise Disclosure Document. We're now midway through your 14-day review period, and I wanted to check in to see if you have any questions.</p>
<p>This is a great time to speak with a franchise attorney if you haven't already. Once the 14-day period is complete, we can move forward with the Franchise Agreement and discuss next steps for your E-2 visa application.</p>
<p>Don't hesitate to reach out — I'm here to make this process as smooth as possible for you.</p>`,
  },
  {
    id: "wire_instructions",
    label: "Wire Transfer Instructions",
    subject: "Wire Transfer Instructions — Franchise Fee",
    bodyHtml: `<p>Dear {{name}},</p>
<p>Congratulations on completing your Franchise Agreement! We are excited to have you as part of the New Dawn Franchising family.</p>
<p>Please find below the wire transfer instructions for your franchise fee. Once your wire is received and confirmed, we will send you a receipt and begin your onboarding immediately.</p>
<div style="background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:20px;margin:16px 0;">
  <p style="margin:0;font-weight:bold;">Wire Transfer Details</p>
  <p style="margin:8px 0 0;">Beneficiary: New Dawn Franchising LLC<br>
  Bank: [Your Bank Name]<br>
  Routing Number: [Routing Number]<br>
  Account Number: [Account Number]<br>
  Reference: [Your Full Name] — Franchise Fee</p>
</div>
<p><strong>Important:</strong> Please email us the wire confirmation number as soon as the transfer is initiated so we can track and confirm receipt promptly.</p>`,
  },
  {
    id: "fdd_receipt_request",
    label: "📋 FDD Receipt — Send Signature Request",
    subject: "Action Required: Please Sign Your FDD Receipt — New Dawn Franchising",
    bodyHtml: `<p>Dear {{name}},</p>
<p>As part of the franchise disclosure process, we need you to electronically sign the <strong>FDD Receipt</strong> — the last page of the Franchise Disclosure Document.</p>
<p>Signing the receipt simply <strong>acknowledges that you received the document</strong>. It does not commit you to anything, and does not start any payment or agreement obligation.</p>
<p>You will receive a separate email momentarily with a secure, personalised link to review and sign the receipt electronically. The process takes less than 2 minutes.</p>
<p>Once signed, federal law requires a <strong>14-day waiting period</strong> before any franchise agreement may be executed or funds transferred. We welcome that time for you to continue reviewing with your attorney.</p>
<p>Please don't hesitate to reach out if you have any questions.</p>`,
    signatureRequest: true,
  },
  {
    id: "reengagement",
    label: "Re-Engagement / Check-In",
    subject: "Checking in — Still interested in E-2 franchise opportunity?",
    bodyHtml: `<p>Dear {{name}},</p>
<p>I hope this message finds you well. I wanted to check in as it's been a little while since we last connected.</p>
<p>Our E-2 franchise opportunity in El Paso is still available, and we're continuing to see strong interest from investors in your region. If your timeline or situation has changed, I'd love to reconnect and see how we might be able to help.</p>
<p>Even if now isn't the right time, I'm happy to answer any questions or provide any additional information that might be useful for your planning.</p>
<p>Would you be open to a quick 15-minute call this week?</p>`,
  },
];
