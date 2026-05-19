// OpenPhone Call Log Service
// Fetches call history, recordings, and transcripts from the OpenPhone/Quo API

const QUO_API_KEY = process.env.QUO_API_KEY || "";
const QUO_PHONE_NUMBER_ID = process.env.QUO_PHONE_NUMBER_ID || "";
const QUO_API_BASE = "https://api.openphone.com/v1";

export interface OpenPhoneCall {
  id: string;
  object: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "busy" | "no-answer" | "voicemail";
  duration: number; // seconds
  createdAt: string;
  answeredAt?: string | null;
  completedAt?: string | null;
  participants?: Array<{
    phoneNumberId?: string;
    direction?: string;
    phoneNumber?: string;
    name?: string;
  }>;
  voicemail?: {
    id?: string;
    duration?: number;
    transcription?: string;
    url?: string;
  } | null;
  recording?: {
    id?: string;
    url?: string;
    duration?: number;
  } | null;
}

export interface OpenPhoneTranscript {
  id?: string;
  callId?: string;
  dialogue?: Array<{
    identifier?: string;
    content?: string;
    startTime?: number;
  }>;
  summary?: string;
}

function authHeaders() {
  return { Authorization: QUO_API_KEY, "Content-Type": "application/json" };
}

export async function fetchOpenPhoneCalls(opts?: {
  maxResults?: number;
  createdAfter?: string;
  pageToken?: string;
}): Promise<{ data: OpenPhoneCall[]; nextPageToken?: string }> {
  if (!QUO_API_KEY || !QUO_PHONE_NUMBER_ID) {
    return { data: [] };
  }

  const params = new URLSearchParams();
  params.set("phoneNumberId", QUO_PHONE_NUMBER_ID);
  params.set("maxResults", String(opts?.maxResults ?? 50));
  if (opts?.createdAfter) params.set("createdAfter", opts.createdAfter);
  if (opts?.pageToken) params.set("pageToken", opts.pageToken);

  try {
    const res = await fetch(`${QUO_API_BASE}/calls?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[OpenPhone] fetchCalls error:", res.status, text);
      return { data: [] };
    }
    const json = await res.json() as { data?: OpenPhoneCall[]; nextPageToken?: string };
    return { data: json.data || [], nextPageToken: json.nextPageToken };
  } catch (err) {
    console.error("[OpenPhone] fetchCalls network error:", err);
    return { data: [] };
  }
}

export async function fetchCallTranscript(callId: string): Promise<OpenPhoneTranscript | null> {
  if (!QUO_API_KEY) return null;
  try {
    const res = await fetch(`${QUO_API_BASE}/call-transcripts/${callId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: OpenPhoneTranscript };
    return json.data || null;
  } catch {
    return null;
  }
}

export function formatTranscript(transcript: OpenPhoneTranscript): string {
  if (!transcript.dialogue || transcript.dialogue.length === 0) return "";
  return transcript.dialogue
    .map((line) => `[${line.identifier || "?"}] ${line.content || ""}`)
    .join("\n");
}

// Derive the caller phone number (the non-OpenPhone participant)
export function getCallerNumber(call: OpenPhoneCall): string {
  return call.direction === "inbound" ? call.from : call.to;
}

// Derive the caller name from participants if available
export function getCallerName(call: OpenPhoneCall): string | null {
  if (!call.participants) return null;
  const external = call.participants.find((p) => !p.phoneNumberId);
  return external?.name || null;
}
