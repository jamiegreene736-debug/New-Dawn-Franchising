/** Stage the reviewed broker campaign. Never enrolls contacts or enables sending. */
import { randomUUID } from "node:crypto";
import pg from "pg";
import campaign from "../shared/broker-escrow-campaign.json";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const before = await client.query("SELECT * FROM drip_campaigns WHERE id=$1 FOR UPDATE", [campaign.id]);
    const oldSteps = await client.query<{ id: string; step_order: number }>("SELECT * FROM drip_steps WHERE campaign_id=$1 ORDER BY step_order", [campaign.id]);
    const enrollments = await client.query("SELECT 1 FROM drip_enrollments WHERE campaign_id=$1 LIMIT 1", [campaign.id]);
    const sends = await client.query("SELECT 1 FROM drip_sends s JOIN drip_steps t ON t.id=s.step_id WHERE t.campaign_id=$1 LIMIT 1", [campaign.id]);
    if (before.rows[0]?.is_active || enrollments.rowCount || sends.rowCount) throw new Error("Only an inactive, unenrolled, unsent campaign may be replaced.");
    if (new Set(oldSteps.rows.map(s => s.step_order)).size !== oldSteps.rows.length) throw new Error("Existing step order needs review.");
    console.log(JSON.stringify({ before: before.rows, previousSteps: oldSteps.rows, apply: process.argv.includes("--apply") }));
    if (!process.argv.includes("--apply")) {
      await client.query("ROLLBACK");
      return;
    }
    await client.query(`INSERT INTO drip_campaigns(id,name,description,is_active,audience_type,outreach_policy)
      VALUES($1,$2,$3,false,'broker',$4) ON CONFLICT(id) DO UPDATE SET name=$2,description=$3,is_active=false,audience_type='broker',outreach_policy=$4`,
    [campaign.id,campaign.name,campaign.description,campaign.outreachPolicy]);
    for (const step of campaign.steps) {
      const id = oldSteps.rows.find(s => s.step_order === step.stepOrder)?.id ?? randomUUID();
      await client.query(`INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,step_type,step_name,subject,preview_text,body_html,trigger_type)
        VALUES($1,$2,$3,$4,'email',$5,$5,$6,$7,'time') ON CONFLICT(id) DO UPDATE SET delay_days=$4,step_type='email',step_name=$5,subject=$5,preview_text=$6,body_html=$7,trigger_type='time',trigger_ref_step=NULL,trigger_window_hours=NULL`,
      [id,campaign.id,step.stepOrder,step.delayDays,step.subject,step.previewText,step.bodyHtml]);
    }
    await client.query("DELETE FROM drip_steps WHERE campaign_id=$1 AND step_order>=10", [campaign.id]);
    const saved = await client.query("SELECT step_order,delay_days,step_type,subject,preview_text,body_html,trigger_type FROM drip_steps WHERE campaign_id=$1 ORDER BY step_order", [campaign.id]);
    if (saved.rows.length !== 10 || saved.rows.some((s, i) => s.step_order !== i || s.step_type !== "email" || s.subject !== campaign.steps[i].subject || s.preview_text !== campaign.steps[i].previewText || s.body_html !== campaign.steps[i].bodyHtml || s.delay_days !== campaign.steps[i].delayDays || s.trigger_type !== "time")) throw new Error("Saved campaign does not match reviewed copy.");
    await client.query("COMMIT");
    console.log(JSON.stringify({ id: campaign.id, name: campaign.name, active: false, recipients: 0, messagesSent: 0, steps: saved.rows }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Campaign staging failed"); process.exitCode = 1; });
