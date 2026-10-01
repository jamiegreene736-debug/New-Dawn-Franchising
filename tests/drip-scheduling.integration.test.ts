import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import nodemailer from "nodemailer";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { processDripEmails } from "../server/drip-processor";

const testUrl = process.env.DRIP_TEST_DATABASE_URL;
const skip = !testUrl;
const sentTo: string[] = [];
let transportMock: ReturnType<typeof mock.method>;
before(async () => {
  if (skip) return;
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/new_dawn_outreach_desk_test");
  assert.equal(process.env.DATABASE_URL, testUrl);
  await pool.query("TRUNCATE drip_sends,drip_enrollments,drip_steps,drip_campaigns,prospects,agent_dnc CASCADE");
  await pool.query(`CREATE TABLE IF NOT EXISTS deliverability_settings (
    id text PRIMARY KEY, daily_cap_override int, hourly_cap_override int,
    domain_gap_override_seconds int, sender_health jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now()
  )`);
  await pool.query("INSERT INTO deliverability_settings(id,daily_cap_override,hourly_cap_override,domain_gap_override_seconds) VALUES('singleton',1,1,0) ON CONFLICT(id) DO UPDATE SET daily_cap_override=1,hourly_cap_override=1,domain_gap_override_seconds=0,sender_health='{}'");
  await pool.query("CREATE TABLE IF NOT EXISTS sender_stats(email text PRIMARY KEY,sent_total int DEFAULT 0,last_sent_at timestamptz,updated_at timestamptz DEFAULT now())");
  process.env.GMAIL_APP_PASSWORD_DYLAN = "test-only";
  transportMock = mock.method(nodemailer, "createTransport", () => ({
    sendMail: async (mail: { to: string; html: string }) => {
      sentTo.push(mail.to);
      assert.match(mail.html, /Hi there,/);
      return { accepted: [mail.to], rejected: [], messageId: "test" };
    },
  }) as unknown as ReturnType<typeof nodemailer.createTransport>);
  await pool.query("INSERT INTO drip_campaigns(id,name) VALUES('campaign','Test')");
  await pool.query("INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,subject,body_html) VALUES('intro','campaign',1,0,'Intro','<p>Hi {{name}},</p>'),('follow','campaign',2,3,'Follow-up','<p>Hi {{firstName}},</p>')");
  for (const id of ['old','new','duplicate','blocked']) {
    await pool.query("INSERT INTO prospects(id,name,email,category,location) VALUES($1,'New Dawn Development Team',$2,'attorney','US')", [id, `${id}@example.com`]);
    await pool.query("INSERT INTO drip_enrollments(id,campaign_id,prospect_id,prospect_email,prospect_name,enrolled_at,current_step) VALUES($1,'campaign',$1,$2,'New Dawn Development Team',now()-interval '30 days',$3)", [id, `${id === 'duplicate' ? 'new' : id}@example.com`, id === 'old' ? 1 : 0]);
  }
  // The oldest contact has already been reached; untouched contacts must get capacity first.
  await pool.query("UPDATE drip_enrollments SET enrolled_at=now()-interval '60 days' WHERE id='old'");
  await pool.query("INSERT INTO drip_sends(enrollment_id,step_id,recipient_email,recipient_name,subject,channel,status,sent_at) VALUES('old','intro','old@example.com','Old Person','Intro','email','sent',now()-interval '14 days')");
  await pool.query("INSERT INTO agent_dnc(email,reason) VALUES('blocked@example.com','Test opt-out')");
});
after(async () => {
  transportMock?.mock.restore();
  delete process.env.GMAIL_APP_PASSWORD_DYLAN;
  await pool.end();
});

test("scheduler prioritizes new recipients, preserves spacing and suppression across runs", { skip }, async () => {
  await processDripEmails({ force: true });
  assert.deepEqual(sentTo, ["new@example.com"]);
  const history = await storage.getDripEmailActivity();
  assert.equal(history.filter(row => row.email === "new@example.com").length, 1);
  await pool.query("UPDATE drip_enrollments SET status='completed' WHERE id='old'");
  await pool.query("UPDATE deliverability_settings SET daily_cap_override=8");
  await processDripEmails({ force: true });
  assert.equal(sentTo.length, 1, "forced sweep cannot send overdue or duplicate email within 24h");
  assert.equal((await storage.getDripEnrollment('blocked'))?.status, 'bounced');
  assert.equal((await storage.getDripEnrollment('new'))?.currentStep, 1);
});

test("database scheduler lock prevents overlapping deployment sends", { skip }, async () => {
  await pool.query("UPDATE drip_enrollments SET status='active' WHERE id='old'");
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(71283045)");
    await processDripEmails({ force: true });
    assert.equal(sentTo.length, 1);
  } finally {
    await client.query("SELECT pg_advisory_unlock(71283045)");
    client.release();
  }
});
