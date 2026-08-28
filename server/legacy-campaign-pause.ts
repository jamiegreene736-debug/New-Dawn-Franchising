/**
 * One-time heal after the Aug 2026 blast weeks:
 * pause pre-quality-gate clones (they still drain 13-step sequences) and
 * pin the daily cap at 80 until an operator raises it.
 */
import { pool } from "./db";
import { storage } from "./storage";
import { getDeliverabilitySettings } from "./deliverability-settings-service";

/** Quality gate shipped 2026-08-27. Dated Grok clones before that stay paused. */
const QUALITY_GATE_DAY = "2026-08-27";

export function shouldPauseLegacyBlast(name: string): boolean {
  const n = (name || "").trim();
  if (/GlobeVisa/i.test(n)) return true;
  if (/^Sample Campaign$/i.test(n)) return true;
  if (/Test Campaign/i.test(n)) return true;
  if (/Grok/i.test(n)) {
    const dated = n.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dated) return true;
    return dated[1] < QUALITY_GATE_DAY;
  }
  return false;
}

export async function applyOutreachHealOnce(): Promise<{ paused: string[]; capPinned: boolean }> {
  const paused: string[] = [];
  try {
    const campaigns = await storage.getDripCampaigns();
    for (const c of campaigns) {
      if (c.isActive && shouldPauseLegacyBlast(c.name)) {
        await storage.updateDripCampaign(c.id, { isActive: false } as any);
        paused.push(c.name);
        console.log(`[Heal] paused legacy blast campaign: ${c.name}`);
      }
    }
  } catch (e: any) {
    console.error("[Heal] campaign pause failed:", e?.message);
  }

  let capPinned = false;
  try {
    await getDeliverabilitySettings();
    const { rows } = await pool.query(
      `SELECT heal_cap_applied FROM deliverability_settings WHERE id='singleton'`,
    );
    if (rows[0] && rows[0].heal_cap_applied === false) {
      await pool.query(
        `UPDATE deliverability_settings
            SET daily_cap_override = 80,
                hourly_cap_override = 15,
                heal_cap_applied = true,
                updated_at = now()
          WHERE id = 'singleton' AND heal_cap_applied = false`,
      );
      capPinned = true;
      console.log("[Heal] pinned daily cap at 80 / hourly 15 (raise in Sending & Safety after Gmail login works)");
    }
  } catch (e: any) {
    console.error("[Heal] cap pin failed:", e?.message);
  }

  return { paused, capPinned };
}
