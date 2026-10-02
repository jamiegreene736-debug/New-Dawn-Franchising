import crypto from "crypto";
import { z } from "zod";
import { pool } from "./db";
import { SENDING_DOMAIN } from "./deliverability-service";

// Reporting only: credentials never grant inbox access or permission to send.
// Prefer POSTMASTER_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN for a domain owner.
// Service-account delegation and static tokens remain supported for existing installs.
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/postmaster.traffic.readonly";
const API = "https://gmailpostmastertools.googleapis.com/v2";

export function getPostmasterConfig() {
  const domains = [...new Set((process.env.POSTMASTER_DOMAINS || SENDING_DOMAIN)
    .split(",").map(d => d.trim().toLowerCase()).filter(Boolean))];
  const configured = !!(process.env.POSTMASTER_ACCESS_TOKEN || process.env.POSTMASTER_SA_KEY ||
    (process.env.POSTMASTER_CLIENT_ID && process.env.POSTMASTER_CLIENT_SECRET && process.env.POSTMASTER_REFRESH_TOKEN));
  return { configured, domains };
}

class ReportingError extends Error {}
let cachedToken: { token: string; exp: number; key: string } | null = null;

async function getAccessToken(): Promise<string> {
  if (process.env.POSTMASTER_ACCESS_TOKEN) return process.env.POSTMASTER_ACCESS_TOKEN.trim();
  const { POSTMASTER_CLIENT_ID: clientId, POSTMASTER_CLIENT_SECRET: clientSecret,
    POSTMASTER_REFRESH_TOKEN: refreshToken, POSTMASTER_SA_KEY: raw } = process.env;
  const key = crypto.createHash("sha256").update(JSON.stringify([clientId, clientSecret, refreshToken, raw, process.env.POSTMASTER_IMPERSONATE])).digest("hex");
  if (cachedToken?.key === key && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  let body: URLSearchParams;
  if (clientId && clientSecret && refreshToken) {
    body = new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  } else {
    let account: { client_email: string; private_key: string };
    try {
      account = z.object({ client_email: z.string().email(), private_key: z.string().min(1) }).parse(JSON.parse(raw || "{}"));
    } catch { throw new ReportingError("Reporting credentials are incomplete or invalid."); }
    const iat = Math.floor(Date.now() / 1000);
    const claim = { iss: account.client_email, scope: SCOPE, aud: TOKEN_URI, iat, exp: iat + 3600, sub: process.env.POSTMASTER_IMPERSONATE };
    const input = `${Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify(claim)).toString("base64url")}`;
    const signature = crypto.createSign("RSA-SHA256").update(input).sign(account.private_key).toString("base64url");
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${signature}` });
  }
  const res = await fetch(TOKEN_URI, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new ReportingError(`Google authorization failed (HTTP ${res.status}). Reconnect the reporting account if access was revoked.`);
  const parsed = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).safeParse(await res.json());
  if (!parsed.success) throw new ReportingError("Google returned an invalid authorization response.");
  cachedToken = { token: parsed.data.access_token, exp: Date.now() + parsed.data.expires_in * 1000, key };
  return cachedToken.token;
}

const metricNames = ["spamRate", "dkimRatio", "spfRatio", "dmarcRatio"] as const;
type Metric = typeof metricNames[number];
const dateSchema = z.object({ year: z.number().int().min(1).max(9999), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) });
const pageSchema = z.object({
  domainStats: z.array(z.object({ metric: z.enum(metricNames), date: dateSchema,
    value: z.object({ doubleValue: z.number().finite().optional(), floatValue: z.number().finite().optional(), intValue: z.string().regex(/^\d+$/).optional() }) })).default([]),
  nextPageToken: z.string().optional(),
});
const googleDate = (date: Date) => ({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });

async function queryDomain(domain: string, token: string) {
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - 29 * 86_400_000);
  const snapshots = new Map<string, Partial<Record<Metric, number>>>();
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await fetch(`${API}/domains/${encodeURIComponent(domain)}/domainStats:query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeQuery: { dateRanges: { dateRanges: [{ start: googleDate(start), end: googleDate(end) }] } },
        aggregationGranularity: "DAILY", pageSize: 200, pageToken,
        metricDefinitions: [
          { name: "spamRate", baseMetric: { standardMetric: "SPAM_RATE" } },
          ...["dkim", "spf", "dmarc"].map(auth => ({ name: `${auth}Ratio`, baseMetric: { standardMetric: "AUTH_SUCCESS_RATE" }, filter: `auth_type = "${auth}"` })),
        ] }), signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      if (res.status === 401) cachedToken = null;
      throw new ReportingError(`Google reporting returned HTTP ${res.status}.${res.status === 403 ? " Check API access and this account's domain permissions." : ""}`);
    }
    const parsed = pageSchema.safeParse(await res.json());
    if (!parsed.success) throw new ReportingError("Google returned an invalid report response.");
    for (const stat of parsed.data.domainStats) {
      const { year, month, day } = stat.date;
      const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new ReportingError("Google returned an invalid report date.");
      const value = stat.value.doubleValue ?? stat.value.floatValue ?? (stat.value.intValue !== undefined ? Number(stat.value.intValue) : undefined);
      // Missing metrics stay unknown. Never manufacture a zero complaint rate.
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new ReportingError("Google returned an invalid report ratio.");
      snapshots.set(date, { ...snapshots.get(date), [stat.metric]: value });
    }
    pageToken = parsed.data.nextPageToken || undefined;
    if (pageToken) {
      if (seenTokens.has(pageToken) || seenTokens.size >= 20) throw new ReportingError("Google report pagination did not complete.");
      seenTokens.add(pageToken);
    }
  } while (pageToken);
  return snapshots;
}

type SyncState = "not_configured" | "not_synced" | "connected" | "no_data" | "error";
let lastSync = { at: new Date(0).toISOString(), stored: 0, error: null as string | null, state: "not_synced" as SyncState };
export function getPostmasterSyncStatus() { return lastSync; }
let syncing: Promise<{ stored: number }> | null = null;
export function syncPostmaster(): Promise<{ stored: number }> {
  if (!syncing) syncing = performSync().finally(() => { syncing = null; });
  return syncing;
}

async function performSync(): Promise<{ stored: number }> {
  const cfg = getPostmasterConfig();
  let stored = 0;
  const errors: string[] = [];
  if (!cfg.configured) {
    lastSync = { at: new Date().toISOString(), stored, error: "Reporting account is not connected.", state: "not_configured" };
    return { stored };
  }
  try {
    if (!cfg.domains.length || cfg.domains.some(domain => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))) {
      throw new ReportingError("Configure a valid reporting domain.");
    }
    const token = await getAccessToken();
    for (const domain of cfg.domains) {
      try {
        const snapshots = await queryDomain(domain, token);
        for (const [day, stats] of snapshots) {
          await pool.query(
            `INSERT INTO postmaster_stats (id, domain, day, spam_rate, domain_reputation, dkim_ratio, spf_ratio, dmarc_ratio, raw)
             VALUES (gen_random_uuid(), $1, $2, $3, NULL, $4, $5, $6, $7::jsonb)
             ON CONFLICT (domain, day) DO UPDATE SET spam_rate=EXCLUDED.spam_rate, domain_reputation=NULL,
               dkim_ratio=EXCLUDED.dkim_ratio, spf_ratio=EXCLUDED.spf_ratio, dmarc_ratio=EXCLUDED.dmarc_ratio, raw=EXCLUDED.raw`,
            [domain, day, stats.spamRate ?? null, stats.dkimRatio ?? null, stats.spfRatio ?? null, stats.dmarcRatio ?? null, JSON.stringify({ apiVersion: "v2", ...stats })],
          );
          stored++;
        }
      } catch (error) {
        errors.push(`${domain}: ${error instanceof ReportingError ? error.message : "Report sync failed. Try again; check server connectivity and report storage if it persists."}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof ReportingError ? error.message : "Could not connect to Google reporting. Try again.");
  }
  lastSync = { at: new Date().toISOString(), stored, error: errors.join(" ") || null, state: errors.length ? "error" : stored ? "connected" : "no_data" };
  return { stored };
}

export async function getPostmasterOverview() {
  const { rows } = await pool.query<{
    domain: string; day: string; spam_rate: string | null; domain_reputation: string | null;
    dkim_ratio: string | null; spf_ratio: string | null; dmarc_ratio: string | null;
  }>(`SELECT DISTINCT ON (domain) domain, day::text, spam_rate, domain_reputation, dkim_ratio, spf_ratio, dmarc_ratio
      FROM postmaster_stats ORDER BY domain, day DESC`);
  return {
    config: getPostmasterConfig(), syncStatus: lastSync,
    latest: rows.map(r => ({ domain: r.domain, day: r.day,
      spamRate: r.spam_rate == null ? null : Number(r.spam_rate), domainReputation: r.domain_reputation,
      dkimRatio: r.dkim_ratio == null ? null : Number(r.dkim_ratio), spfRatio: r.spf_ratio == null ? null : Number(r.spf_ratio),
      dmarcRatio: r.dmarc_ratio == null ? null : Number(r.dmarc_ratio) })),
  };
}
