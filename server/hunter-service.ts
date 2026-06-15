const HUNTER_API_KEY = process.env.HUNTER_API_KEY || "";

export function getHunterStatus() {
  return { configured: !!HUNTER_API_KEY, provider: "Hunter.io" };
}

export interface HunterEmailResult {
  email: string;
  confidence: number;
  pattern: string | null;
  status: string;
}

export async function hunterFindEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<HunterEmailResult | null> {
  if (!HUNTER_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      domain,
      first_name: firstName,
      last_name: lastName,
      api_key: HUNTER_API_KEY,
    });
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown[] };
    if (json.errors?.length || !json.data?.email) return null;
    const d = json.data;
    const confidence = Number(d.confidence || 0);
    if (confidence < 70) return null;
    return {
      email: String(d.email),
      confidence,
      pattern: String(d.pattern || "") || null,
      status: String(d.status || ""),
    };
  } catch { return null; }
}

export interface HunterVerifyResult {
  email: string;
  result: string;   // deliverable | undeliverable | risky | unknown
  status: string;   // valid | invalid | accept_all | webmail | disposable | unknown
  score: number;    // 0-100 confidence
  disposable: boolean;
  webmail: boolean;
  mxRecords: boolean;
  smtpServer: boolean;
}

// Verify an email address with Hunter's email-verifier endpoint.
export async function hunterVerifyEmail(email: string): Promise<HunterVerifyResult | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const params = new URLSearchParams({ email, api_key: HUNTER_API_KEY });
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as { data?: Record<string, any>; errors?: unknown[] };
    if (json.errors?.length || !json.data) return null;
    const d = json.data;
    return {
      email: String(d.email || email),
      result: String(d.result || "unknown"),
      status: String(d.status || "unknown"),
      score: Number(d.score || 0),
      disposable: !!d.disposable,
      webmail: !!d.webmail,
      mxRecords: !!d.mx_records,
      smtpServer: !!d.smtp_server,
    };
  } catch { return null; }
}

export async function hunterDomainPattern(domain: string): Promise<string | null> {
  if (!HUNTER_API_KEY) return null;

  try {
    const params = new URLSearchParams({ domain, api_key: HUNTER_API_KEY });
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as { data?: { pattern?: string } };
    return json.data?.pattern || null;
  } catch { return null; }
}

export function buildEmailFromPattern(
  firstName: string,
  lastName: string,
  domain: string,
  pattern: string
): string {
  const f = firstName.toLowerCase();
  const l = lastName.toLowerCase();
  const fi = f[0] || "";
  const li = l[0] || "";
  return pattern
    .replace("{first}", f)
    .replace("{last}", l)
    .replace("{f}", fi)
    .replace("{l}", li)
    .replace("{first.last}", `${f}.${l}`)
    .replace("{f.last}", `${fi}.${l}`)
    .concat(`@${domain}`);
}
