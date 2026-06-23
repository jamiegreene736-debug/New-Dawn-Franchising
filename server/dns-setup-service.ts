import { promises as dns } from "dns";
import { SENDING_DOMAIN, getDomainAuth, type DomainAuthReport } from "./deliverability-service";

// ─────────────────────────────────────────────────────────────────────────────
// DNS / Subdomain setup service
//
// Generates the exact, copy-paste DNS records needed to stand up a dedicated
// cold-sending subdomain (Instantly/Smartlead's recommended architecture) and a
// first-party tracking domain — then LIVE-VERIFIES each one against real DNS.
//
// Why a subdomain: the root domain hosts the brand site + the real Workspace
// mailboxes — it's a transactional asset to protect. Cold outreach runs from a
// dedicated subdomain (e.g. send.newdawnfranchising.com) with its OWN
// SPF/DKIM/DMARC so a reputation hit is isolated from the root. SPF does NOT
// cascade to subdomains, so every record below is published AT the subdomain.
//
// All hosts/targets are env-overridable so the same tooling works if the team
// later moves to a different subdomain or a separate sending SLD (Path B).
// ─────────────────────────────────────────────────────────────────────────────

export const ROOT_DOMAIN = SENDING_DOMAIN; // newdawnfranchising.com
export const SENDING_SUBDOMAIN = (process.env.SENDING_SUBDOMAIN || `send.${ROOT_DOMAIN}`).toLowerCase();
// First-party open/click tracking host. A CNAME → the app so tracking links ride
// the sending org's own domain (maximises trust, isolates link reputation).
export const TRACKING_DOMAIN = (process.env.EMAIL_TRACKING_DOMAIN || `link.${SENDING_SUBDOMAIN}`).toLowerCase();
export const TRACKING_TARGET = (process.env.EMAIL_TRACKING_TARGET || `www.${ROOT_DOMAIN}`).toLowerCase();
const DMARC_RUA = process.env.DMARC_RUA || `dmarc@${ROOT_DOMAIN}`;
const DKIM_SELECTOR = process.env.DKIM_SELECTOR || "google"; // Google Workspace default

export interface DnsRecord {
  id: string;
  group: string;
  type: "TXT" | "CNAME" | "MX";
  host: string; // full FQDN
  hostRelative: string; // what most registrars want in the "Host/Name" field
  value: string;
  ttl: number;
  required: boolean;
  purpose: string;
}

// Google Workspace MX set, in priority order.
const GOOGLE_MX: { priority: number; exchange: string }[] = [
  { priority: 1, exchange: "ASPMX.L.GOOGLE.COM" },
  { priority: 5, exchange: "ALT1.ASPMX.L.GOOGLE.COM" },
  { priority: 5, exchange: "ALT2.ASPMX.L.GOOGLE.COM" },
  { priority: 10, exchange: "ALT3.ASPMX.L.GOOGLE.COM" },
  { priority: 10, exchange: "ALT4.ASPMX.L.GOOGLE.COM" },
];

function relativeHost(fqdn: string): string {
  if (fqdn === ROOT_DOMAIN) return "@";
  return fqdn.endsWith(`.${ROOT_DOMAIN}`) ? fqdn.slice(0, -(ROOT_DOMAIN.length + 1)) : fqdn;
}

export function generateRecords(): DnsRecord[] {
  const sub = SENDING_SUBDOMAIN;
  const records: DnsRecord[] = [];

  // ── MX — the subdomain must be able to RECEIVE (a send-only domain is itself a
  //    spam signal, and bounces/replies need somewhere to land). ────────────────
  for (let i = 0; i < GOOGLE_MX.length; i++) {
    const mx = GOOGLE_MX[i];
    records.push({
      id: `mx-${i}`,
      group: "Sending subdomain — receive (MX)",
      type: "MX",
      host: sub,
      hostRelative: relativeHost(sub),
      value: `${mx.priority} ${mx.exchange}`,
      ttl: 3600,
      required: true,
      purpose: "Route inbound mail for the subdomain to Google Workspace so it can receive replies/bounces.",
    });
  }

  // ── SPF — published AT the subdomain (does not inherit from root). ~all during
  //    warmup, tighten to -all once every sender is confirmed. ──────────────────
  records.push({
    id: "spf",
    group: "Sending subdomain — authentication",
    type: "TXT",
    host: sub,
    hostRelative: relativeHost(sub),
    value: "v=spf1 include:_spf.google.com ~all",
    ttl: 3600,
    required: true,
    purpose: "Authorise Google's outbound IPs to send as the subdomain. SPF does NOT cascade from the root — it must live here.",
  });

  // ── DKIM — generate the 2048-bit key in Google Admin for the subdomain, paste
  //    the public key here, THEN enable signing. ────────────────────────────────
  records.push({
    id: "dkim",
    group: "Sending subdomain — authentication",
    type: "TXT",
    host: `${DKIM_SELECTOR}._domainkey.${sub}`,
    hostRelative: relativeHost(`${DKIM_SELECTOR}._domainkey.${sub}`),
    value: "v=DKIM1; k=rsa; p=<PASTE 2048-bit public key from Google Admin → Apps → Gmail → Authenticate email>",
    ttl: 3600,
    required: true,
    purpose: "Cryptographically sign mail from the subdomain. Generate the key for this subdomain in Google Admin, publish it, then turn on signing.",
  });

  // ── DMARC — dedicated record for the subdomain so it runs its own monitor→
  //    enforce ramp independent of the root. Relaxed alignment. ─────────────────
  records.push({
    id: "dmarc",
    group: "Sending subdomain — authentication",
    type: "TXT",
    host: `_dmarc.${sub}`,
    hostRelative: relativeHost(`_dmarc.${sub}`),
    value: `v=DMARC1; p=none; rua=mailto:${DMARC_RUA}; adkim=r; aspf=r; fo=1`,
    ttl: 3600,
    required: true,
    purpose: "Start the subdomain in monitor mode (p=none) with aggregate reporting. Ramp to p=quarantine → p=reject after 2–4 weeks of clean reports.",
  });

  // ── First-party tracking domain (CNAME → app). ──────────────────────────────
  records.push({
    id: "tracking",
    group: "First-party tracking domain",
    type: "CNAME",
    host: TRACKING_DOMAIN,
    hostRelative: relativeHost(TRACKING_DOMAIN),
    value: `${TRACKING_TARGET}.`,
    ttl: 3600,
    required: false,
    purpose: `Serve open/click tracking from your own domain instead of a shared host. After it resolves, set EMAIL_TRACKING_DOMAIN=${TRACKING_DOMAIN} so pixel/click links use it.`,
  });

  return records;
}

// ─── Live verification ────────────────────────────────────────────────────────

export interface TrackingVerification {
  host: string;
  expectedTarget: string;
  status: "pass" | "warn" | "fail";
  summary: string;
  resolved?: string[];
}

async function verifyTracking(): Promise<TrackingVerification> {
  const host = TRACKING_DOMAIN;
  try {
    const cname = await dns.resolveCname(host).catch(() => [] as string[]);
    if (!cname.length) {
      // Maybe it resolves via A directly (also acceptable if it hits the app).
      const a = await dns.resolve4(host).catch(() => [] as string[]);
      if (a.length) {
        return { host, expectedTarget: TRACKING_TARGET, status: "warn", summary: "Resolves via A record, not a CNAME — works, but a CNAME to the app host is preferred so the target can change without re-pointing.", resolved: a };
      }
      return { host, expectedTarget: TRACKING_TARGET, status: "fail", summary: `No DNS record found for ${host}. Add the CNAME below, then it'll go live.`, resolved: [] };
    }
    const matches = cname.some((c) => c.toLowerCase().replace(/\.$/, "") === TRACKING_TARGET.replace(/\.$/, ""));
    return {
      host,
      expectedTarget: TRACKING_TARGET,
      status: matches ? "pass" : "warn",
      summary: matches
        ? `Tracking domain is live and points to ${TRACKING_TARGET}.`
        : `Resolves, but to ${cname.join(", ")} (expected ${TRACKING_TARGET}). Update the CNAME if this is wrong.`,
      resolved: cname,
    };
  } catch (e: any) {
    return { host, expectedTarget: TRACKING_TARGET, status: "fail", summary: e?.message || "CNAME lookup failed.", resolved: [] };
  }
}

export interface DnsSetupReport {
  generatedAt: string;
  config: {
    rootDomain: string;
    sendingSubdomain: string;
    trackingDomain: string;
    trackingTarget: string;
    dmarcRua: string;
    trackingDomainActive: boolean; // is EMAIL_TRACKING_DOMAIN actually set?
  };
  records: DnsRecord[];
  verification: {
    root: DomainAuthReport;
    subdomain: DomainAuthReport;
    tracking: TrackingVerification;
  };
}

export async function getDnsSetupReport(): Promise<DnsSetupReport> {
  const [root, subdomain, tracking] = await Promise.all([
    getDomainAuth(ROOT_DOMAIN),
    getDomainAuth(SENDING_SUBDOMAIN),
    verifyTracking(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    config: {
      rootDomain: ROOT_DOMAIN,
      sendingSubdomain: SENDING_SUBDOMAIN,
      trackingDomain: TRACKING_DOMAIN,
      trackingTarget: TRACKING_TARGET,
      dmarcRua: DMARC_RUA,
      trackingDomainActive: !!process.env.EMAIL_TRACKING_DOMAIN,
    },
    records: generateRecords(),
    verification: { root, subdomain, tracking },
  };
}
