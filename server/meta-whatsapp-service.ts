import type { CrmTemplateGroup } from "@shared/crm-template-groups";

// Meta WhatsApp Cloud API Service
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
// Auth: Bearer token (permanent system user token recommended, or temp token for dev)

const META_WA_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN || "";
const META_WA_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
const META_GRAPH_VERSION = "v23.0";
const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export function getWhatsAppStatus() {
  return {
    configured: !!(META_WA_ACCESS_TOKEN && META_WA_PHONE_NUMBER_ID),
    whatsappReady: !!(META_WA_ACCESS_TOKEN && META_WA_PHONE_NUMBER_ID),
    phoneNumberId: META_WA_PHONE_NUMBER_ID || null,
  };
}

function normalizePhone(to: string): string {
  // Meta wants digits only, no leading +
  return to.startsWith("+") ? to.slice(1) : to.replace(/\D/g, "");
}

// ─── Free-form text (only valid in the 24-h customer service window) ──────────

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!META_WA_ACCESS_TOKEN)
    return { success: false, error: "META_WHATSAPP_ACCESS_TOKEN not configured." };
  if (!META_WA_PHONE_NUMBER_ID)
    return { success: false, error: "META_WHATSAPP_PHONE_NUMBER_ID not configured." };

  const phone = normalizePhone(to);

  try {
    const res = await fetch(`${META_API_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const json = await res.json() as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      return { success: false, error: json.error?.message || `Meta API error ${res.status}` };
    }

    return { success: true, id: json.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ─── Template-based send (required for first-time outreach / cold contacts) ───
// Templates must be approved in Meta Business Manager before use.
// Submit at: business.facebook.com → WhatsApp Manager → Message Templates

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  variables: string[] = []
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!META_WA_ACCESS_TOKEN)
    return { success: false, error: "META_WHATSAPP_ACCESS_TOKEN not configured." };
  if (!META_WA_PHONE_NUMBER_ID)
    return { success: false, error: "META_WHATSAPP_PHONE_NUMBER_ID not configured." };

  const phone = normalizePhone(to);

  const components = variables.length > 0
    ? [{
        type: "body",
        parameters: variables.map(v => ({ type: "text", text: v })),
      }]
    : [];

  try {
    const res = await fetch(`${META_API_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
    });

    const json = await res.json() as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      return { success: false, error: json.error?.message || `Meta API error ${res.status}` };
    }

    return { success: true, id: json.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Note: there is intentionally no "check if a number is on WhatsApp" helper.
// The Cloud API has no contacts/validation endpoint (that was On-Premises API
// only), so such a check cannot be performed reliably.

// ─── Pre-loaded template definitions ─────────────────────────────────────────
// These match the templates you should create in Meta Business Manager.
// Submit at: business.facebook.com → WhatsApp Manager → Message Templates

export const WHATSAPP_TEMPLATES: Array<{
  id: string;
  label: string;
  metaTemplateName: string | null;
  languageCode: string;
  requiresApproval: boolean;
  body: string;
  note: string;
  group: CrmTemplateGroup;
}> = [
  {
    id: "wa_broker_intro",
    label: "Step 1: Broker Intro (template)",
    group: "1 — Pitch the Broker",
    metaTemplateName: "new_dawn_broker_intro",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, I'm with New Dawn Franchising — three E-2 franchise verticals (Property Management, Telecom, Insurance) from $225K. Would you be open to a quick call about our referral partner program?",
    note: "Submit as 'new_dawn_broker_intro' (Marketing) in Meta Business Manager. Variable: {{1}} = first name.",
  },
  {
    id: "wa_investor_intro",
    label: "Step 1: Investor Intro (template)",
    group: "2 — Pitch the Investor",
    metaTemplateName: "new_dawn_intro",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, I'm with New Dawn Franchising. We offer E-2 visa franchises across Property Management, Telecom, and Insurance — you own and direct the business; our teams handle daily operations. Open to a 15-min call?",
    note: "Submit as 'new_dawn_intro' (Marketing) in Meta Business Manager. Variable: {{1}} = first name.",
  },
  {
    id: "wa_investor_followup",
    label: "Step 2: Investor Follow-Up (template)",
    group: "2 — Pitch the Investor",
    metaTemplateName: "new_dawn_followup",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, following up on New Dawn's E-2 franchise platform — three industries, one platform, investment from $225K. Happy to send our FDD or schedule a discovery call. Reply STOP to opt out.",
    note: "Submit as 'new_dawn_followup' (Marketing). Variable: {{1}} = first name.",
  },
  {
    id: "wa_fdd_offer",
    label: "Step 1: FDD Offer (template)",
    group: "3 — FDD & Receipt",
    metaTemplateName: "new_dawn_fdd",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, your Franchise Disclosure Document is ready. It covers all three verticals so you can compare options — you'll have 14 days to review before any next steps. Shall I send it over?",
    note: "Submit as 'new_dawn_fdd' (Marketing). Variable: {{1}} = first name.",
  },
  {
    id: "wa_freeform_reply",
    label: "Free-form reply (24hr window)",
    group: "5 — Follow-Up",
    metaTemplateName: null,
    languageCode: "en_US",
    requiresApproval: false,
    body: "Hi {{name}}, Dylan here from New Dawn Franchising. Just checking in — any questions I can answer about our E-2 franchise platform?",
    note: "Only works if the contact has messaged you within the last 24 hours.",
  },
];
