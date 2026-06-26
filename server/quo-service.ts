import type { CrmTemplateGroup } from "@shared/crm-template-groups";

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

  // Normalize + validate to E.164 before hitting the provider. Previously this
  // only stripped non-digits and prepended "+", so a US/Canada number entered as
  // "416.800.7213" became "+4168007213" (no country code) and OpenPhone rejected
  // it as invalid. toSmsE164 turns that into "+14168007213" and rejects clearly
  // unsendable values (e.g. an email address sitting in the phone field) with a
  // readable error instead of a cryptic provider rejection.
  const check = toSmsE164(to);
  if (!check.ok) {
    return { success: false, error: check.error };
  }
  const phone = check.e164;

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
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : phone;
}

/**
 * Normalize a raw contact value to a sendable E.164 number, validating along the
 * way. Returns the E.164 string when textable, or a human-readable reason when
 * not. Catches the two real-world failure modes seen in production: an email
 * address sitting in the phone field, and local/short numbers with no usable
 * country code (e.g. "416.800.7213" → "+14168007213").
 */
export function toSmsE164(
  raw: string | null | undefined,
): { ok: true; e164: string } | { ok: false; error: string } {
  const value = (raw || "").trim();
  if (!value) return { ok: false, error: "No phone number" };
  // Letters/@ mean it isn't a phone number at all (almost always an email that
  // was mirrored into the phone field) — it can never be texted.
  if (/[a-zA-Z@]/.test(value)) {
    return { ok: false, error: `Not a phone number: "${value}"` };
  }
  const e164 = normalizePhoneE164(value);
  const digits = e164.replace(/\D/g, "");
  // E.164 is a leading "+" and up to 15 digits. A dialable number needs the
  // national number plus a country code; under 11 digits after normalization
  // (e.g. a bare 7-digit local number) is incomplete and the carrier rejects it.
  if (digits.length < 11 || digits.length > 15) {
    return { ok: false, error: `Invalid phone number format: "${value}"` };
  }
  return { ok: true, e164 };
}

export function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export interface SmsConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  sentAt: string;
}

/** Pull the full SMS thread with a contact from Quo/OpenPhone. */
export async function fetchSmsConversation(phone: string): Promise<SmsConversationMessage[]> {
  if (!QUO_API_KEY || !QUO_PHONE_NUMBER_ID) return [];

  const participant = normalizePhoneE164(phone);
  const out: SmsConversationMessage[] = [];
  let pageToken: string | null = null;

  try {
    for (let page = 0; page < 5; page++) {
      const url = new URL(`${QUO_API_BASE}/messages`);
      url.searchParams.set("phoneNumberId", QUO_PHONE_NUMBER_ID);
      url.searchParams.set("participants", participant);
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: QUO_API_KEY },
      });
      if (!res.ok) break;

      const json = await res.json() as {
        data?: Array<{
          id: string;
          text?: string;
          direction?: string;
          status?: string;
          createdAt?: string;
        }>;
        nextPageToken?: string | null;
      };

      for (const msg of json.data || []) {
        if (!msg.text) continue;
        out.push({
          id: msg.id,
          direction: msg.direction === "incoming" ? "inbound" : "outbound",
          body: msg.text,
          status: msg.status || "sent",
          sentAt: msg.createdAt || new Date().toISOString(),
        });
      }

      pageToken = json.nextPageToken ?? null;
      if (!pageToken) break;
    }
  } catch {
    return [];
  }

  out.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  return out;
}

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

export const SMS_TEMPLATES: Array<{ id: string; label: string; body: string; group: CrmTemplateGroup }> = [
  {
    id: "broker_intro",
    label: "Step 1: Broker Intro",
    group: "1 — Pitch the Broker",
    body: "Hi {{name}}, I'm with New Dawn Franchising — a multi-vertical E-2 franchise platform (PM, Telecom, Insurance) from $225K. Open to a 15-min call on referral partnerships?",
  },
  {
    id: "broker_followup",
    label: "Step 2: Broker Follow-Up",
    group: "1 — Pitch the Broker",
    body: "Hi {{name}}, following up on New Dawn's E-2 franchise referral program. Happy to send our FDD overview or jump on a quick call — whatever's easier.",
  },
  {
    id: "investor_intro",
    label: "Step 1: Investor Intro",
    group: "2 — Pitch the Investor",
    body: "Hi {{name}}, New Dawn Franchising offers E-2 visa franchises in Property Management, Telecom, or Insurance from $225K. You direct it; we run ops. 15 mins to chat?",
  },
  {
    id: "investor_discovery",
    label: "Step 2: Discovery Nudge",
    group: "2 — Pitch the Investor",
    body: "Hi {{name}}, wanted to follow up on New Dawn's E-2 franchise platform. Would you have 15 minutes this week for a discovery call? No commitment — just Q&A.",
  },
  {
    id: "investor_post_call",
    label: "Step 3: Post-Call Follow-Up",
    group: "2 — Pitch the Investor",
    body: "Hi {{name}}, great speaking with you today. I'll send your FDD shortly — you'll have 14 days to review before any next steps. Reach out with any questions!",
  },
  {
    id: "fdd_reminder",
    label: "Step 1: FDD Review Reminder",
    group: "3 — FDD & Receipt",
    body: "Hi {{name}}, checking in on your FDD review. Any questions on Property Management, Telecom, or Insurance? Happy to walk through it on a quick call.",
  },
  {
    id: "fdd_receipt",
    label: "Step 2: FDD Receipt Nudge",
    group: "3 — FDD & Receipt",
    body: "Hi {{name}}, please sign your FDD Receipt when you get a moment — it only confirms you received the document. A secure link is on its way to your email.",
  },
  {
    id: "closing_wire",
    label: "Step 1: Wire Reminder",
    group: "4 — Close the Deal",
    body: "Hi {{name}}, congrats on your Franchise Agreement! Wire instructions are in your email — please send the confirmation number once initiated so we can begin onboarding.",
  },
];
