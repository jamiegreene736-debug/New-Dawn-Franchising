/** Refresh every email campaign without reenrollment, activation or sending. */
import { writeFile } from "node:fs/promises";
import { pool } from "../server/db";
import { withSpacing, type CampaignTrackStep } from "../shared/campaign-tracks";
import { reviewedEmailSteps } from "../shared/outreach-copy";

const apply = process.argv.includes("--apply");
const backupPath = process.argv.find(a => a.startsWith("--backup="))?.slice(9);
if (apply && !backupPath) throw new Error("--apply requires --backup=/absolute/path.json");
interface ExistingStep { id: string; campaign_id: string; name: string; audience_type: string; step_order: number; subject: string; body_html: string; step_name: string; delay_days: number }
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  const { rows } = await connection.query<ExistingStep>(`SELECT s.id,s.campaign_id,c.name,c.audience_type,s.step_order,s.subject,s.body_html,s.step_name,s.delay_days
    FROM drip_steps s JOIN drip_campaigns c ON c.id=s.campaign_id WHERE s.step_type IN ('email','manual_email') ORDER BY c.id,s.step_order`);
  const campaigns = new Map<string, ExistingStep[]>();
  for (const row of rows) campaigns.set(row.campaign_id, [...(campaigns.get(row.campaign_id) || []), row]);
  const updates = [];
  for (const group of campaigns.values()) {
    const inputs: CampaignTrackStep[] = group.map(row => ({ stepOrder: row.step_order, delayDays: row.delay_days, stepType: "email", stepName: row.step_name, priority: "Medium", subject: row.subject, bodyHtml: row.body_html, bodyText: "" }));
    const revised = reviewedEmailSteps(inputs, group[0].audience_type === "client" ? "client" : "broker");
    for (let index = 0; index < group.length; index++) {
      const row = group[index], step = revised[index], body = withSpacing(step.bodyHtml);
      if (row.subject !== step.subject || row.body_html !== body || row.delay_days !== step.delayDays)
        updates.push({ before: row, subject: step.subject, body, delayDays: step.delayDays });
    }
  }
  if (apply) {
    await writeFile(backupPath!, JSON.stringify(updates, null, 2), { mode: 0o600, flag: "wx" });
    for (const update of updates) await connection.query("UPDATE drip_steps SET subject=$1,body_html=$2,step_name=$1,delay_days=$4 WHERE id=$3", [update.subject, update.body, update.before.id, update.delayDays]);
    await connection.query("UPDATE deliverability_settings SET sender_rotation=false,updated_at=now() WHERE id='singleton'");
  }
  console.log(JSON.stringify({ apply, campaigns: new Set(updates.map(u => u.before.campaign_id)).size, emailSteps: updates.length, enrollmentChanges: 0, emailsSent: 0 }));
  await connection.query(apply ? "COMMIT" : "ROLLBACK");
} catch (error) { await connection.query("ROLLBACK"); throw error; }
finally { connection.release(); await pool.end(); }
