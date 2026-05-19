const DROPCOWBOY_TOKEN = process.env.DROPCOWBOY_TOKEN || "";
const DROPCOWBOY_HMAC = process.env.DROPCOWBOY_HMAC_KEY || "";
const DROPCOWBOY_FROM = process.env.DROPCOWBOY_FROM_NUMBER || "";

export function getVoicemailStatus() {
  return {
    configured: !!(DROPCOWBOY_TOKEN && DROPCOWBOY_FROM),
    provider: "Drop Cowboy",
    fromNumber: DROPCOWBOY_FROM || null,
  };
}

export interface VoicemailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendRinglessVoicemail(
  to: string,
  audioUrl: string
): Promise<VoicemailResult> {
  if (!DROPCOWBOY_TOKEN) {
    return { success: false, error: "DROPCOWBOY_TOKEN not configured. Set DROPCOWBOY_TOKEN, DROPCOWBOY_HMAC_KEY, and DROPCOWBOY_FROM_NUMBER." };
  }
  if (!DROPCOWBOY_FROM) {
    return { success: false, error: "DROPCOWBOY_FROM_NUMBER not configured" };
  }
  if (!audioUrl) {
    return { success: false, error: "Audio URL is required" };
  }

  const phone = to.startsWith("+1") ? to.slice(2).replace(/\D/g, "") : to.replace(/\D/g, "");

  try {
    const res = await fetch("https://api.dropcowboy.com/ringless-voicemails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-token": DROPCOWBOY_TOKEN,
        "x-hmac": DROPCOWBOY_HMAC,
      },
      body: JSON.stringify({
        from: DROPCOWBOY_FROM.replace(/\D/g, ""),
        to: phone,
        vm: audioUrl,
      }),
    });

    const json = await res.json() as { id?: string; error?: string; message?: string };

    if (!res.ok) {
      return { success: false, error: json.error || json.message || `Drop Cowboy error ${res.status}` };
    }

    return { success: true, id: json.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export const VOICEMAIL_SCRIPTS = [
  {
    id: "intro",
    label: "Introduction",
    script: "Hi {{name}}, this is calling from New Dawn Franchising. I wanted to reach out personally about our E-2 visa property management franchise opportunity in Texas. It's a great fit for international investors. Please give me a call back when you have a moment. Thank you!",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    script: "Hi {{name}}, just leaving a quick voicemail to follow up on our E-2 franchise conversation. We have some exciting updates I'd love to share with you. Call me back at your convenience!",
  },
  {
    id: "fdd",
    label: "FDD ready",
    script: "Hi {{name}}, I'm reaching out because your Franchise Disclosure Document is ready. This is an important step in your E-2 visa franchise journey. Please call me back so we can walk through it together. Thank you!",
  },
];
