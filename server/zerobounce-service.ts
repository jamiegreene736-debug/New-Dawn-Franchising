const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY || "";

export function getZeroBounceStatus() {
  return { configured: !!ZEROBOUNCE_API_KEY, provider: "ZeroBounce" };
}

export type EmailStatus = "valid" | "catch-all" | "invalid" | "unknown" | "unverified";

export interface ZeroBounceResult {
  email: string;
  status: EmailStatus;
  subStatus: string | null;
  safe: boolean;
}

export async function verifyEmail(email: string): Promise<ZeroBounceResult> {
  if (!ZEROBOUNCE_API_KEY) {
    return { email, status: "unverified", subStatus: null, safe: false };
  }

  try {
    const params = new URLSearchParams({ api_key: ZEROBOUNCE_API_KEY, email });
    const res = await fetch(`https://api.zerobounce.net/v2/validate?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { email, status: "unknown", subStatus: null, safe: false };
    const json = await res.json() as { status?: string; sub_status?: string };
    const status = (json.status || "unknown").toLowerCase() as EmailStatus;
    const safe = status === "valid" || status === "catch-all";
    return { email, status, subStatus: json.sub_status || null, safe };
  } catch {
    return { email, status: "unknown", subStatus: null, safe: false };
  }
}

export async function verifyEmailBatch(
  emails: string[],
  concurrency = 4
): Promise<Map<string, ZeroBounceResult>> {
  const results = new Map<string, ZeroBounceResult>();
  if (!emails.length) return results;

  for (let i = 0; i < emails.length; i += concurrency) {
    const chunk = emails.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((e) => verifyEmail(e)));
    for (let j = 0; j < chunk.length; j++) {
      const s = settled[j];
      results.set(
        chunk[j],
        s.status === "fulfilled"
          ? s.value
          : { email: chunk[j], status: "unknown", subStatus: null, safe: false }
      );
    }
  }
  return results;
}
