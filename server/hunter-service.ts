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
