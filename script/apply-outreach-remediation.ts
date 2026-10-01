/** Preserve campaign history while holding audit-affected recipients for review. */
import { writeFile } from "node:fs/promises";
import { pool } from "../server/db";
const apply = process.argv.includes("--apply");
const backup = process.argv.find(a => a.startsWith("--backup="))?.slice(9);
if (apply && !backup) throw new Error("An exclusive backup path is required.");
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  const before = {
    enrollments: (await connection.query("SELECT id,status,hold_reason FROM drip_enrollments WHERE status='active'")).rows,
    replies: (await connection.query("SELECT id,reply_signal FROM drip_sends WHERE status='replied' AND reply_signal IS NULL")).rows,
  };
  if (apply) {
    await writeFile(backup!, JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" });
    await connection.query("UPDATE drip_campaigns SET is_active=false WHERE is_active=true");
    await connection.query("UPDATE deliverability_settings SET outreach_autopilot_paused=true,verify_before_send=true,sender_rotation=false WHERE id='singleton'");
    await connection.query(`UPDATE drip_enrollments SET hold_reason=CASE
      WHEN enrolled_at<now()-interval '45 days' THEN 'Sequence older than 45 days; backlog requires review.'
      ELSE 'Recipient qualification and external delivery check required before resuming.' END WHERE status='active'`);
    // Only explicit unsubscribe enrollment evidence is used for historical labels.
    await connection.query(`UPDATE drip_sends s SET reply_signal='opt_out' FROM drip_enrollments e
      WHERE s.enrollment_id=e.id AND s.status='replied' AND s.reply_signal IS NULL AND e.status='unsubscribed'`);
  }
  console.log(JSON.stringify({ apply, enrollmentsHeld: before.enrollments.length, historicalRepliesReviewed: before.replies.length, emailsSent: 0 }));
  await connection.query(apply ? "COMMIT" : "ROLLBACK");
} catch (error) { await connection.query("ROLLBACK"); throw error; }
finally { connection.release(); await pool.end(); }
