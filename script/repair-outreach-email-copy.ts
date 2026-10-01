/** Update known campaign templates and their daily clones without reenrolling or sending. */
import { writeFile } from "node:fs/promises";
import { pool } from "../server/db";
import { BROKER_TRACK, BROKER_2_TRACK, CLIENT_TRACK, BROKER_CAMPAIGN_NAME, BROKER_2_CAMPAIGN_NAME, CLIENT_CAMPAIGN_NAME, withSpacing, type CampaignTrackStep } from "../shared/campaign-tracks";
import { GLOBEVISA_TRACK, GLOBEVISA_NURTURE_TRACK, GLOBEVISA_CAMPAIGN_NAME, GLOBEVISA_NURTURE_NAME } from "../server/globevisa-campaign";

const apply = process.argv.includes("--apply");
const backupPath = process.argv.find(a => a.startsWith("--backup="))?.slice(9);
if (apply && !backupPath) throw new Error("--apply requires --backup=/absolute/path.json");
function trackFor(name: string, audience: string): CampaignTrackStep[] | undefined {
  if (name === GLOBEVISA_NURTURE_NAME) return GLOBEVISA_NURTURE_TRACK;
  if (name === GLOBEVISA_CAMPAIGN_NAME) return GLOBEVISA_TRACK;
  if (name === BROKER_CAMPAIGN_NAME) return BROKER_TRACK;
  if (name === CLIENT_CAMPAIGN_NAME || name === "Grok Campaign — Clients" || name === "Copy of Grok Campaign — Clients") return CLIENT_TRACK;
  if (name === BROKER_2_CAMPAIGN_NAME || name.startsWith("Grok 2.0 Brokers") || name.startsWith("GlobeVisa Apollo") || name === "GlobeVisa - Brokers - 50 Contacts Test") return audience === "client" ? CLIENT_TRACK : BROKER_2_TRACK;
}
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  const { rows } = await connection.query<{ id: string; name: string; audience_type: string; step_order: number; subject: string; body_html: string; step_name: string }>(`SELECT s.id,c.name,c.audience_type,s.step_order,s.subject,s.body_html,s.step_name FROM drip_steps s JOIN drip_campaigns c ON c.id=s.campaign_id WHERE s.step_type='email' ORDER BY c.name,s.step_order`);
  const updates = rows.flatMap(row => {
    const step = trackFor(row.name, row.audience_type)?.find(s => s.stepOrder === row.step_order && s.stepType === "email");
    if (!step) return [];
    const body = withSpacing(step.bodyHtml);
    return row.subject === step.subject && row.body_html === body ? [] : [{ before: row, subject: step.subject, body }];
  });
  if (apply) {
    await writeFile(backupPath!, JSON.stringify(updates, null, 2), { mode: 0o600, flag: "wx" });
    for (const update of updates) await connection.query("UPDATE drip_steps SET subject=$1, body_html=$2, step_name=$1 WHERE id=$3", [update.subject, update.body, update.before.id]);
    await connection.query("UPDATE deliverability_settings SET sender_rotation=false,updated_at=now() WHERE id='singleton'");
  }
  console.log(JSON.stringify({ apply, campaigns: new Set(updates.map(u => u.before.name)).size, emailSteps: updates.length, enrollmentChanges: 0, emailsSent: 0 }));
  await connection.query(apply ? "COMMIT" : "ROLLBACK");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally { connection.release(); await pool.end(); }
