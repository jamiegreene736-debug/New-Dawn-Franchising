import { after, before, test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import nodemailer from "nodemailer";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { createGlockTest, getGlockReport, glockConfig, normalizePlacement } from "../server/glockapps-service";
import { placementHash, placementSnapshot, startPlacementTest, processPlacementTests, refreshPlacementTest, placementOverview, cancelPlacementTest } from "../server/campaign-placement-service";
import { registerCampaignPlacementRoutes } from "../server/campaign-placement-routes";

const campaignId = randomUUID(), stepId = randomUUID();
const step = { id: stepId, campaignId, stepOrder: 1, stepType: "email", subject: "A question for {{firstName}}", bodyHtml: "<p>Hi {{firstName}}, please reply.</p>", previewText: "A short preview" };
const created = { status: "success", testId: "2026-10-01:fixture", insertHeader: "X-API-Campaign-id: 2026-10-01:fixture", emails: ["seed@gmail.com","seed@outlook.com"] };
const calls: { url: string; init?: RequestInit }[] = [];
let responseStatus = 200, responseData: unknown = created, throws = false, rejectMail = false;
const envelopes: Record<string,unknown>[] = [];
const realFetch = globalThis.fetch;
const dbEnabled = !!process.env.PLACEMENT_TEST_DATABASE_URL;
let campaignExists = true;

before(async () => {
  process.env.GLOCKAPPS_API_KEY="fixture-key";
  process.env.GLOCKAPPS_PROJECT_ID="123";
  process.env.GLOCKAPPS_SEED_ACCOUNT_IDS="1,2";
  process.env.GMAIL_APP_PASSWORD_DYLAN="fixture-password";
  mock.method(globalThis,"fetch",async (url: string | URL | Request,init?: RequestInit) => {
    if (!String(url).startsWith("https://api.glockapps.com/")) return realFetch(url,init);
    calls.push({url:String(url),init});
    if (throws) throw new Error("timeout fixture-key");
    return new Response(JSON.stringify(responseData),{status:responseStatus,headers:{"Content-Type":"application/json"}});
  });
  mock.method(nodemailer,"createTransport",()=>({ sendMail: async (mail: Record<string,unknown>)=> { envelopes.push(mail); return { accepted:rejectMail?[]:[mail.to],rejected:rejectMail?[mail.to]:[],messageId:mail.messageId }; } }) as ReturnType<typeof nodemailer.createTransport>);
  mock.method(storage,"getDripCampaign",async ()=> campaignExists ? {id:campaignId} as Awaited<ReturnType<typeof storage.getDripCampaign>> : undefined);
  mock.method(storage,"getDripSteps",async ()=>[step] as Awaited<ReturnType<typeof storage.getDripSteps>>);
  if (!dbEnabled) return;
  const url = new URL(process.env.PLACEMENT_TEST_DATABASE_URL!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname) && url.pathname==="/new_dawn_placement_test");
  assert.equal(process.env.DATABASE_URL, process.env.PLACEMENT_TEST_DATABASE_URL);
  const source = readFileSync(new URL("../server/ensure-schema.ts",import.meta.url),"utf8");
  for (const table of ["campaign_placement_tests","campaign_placement_messages"]) {
    const statement = source.match(new RegExp('`(CREATE TABLE IF NOT EXISTS '+table+' \\([\\s\\S]*?\\))`'))?.[1];
    assert.ok(statement); await pool.query(statement);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS deliverability_settings(id text PRIMARY KEY,outreach_autopilot_paused boolean,daily_cap_override int,hourly_cap_override int,sender_health jsonb,updated_at timestamptz);
    INSERT INTO deliverability_settings VALUES('singleton',true,80,15,'{}',now()) ON CONFLICT(id) DO UPDATE SET outreach_autopilot_paused=true,daily_cap_override=80,hourly_cap_override=15;
    CREATE TABLE IF NOT EXISTS drip_sends(channel text,sent_at timestamptz)`);
});
after(async ()=>{ mock.restoreAll(); await pool.end(); });
function resetProvider() { calls.length=0; responseStatus=200; responseData=created; throws=false; rejectMail=false; envelopes.length=0; }
async function reset() { resetProvider(); await pool.query("TRUNCATE campaign_placement_messages,campaign_placement_tests,drip_sends; UPDATE deliverability_settings SET outreach_autopilot_paused=true,daily_cap_override=80,hourly_cap_override=15"); }
function report(type="Inbox", finished=true) { return {status:"success",result:{testId:created.testId,finished,inboxes:created.emails.map(email=>({email,iType:type,finished:true,spf:"pass",dkim:"pass",dmarc:"pass"}))}}; }
async function ageCheck(id:string) { await pool.query("UPDATE campaign_placement_tests SET checked_at=now()-interval '6 minutes' WHERE id=$1",[id]); }

test("provider config requires bounded explicit seed selection; no API call when unconfigured",async()=>{
  delete process.env.GLOCKAPPS_SEED_ACCOUNT_IDS;
  assert.equal(glockConfig().configured,false);
  await assert.rejects(createGlockTest("test"),/Connect GlockApps/);
  process.env.GLOCKAPPS_SEED_ACCOUNT_IDS="1,2";
});
test("paid create uses the official API path and header, never retries uncertain requests",async()=>{
  resetProvider(); await createGlockTest("test");
  assert.equal(calls[0].url,"https://api.glockapps.com/gateway/spamtest-v2/api/projects/123/manualTest");
  assert.equal((calls[0].init?.headers as Record<string,string>)["x-api-key"],"fixture-key");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)).seedAccountIds,["1","2"]);
  throws=true; await assert.rejects(createGlockTest("test"),/outcome may be unknown/);
  assert.equal(calls.length,2);
});
test("provider rejects malformed recipients, header injection, excessive panels and mismatched reports",async()=>{
  for(const change of [{emails:["seed@example.com\r\nBcc: victim@example.com"]},{insertHeader:"X-API-Campaign-id: id\r\nBcc: victim@example.com"},{emails:Array.from({length:13},(_,i)=>`seed${i}@example.com`)},{emails:["seed@gmail.com","SEED@gmail.com"]}]){
    resetProvider(); responseData={...created,...change}; await assert.rejects(createGlockTest("test"),/invalid or oversized/);
  }
  resetProvider(); responseData={status:"success",result:{testId:"other",finished:true}}; await assert.rejects(getGlockReport("123",created.testId),/mismatched/);
});
test("auth, insufficient credits, rate limit and server errors are actionable without secret leakage",async()=>{
  for(const [status,pattern] of [[401,/access/],[402,/credits/],[429,/rate limiting/],[500,/HTTP 500/]] as const){
    resetProvider();responseStatus=status;await assert.rejects(createGlockTest("test"),pattern);assert.equal(calls.length,1);
  }
});
test("unknown placements never count as inbox and preview edits invalidate the snapshot",()=>{
  assert.equal(normalizePlacement("Spam"),"spam"); assert.equal(normalizePlacement("Other"),"tabs"); assert.equal(normalizePlacement("new-folder"),"unknown");
  assert.notEqual(placementHash(placementSnapshot(step)),placementHash(placementSnapshot({...step,previewText:"Changed"})));
});
test("placement lifecycle, idempotency, actual rendering and first observed spam are preserved",{skip:!dbEnabled},async()=>{
  await reset(); const request=randomUUID();
  const id=await startPlacementTest(campaignId,stepId,request,"");
  assert.equal(await startPlacementTest(campaignId,stepId,request,""),id); assert.equal(calls.length,1);
  await assert.rejects(startPlacementTest(campaignId,stepId,randomUUID(),""),/in progress/);
  responseData=report("Spam",false);
  await processPlacementTests();await processPlacementTests();
  assert.equal(envelopes.length,1);
  await pool.query("UPDATE campaign_placement_messages SET attempted_at=now()-interval '6 minutes' WHERE attempted_at IS NOT NULL");
  await processPlacementTests();
  assert.equal(envelopes.length,2);
  assert.equal(envelopes[0].subject,"A question for Alex"); assert.match(String(envelopes[0].html),/Hi Alex/);
  assert.match(String(envelopes[0].html),/A short preview/); assert.doesNotMatch(String(envelopes[0].html),/track\/open/);
  assert.equal((envelopes[0].headers as Record<string,string>)["X-API-Campaign-id"],created.testId);
  assert.ok((envelopes[0].headers as Record<string,string>)["List-Unsubscribe"]);
  await ageCheck(id); responseData=report("Spam"); await refreshPlacementTest(campaignId,id);
  let overview=await placementOverview(campaignId); assert.equal(overview.tests[0].status,"complete");
  assert.ok(overview.tests[0].messages.every(m=>m.placement==="spam"));
  await ageCheck(id);responseData=report("Inbox");await refreshPlacementTest(campaignId,id);
  overview=await placementOverview(campaignId);assert.ok(overview.tests[0].messages.every(m=>m.placement==="spam"));
  await assert.rejects(startPlacementTest(campaignId,stepId,randomUUID(),""),/meaningful/);
  const old=step.previewText;step.previewText="Edited preview";assert.equal((await placementOverview(campaignId)).tests[0].current,false);step.previewText=old;
  await assert.rejects(refreshPlacementTest(randomUUID(),randomUUID()),/not found/);
});
test("paused outreach, rolling caps and cancellation prevent seed sends",{skip:!dbEnabled},async()=>{
  await reset(); await pool.query("UPDATE deliverability_settings SET outreach_autopilot_paused=false");
  await assert.rejects(startPlacementTest(campaignId,stepId,randomUUID(),""),/Pause outreach/);
  await pool.query("UPDATE deliverability_settings SET outreach_autopilot_paused=true");
  const id=await startPlacementTest(campaignId,stepId,randomUUID(),"");responseData=report("",false);
  await pool.query("INSERT INTO drip_sends SELECT 'email',now() FROM generate_series(1,15)");
  await processPlacementTests();assert.equal(envelopes.length,0);
  await pool.query("TRUNCATE drip_sends; UPDATE deliverability_settings SET outreach_autopilot_paused=false");
  await processPlacementTests();assert.equal(envelopes.length,0);
  await pool.query("UPDATE deliverability_settings SET outreach_autopilot_paused=true");
  await assert.rejects(cancelPlacementTest(randomUUID(),id),/not found/);
  await cancelPlacementTest(campaignId,id); await processPlacementTests();assert.equal(envelopes.length,0);
});
test("uncertain SMTP acceptance stops the test, never automatically resends and remains distinct from placement",{skip:!dbEnabled},async()=>{
  await reset();const id=await startPlacementTest(campaignId,stepId,randomUUID(),"");responseData=report("",false);rejectMail=true;
  await processPlacementTests();await processPlacementTests();assert.equal(envelopes.length,1);
  const overview=await placementOverview(campaignId);assert.equal(overview.tests[0].status,"attention");assert.equal(overview.tests[0].messages[0].send_status,"unknown");
  await ageCheck(id);responseData=report("Inbox");await refreshPlacementTest(campaignId,id);await processPlacementTests();assert.equal(envelopes.length,1);
});
test("timeout at paid creation is persisted and an idempotent retry does not spend twice",{skip:!dbEnabled},async()=>{
  await reset();throws=true;const request=randomUUID();const id=await startPlacementTest(campaignId,stepId,request,"");
  assert.equal(await startPlacementTest(campaignId,stepId,request,""),id);assert.equal(calls.length,1);assert.equal((await placementOverview(campaignId)).tests[0].status,"attention");
});
test("routes require authentication, validate start requests and reject missing campaigns",{skip:!dbEnabled},async()=>{
  await reset();const app=express();app.use(express.json());registerCampaignPlacementRoutes(app,(req,res,next)=>req.headers.authorization==="test"?next():res.sendStatus(401));
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address();assert.ok(address && typeof address!=="string");const url=`http://127.0.0.1:${address.port}/api/crm/campaigns/${campaignId}/placement-tests`;
  try {
    for(const method of ["GET","POST"]) assert.equal((await realFetch(url,{method})).status,401);
    assert.equal((await realFetch(url,{method:"POST",headers:{authorization:"test","Content-Type":"application/json"},body:'{"stepId":"anything"}'})).status,400);
    campaignExists=false;assert.equal((await realFetch(url,{headers:{authorization:"test"}})).status,404);
  } finally {campaignExists=true;await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test("cross-process lock prevents competing paid creates and is released on failures",{skip:!dbEnabled},async()=>{
  await reset();const connection=await pool.connect();await connection.query("SELECT pg_advisory_lock(48192071)");
  try { await assert.rejects(startPlacementTest(campaignId,stepId,randomUUID(),""),/already running/);assert.equal(calls.length,0); }
  finally {await connection.query("SELECT pg_advisory_unlock(48192071)");connection.release();}
  await startPlacementTest(campaignId,stepId,randomUUID(),"");assert.equal(calls.length,1);
});
test("expired queues never send and unobserved provider results stay unresolved",{skip:!dbEnabled},async()=>{
  await reset();const id=await startPlacementTest(campaignId,stepId,randomUUID(),"");responseData=report("new-provider-folder",true);
  await processPlacementTests();assert.equal((await placementOverview(campaignId)).tests[0].messages[0].placement,"unknown");
  await pool.query("UPDATE campaign_placement_tests SET created_at=now()-interval '25 hours' WHERE id=$1",[id]);
  await processPlacementTests();assert.equal(envelopes.length,1);assert.equal((await placementOverview(campaignId)).tests[0].status,"attention");
});

test("campaign panel disables paid tests until connected and presents observed spam without a delivery guarantee",async()=>{
  const { createElement }=await import("react");
  const { renderToStaticMarkup }=await import("react-dom/server");
  const { QueryClient,QueryClientProvider }=await import("@tanstack/react-query");
  const { CampaignPlacementTest }=await import("../client/src/components/campaign-placement-test");
  const client=new QueryClient();
  const key=[`/api/crm/campaigns/${campaignId}/placement-tests`,"fixture"];
  const data={configured:false,senderReady:true,outreachPaused:true,seedCount:0,tests:[]};
  client.setQueryData(key,data);
  const render=()=>renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(CampaignPlacementTest,{campaignId,revision:"fixture",steps:[{id:stepId,subject:step.subject}]})));
  assert.match(render(),/Connect GlockApps/);assert.match(render(),/disabled=""/);
  client.setQueryData(key,{...data,configured:true,seedCount:1,tests:[{id:randomUUID(),step_id:stepId,status:"complete",error:null,created_at:new Date().toISOString(),checked_at:new Date().toISOString(),snapshot:placementSnapshot(step),current:false,stale:false,messages:[{email:"seed@gmail.com",send_status:"accepted",placement:"spam",authentication:null}]}]});
  const html=render();assert.match(html,/1 spam/);assert.match(html,/saved email has changed/);assert.match(html,/not a guarantee/);
  client.clear();
});
