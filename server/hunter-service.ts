const HUNTER_API_KEY = process.env.HUNTER_API_KEY || "";

export function getHunterStatus() {
  return { configured: !!HUNTER_API_KEY, provider: "Hunter.io" };
}

// ─── Failure visibility ───────────────────────────────────────────────────────
// Every function below returns null on any failure so callers degrade
// gracefully — but that made a quota-exhausted key indistinguishable from
// "no email found": a whole day's enrichment could silently produce zero.
// Record the most severe recent HTTP failure so batch jobs (the daily campaign
// build) can surface it in their report; quota/rate failures outrank the rest.
let lastHunterIssue: { message: string; quota: boolean } | null = null;

/** Most recent Hunter HTTP failure since the last clear (null = all healthy). */
export function getHunterIssue(): string | null {
  return lastHunterIssue?.message ?? null;
}

/** Reset failure tracking — call at the start of a batch run. */
export function clearHunterIssue(): void {
  lastHunterIssue = null;
}

function noteHunterHttpFailure(endpoint: string, status: number, bodyText: string): void {
  const detail = (() => {
    try {
      const errs = (JSON.parse(bodyText) as { errors?: { details?: string; id?: string }[] }).errors;
      return errs?.[0]?.details || errs?.[0]?.id || "";
    } catch {
      return "";
    }
  })();
  const quota = status === 429 || /limit|quota|run out|insufficient/i.test(detail);
  if (quota) {
    lastHunterIssue = {
      quota: true,
      message: `Hunter ${endpoint} rate/quota limit hit (HTTP ${status}${detail ? `: ${detail.slice(0, 100)}` : ""}) — email enrichment degraded`,
    };
  } else if (!lastHunterIssue?.quota) {
    lastHunterIssue = { quota: false, message: `Hunter ${endpoint} error HTTP ${status}${detail ? `: ${detail.slice(0, 100)}` : ""}` };
  }
  console.warn(`[Hunter] ${endpoint} HTTP ${status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
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
    if (!res.ok) {
      noteHunterHttpFailure("email-finder", res.status, await res.text().catch(() => ""));
      return null;
    }
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
    if (!res.ok) {
      noteHunterHttpFailure("email-verifier", res.status, await res.text().catch(() => ""));
      return null;
    }
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

export interface HunterDomainEmail {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  /** "personal" (a named person's mailbox) or "generic" (info@, office@…). */
  type: string;
  confidence: number;
}

export interface HunterDomainSearchResult {
  pattern: string | null;
  organization: string | null;
  emails: HunterDomainEmail[];
}

/**
 * Full Hunter domain-search: the firm's email pattern PLUS the actual addresses
 * Hunter has on file for the domain — including named people with positions.
 * This is what turns an org-only lead ("Smith Immigration Law") into real,
 * emailable contacts.
 */
export async function hunterDomainSearch(domain: string): Promise<HunterDomainSearchResult | null> {
  if (!HUNTER_API_KEY) return null;

  try {
    const params = new URLSearchParams({ domain, api_key: HUNTER_API_KEY });
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    if (!res.ok) {
      noteHunterHttpFailure("domain-search", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json() as {
      data?: {
        pattern?: string;
        organization?: string;
        emails?: Array<{
          value?: string;
          first_name?: string | null;
          last_name?: string | null;
          position?: string | null;
          type?: string;
          confidence?: number;
        }>;
      };
    };
    if (!json.data) return null;
    return {
      pattern: json.data.pattern || null,
      organization: json.data.organization || null,
      emails: (json.data.emails ?? [])
        .filter((e) => e.value && e.value.includes("@"))
        .map((e) => ({
          email: String(e.value),
          firstName: e.first_name || null,
          lastName: e.last_name || null,
          position: e.position || null,
          type: String(e.type || "generic"),
          confidence: Number(e.confidence || 0),
        })),
    };
  } catch { return null; }
}

export async function hunterDomainPattern(domain: string): Promise<string | null> {
  const r = await hunterDomainSearch(domain);
  return r?.pattern ?? null;
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
