// Quo (OpenPhone) SMS Service
// API docs: https://www.quo.com/docs/mdx/api-reference/messages/send-a-text-message
// Auth: plain API key in Authorization header

const QUO_API_KEY = process.env.QUO_API_KEY || "";
const QUO_PHONE_NUMBER_ID = process.env.QUO_PHONE_NUMBER_ID || "";
const QUO_API_BASE = "https://api.openphone.com/v1";

export function getQuoStatus() {
  return {
    configured: !!(QUO_API_KEY && QUO_PHONE_NUMBER_ID),
    smsReady: !!(QUO_API_KEY && QUO_PHONE_NUMBER_ID),
    phoneNumberId: QUO_PHONE_NUMBER_ID || null,
  };
}

export async function sendSmsViaQuo(
  to: string,
  content: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!QUO_API_KEY) {
    return { success: false, error: "QUO_API_KEY not configured. Add it in Secrets." };
  }
  if (!QUO_PHONE_NUMBER_ID) {
    return { success: false, error: "QUO_PHONE_NUMBER_ID not configured. Add it in Secrets." };
  }

  const phone = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  try {
    const res = await fetch(`${QUO_API_BASE}/messages`, {
      method: "POST",
      headers: {
        Authorization: QUO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        from: QUO_PHONE_NUMBER_ID,
        to: [phone],
      }),
    });

    const json = await res.json() as { data?: { id?: string }; message?: string; error?: string };

    if (!res.ok) {
      return {
        success: false,
        error: json.message || json.error || `Quo API error ${res.status}`,
      };
    }

    return { success: true, id: json.data?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Fetch the phone numbers available on the Quo account (useful for setup verification)
export async function listQuoPhoneNumbers(): Promise<{ id: string; formattedNumber: string; name: string }[]> {
  if (!QUO_API_KEY) return [];
  try {
    const res = await fetch(`${QUO_API_BASE}/phone-numbers`, {
      headers: { Authorization: QUO_API_KEY },
    });
    const json = await res.json() as { data?: { id: string; formattedNumber: string; name: string }[] };
    return json.data || [];
  } catch {
    return [];
  }
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
