import crypto from "crypto";
import { pool } from "./db";
import { SENDING_DOMAIN } from "./deliverability-service";

// ─────────────────────────────────────────────────────────────────────────────
// Google Postmaster Tools ingestion (Phase 3)
//
// Pulls Gmail's view of the sending domain — domain/IP reputation, user-reported
// spam rate, and SPF/DKIM/DMARC success ratios — the single best free signal for
// Gmail deliverability. Stores a daily snapshot per domain.
//
// Auth (gated; inert until configured):
//   • POSTMASTER_ACCESS_TOKEN  — a ready OAuth token (simplest), OR
//   • POSTMASTER_SA_KEY        — a service-account JSON key (minted to a token
//                                here via RS256 JWT); set POSTMASTER_IMPERSONATE
//                                to the owner email for domain-wide delegation.
//   • POSTMASTER_DOMAINS       — comma list (default: the sending domain + send.).
//
// The account/owner must be added to the domain in Postmaster Tools, and the
// domain needs enough volume for Google to publish stats.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/postmaster.readonly";
const API = "https://gmailpostmastertools.googleapis.com/v1";

export function getPostmasterConfig() {
  const domains = (process.env.POSTMASTER_DOMAINS || `${SENDING_DOMAIN},send.${SENDING_DOMAIN}`)
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const configured = !!(process.env.POSTMASTER_ACCESS_TOKEN || process.env.POSTMASTER_SA_KEY);
  return { configured, domains };
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const staticTok = process.env.POSTMASTER_ACCESS_TOKEN;
  if (staticTok) return staticTok.trim();

  const raw = process.env.POSTMASTER_SA_KEY;
  if (!raw) return null;
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;

  let key: any;
  try { key = JSON.parse(raw); } catch { console.error("[Postmaster] POSTMASTER_SA_KEY is not valid JSON"); return null; }
  if (!key.client_email || !key.private_key) return null;

  const iat = Math.floor(Date.now() / 1000);
  const claim: any = { iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat, exp: iat + 3600 };
  if (process.env.POSTMASTER_IMPERSONATE) claim.sub = process.env.POSTMASTER_IMPERSONATE;
  const signingInput = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claim))}`;
  const signature = b64url(crypto.createSign("RSA-SHA256").update(signingInput).sign(key.private_key));
  const assertion = `${signingInput}.${signature}`;

  try {
    const res = await fetch(TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await res.json();
    if (!res.ok || !json.access_token) { console.error("[Postmaster] token exchange failed:", json.error || res.status); return null; }
    cachedToken = { token: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
    return cachedToken.token;
  } catch (e: any) {
    console.error("[Postmaster] token exchange error:", e?.message);
    return null;
  }
}

const ratio = (v: any): number | null => (v == null ? null : +Number(v).toFixed(4));

let lastSync = { at: new Date(0).toISOString(), stored: 0, error: null as string | null };
export function getPostmasterSyncStatus() { return lastSync; }

export async function syncPostmaster(): Promise<{ stored: number }> {
  const cfg = getPostmasterConfig();
  if (!cfg.configured) { lastSync = { at: new Date().toISOString(), stored: 0, error: "not configured" }; return { stored: 0 }; }
  const token = await getAccessToken();
  if (!token) { lastSync = { at: new Date().toISOString(), stored: 0, error: "could not obtain access token" }; return { stored: 0 }; }

  let stored = 0;
  let error: string | null = null;
  for (const domain of cfg.domains) {
    try {
      const res = await fetch(`${API}/domains/${encodeURIComponent(domain)}/trafficStats`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) { error = `${domain}: HTTP ${res.status}`; continue; }
      const json: any = await res.json();
      const stats: any[] = json.trafficStats || [];
      for (const s of stats) {
        // name = domains/<d>/trafficStats/YYYYMMDD
        const day = (s.name || "").split("/").pop() || "";
        const date = day.length === 8 ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : null;
        if (!date) continue;
        await pool.query(
          `INSERT INTO postmaster_stats (id, domain, day, spam_rate, domain_reputation, dkim_ratio, spf_ratio, dmarc_ratio, raw)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           ON CONFLICT (domain, day) DO UPDATE SET spam_rate=EXCLUDED.spam_rate, domain_reputation=EXCLUDED.domain_reputation,
             dkim_ratio=EXCLUDED.dkim_ratio, spf_ratio=EXCLUDED.spf_ratio, dmarc_ratio=EXCLUDED.dmarc_ratio, raw=EXCLUDED.raw`,
          [domain, date, ratio(s.userReportedSpamRatio), s.domainReputation || null,
           ratio(s.dkimSuccessRatio), ratio(s.spfSuccessRatio), ratio(s.dmarcSuccessRatio), JSON.stringify(s)],
        );
        stored++;
      }
    } catch (e: any) {
      error = `${domain}: ${e?.message}`;
    }
  }
  lastSync = { at: new Date().toISOString(), stored, error };
  if (stored) console.log(`[Postmaster] stored ${stored} daily snapshot(s)`);
  return { stored };
}

export async function getPostmasterOverview() {
  const cfg = getPostmasterConfig();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (domain) domain, day, spam_rate, domain_reputation, dkim_ratio, spf_ratio, dmarc_ratio
     FROM postmaster_stats ORDER BY domain, day DESC`,
  ).catch(() => ({ rows: [] }));
  return {
    config: { configured: cfg.configured, domains: cfg.domains },
    syncStatus: lastSync,
    latest: rows.map((r: any) => ({
      domain: r.domain, day: r.day,
      spamRate: r.spam_rate == null ? null : Number(r.spam_rate),
      domainReputation: r.domain_reputation,
      dkimRatio: r.dkim_ratio == null ? null : Number(r.dkim_ratio),
      spfRatio: r.spf_ratio == null ? null : Number(r.spf_ratio),
      dmarcRatio: r.dmarc_ratio == null ? null : Number(r.dmarc_ratio),
    })),
  };
}
