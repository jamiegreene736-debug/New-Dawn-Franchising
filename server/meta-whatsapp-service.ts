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

// ─── Check if a phone number is registered on WhatsApp ────────────────────────
// Uses the Meta Contacts API. Returns true/false per number.

export async function checkWhatsAppNumber(
  phoneNumber: string
): Promise<{ onWhatsApp: boolean; waId?: string; error?: string }> {
  if (!META_WA_ACCESS_TOKEN)
    return { onWhatsApp: false, error: "META_WHATSAPP_ACCESS_TOKEN not configured." };
  if (!META_WA_PHONE_NUMBER_ID)
    return { onWhatsApp: false, error: "META_WHATSAPP_PHONE_NUMBER_ID not configured." };

  const phone = "+" + normalizePhone(phoneNumber);

  try {
    const res = await fetch(`${META_API_BASE}/${META_WA_PHONE_NUMBER_ID}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        contacts: [phone],
      }),
    });

    const json = await res.json() as {
      contacts?: Array<{ input: string; status: string; wa_id?: string }>;
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      return { onWhatsApp: false, error: json.error?.message || `Meta API error ${res.status}` };
    }

    const contact = json.contacts?.[0];
    if (!contact) return { onWhatsApp: false };

    if (contact.status === "valid" && contact.wa_id) {
      return { onWhatsApp: true, waId: contact.wa_id };
    }

    return { onWhatsApp: false };
  } catch (err) {
    return { onWhatsApp: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ─── Pre-loaded template definitions ─────────────────────────────────────────
// These match the templates you should create in Meta Business Manager.
// Submit at: business.facebook.com → WhatsApp Manager → Message Templates

export const WHATSAPP_TEMPLATES = [
  {
    id: "wa_intro",
    label: "Cold intro (template)",
    metaTemplateName: "new_dawn_intro",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, I'm Dylan from New Dawn Franchising. We help international investors acquire E-2 visa compliant property management businesses in Texas. Would you be open to a quick call?",
    note: "Submit this as 'new_dawn_intro' (Marketing) in Meta Business Manager. Variable: {{1}} = first name.",
  },
  {
    id: "wa_followup",
    label: "Follow-up (template)",
    metaTemplateName: "new_dawn_followup",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, following up on my note about E-2 visa franchise opportunities in Texas. Happy to send details or jump on a 15-min call. Reply STOP to opt out.",
    note: "Submit as 'new_dawn_followup' (Marketing). Variable: {{1}} = first name.",
  },
  {
    id: "wa_brochure",
    label: "Brochure offer (template)",
    metaTemplateName: "new_dawn_brochure",
    languageCode: "en_US",
    requiresApproval: true,
    body: "Hi {{name}}, I've put together an investor brochure covering the full E-2 franchise model, investment details, and Texas market data. Want me to send it over?",
    note: "Submit as 'new_dawn_brochure' (Marketing). Variable: {{1}} = first name.",
  },
  {
    id: "wa_freeform_reply",
    label: "Free-form reply (existing contacts only)",
    metaTemplateName: null,
    languageCode: "en_US",
    requiresApproval: false,
    body: "Hi {{name}}, Dylan here from New Dawn Franchising. Just wanted to check in — any questions I can answer about the E-2 franchise opportunity?",
    note: "Only works if the contact has messaged you within the last 24 hours.",
  },
];
