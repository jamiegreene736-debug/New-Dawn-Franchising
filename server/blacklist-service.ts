import { promises as dns } from "dns";
import { SENDING_DOMAIN } from "./deliverability-service";

// ─────────────────────────────────────────────────────────────────────────────
// DNSBL / blocklist monitor — checks the sending domain and the IPs behind it
// against the public DNS blocklists that matter for inbox placement. Mirrors the
// blacklist-monitoring panel Instantly/Smartlead/GlockApps surface.
//
// How a DNSBL works: you reverse the IP's octets and append the list's zone,
// then do an A-lookup. A 127.0.0.x answer = listed (the last octet encodes which
// sub-list / reason); NXDOMAIN = clean. Domain (URI) blocklists work the same but
// with the bare domain instead of the reversed IP.
//
// Spamhaus note: Spamhaus refuses queries from public/large shared resolvers
// (returns 127.255.255.x = "query blocked"), so it's OFF by default and only
// included when BLACKLIST_INCLUDE_SPAMHAUS=1 (paired with a dedicated resolver /
// DQS key, otherwise the result is meaningless).
// ─────────────────────────────────────────────────────────────────────────────

interface Zone {
  zone: string;
  name: string;
  kind: "ip" | "domain";
  severity: "high" | "medium" | "low";
  gated?: boolean; // requires BLACKLIST_INCLUDE_SPAMHAUS
}

const ZONES: Zone[] = [
  // IP-based
  { zone: "bl.spamcop.net", name: "SpamCop", kind: "ip", severity: "high" },
  { zone: "dnsbl.sorbs.net", name: "SORBS", kind: "ip", severity: "medium" },
  { zone: "psbl.surriel.com", name: "PSBL (Passive)", kind: "ip", severity: "medium" },
  { zone: "all.spamrats.com", name: "SpamRats", kind: "ip", severity: "medium" },
  { zone: "bl.mailspike.net", name: "Mailspike", kind: "ip", severity: "medium" },
  { zone: "dnsbl-1.uceprotect.net", name: "UCEPROTECT-1", kind: "ip", severity: "low" },
  { zone: "b.barracudacentral.org", name: "Barracuda", kind: "ip", severity: "high" },
  { zone: "zen.spamhaus.org", name: "Spamhaus ZEN", kind: "ip", severity: "high", gated: true },
  // Domain (URI) based
  { zone: "multi.surbl.org", name: "SURBL", kind: "domain", severity: "high" },
  { zone: "dbl.spamhaus.org", name: "Spamhaus DBL", kind: "domain", severity: "high", gated: true },
];

export type ListedStatus = "clean" | "listed" | "error";

export interface BlacklistEntry {
  list: string;
  zone: string;
  kind: "ip" | "domain";
  severity: "high" | "medium" | "low";
  target: string; // the IP or domain queried
  status: ListedStatus;
  detail?: string; // the 127.0.0.x code or error message
}

export interface BlacklistReport {
  checkedAt: string;
  domain: string;
  ips: string[];
  listedCount: number;
  errorCount: number;
  totalChecks: number;
  entries: BlacklistEntry[];
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

function reverseIp(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  return parts.reverse().join(".");
}

async function resolveIps(domain: string): Promise<string[]> {
  const ips = new Set<string>();
  try {
    for (const a of await dns.resolve4(domain)) ips.add(a);
  } catch {}
  // Also resolve the MX hosts' A records — recipient servers judge those too.
  try {
    const mx = await dns.resolveMx(domain);
    for (const m of mx.slice(0, 3)) {
      try {
        for (const a of await dns.resolve4(m.exchange)) ips.add(a);
      } catch {}
    }
  } catch {}
  return [...ips];
}

async function queryZone(query: string): Promise<{ status: ListedStatus; detail?: string }> {
  try {
    const answers = await withTimeout(dns.resolve4(query), 6000);
    const code = answers[0] || "127.0.0.2";
    // 127.255.255.x = the list refused the query (rate-limit / public resolver block).
    if (code.startsWith("127.255.")) return { status: "error", detail: `query blocked (${code})` };
    return { status: "listed", detail: code };
  } catch (e: any) {
    // NXDOMAIN / NOTFOUND = not listed (the desired outcome).
    if (e?.code === "ENOTFOUND" || e?.code === "ENODATA" || e?.code === "NXDOMAIN") {
      return { status: "clean" };
    }
    return { status: "error", detail: e?.code || e?.message || "lookup failed" };
  }
}

export async function getBlacklistReport(domainArg?: string): Promise<BlacklistReport> {
  const domain = (domainArg || SENDING_DOMAIN).trim().toLowerCase();
  const includeSpamhaus = process.env.BLACKLIST_INCLUDE_SPAMHAUS === "1";
  const zones = ZONES.filter((z) => includeSpamhaus || !z.gated);

  const ips = await resolveIps(domain);
  const entries: BlacklistEntry[] = [];

  const tasks: Promise<void>[] = [];
  for (const z of zones) {
    if (z.kind === "ip") {
      for (const ip of ips) {
        const rev = reverseIp(ip);
        if (!rev) continue;
        tasks.push(
          queryZone(`${rev}.${z.zone}`).then((r) =>
            void entries.push({ list: z.name, zone: z.zone, kind: z.kind, severity: z.severity, target: ip, ...r }),
          ),
        );
      }
    } else {
      tasks.push(
        queryZone(`${domain}.${z.zone}`).then((r) =>
          void entries.push({ list: z.name, zone: z.zone, kind: z.kind, severity: z.severity, target: domain, ...r }),
        ),
      );
    }
  }
  await Promise.allSettled(tasks);

  // Stable ordering: listed first (by severity), then errors, then clean.
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  const statusRank = { listed: 0, error: 1, clean: 2 } as const;
  entries.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      sevRank[a.severity] - sevRank[b.severity] ||
      a.list.localeCompare(b.list),
  );

  return {
    checkedAt: new Date().toISOString(),
    domain,
    ips,
    listedCount: entries.filter((e) => e.status === "listed").length,
    errorCount: entries.filter((e) => e.status === "error").length,
    totalChecks: entries.length,
    entries,
  };
}
