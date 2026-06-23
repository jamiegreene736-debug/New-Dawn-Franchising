import { promises as dns } from "dns";
import { pool } from "./db";
import { ALL_SENDER_PROFILES, getSenderPassword } from "./email-service";

// ─────────────────────────────────────────────────────────────────────────────
// Email Deliverability service
//
// Powers the admin portal's "Email Deliverability" tab. Three concerns:
//   1. Live domain-authentication checks (SPF / DKIM / DMARC / MX / BIMI) run
//      against real DNS at request time — no cached guesses.
//   2. Live deliverability metrics aggregated from the existing Postgres tables
//      (drip_sends, drip_enrollments, agent_dnc) — bounce rate, suppression
//      growth, per-domain bounce concentration, sending volume, engagement.
//   3. A persisted remediation roadmap (deliverability_checklist) so the team
//      can track what's done vs outstanding.
//
// Everything is best-effort: a single failing DNS lookup or SQL query degrades
// to a null/`unknown` result rather than throwing the whole panel.
// ─────────────────────────────────────────────────────────────────────────────

// The domain all cold + transactional mail is currently sent from.
export const SENDING_DOMAIN = "newdawnfranchising.com";

// Google Workspace SPF macro — what _spf.google.com authorizes. Used to confirm
// the sending domain's SPF ultimately authorizes Google's outbound IPs.
const GOOGLE_SPF_INCLUDE = "_spf.google.com";
const GOOGLE_IP_HINTS = ["ip4:74.125", "ip4:209.85", "ip6:2001:4860"];

export type AuthStatus = "pass" | "warn" | "fail" | "info";

export interface AuthCheck {
  key: "spf" | "dkim" | "dmarc" | "mx" | "bimi";
  label: string;
  status: AuthStatus;
  summary: string;
  value?: string;
  details?: string[];
  fix?: string;
}

// ─── DNS helpers ──────────────────────────────────────────────────────────────

async function txt(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    // Each record is an array of string chunks that must be concatenated.
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

// Recursively expand an SPF record's include:/redirect= chain (depth-limited) so
// we can both count DNS-lookup mechanisms (RFC 7208's limit is 10) and confirm
// the chain ultimately authorizes Google.
async function expandSpf(
  record: string,
  depth: number,
  seen: Set<string>,
): Promise<{ mechanisms: string[]; lookups: number }> {
  const tokens = record.split(/\s+/).filter(Boolean);
  let mechanisms = [...tokens];
  let lookups = 0;
  if (depth <= 0) return { mechanisms, lookups };
  for (const tok of tokens) {
    const m = tok.match(/^(?:\+|-|~|\?)?(include:|redirect=)(.+)$/i);
    if (tok.match(/^(?:\+|-|~|\?)?(a|mx|ptr|exists|include|redirect)(?:[:=]|$)/i)) {
      lookups++;
    }
    if (m) {
      const target = m[2].trim().toLowerCase();
      if (seen.has(target)) continue;
      seen.add(target);
      const nested = await txt(target);
      const spf = nested.find((r) => r.toLowerCase().startsWith("v=spf1"));
      if (spf) {
        const sub = await expandSpf(spf, depth - 1, seen);
        mechanisms = mechanisms.concat(sub.mechanisms);
        lookups += sub.lookups;
      }
    }
  }
  return { mechanisms, lookups };
}

async function checkSpf(domain: string): Promise<AuthCheck> {
  const records = (await txt(domain)).filter((r) => r.toLowerCase().startsWith("v=spf1"));
  if (records.length === 0) {
    return {
      key: "spf",
      label: "SPF",
      status: "fail",
      summary: "No SPF record found — receiving servers can't verify your sending IPs.",
      fix: `Publish a TXT record at ${domain}: "v=spf1 include:_spf.google.com ~all" (or your ESP's include).`,
    };
  }
  if (records.length > 1) {
    return {
      key: "spf",
      label: "SPF",
      status: "fail",
      summary: `${records.length} SPF records published — RFC 7208 says a domain may have only ONE; multiple = permerror.`,
      value: records.join(" || "),
      fix: "Merge into a single v=spf1 record and delete the extras.",
    };
  }
  const record = records[0];
  const expanded = await expandSpf(record, 3, new Set([domain.toLowerCase()]));
  const flat = expanded.mechanisms.join(" ").toLowerCase();
  const googleAuthorized =
    flat.includes(GOOGLE_SPF_INCLUDE) || GOOGLE_IP_HINTS.some((h) => flat.includes(h));
  const allMatch = record.match(/([-~?+])all\b/);
  const allQualifier = allMatch ? allMatch[1] : null;
  const details: string[] = [];
  details.push(`DNS-lookup mechanisms used: ~${expanded.lookups} (RFC limit is 10).`);
  details.push(
    googleAuthorized
      ? "Authorizes Google Workspace IPs (your current sender) ✓"
      : "Does NOT appear to authorize Google's IPs — Gmail-sent mail may softfail.",
  );
  if (allQualifier === "~") details.push("Ends in ~all (softfail). Acceptable; -all (hardfail) is stronger once you're certain every sender is listed.");
  if (allQualifier === "?") details.push("Ends in ?all (neutral) — provides almost no protection; tighten to ~all or -all.");
  if (allQualifier === "+") details.push("Ends in +all (pass-all) — this authorizes the whole internet to spoof you. Fix immediately.");

  let status: AuthStatus = "pass";
  if (!googleAuthorized || allQualifier === "+") status = "fail";
  else if (allQualifier === "?" || expanded.lookups > 10) status = "warn";

  return {
    key: "spf",
    label: "SPF",
    status,
    summary:
      status === "pass"
        ? "SPF is published and authorizes your Google sending IPs."
        : status === "warn"
          ? "SPF is published but could be tightened."
          : "SPF is published but does not properly authorize your sender.",
    value: record,
    details,
    fix:
      allQualifier === "~"
        ? "Optional: move ~all → -all after confirming every legitimate sender (ESP, tools) is included."
        : undefined,
  };
}

async function checkDmarc(domain: string): Promise<AuthCheck> {
  const records = (await txt(`_dmarc.${domain}`)).filter((r) =>
    r.toLowerCase().startsWith("v=dmarc1"),
  );
  if (records.length === 0) {
    return {
      key: "dmarc",
      label: "DMARC",
      status: "fail",
      summary: "No DMARC record — you get no spoofing protection and no visibility into who sends as you.",
      fix: `Publish a TXT record at _dmarc.${domain}: "v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1" to start monitoring, then ramp to p=quarantine/p=reject.`,
    };
  }
  if (records.length > 1) {
    return {
      key: "dmarc",
      label: "DMARC",
      status: "fail",
      summary:
        `🔴 ${records.length} DMARC records published. Per RFC 7489 §6.6.3 this is a PERMERROR — receivers can't pick a policy, so DMARC fails to apply: you currently have NO enforcement and broken reporting.`,
      value: records.join("  ||  "),
      fix: `Delete all but ONE record at _dmarc.${domain}. Keep a single consolidated record (e.g. "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; adkim=s; aspf=s; fo=1").`,
    };
  }
  const record = records[0];
  const get = (k: string) => (record.match(new RegExp(`${k}=([^;]+)`, "i")) || [])[1]?.trim();
  const p = (get("p") || "none").toLowerCase();
  const rua = get("rua");
  const pct = get("pct");
  const details: string[] = [];
  details.push(`Policy: p=${p}${pct ? `, pct=${pct}` : ""}.`);
  details.push(rua ? `Aggregate reports → ${rua}` : "No rua= — you receive no aggregate reports (flying blind).");
  details.push(`Alignment: adkim=${get("adkim") || "r"}, aspf=${get("aspf") || "r"} (r=relaxed, s=strict).`);

  let status: AuthStatus = "pass";
  if (p === "none") status = "warn";
  if (!rua) status = status === "pass" ? "warn" : status;

  return {
    key: "dmarc",
    label: "DMARC",
    status,
    summary:
      p === "none"
        ? "DMARC is in monitor-only mode (p=none) — reporting works but spoofed mail is not blocked."
        : `DMARC is enforcing (p=${p}).`,
    value: record,
    details,
    fix:
      p === "none"
        ? "After 2–4 weeks of clean aggregate reports, ramp p=none → p=quarantine → p=reject."
        : undefined,
  };
}

async function checkDkim(domain: string): Promise<AuthCheck> {
  // Try the common selectors. Google Workspace defaults to "google".
  const selectors = ["google", "default", "selector1", "selector2", "k1", "s1", "mail", "dkim"];
  for (const sel of selectors) {
    const recs = await txt(`${sel}._domainkey.${domain}`);
    const dk = recs.find((r) => /v=DKIM1/i.test(r) && /p=[A-Za-z0-9]/.test(r));
    if (dk) {
      return {
        key: "dkim",
        label: "DKIM",
        status: "pass",
        summary: `DKIM is published and active (selector "${sel}").`,
        value: dk.length > 120 ? dk.slice(0, 117) + "…" : dk,
        details: [`Selector ${sel}._domainkey.${domain} returns a valid public key — your mail is cryptographically signed.`],
      };
    }
  }
  return {
    key: "dkim",
    label: "DKIM",
    status: "warn",
    summary: "No DKIM key found at common selectors — your mail may be unsigned (or uses a custom selector).",
    fix: `Enable DKIM in Google Workspace (Apps → Gmail → Authenticate email) and publish the google._domainkey TXT record for ${domain}.`,
  };
}

async function checkMx(domain: string): Promise<AuthCheck> {
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) {
      return { key: "mx", label: "MX", status: "warn", summary: "No MX records — the domain can't receive mail (bounces/replies may be lost)." };
    }
    const sorted = mx.sort((a, b) => a.priority - b.priority);
    const isGoogle = sorted.some((m) => /google|googlemail|aspmx/i.test(m.exchange));
    return {
      key: "mx",
      label: "MX",
      status: "info",
      summary: isGoogle ? "Mail is hosted on Google Workspace." : "MX records present.",
      value: sorted.map((m) => `${m.priority} ${m.exchange}`).join(", "),
    };
  } catch {
    return { key: "mx", label: "MX", status: "warn", summary: "Could not resolve MX records." };
  }
}

async function checkBimi(domain: string): Promise<AuthCheck> {
  const recs = (await txt(`default._bimi.${domain}`)).filter((r) => /v=BIMI1/i.test(r));
  if (recs.length) {
    return { key: "bimi", label: "BIMI", status: "info", summary: "BIMI record published (brand logo in inbox).", value: recs[0] };
  }
  return {
    key: "bimi",
    label: "BIMI",
    status: "info",
    summary: "No BIMI record (optional). Requires DMARC at enforcement + a verified VMC to show your logo in Gmail.",
  };
}

export interface DomainAuthReport {
  domain: string;
  checkedAt: string;
  checks: AuthCheck[];
  score: number; // 0–100 weighted on the core three
}

export async function getDomainAuth(domain = SENDING_DOMAIN): Promise<DomainAuthReport> {
  const [spf, dkim, dmarc, mx, bimi] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
    checkMx(domain),
    checkBimi(domain),
  ]);
  // Weighted auth score on the three that drive inbox placement.
  const weight = (c: AuthCheck) => (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0);
  const score = Math.round(((weight(spf) + weight(dkim) + weight(dmarc)) / 3) * 100);
  return { domain, checkedAt: new Date().toISOString(), checks: [spf, dkim, dmarc, mx, bimi], score };
}

// ─── Metrics (from Postgres) ──────────────────────────────────────────────────

async function safeRows(sql: string, params: any[] = []): Promise<any[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch (e: any) {
    console.error("[Deliverability] query failed:", e?.message);
    return [];
  }
}

const ATTEMPTED = `status IN ('sent','delivered','opened','clicked','replied','bounced','failed')`;

async function sendWindow(days: number | null) {
  const where = days == null ? "" : `AND created_at > now() - make_interval(days => ${days})`;
  const rows = await safeRows(
    `SELECT
       count(*) FILTER (WHERE ${ATTEMPTED}) AS attempted,
       count(*) FILTER (WHERE status = 'bounced') AS bounced,
       count(*) FILTER (WHERE status = 'failed') AS failed,
       count(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
       count(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked
     FROM drip_sends
     WHERE channel = 'email' ${where}`,
  );
  const r = rows[0] || {};
  const attempted = Number(r.attempted || 0);
  const bounced = Number(r.bounced || 0);
  const failed = Number(r.failed || 0);
  const opened = Number(r.opened || 0);
  const clicked = Number(r.clicked || 0);
  return {
    attempted,
    bounced,
    failed,
    opened,
    clicked,
    bounceRate: attempted ? +(((bounced + failed) / attempted) * 100).toFixed(1) : 0,
    openRate: attempted ? +((opened / attempted) * 100).toFixed(1) : 0,
    clickRate: attempted ? +((clicked / attempted) * 100).toFixed(1) : 0,
  };
}

export interface DeliverabilityMetrics {
  generatedAt: string;
  sendingDomain: string;
  volume: { last24h: any; last7d: any; last30d: any; allTime: any };
  suppression: { total: number; last7: number; last30: number; byReason: { reason: string; count: number }[] };
  topBounceDomains: { domain: string; attempted: number; bounced: number; rate: number }[];
  enrollments: { total: number; replied: number; bounced: number; replyRate: number };
  config: {
    dailyCap: number;
    hourlyCap: number;
    domainGapSeconds: number;
    sendersConfigured: number;
    sendersTotal: number;
    sendingModel: string;
  };
  gaps: { key: string; ok: boolean; label: string }[];
}

export async function getDeliverabilityMetrics(): Promise<DeliverabilityMetrics> {
  const [last24h, last7d, last30d, allTime] = await Promise.all([
    sendWindow(1),
    sendWindow(7),
    sendWindow(30),
    sendWindow(null),
  ]);

  const supRows = await safeRows(
    `SELECT count(*) AS total,
       count(*) FILTER (WHERE added_at > now() - interval '7 days') AS last7,
       count(*) FILTER (WHERE added_at > now() - interval '30 days') AS last30
     FROM agent_dnc`,
  );
  const sup = supRows[0] || {};
  const byReason = (
    await safeRows(
      `SELECT coalesce(nullif(trim(reason),''),'(unspecified)') AS reason, count(*) AS count
       FROM agent_dnc GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    )
  ).map((r) => ({ reason: r.reason, count: Number(r.count) }));

  const topBounceDomains = (
    await safeRows(
      `SELECT split_part(recipient_email,'@',2) AS domain,
         count(*) FILTER (WHERE ${ATTEMPTED}) AS attempted,
         count(*) FILTER (WHERE status='bounced') AS bounced
       FROM drip_sends
       WHERE channel='email' AND recipient_email LIKE '%@%'
       GROUP BY 1
       HAVING count(*) FILTER (WHERE status='bounced') > 0
       ORDER BY bounced DESC, attempted DESC
       LIMIT 12`,
    )
  ).map((r) => {
    const attempted = Number(r.attempted || 0);
    const bounced = Number(r.bounced || 0);
    return { domain: r.domain, attempted, bounced, rate: attempted ? +((bounced / attempted) * 100).toFixed(0) : 0 };
  });

  const enrRows = await safeRows(
    `SELECT count(*) AS total,
       count(*) FILTER (WHERE status='replied') AS replied,
       count(*) FILTER (WHERE status='bounced') AS bounced
     FROM drip_enrollments`,
  );
  const enr = enrRows[0] || {};
  const enrTotal = Number(enr.total || 0);

  const sendersConfigured = ALL_SENDER_PROFILES.filter((p) => !!getSenderPassword(p)).length;

  return {
    generatedAt: new Date().toISOString(),
    sendingDomain: SENDING_DOMAIN,
    volume: { last24h, last7d, last30d, allTime },
    suppression: {
      total: Number(sup.total || 0),
      last7: Number(sup.last7 || 0),
      last30: Number(sup.last30 || 0),
      byReason,
    },
    topBounceDomains,
    enrollments: {
      total: enrTotal,
      replied: Number(enr.replied || 0),
      bounced: Number(enr.bounced || 0),
      replyRate: enrTotal ? +((Number(enr.replied || 0) / enrTotal) * 100).toFixed(1) : 0,
    },
    config: {
      dailyCap: Number(process.env.EMAIL_DAILY_CAP || 100),
      hourlyCap: Number(process.env.EMAIL_HOURLY_CAP || 20),
      domainGapSeconds: Number(process.env.EMAIL_DOMAIN_GAP_SECONDS || 45),
      sendersConfigured,
      sendersTotal: ALL_SENDER_PROFILES.length,
      sendingModel: "Gmail / Google Workspace (shared IP pool) via app passwords",
    },
    // Known per-message / pipeline gaps reflecting current code state. These map
    // to checklist items; surfaced here so the dashboard can show a live ✓/✗.
    gaps: [
      { key: "list_unsubscribe", ok: true, label: "List-Unsubscribe header (one-click)" },
      { key: "list_unsubscribe_post", ok: true, label: "List-Unsubscribe-Post (RFC 8058)" },
      { key: "plain_text", ok: true, label: "Plain-text alternative (multipart)" },
      { key: "reply_to", ok: true, label: "Reply-To header" },
      { key: "bounce_all_inboxes", ok: false, label: "Bounce processing on all sender inboxes" },
      { key: "preverify", ok: !!process.env.ZEROBOUNCE_API_KEY, label: "Pre-send verification key (ZeroBounce)" },
    ],
  };
}

// ─── Remediation roadmap (persisted checklist) ───────────────────────────────

export type ChecklistStatus = "todo" | "in_progress" | "done" | "not_applicable";

interface SeedItem {
  id: string;
  category: string;
  title: string;
  detail: string;
  priority: "critical" | "high" | "medium" | "low";
  owner: "you" | "dev" | "both";
  effort: "low" | "medium" | "high";
  impact: "critical" | "high" | "medium" | "low";
  status?: ChecklistStatus; // seed default only; never overwrites a user change
}

// The plan. Ordered by the sequence an expert would actually work it:
// authentication first, then infrastructure, hygiene, content/compliance,
// reputation/warmup, and ongoing monitoring.
const SEED: SeedItem[] = [
  // A. Authentication
  { id: "dmarc-dedupe", category: "Authentication", title: "Remove the duplicate DMARC record", detail: "DONE (2026-06-22): the domain previously published TWO DMARC records (a PERMERROR per RFC 7489 §6.6.3, disabling enforcement). Now consolidated to a single valid record: v=DMARC1; p=none; rua=mailto:dmarc@newdawnfranchising.com. DMARC is back in effect (monitor mode) — see dmarc-ramp for the next step.", priority: "critical", owner: "you", effort: "low", impact: "critical", status: "done" },
  { id: "dmarc-ramp", category: "Authentication", title: "Set DMARC reporting + ramp to enforcement", detail: "On the single surviving record set rua=mailto:dmarc@newdawnfranchising.com and fo=1. Start at p=none, watch aggregate reports 2–4 weeks, then move p=quarantine → p=reject as alignment proves clean.", priority: "high", owner: "you", effort: "low", impact: "high", status: "todo" },
  { id: "spf-google", category: "Authentication", title: "Keep SPF authorizing Google (within 10 lookups)", detail: "SPF currently resolves through an _spfm flattening include to _spf.google.com and passes for Gmail sends. Keep it a single record and under the 10-DNS-lookup limit as you add senders/ESPs.", priority: "high", owner: "dev", effort: "low", impact: "high", status: "done" },
  { id: "dkim-google", category: "Authentication", title: "Confirm DKIM signing stays enabled", detail: "google._domainkey is published with a valid 2048-bit key and signing is active. Re-verify after any Google Workspace change; rotate the key annually.", priority: "high", owner: "dev", effort: "low", impact: "high", status: "done" },
  { id: "spf-hardfail", category: "Authentication", title: "Tighten SPF ~all → -all (after audit)", detail: "Once every legitimate sender is confirmed in SPF, move from softfail (~all) to hardfail (-all) so spoofed mail is rejected outright.", priority: "medium", owner: "you", effort: "low", impact: "medium", status: "todo" },

  // B. Sending infrastructure & domain strategy
  { id: "dedicated-subdomain", category: "Infrastructure", title: "Send cold outreach from a dedicated subdomain", detail: "Never risk the root/transactional domain's reputation on cold outreach. Move campaigns to a subdomain like go.newdawnfranchising.com (or a separate domain) with its own SPF/DKIM/DMARC so a reputation hit is isolated.", priority: "high", owner: "both", effort: "medium", impact: "high", status: "todo" },
  { id: "cold-esp", category: "Infrastructure", title: "Use a real cold-outreach platform, not Gmail shared IPs", detail: "Cold volume currently goes through Gmail's shared IP pool. Tencent/QQ and many Chinese enterprise-mail providers actively BLOCK Gmail's shared IPs on policy/reputation grounds (the GlobeVisa 5.7.0 rejections) — this is a hard block, not a warmup gap, so no amount of pacing fixes it for China-hosted recipients. Evaluate a dedicated cold-email stack (e.g. Smartlead/Instantly/Mailreef) or Google Workspace + warmup on its own IP, separate from transactional mail; for China-hosted domains use dedicated-IP infrastructure or reach them via another channel.", priority: "high", owner: "both", effort: "medium", impact: "high", status: "todo" },
  { id: "warmup", category: "Infrastructure", title: "Warm up the sending identity", detail: "Ramp volume slowly on any new domain/mailbox (≈20 → 50 → 100/day over 2–4 weeks) with automated warmup so ISPs build a positive reputation before real campaigns.", priority: "high", owner: "you", effort: "medium", impact: "high", status: "todo" },

  // C. List hygiene & verification
  { id: "verify-gate", category: "List hygiene", title: "Verify every address before enrollment", detail: "ZeroBounce is integrated — gate enrollment on it: drop invalid + unknown, and treat catch-all domains as risky. Stops bad addresses from ever being sent (protects bounce rate).", priority: "high", owner: "dev", effort: "low", impact: "high", status: "todo" },
  { id: "per-domain-guard", category: "List hygiene", title: "Auto-pause a domain on high bounce concentration", detail: "Add a guard that halts/slows sends to a single recipient domain once it crosses a bounce threshold (e.g. >20% or N hard bounces). The GlobeVisa list bounced ~36% on one domain before anything stopped it.", priority: "high", owner: "dev", effort: "medium", impact: "high", status: "todo" },
  { id: "domain-suppress", category: "List hygiene", title: "Support domain-level suppression", detail: "When a whole domain hard-blocks (policy 5.7.0), suppress the domain in agent_dnc, not just individual addresses, so future lists skip it automatically.", priority: "medium", owner: "dev", effort: "low", impact: "medium", status: "todo" },
  { id: "role-addresses", category: "List hygiene", title: "Strip role-based addresses from cold lists", detail: "Exclude info@, sales@, admin@, support@, contact@ — they complain/bounce more and rarely convert.", priority: "medium", owner: "dev", effort: "low", impact: "medium", status: "todo" },

  // D. Content & compliance (per message)
  { id: "list-unsub", category: "Content & compliance", title: "Add one-click List-Unsubscribe headers", detail: "DONE: every non-transactional send now includes List-Unsubscribe + List-Unsubscribe-Post (RFC 8058 one-click), backed by the public /api/unsubscribe endpoint that suppresses to agent_dnc. Gmail/Yahoo bulk-sender rules require these for bulk mail.", priority: "critical", owner: "dev", effort: "low", impact: "critical", status: "done" },
  { id: "plain-text", category: "Content & compliance", title: "Send multipart (HTML + plain-text)", detail: "DONE: every send now carries a text/plain alternative derived from the HTML, so it's no longer HTML-only (a spam/accessibility signal).", priority: "high", owner: "dev", effort: "low", impact: "high", status: "done" },
  { id: "can-spam", category: "Content & compliance", title: "Visible unsubscribe link + physical address", detail: "CAN-SPAM requires a working unsubscribe and a physical mailing address in commercial email. Add both to the footer and wire the unsubscribe to agent_dnc.", priority: "high", owner: "dev", effort: "low", impact: "high", status: "todo" },
  { id: "reply-to", category: "Content & compliance", title: "Set Reply-To + aligned From", detail: "DONE: every send now sets an explicit Reply-To equal to the sending address (same domain as DKIM/SPF), so replies route correctly and alignment holds.", priority: "medium", owner: "dev", effort: "low", impact: "medium", status: "done" },
  { id: "spam-signals", category: "Content & compliance", title: "Reduce spammy content signals", detail: "Keep link count low, maintain a healthy text-to-image ratio, avoid URL shorteners and spam-trigger phrasing, and personalize. Run templates through a spam-score check (e.g. mail-tester).", priority: "medium", owner: "you", effort: "medium", impact: "medium", status: "todo" },
  { id: "tracking-domain", category: "Content & compliance", title: "Use an aligned tracking/click domain", detail: "Open-pixel and click-rewrite URLs should live on your sending (sub)domain, not a mismatched host, so links don't trip filters and stay DKIM-aligned.", priority: "medium", owner: "dev", effort: "medium", impact: "medium", status: "todo" },

  // E. Reputation, volume & engagement
  { id: "throttles", category: "Reputation & volume", title: "Keep volume caps + per-domain pacing", detail: "Daily cap (100), hourly cap (20), 45s same-domain spacing and send-time jitter are already in place. Verify the values fit your warmup stage and keep them on.", priority: "medium", owner: "dev", effort: "low", impact: "medium", status: "done" },
  { id: "engagement", category: "Reputation & volume", title: "Protect engagement signals", detail: "Only send to engaged/likely-interested recipients; pause persistent non-openers. Engagement is the dominant inbox-placement factor at Gmail.", priority: "high", owner: "you", effort: "medium", impact: "high", status: "todo" },
  { id: "thresholds", category: "Reputation & volume", title: "Hold bounce <2% and complaints <0.1%", detail: "Google flags complaint rates above 0.3% as elevated risk to sender reputation (watch it in Postmaster Tools) — it's a danger zone, not a hard cutoff. Best practice: keep complaints <0.1% and hard-bounce under ~2%. Sustained breaches erode placement for all mail on the domain.", priority: "high", owner: "you", effort: "low", impact: "high", status: "todo" },

  // F. Monitoring & feedback loops
  { id: "postmaster", category: "Monitoring", title: "Set up Google Postmaster Tools", detail: "Register newdawnfranchising.com (and the cold subdomain) in Google Postmaster Tools to see domain/IP reputation, spam rate and authentication success straight from Gmail. Free and the single best monitoring signal.", priority: "high", owner: "you", effort: "low", impact: "high", status: "todo" },
  { id: "dmarc-monitor", category: "Monitoring", title: "Monitor DMARC aggregate reports", detail: "Point rua= at a DMARC analytics service (Postmark/dmarcian/Valimail free) so the XML reports become a readable view of who's sending as you and whether alignment passes.", priority: "medium", owner: "you", effort: "low", impact: "high", status: "todo" },
  { id: "bounce-all-inboxes", category: "Monitoring", title: "Process bounces from every sender inbox", detail: "Bounce detection only polls franchising@. Mail sent from dylan@/info@/support@ can hard-bounce without ever being suppressed. Extend IMAP bounce scanning to all sending mailboxes.", priority: "medium", owner: "dev", effort: "low", impact: "medium", status: "todo" },
  { id: "soft-hard", category: "Monitoring", title: "Distinguish soft vs hard bounces", detail: "Only permanently suppress hard bounces (5.x.x user-unknown). Soft/transient failures (4.x.x, greylisting) should retry, not auto-DNC, so you don't burn valid contacts.", priority: "medium", owner: "dev", effort: "medium", impact: "medium", status: "todo" },
  { id: "complaint-loop", category: "Monitoring", title: "Wire complaint + unsubscribe feedback loops", detail: "Enroll in Yahoo/Microsoft SNDS feedback loops and auto-suppress on complaint, plus parse 'unsubscribe/stop' replies into agent_dnc (partially done via keyword detection).", priority: "medium", owner: "dev", effort: "medium", impact: "medium", status: "todo" },
  { id: "seed-testing", category: "Monitoring", title: "Run periodic inbox-placement seed tests", detail: "Use GlockApps/MailReach against a seed list before big sends to see Inbox-vs-Spam placement across Gmail/Outlook/Yahoo and catch problems before recipients do.", priority: "low", owner: "you", effort: "low", impact: "medium", status: "todo" },
];

export interface ChecklistItem extends SeedItem {
  status: ChecklistStatus;
  notes: string | null;
  sortOrder: number;
}

export async function getChecklist(): Promise<ChecklistItem[]> {
  // Upsert seed content (NOT status/notes) so wording stays current without
  // resetting the team's progress, then return everything ordered.
  try {
    const cols = 10;
    const values: string[] = [];
    const params: any[] = [];
    SEED.forEach((s, i) => {
      const b = i * cols;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`,
      );
      params.push(s.id, s.category, s.title, s.detail, s.priority, s.owner, s.effort, s.impact, i, s.status || "todo");
    });
    // Seed status is applied ONLY on first insert (it's omitted from the conflict
    // update), so re-running this to refresh wording never resets the team's
    // progress. Everything else (titles/detail/order) stays current.
    await pool.query(
      `INSERT INTO deliverability_checklist
         (id, category, title, detail, priority, owner, effort, impact, sort_order, status)
       VALUES ${values.join(",")}
       ON CONFLICT (id) DO UPDATE SET
         category=EXCLUDED.category, title=EXCLUDED.title, detail=EXCLUDED.detail,
         priority=EXCLUDED.priority, owner=EXCLUDED.owner, effort=EXCLUDED.effort,
         impact=EXCLUDED.impact, sort_order=EXCLUDED.sort_order`,
      params,
    );
  } catch (e: any) {
    console.error("[Deliverability] checklist seed failed:", e?.message);
  }
  const rows = await safeRows(
    `SELECT id, category, title, detail, priority, owner, effort, impact, sort_order, status, notes
     FROM deliverability_checklist ORDER BY sort_order ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    detail: r.detail,
    priority: r.priority,
    owner: r.owner,
    effort: r.effort,
    impact: r.impact,
    sortOrder: Number(r.sort_order),
    status: r.status,
    notes: r.notes,
  }));
}

export async function updateChecklistItem(
  id: string,
  patch: { status?: ChecklistStatus; notes?: string },
): Promise<boolean> {
  const sets: string[] = [];
  const params: any[] = [];
  if (patch.status) {
    params.push(patch.status);
    sets.push(`status=$${params.length}`);
  }
  if (patch.notes !== undefined) {
    params.push(patch.notes);
    sets.push(`notes=$${params.length}`);
  }
  if (!sets.length) return false;
  params.push(new Date());
  sets.push(`updated_at=$${params.length}`);
  params.push(id);
  const { rowCount } = await pool.query(
    `UPDATE deliverability_checklist SET ${sets.join(", ")} WHERE id=$${params.length}`,
    params,
  );
  return (rowCount || 0) > 0;
}
