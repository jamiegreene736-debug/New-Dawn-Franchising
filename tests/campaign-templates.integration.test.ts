import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Server } from "node:http";
import express from "express";
import session from "express-session";
import { pool } from "../server/db";
import { ensureSchema } from "../server/ensure-schema";
import { createTemplateCampaign, registerCampaignTemplateRoutes } from "../server/campaign-template-routes";
import { getTemplateSmsPermission, templateRecipientReplied, templateRecipientOptedOut } from "../server/campaign-template-dispatch";
import { smsPermissionIssue } from "../server/campaign-template-safety";
import nodemailer from "nodemailer";

const testUrl = process.env.TEMPLATE_TEST_DATABASE_URL;
const skip = !testUrl;
let server: Server;
let base: string;
let processDripEmails: typeof import("../server/drip-processor").processDripEmails;
before(async () => {
  if (skip) return;
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && ["/new_dawn_campaign_templates_test", "/new_dawn_outreach_desk_test"].includes(url.pathname));
  assert.equal(process.env.DATABASE_URL, testUrl);
  process.env.QUO_API_KEY = "fixture-only-provider-mocked";
  process.env.QUO_PHONE_NUMBER_ID = "fixture-only-provider-mocked";
  ({ processDripEmails } = await import("../server/drip-processor"));
  const exists = await pool.query("SELECT to_regclass('public.drip_campaigns') AS name");
  if (!exists.rows[0].name) {
    const schema = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export", "--dialect", "postgresql", "--schema", "./shared/schema.ts"], { encoding: "utf8" });
    await pool.query(schema);
  }
  await ensureSchema();
  await pool.query("INSERT INTO deliverability_settings(id,outreach_autopilot_paused,daily_cap_override,hourly_cap_override,domain_gap_override_seconds) VALUES('singleton',false,10,10,0) ON CONFLICT(id) DO UPDATE SET outreach_autopilot_paused=false,daily_cap_override=10,hourly_cap_override=10,domain_gap_override_seconds=0");
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "campaign-template-local-test-only", resave: false, saveUninitialized: false }));
  registerCampaignTemplateRoutes(app, (req,res,next) => {
    if (req.headers["x-test-admin"] !== "fixture") { res.status(401).json({ message: "Unauthorized" }); return; }
    req.session.adminId = "test-admin"; next();
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});

test("consented text is sent once in local hours and a delayed next touch waits", { skip }, async () => {
  const id=randomUUID(),email=`${id}@example.com`,phone=fixturePhone();
  const clock=new Date(); clock.setUTCHours(15,0,0,0);
  while ([0,6].includes(clock.getUTCDay())) clock.setUTCDate(clock.getUTCDate()+1);
  mock.timers.enable({ apis:["Date"], now:clock.getTime() });
  let providerCalls=0;
  const provider=mock.method(globalThis,"fetch",async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(url),"https://api.openphone.com/v1/messages");
    providerCalls++;
    const payload=JSON.parse(String(options?.body));
    assert.deepEqual(payload.to,[phone]); assert.match(payload.content,/Hi Fixture/);
    return new Response(JSON.stringify({data:{id:"fixture-accepted"}}),{status:202});
  });
  try {
    await pool.query("INSERT INTO prospects(id,name,email,phone,category,location) VALUES($1,'Fixture Person',$2,$3,'broker','US')",[id,email,phone]);
    await pool.query("INSERT INTO drip_campaigns(id,name,is_active,outreach_policy,template_id) VALUES($1,'Consented fixture',true,'template_drip','broker-introductions')",[id]);
    await pool.query("INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,step_type,subject,body_html) VALUES($1,$3,1,0,'sms','','Hi {{firstName}}, New Dawn Franchising. Reply STOP to opt out.'),($2,$3,2,4,'sms','','New Dawn Franchising. Reply STOP to opt out.')",[randomUUID(),randomUUID(),id]);
    await pool.query("INSERT INTO drip_enrollments(id,campaign_id,prospect_id,prospect_email,prospect_name,enrolled_at) VALUES($1,$1,$1,$2,'Fixture Person',now()-interval '1 day')",[id,email]);
    await pool.query("INSERT INTO campaign_sms_permissions(id,email,phone,consented_at,source,disclosure,evidence,timezone,recorded_by) VALUES($1,$2,$3,now()-interval '1 day','Signed opt-in','New Dawn marketing texts','Signed record fixture','America/New_York','fixture')",[randomUUID(),email,phone]);
    await processDripEmails({templateTextsOnly:true,force:true,campaignId:id});
    await processDripEmails({templateTextsOnly:true,force:true,campaignId:id});
    assert.equal(providerCalls,1);
    const sends=await pool.query("SELECT status,channel FROM drip_sends WHERE enrollment_id=$1",[id]);
    assert.deepEqual(sends.rows,[{status:'sent',channel:'sms'}]);
    const enrollment=await pool.query("SELECT current_step FROM drip_enrollments WHERE id=$1",[id]); assert.equal(enrollment.rows[0].current_step,1);
  } finally {
    provider.mock.restore(); mock.timers.reset();
    await pool.query("UPDATE drip_campaigns SET is_active=false WHERE id=$1",[id]);
  }
});

test("provider outages and unreadable responses are uncertain; rate limits are known rejections", { skip }, async () => {
  const {sendSmsViaQuo}=await import("../server/quo-service");
  const provider=mock.method(globalThis,"fetch",async () => new Response("unreadable",{status:202}));
  try {
    assert.equal((await sendSmsViaQuo("+14155552671","Fixture")).uncertain,true);
    provider.mock.mockImplementation(async () => { throw new Error("fetch failed"); });
    assert.equal((await sendSmsViaQuo("+14155552671","Fixture")).uncertain,true);
    provider.mock.mockImplementation(async () => new Response(JSON.stringify({message:'Provider unavailable'}),{status:503}));
    assert.equal((await sendSmsViaQuo("+14155552671","Fixture")).uncertain,true);
    provider.mock.mockImplementation(async () => new Response(JSON.stringify({message:'Rate limited'}),{status:429}));
    const rejection=await sendSmsViaQuo("+14155552671","Fixture"); assert.equal(rejection.success,false); assert.equal(rejection.uncertain,false);
  } finally { provider.mock.restore(); }
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
});
async function request(path: string, body?: unknown, admin = true) {
  return fetch(base+path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(admin ? { "x-test-admin": "fixture" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function fixturePhone() { return "+1512"+String(Math.floor(Math.random()*10000000)).padStart(7,"0"); }

test("library, creation and permissions are admin-only", { skip }, async () => {
  for (const [path,body] of [["/api/crm/campaign-templates",undefined],["/api/crm/campaign-templates/broker-introductions/create",{}],["/api/crm/sms-permissions",undefined],["/api/crm/sms-permissions",{}],[`/api/crm/sms-permissions/${randomUUID()}/revoke`,{}]] as const) assert.equal((await request(path,body,false)).status,401);
  const response = await request("/api/crm/campaign-templates");
  assert.equal(response.status,200); assert.equal((await response.json()).templates.length,3);
});
test("all three templates persist correct audiences and channels as paused drafts", { skip }, async () => {
  for (const [id,audience] of [["broker-introductions","broker"],["attorney-introductions","broker"],["direct-client","client"]]) {
    const response = await request(`/api/crm/campaign-templates/${id}/create`, { name: `Integration ${id}`, includeSms:true, requestKey:randomUUID() });
    assert.equal(response.status,201);
    const campaign = await response.json(); assert.equal(campaign.isActive,false);
    const saved = await pool.query("SELECT * FROM drip_campaigns WHERE id=$1", [campaign.id]);
    assert.equal(saved.rows[0].audience_type,audience); assert.equal(saved.rows[0].template_id,id);
    const steps = await pool.query("SELECT * FROM drip_steps WHERE campaign_id=$1 ORDER BY step_order", [campaign.id]);
    assert.deepEqual(steps.rows.map(s=>s.step_type),["email","email","sms","email","sms","email"]);
    assert.deepEqual(steps.rows.map(s=>s.delay_days),[0,4,7,11,16,21]);
    const enrolled = await pool.query("SELECT count(*)::int AS n FROM drip_enrollments WHERE campaign_id=$1",[campaign.id]); assert.equal(enrolled.rows[0].n,0);
  }
});
test("concurrent retries create one campaign and conflicting reuse is rejected", { skip }, async () => {
  const input = { name:"Idempotent test", includeSms:false, requestKey:randomUUID() };
  const responses = await Promise.all([request("/api/crm/campaign-templates/direct-client/create",input),request("/api/crm/campaign-templates/direct-client/create",input)]);
  const records = await Promise.all(responses.map(r=>r.json())); assert.equal(records[0].id,records[1].id);
  const steps = await pool.query("SELECT * FROM drip_steps WHERE campaign_id=$1 ORDER BY step_order", [records[0].id]); assert.equal(steps.rows.length,4); assert.ok(steps.rows.every(s=>s.step_type==="email"));
  assert.equal((await request("/api/crm/campaign-templates/broker-introductions/create",input)).status,409);
});
test("a failed step insert rolls back the campaign and permits a clean retry", { skip }, async () => {
  const input = { name:"Atomic draft", includeSms:true, requestKey:randomUUID() };
  await pool.query("ALTER TABLE drip_steps ADD CONSTRAINT template_insert_failure CHECK (step_order<>3) NOT VALID");
  try { await assert.rejects(createTemplateCampaign("broker-introductions",input)); }
  finally { await pool.query("ALTER TABLE drip_steps DROP CONSTRAINT template_insert_failure"); }
  const saved = await pool.query("SELECT id FROM drip_campaigns WHERE template_request_key=$1",[input.requestKey]); assert.equal(saved.rows.length,0);
  assert.ok(await createTemplateCampaign("broker-introductions",input));
});
test("invalid and unknown creation requests never write a campaign", { skip }, async () => {
  assert.equal((await request("/api/crm/campaign-templates/direct-client/create",{name:"Test",requestKey:randomUUID(),isActive:true})).status,400);
  assert.equal((await request("/api/crm/campaign-templates/unknown/create",{name:"Test",requestKey:randomUUID()})).status,404);
});
test("phone/email matching and revocation control consent without erasing proof", { skip }, async () => {
  const email=`${randomUUID()}@example.com`, phone="+14155552671";
  const body={email,phone,consentedAt:"2026-09-01T15:00:00Z",source:"Signed opt-in form record",disclosure:"New Dawn marketing texts about franchise business review",evidence:"Stored signed opt-in record reference 1234",timezone:"America/New_York"};
  const response=await request("/api/crm/sms-permissions",body); assert.equal(response.status,201);
  const saved=await response.json();
  assert.equal(smsPermissionIssue(await getTemplateSmsPermission(email,phone)),null);
  assert.ok(smsPermissionIssue(await getTemplateSmsPermission("other@example.com",phone)));
  assert.ok(smsPermissionIssue(await getTemplateSmsPermission(email,"+14155552672")));
  assert.equal((await request(`/api/crm/sms-permissions/${saved.id}/revoke`,{})).status,200);
  assert.ok(smsPermissionIssue(await getTemplateSmsPermission(email,phone)));
  const revoked=await pool.query("SELECT evidence,revoked_at FROM campaign_sms_permissions WHERE id=$1",[saved.id]); assert.equal(revoked.rows[0].evidence,body.evidence); assert.ok(revoked.rows[0].revoked_at);
});
test("inbound email, texts and confirmed meetings stop template outreach", { skip }, async () => {
  const id=randomUUID(),email=`${id}@example.com`;
  const phone=fixturePhone();
  const enrolledAt=new Date(Date.now()-60000);
  assert.equal(await templateRecipientReplied(email,null,enrolledAt),false);
  await pool.query("INSERT INTO contacts(id,first_name,last_name,email,phone) VALUES($1,'Fixture','Person',$2,$3)",[id,email,phone]);
  await pool.query("INSERT INTO contact_activities(contact_id,activity_type,metadata) VALUES($1,'sms_received','{}')",[id]);
  assert.equal(await templateRecipientReplied(email,phone,enrolledAt),true);
  assert.equal(await templateRecipientReplied(email,phone,new Date(Date.now()+60000)),false);
  await pool.query("INSERT INTO meetings(id,invitee_email,invitee_name,status,scheduled_at) VALUES($1,$2,'Fixture Person','confirmed',now())",[randomUUID(),email]);
  assert.equal(await templateRecipientReplied(email,null,new Date(Date.now()+60000)),true);
  assert.equal(await templateRecipientOptedOut(email,phone),false);
  await pool.query("INSERT INTO contact_activities(contact_id,activity_type,metadata) VALUES($1,'sms_received',$2)",[id,JSON.stringify({replyText:"STOP"})]);
  assert.equal(await templateRecipientOptedOut(email,phone),true);
});

test("dispatcher skips unconsented texts and preserves a future email even when forced", { skip }, async () => {
  process.env.GMAIL_APP_PASSWORD_DYLAN="fixture-only-never-used";
  const transport=mock.method(nodemailer,"createTransport",()=> { throw new Error("No provider should be called in this fixture"); });
  const id=randomUUID(),email=`${id}@example.com`;
  const phone=fixturePhone();
  try {
    await pool.query("INSERT INTO prospects(id,name,email,phone,category,location,email_status,email_verified_at) VALUES($1,'Fixture Person',$2,$3,'broker','US','valid',now())",[id,email,phone]);
    await pool.query("INSERT INTO drip_campaigns(id,name,is_active,outreach_policy,template_id) VALUES($1,'No permission fixture',true,'template_drip','broker-introductions')",[id]);
    await pool.query("INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,step_type,subject,body_html) VALUES($1,$3,1,0,'sms','','Text one'),($2,$3,2,0,'sms','','Text two'),($4,$3,3,4,'email','Future','<p>Future</p>')",[randomUUID(),randomUUID(),id,randomUUID()]);
    await pool.query("INSERT INTO drip_enrollments(id,campaign_id,prospect_id,prospect_email,prospect_name,enrolled_at) VALUES($1,$1,$1,$2,'Fixture Person',now()-interval '1 day')",[id,email]);
    await processDripEmails({force:true,campaignId:id});
    const enrollment=await pool.query("SELECT current_step,status FROM drip_enrollments WHERE id=$1",[id]);
    assert.equal(enrollment.rows[0].current_step,2); assert.equal(enrollment.rows[0].status,"active");
    const sends=await pool.query("SELECT channel,status,error_message FROM drip_sends WHERE enrollment_id=$1",[id]);
    assert.equal(sends.rows.length,2); assert.ok(sends.rows.every(s=>s.channel==='sms' && s.status==='skipped' && /permission/.test(s.error_message)));
    await processDripEmails({templateTextsOnly:true,campaignId:id});
    const afterTextSweep=await pool.query("SELECT current_step FROM drip_enrollments WHERE id=$1",[id]); assert.equal(afterTextSweep.rows[0].current_step,2,"text-only sweep cannot release the pending email");
    await pool.query("UPDATE drip_campaigns SET is_active=false WHERE id=$1",[id]);
  } finally { transport.mock.restore(); delete process.env.GMAIL_APP_PASSWORD_DYLAN; }
});

test("dispatcher reconciles uncertain SMS outcomes and suppresses recorded STOP across channels", { skip }, async () => {
  process.env.GMAIL_APP_PASSWORD_DYLAN="fixture-only-never-used";
  const id=randomUUID(),email=`${id}@example.com`,stepId=randomUUID();
  const phone=fixturePhone();
  try {
    await pool.query("INSERT INTO prospects(id,name,email,phone,category,location) VALUES($1,'Stop Fixture',$2,$3,'broker','US')",[id,email,phone]);
    await pool.query("INSERT INTO drip_campaigns(id,name,is_active,outreach_policy,template_id) VALUES($1,'Unknown fixture',true,'template_drip','broker-introductions')",[id]);
    await pool.query("INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,step_type,subject,body_html) VALUES($1,$2,1,0,'sms','','Text')",[stepId,id]);
    await pool.query("INSERT INTO drip_enrollments(id,campaign_id,prospect_id,prospect_email,prospect_name,enrolled_at) VALUES($1,$1,$1,$2,'Stop Fixture',now()-interval '1 day')",[id,email]);
    await pool.query("INSERT INTO drip_sends(enrollment_id,step_id,recipient_email,recipient_name,subject,channel,status) VALUES($1,$2,$3,'Stop Fixture','Text','sms','unknown')",[id,stepId,phone]);
    await processDripEmails({force:true,campaignId:id});
    const held=await pool.query("SELECT current_step,hold_reason FROM drip_enrollments WHERE id=$1",[id]); assert.equal(held.rows[0].current_step,0); assert.match(held.rows[0].hold_reason,/uncertain outcome/);
    await pool.query("INSERT INTO contacts(id,first_name,last_name,email,phone) VALUES($1,'Stop','Fixture',$2,$3)",[id,email,phone]);
    await pool.query("INSERT INTO contact_activities(contact_id,activity_type,metadata) VALUES($1,'sms_received',$2)",[id,JSON.stringify({replyText:'STOP'})]);
    await processDripEmails({force:true,campaignId:id});
    const suppressed=await pool.query("SELECT status FROM drip_enrollments WHERE id=$1",[id]); assert.equal(suppressed.rows[0].status,'suppressed');
    const dnc=await pool.query("SELECT * FROM agent_dnc WHERE email=$1",[email]); assert.ok(dnc.rows.length);
    const count=await pool.query("SELECT count(*)::int AS n FROM drip_sends WHERE enrollment_id=$1",[id]); assert.equal(count.rows[0].n,1);
    await pool.query("UPDATE drip_campaigns SET is_active=false WHERE id=$1",[id]);
  } finally { delete process.env.GMAIL_APP_PASSWORD_DYLAN; }
});
