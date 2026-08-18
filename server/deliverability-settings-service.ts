import { pool } from "./db";
import { storage } from "./storage";
import { addToDnc, isOnDnc } from "./agent-service";
import { EMAIL_DAILY_CAP, EMAIL_HOURLY_CAP, EMAIL_DOMAIN_GAP_MS } from "./smart-scheduler";

// ─────────────────────────────────────────────────────────────────────────────
// Deliverability settings + safety guards (Phase 2)
//
// A single settings row (id='singleton') that gates the behaviour-changing parts
// of the send path. Defaults:
//   • verifyBeforeSend  = false  (no change)
//   • senderRotation    = true   (spread volume across every credentialed
//                                 mailbox; a no-op when only one sender has an
//                                 app password — see chooseSenderForKey)
//   • domainGuard       = true   (protective: auto-suppress a domain that is
//                                 clearly hard-blocking — same idea as a manual
//                                 DNC, just automatic and high-threshold)
//   • campaignPauseEnabled = false (don't auto-pause whole campaigns by default)
//   • softBounceSkipDnc = true   (stop suppressing TRANSIENT 4.x.x bounces)
//   • cap overrides     = null   (fall back to the env-var caps)
//
// Caps are fetched fresh each drip run so changes apply without a restart.
// ─────────────────────────────────────────────────────────────────────────────

export interface DeliverabilitySettings {
  verifyBeforeSend: boolean;
  senderRotation: boolean;
  domainGuard: boolean;
  domainBounceThresholdPct: number;
  domainBounceMin: number;
  campaignPauseEnabled: boolean;
  campaignBounceThresholdPct: number;
  campaignBounceMin: number;
  softBounceSkipDnc: boolean;
  // Outreach autopilot pause switch (env OUTREACH_AUTOPILOT is the master
  // enable; this is the runtime emergency brake behind the SMS pause link).
  outreachAutopilotPaused: boolean;
  dailyCapOverride: number | null;
  hourlyCapOverride: number | null;
  domainGapOverrideSeconds: number | null;
  // Linear ramp: grow the daily cap from rampStartCap to the target over rampDays.
  rampMode: string; // 'off' | 'linear'
  rampStartCap: number;
  rampDays: number;
  rampStartedAt: string | null;
  // Derived (overrides + ramp merged with the env defaults) for the send path + UI.
  effectiveDailyCap: number;
  effectiveHourlyCap: number;
  effectiveDomainGapMs: number;
  updatedAt: string;
}

const DEFAULTS = {
  verify_before_send: false,
  sender_rotation: true,
  domain_guard: true,
  domain_bounce_threshold_pct: 40,
  domain_bounce_min: 8,
  campaign_pause_enabled: false,
  campaign_bounce_threshold_pct: 12,
  campaign_bounce_min: 50,
  soft_bounce_skip_dnc: true,
  outreach_autopilot_paused: false,
  ramp_mode: "off",
  ramp_start_cap: 20,
  ramp_days: 14,
};

function rowToSettings(r: any): DeliverabilitySettings {
  const dailyCapOverride = r.daily_cap_override == null ? null : Number(r.daily_cap_override);
  const hourlyCapOverride = r.hourly_cap_override == null ? null : Number(r.hourly_cap_override);
  const domainGapOverrideSeconds = r.domain_gap_override_seconds == null ? null : Number(r.domain_gap_override_seconds);
  const rampMode = r.ramp_mode || "off";
  const rampStartCap = Number(r.ramp_start_cap ?? DEFAULTS.ramp_start_cap);
  const rampDays = Number(r.ramp_days ?? DEFAULTS.ramp_days);
  const rampStartedAt = r.ramp_started_at ? new Date(r.ramp_started_at).toISOString() : null;

  // Target cap = override, else env default. Linear ramp climbs from rampStartCap
  // to that target over rampDays, then holds.
  const targetDaily = dailyCapOverride ?? EMAIL_DAILY_CAP;
  let effectiveDailyCap = targetDaily;
  if (rampMode === "linear" && rampStartedAt) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(rampStartedAt).getTime()) / 86_400_000));
    const start = Math.min(rampStartCap, targetDaily);
    const inc = rampDays > 0 ? (targetDaily - start) / rampDays : targetDaily - start;
    effectiveDailyCap = Math.max(start, Math.min(targetDaily, Math.round(start + inc * days)));
  }

  return {
    verifyBeforeSend: !!r.verify_before_send,
    senderRotation: !!r.sender_rotation,
    domainGuard: !!r.domain_guard,
    domainBounceThresholdPct: Number(r.domain_bounce_threshold_pct),
    domainBounceMin: Number(r.domain_bounce_min),
    campaignPauseEnabled: !!r.campaign_pause_enabled,
    campaignBounceThresholdPct: Number(r.campaign_bounce_threshold_pct),
    campaignBounceMin: Number(r.campaign_bounce_min),
    softBounceSkipDnc: !!r.soft_bounce_skip_dnc,
    outreachAutopilotPaused: !!r.outreach_autopilot_paused,
    dailyCapOverride,
    hourlyCapOverride,
    domainGapOverrideSeconds,
    rampMode,
    rampStartCap,
    rampDays,
    rampStartedAt,
    effectiveDailyCap,
    effectiveHourlyCap: hourlyCapOverride ?? EMAIL_HOURLY_CAP,
    effectiveDomainGapMs: domainGapOverrideSeconds != null ? domainGapOverrideSeconds * 1000 : EMAIL_DOMAIN_GAP_MS,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getDeliverabilitySettings(): Promise<DeliverabilitySettings> {
  try {
    const { rows } = await pool.query(`SELECT * FROM deliverability_settings WHERE id='singleton'`);
    if (rows.length) return rowToSettings(rows[0]);
    await pool.query(
      `INSERT INTO deliverability_settings
         (id, verify_before_send, sender_rotation, domain_guard, domain_bounce_threshold_pct, domain_bounce_min,
          campaign_pause_enabled, campaign_bounce_threshold_pct, campaign_bounce_min, soft_bounce_skip_dnc)
       VALUES ('singleton',$1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        DEFAULTS.verify_before_send, DEFAULTS.sender_rotation, DEFAULTS.domain_guard,
        DEFAULTS.domain_bounce_threshold_pct, DEFAULTS.domain_bounce_min, DEFAULTS.campaign_pause_enabled,
        DEFAULTS.campaign_bounce_threshold_pct, DEFAULTS.campaign_bounce_min, DEFAULTS.soft_bounce_skip_dnc,
      ],
    );
    const { rows: r2 } = await pool.query(`SELECT * FROM deliverability_settings WHERE id='singleton'`);
    return rowToSettings(r2[0]);
  } catch (e: any) {
    // If the table isn't there yet (first boot before ensure-schema), fall back to
    // safe defaults so the send path never breaks.
    console.error("[Deliverability] settings read failed, using defaults:", e?.message);
    return rowToSettings({ ...DEFAULTS });
  }
}

const PATCH_COLS: Record<string, string> = {
  verifyBeforeSend: "verify_before_send",
  senderRotation: "sender_rotation",
  domainGuard: "domain_guard",
  domainBounceThresholdPct: "domain_bounce_threshold_pct",
  domainBounceMin: "domain_bounce_min",
  campaignPauseEnabled: "campaign_pause_enabled",
  campaignBounceThresholdPct: "campaign_bounce_threshold_pct",
  campaignBounceMin: "campaign_bounce_min",
  softBounceSkipDnc: "soft_bounce_skip_dnc",
  outreachAutopilotPaused: "outreach_autopilot_paused",
  dailyCapOverride: "daily_cap_override",
  hourlyCapOverride: "hourly_cap_override",
  domainGapOverrideSeconds: "domain_gap_override_seconds",
  rampMode: "ramp_mode",
  rampStartCap: "ramp_start_cap",
  rampDays: "ramp_days",
};

export async function updateDeliverabilitySettings(patch: Record<string, any>): Promise<DeliverabilitySettings> {
  await getDeliverabilitySettings();
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, col] of Object.entries(PATCH_COLS)) {
    if (k in patch && patch[k] !== undefined) {
      // Empty string → NULL for the nullable override columns.
      const v = (col.endsWith("_override") || col.endsWith("_override_seconds")) && (patch[k] === "" || patch[k] === null)
        ? null
        : patch[k];
      params.push(v);
      sets.push(`${col}=$${params.length}`);
    }
  }
  // Starting the linear ramp stamps ramp_started_at so the climb begins now.
  if (patch.rampMode === "linear") sets.push(`ramp_started_at=COALESCE(ramp_started_at, now())`);
  if (patch.rampMode === "off") sets.push(`ramp_started_at=NULL`);
  if (!sets.length) return getDeliverabilitySettings();
  sets.push(`updated_at=now()`);
  await pool.query(`UPDATE deliverability_settings SET ${sets.join(", ")} WHERE id='singleton'`, params);
  return getDeliverabilitySettings();
}

// ─── Sender rotation stats ────────────────────────────────────────────────────

export async function recordSenderUse(email: string): Promise<void> {
  await pool.query(
    `INSERT INTO sender_stats (email, sent_total, last_sent_at) VALUES ($1, 1, now())
     ON CONFLICT (email) DO UPDATE SET sent_total = sender_stats.sent_total + 1, last_sent_at = now()`,
    [email],
  );
}

export async function getSenderStats(): Promise<{ email: string; sentTotal: number; lastSentAt: string | null }[]> {
  try {
    const { rows } = await pool.query(`SELECT email, sent_total, last_sent_at FROM sender_stats ORDER BY sent_total DESC`);
    return rows.map((r) => ({ email: r.email, sentTotal: Number(r.sent_total), lastSentAt: r.last_sent_at ? new Date(r.last_sent_at).toISOString() : null }));
  } catch {
    return [];
  }
}

// ─── Bounce guard ─────────────────────────────────────────────────────────────
// Auto-suppress a recipient domain that is clearly hard-blocking us, and
// (optionally) pause a whole campaign whose bounce rate has run away. Domain
// suppression writes to agent_dnc, which the drip processor already honours — so
// future sends to that domain are skipped through the existing mechanism.

const ATTEMPTED = `status IN ('sent','delivered','opened','clicked','replied','bounced','failed')`;

export interface BounceGuardResult {
  ran: boolean;
  domainsSuppressed: { domain: string; attempted: number; bounced: number; rate: number }[];
  campaignsPaused: { campaignId: string; attempted: number; bounced: number; rate: number }[];
  at: string;
}

let lastGuard: BounceGuardResult = { ran: false, domainsSuppressed: [], campaignsPaused: [], at: new Date(0).toISOString() };
export function getLastBounceGuard() {
  return lastGuard;
}

export async function runBounceGuard(): Promise<BounceGuardResult> {
  const s = await getDeliverabilitySettings();
  const result: BounceGuardResult = { ran: true, domainsSuppressed: [], campaignsPaused: [], at: new Date().toISOString() };

  // 1) Per-domain suppression.
  if (s.domainGuard) {
    try {
      const { rows } = await pool.query(
        `SELECT split_part(recipient_email,'@',2) AS domain,
           count(*) FILTER (WHERE ${ATTEMPTED}) AS attempted,
           count(*) FILTER (WHERE status='bounced') AS bounced
         FROM drip_sends
         WHERE channel='email' AND recipient_email LIKE '%@%' AND created_at > now() - interval '30 days'
         GROUP BY 1
         HAVING count(*) FILTER (WHERE ${ATTEMPTED}) >= $1`,
        [s.domainBounceMin],
      );
      for (const r of rows) {
        const attempted = Number(r.attempted || 0);
        const bounced = Number(r.bounced || 0);
        const rate = attempted ? Math.round((bounced / attempted) * 100) : 0;
        if (rate < s.domainBounceThresholdPct) continue;
        const domain = String(r.domain).toLowerCase();
        if (!domain) continue;
        if (await isOnDnc(null, null, domain)) continue; // already suppressed
        await addToDnc(undefined, undefined, domain, `Auto-suppressed: ${rate}% bounce over ${attempted} sends (bounce guard)`);
        result.domainsSuppressed.push({ domain, attempted, bounced, rate });
        console.log(`[BounceGuard] suppressed domain ${domain} (${rate}% / ${attempted} sends)`);
      }
    } catch (e: any) {
      console.error("[BounceGuard] domain pass failed:", e?.message);
    }
  }

  // 2) Per-campaign auto-pause (off by default).
  if (s.campaignPauseEnabled) {
    try {
      const { rows } = await pool.query(
        `SELECT e.campaign_id AS campaign_id,
           count(*) FILTER (WHERE ${ATTEMPTED}) AS attempted,
           count(*) FILTER (WHERE s.status='bounced') AS bounced
         FROM drip_sends s
         JOIN drip_enrollments e ON s.enrollment_id = e.id
         WHERE s.channel='email' AND s.created_at > now() - interval '30 days'
         GROUP BY e.campaign_id
         HAVING count(*) FILTER (WHERE ${ATTEMPTED}) >= $1`,
        [s.campaignBounceMin],
      );
      const campaigns = await storage.getDripCampaigns();
      for (const r of rows) {
        const attempted = Number(r.attempted || 0);
        const bounced = Number(r.bounced || 0);
        const rate = attempted ? Math.round((bounced / attempted) * 100) : 0;
        if (rate < s.campaignBounceThresholdPct) continue;
        const camp = campaigns.find((c) => c.id === r.campaign_id);
        if (!camp || !camp.isActive) continue; // already paused/gone
        await storage.updateDripCampaign(camp.id, { isActive: false } as any);
        result.campaignsPaused.push({ campaignId: camp.id, attempted, bounced, rate });
        console.log(`[BounceGuard] paused campaign ${camp.id} (${rate}% / ${attempted} sends)`);
      }
    } catch (e: any) {
      console.error("[BounceGuard] campaign pass failed:", e?.message);
    }
  }

  lastGuard = result;
  return result;
}
