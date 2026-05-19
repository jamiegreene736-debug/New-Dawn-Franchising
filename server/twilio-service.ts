const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const SMS_FROM = process.env.TWILIO_PHONE_NUMBER || "";
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || "";

export function getTwilioStatus() {
  return {
    configured: !!(ACCOUNT_SID && AUTH_TOKEN && SMS_FROM),
    smsReady: !!(ACCOUNT_SID && AUTH_TOKEN && SMS_FROM),
    whatsappReady: !!(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_FROM),
    smsNumber: SMS_FROM || null,
    whatsappNumber: WHATSAPP_FROM || null,
  };
}

async function twilioRequest(body: Record<string, string>): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER." };
  }

  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams(body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const json = await res.json() as { sid?: string; error_message?: string; message?: string };

    if (!res.ok) {
      return { success: false, error: json.error_message || json.message || `Twilio error ${res.status}` };
    }

    return { success: true, sid: json.sid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!SMS_FROM) return { success: false, error: "TWILIO_PHONE_NUMBER not configured" };
  const phone = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
  return twilioRequest({ To: phone, From: SMS_FROM, Body: body });
}

export async function sendWhatsApp(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!WHATSAPP_FROM) return { success: false, error: "TWILIO_WHATSAPP_NUMBER not configured" };
  const phone = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
  const whatsappFrom = WHATSAPP_FROM.startsWith("whatsapp:") ? WHATSAPP_FROM : `whatsapp:${WHATSAPP_FROM}`;
  return twilioRequest({ To: `whatsapp:${phone}`, From: whatsappFrom, Body: body });
}

export const SMS_TEMPLATES = [
  {
    id: "follow_up",
    label: "Quick follow-up",
    body: "Hey {{name}}, just following up on your E-2 franchise interest — do you have 15 mins this week?",
  },
  {
    id: "intro",
    label: "Initial outreach",
    body: "Hi {{name}}, I wanted to share info about our E-2 visa franchise opportunity in Texas. Are you available for a quick call?",
  },
  {
    id: "next_step",
    label: "Next step nudge",
    body: "{{name}}, your E-2 franchise application is looking great. Let's schedule our next step — reply to confirm a time.",
  },
  {
    id: "fdd_reminder",
    label: "FDD reminder",
    body: "Hi {{name}}, just a reminder that your Franchise Disclosure Document is ready for review. Let me know if you have any questions!",
  },
  {
    id: "meeting_confirm",
    label: "Meeting confirmation",
    body: "{{name}}, confirming our call tomorrow. Looking forward to discussing the E-2 franchise opportunity with you!",
  },
];

export const WHATSAPP_TEMPLATES = [
  {
    id: "wa_intro",
    label: "International intro",
    body: "Hello {{name}}, this is New Dawn Franchising. We specialize in E-2 visa compliant property management franchises in Texas. I'd love to share more — are you open to a brief call?",
  },
  {
    id: "wa_follow_up",
    label: "Follow-up",
    body: "Hi {{name}}, following up on your interest in our E-2 franchise opportunity. Do you have any questions I can answer?",
  },
  {
    id: "wa_brochure",
    label: "Brochure offer",
    body: "Hi {{name}}, I've prepared a detailed investor brochure for you. Would you like me to send it over? It covers the full E-2 visa franchise model, investment details, and Texas market data.",
  },
];
