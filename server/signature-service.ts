import crypto from "crypto";
import { sendEmail, buildEmailSignature } from "./email-service";

export function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

const DOC_LABELS: Record<string, string> = {
  fdd_receipt: "FDD Receipt",
  franchise_agreement: "Franchise Agreement",
};

export async function sendSignatureRequestEmail(
  toEmail: string,
  toName: string,
  documentType: string,
  token: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const docLabel = DOC_LABELS[documentType] || documentType;
  const signingUrl = `${baseUrl}/sign/${token}`;
  const firstName = toName.split(" ")[0];

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0a1628;padding:32px 40px;text-align:center;">
            <h1 style="color:#c9a84c;margin:0;font-size:22px;letter-spacing:1px;">NEW DAWN FRANCHISING</h1>
            <p style="color:#8899aa;margin:8px 0 0;font-size:13px;">Group of Companies™</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#1a2744;font-size:16px;margin:0 0 16px;">Dear ${firstName},</p>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Please review and electronically sign your <strong>${docLabel}</strong> at your earliest convenience.
              This is a required step in the franchise process.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${signingUrl}" style="display:inline-block;background:#c9a84c;color:#0a1628;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;">
                Review &amp; Sign Document →
              </a>
            </div>
            <p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 8px;">
              The link above is unique to you and should not be shared. If you have any questions, please reply to this email or call us directly.
            </p>
            ${documentType === "fdd_receipt" ? `
            <div style="background:#fef9ec;border:1px solid #f0d070;border-radius:8px;padding:16px;margin:24px 0;">
              <p style="color:#7a5c00;font-size:13px;margin:0;"><strong>Important:</strong> After signing the FDD Receipt, federal law requires a 14-day waiting period before any franchise agreement may be signed or funds may be transferred.</p>
            </div>
            ` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
            ${buildEmailSignature("dylan@newdawnfranchising.com", baseUrl)}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(toEmail, `Action Required: Please Sign Your ${docLabel}`, html);
}

export async function sendWelcomeEmail(
  toEmail: string,
  toName: string
): Promise<{ success: boolean; error?: string }> {
  const firstName = toName.split(" ")[0];
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0a1628;padding:32px 40px;text-align:center;">
            <h1 style="color:#c9a84c;margin:0;font-size:22px;letter-spacing:1px;">NEW DAWN FRANCHISING</h1>
            <p style="color:#8899aa;margin:8px 0 0;font-size:13px;">Group of Companies™</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#0a1628;font-size:24px;margin:0 0 16px;">Welcome to the Family, ${firstName}! 🎉</h2>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
              We are thrilled to welcome you as a franchisee of <strong>New Dawn Franchising</strong>. Your wire transfer has been received and confirmed, and you are now officially part of the New Dawn family.
            </p>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Our team will be in touch shortly to walk you through your onboarding, introduce you to your territory, and get you set up for success.
            </p>
            <div style="background:#f0f7f0;border:1px solid #b0d8b0;border-radius:8px;padding:20px;margin:24px 0;">
              <p style="color:#1a5c1a;font-size:14px;margin:0 0 8px;font-weight:700;">What happens next:</p>
              <ul style="color:#2a6c2a;font-size:14px;margin:0;padding-left:20px;line-height:2;">
                <li>Onboarding call scheduled within 48 hours</li>
                <li>Territory introduction and market briefing</li>
                <li>Operations manual and training access provided</li>
                <li>Introduction to your dedicated support team</li>
              </ul>
            </div>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Thank you for your trust and confidence in New Dawn. We look forward to growing together.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
            ${buildEmailSignature("dylan@newdawnfranchising.com", "https://newdawnfranchising.com")}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(toEmail, `Welcome to the New Dawn Franchising Family, ${firstName}!`, html);
}

export async function sendWireReceiptEmail(
  toEmail: string,
  toName: string,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  const firstName = toName.split(" ")[0];
  const now = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0a1628;padding:32px 40px;text-align:center;">
            <h1 style="color:#c9a84c;margin:0;font-size:22px;letter-spacing:1px;">NEW DAWN FRANCHISING</h1>
            <p style="color:#8899aa;margin:8px 0 0;font-size:13px;">Wire Transfer Confirmation</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="color:#1a2744;font-size:16px;margin:0 0 16px;">Dear ${firstName},</p>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
              This email confirms that your wire transfer has been received and processed by New Dawn Franchising LLC.
            </p>
            <div style="background:#fafafa;border:1px solid #ddd;border-radius:8px;padding:24px;margin:0 0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#666;font-size:13px;padding:6px 0;">Date Received</td><td style="color:#1a2744;font-size:13px;font-weight:600;text-align:right;">${now}</td></tr>
                <tr><td style="color:#666;font-size:13px;padding:6px 0;">Recipient</td><td style="color:#1a2744;font-size:13px;font-weight:600;text-align:right;">New Dawn Franchising LLC</td></tr>
                ${amount ? `<tr><td style="color:#666;font-size:13px;padding:6px 0;">Amount</td><td style="color:#1a2744;font-size:14px;font-weight:700;text-align:right;">${amount}</td></tr>` : ""}
                <tr><td style="color:#666;font-size:13px;padding:6px 0;">Purpose</td><td style="color:#1a2744;font-size:13px;font-weight:600;text-align:right;">Franchise Fee</td></tr>
              </table>
            </div>
            <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
              Please retain this email for your records. A member of our team will follow up shortly with next steps for your onboarding.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
            ${buildEmailSignature("dylan@newdawnfranchising.com", "https://newdawnfranchising.com")}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(toEmail, "Wire Transfer Confirmation — New Dawn Franchising", html);
}
