import { createHash, randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { storage } from "./storage";
import { sendEmailFromSender } from "./email-service";
import { getDeliverabilitySettings } from "./deliverability-settings-service";
import { makePersonalize } from "./campaign-personalization";
import { createGlockTest, getGlockReport, glockConfig, normalizePlacement, PlacementError } from "./glockapps-service";
import type { PlacementSnapshot, PlacementTest, PlacementMessage, PlacementOverview } from "../shared/campaign-placement";

const LOCK = 48192071;
const SENDER = "dylan@newdawnfranchising.com";
interface Step { id: string; stepType: string; subject: string | null; bodyHtml: string | null; previewText?: string | null }
interface TestRow extends Omit<PlacementTest, "current" | "stale" | "messages"> {
  campaign_id: string; content_hash: string; project_id: string; provider_test_id: string | null; provider_header: string | null;
}
export function placementSnapshot(step: Step): PlacementSnapshot {
  return { subject: step.subject || "", bodyHtml: step.bodyHtml || "", previewText: step.previewText || "", sender: SENDER, rendererVersion: 1 };
}
export function placementHash(snapshot: PlacementSnapshot): string { return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"); }
function senderReady() { return !!(process.env.GMAIL_APP_PASSWORD_DYLAN || process.env.GMAIL_APP_PASSWORD)?.trim(); }
async function stepsFor(campaignId: string) {
  if (!await storage.getDripCampaign(campaignId)) throw new PlacementError("Campaign not found", 404);
  return storage.getDripSteps(campaignId);
}
export async function placementOverview(campaignId: string): Promise<PlacementOverview> {
  const steps = await stepsFor(campaignId);
  const { rows } = await pool.query<TestRow>("SELECT * FROM campaign_placement_tests WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 10", [campaignId]);
  const { rows: messages } = await pool.query<PlacementMessage & { test_id: string }>("SELECT test_id,email,send_status,placement,authentication FROM campaign_placement_messages WHERE test_id=ANY($1::uuid[]) ORDER BY email", [rows.map(t => t.id)]);
  const config = glockConfig();
  return { configured: config.configured, senderReady: senderReady(), outreachPaused: (await getDeliverabilitySettings()).outreachAutopilotPaused, seedCount: config.seedIds.length,
    tests: rows.map(t => {
      const step = steps.find(s => s.id === t.step_id);
      return { id: t.id, step_id: t.step_id, status: t.status, error: t.error, created_at: t.created_at, checked_at: t.checked_at, snapshot: t.snapshot,
        current: step?.stepType === "email" && placementHash(placementSnapshot(step)) === t.content_hash,
        stale: Date.now() - new Date(t.created_at).getTime() > 7 * 86400_000, messages: messages.filter(m => m.test_id === t.id) };
    }) };
}
async function withLock<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let locked = false;
  let broken = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK])).rows[0].locked;
    if (!locked) throw new PlacementError("A placement test operation is already running. Refresh shortly.", 409);
    return await work(client);
  } finally {
    if (locked) { try { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]); } catch { broken = true; } }
    client.release(broken);
  }
}
export async function startPlacementTest(campaignId: string, stepId: string, requestId: string, reason: string) {
  const step = (await stepsFor(campaignId)).find(s => s.id === stepId && s.stepType === "email");
  if (!step || !step.subject?.trim() || !step.bodyHtml?.trim()) throw new PlacementError("Select a saved email with a subject and body.", 400);
  const config = glockConfig();
  if (!config.configured || !senderReady()) throw new PlacementError("Connect GlockApps and the sending mailbox before testing.", 409);
  if (!(await getDeliverabilitySettings()).outreachAutopilotPaused) throw new PlacementError("Pause outreach before running a controlled placement test.", 409);
  const snapshot = placementSnapshot(step), hash = placementHash(snapshot);
  return withLock(async client => {
    const prior = await client.query<TestRow>("SELECT * FROM campaign_placement_tests WHERE request_id=$1", [requestId]);
    if (prior.rows.length) {
      if (prior.rows[0].campaign_id !== campaignId || prior.rows[0].step_id !== stepId) throw new PlacementError("This request belongs to another test.", 409);
      return prior.rows[0].id;
    }
    const active = await client.query("SELECT id FROM campaign_placement_tests WHERE status IN ('creating','queued','awaiting_placement') LIMIT 1");
    if (active.rows.length) throw new PlacementError("A placement test is already in progress. Finish or cancel it before using another credit.", 409);
    const repeat = await client.query("SELECT id FROM campaign_placement_tests WHERE campaign_id=$1 AND step_id=$2 AND content_hash=$3 AND created_at>now()-interval '7 days' LIMIT 1", [campaignId, stepId, hash]);
    if (repeat.rows.length && reason.trim().length < 30) throw new PlacementError("This email was already tested. Describe the meaningful sender, DNS or content change before spending another credit (at least 30 characters).", 409);
    const id = randomUUID();
    await client.query("INSERT INTO campaign_placement_tests(id,campaign_id,step_id,request_id,content_hash,snapshot,reason,project_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [id,campaignId,stepId,requestId,hash,JSON.stringify(snapshot),reason,config.projectId]);
    try {
      const test = await createGlockTest(`New Dawn ${id}`);
      await client.query("UPDATE campaign_placement_tests SET provider_test_id=$2,provider_header=$3 WHERE id=$1", [id,test.testId,test.insertHeader.slice(test.insertHeader.indexOf(":") + 1).trim()]);
      for (const email of test.emails) await client.query("INSERT INTO campaign_placement_messages(test_id,email) VALUES($1,$2)", [id,email.toLowerCase()]);
      await client.query("UPDATE campaign_placement_tests SET status='queued' WHERE id=$1", [id]);
    } catch (error) {
      await client.query("UPDATE campaign_placement_tests SET status='attention',error=$2 WHERE id=$1", [id,error instanceof PlacementError ? error.message : "Test preparation failed. Check the provider account before retrying; a credit may have been used."]);
    }
    return id;
  });
}
async function refreshTest(client: PoolClient, test: TestRow) {
  if (!test.provider_test_id) throw new PlacementError("No provider report is available. Check GlockApps before starting another paid test.", 409);
  const report = await getGlockReport(test.project_id, test.provider_test_id);
  for (const result of report.inboxes) {
    if (!result.finished) continue;
    const placement = normalizePlacement(result.iType);
    // The first observed placement is immutable: moving a message never turns a spam result into a pass.
    await client.query(`UPDATE campaign_placement_messages SET placement=$3,authentication=$4
      WHERE test_id=$1 AND email=$2 AND placement IN ('pending','unknown','missing') AND send_status IN ('accepted','unknown')`,
    [test.id,result.email.toLowerCase(),placement,JSON.stringify({ spf: result.spf || "unknown", dkim: result.dkim || "unknown", dmarc: result.dmarc || "unknown" })]);
  }
  const age = Date.now() - new Date(test.created_at).getTime();
  const expired = age > 24 * 3600_000;
  const { rows } = await client.query<{ queued: number; unresolved: number }>(`SELECT count(*) FILTER(WHERE send_status='queued')::int AS queued,
    count(*) FILTER(WHERE send_status <> 'accepted' OR placement NOT IN ('inbox','tabs','spam'))::int AS unresolved FROM campaign_placement_messages WHERE test_id=$1`, [test.id]);
  const status = test.status === "attention" ? "attention" : report.failedReport || expired ? "attention" : rows[0].queued ? "queued" : report.finished ? (rows[0].unresolved ? "attention" : "complete") : "awaiting_placement";
  await client.query("UPDATE campaign_placement_tests SET status=$2,checked_at=now(),error=$3 WHERE id=$1", [test.id,status,report.failedReport ? "GlockApps could not finish this report." : expired ? "Test timed out. Unobserved mail remains unknown; no messages will be resent." : status === "attention" ? "Some messages failed or have no confirmed placement. Review the mailbox results." : null]);
}
export async function refreshPlacementTest(campaignId: string, testId: string) {
  await stepsFor(campaignId);
  return withLock(async client => {
    const { rows } = await client.query<TestRow>("SELECT * FROM campaign_placement_tests WHERE id=$1 AND campaign_id=$2", [testId,campaignId]);
    const test = rows[0];
    if (!test) throw new PlacementError("Placement test not found", 404);
    if (test.status === "cancelled") return;
    if (test.checked_at && Date.now() - new Date(test.checked_at).getTime() < 60_000) throw new PlacementError("Wait one minute between report refreshes.", 429);
    await client.query("UPDATE campaign_placement_tests SET checked_at=now() WHERE id=$1", [test.id]);
    await refreshTest(client,test);
  });
}
export async function cancelPlacementTest(campaignId: string, testId: string) {
  return withLock(async client => {
    const result = await client.query("UPDATE campaign_placement_tests SET status='cancelled',error='Stopped by administrator. Already accepted messages cannot be recalled; no credit refund is assumed.' WHERE id=$1 AND campaign_id=$2", [testId,campaignId]);
    if (!result.rowCount) throw new PlacementError("Placement test not found", 404);
  });
}

// Test mail bypasses the prospect queue only while outreach is paused. It goes solely to provider-returned seeds.
// Claims are durable before SMTP, so a restart or uncertain SMTP outcome never automatically resends a copy.
export async function processPlacementTests() {
  if (!glockConfig().configured) return;
  await withLock(async client => {
    await client.query("UPDATE campaign_placement_messages SET send_status='unknown' WHERE send_status='sending' AND attempted_at<now()-interval '10 minutes'");
    await client.query("UPDATE campaign_placement_tests SET status='attention',error='Preparation was interrupted; inspect GlockApps before retrying.' WHERE status='creating' AND created_at<now()-interval '10 minutes'");
    const { rows } = await client.query<TestRow>("SELECT * FROM campaign_placement_tests WHERE status IN ('queued','awaiting_placement') ORDER BY created_at LIMIT 1");
    const test = rows[0];
    if (!test) return;
    if (Date.now() - new Date(test.created_at).getTime() > 24 * 3600_000) {
      await client.query("UPDATE campaign_placement_tests SET status='attention',error='Test expired. Remaining copies were not sent.' WHERE id=$1", [test.id]);
      return;
    }
    const settings = await getDeliverabilitySettings();
    if (settings.outreachAutopilotPaused && test.status === "queued") {
      const counts = await client.query<{ hourly: number; daily: number }>(`SELECT count(*) FILTER(WHERE at>now()-interval '1 hour')::int AS hourly,count(*)::int AS daily FROM (
        SELECT attempted_at AS at FROM campaign_placement_messages WHERE attempted_at>now()-interval '24 hours'
        UNION ALL SELECT sent_at AS at FROM drip_sends WHERE channel='email' AND sent_at>now()-interval '24 hours'
      ) sends`);
      if (counts.rows[0].hourly < Math.min(15,settings.effectiveHourlyCap) && counts.rows[0].daily < Math.min(80,settings.effectiveDailyCap)) {
        const claimed = await client.query<{ email: string }>(`UPDATE campaign_placement_messages SET send_status='sending',attempted_at=now() WHERE test_id=$1 AND NOT EXISTS(SELECT 1 FROM campaign_placement_messages WHERE attempted_at>now()-interval '5 minutes') AND email=(SELECT email FROM campaign_placement_messages WHERE test_id=$1 AND send_status='queued' ORDER BY email LIMIT 1) RETURNING email`, [test.id]);
        const email = claimed.rows[0]?.email;
        if (email) {
          const personalize = makePersonalize("Alex Morgan", email, "");
          const result = await sendEmailFromSender(test.snapshot.sender,email,personalize(test.snapshot.subject),personalize(test.snapshot.bodyHtml),undefined,undefined,{
            minimalSignature: true, previewText: personalize(test.snapshot.previewText), placementTestHeader: test.provider_header!,
            messageId: `<placement-${test.id}-${createHash("sha256").update(email).digest("hex").slice(0,12)}@newdawnfranchising.com>`,
            onPrepared: async html => { await client.query("UPDATE campaign_placement_messages SET rendered_html=$3 WHERE test_id=$1 AND email=$2", [test.id,email,html]); },
          });
          await client.query("UPDATE campaign_placement_messages SET send_status=$3 WHERE test_id=$1 AND email=$2", [test.id,email,result.success ? "accepted" : "unknown"]);
          if (!result.success) {
            await client.query("UPDATE campaign_placement_tests SET status='attention',error='The sender did not confirm acceptance. Sending stopped; inspect the sending mailbox before retrying.' WHERE id=$1", [test.id]);
            return;
          }
        }
      }
    }
    if (!test.checked_at || Date.now() - new Date(test.checked_at).getTime() >= 5 * 60_000) {
      try { await refreshTest(client,test); }
      catch (error) { await client.query("UPDATE campaign_placement_tests SET checked_at=now(),error=$2 WHERE id=$1", [test.id,error instanceof PlacementError ? error.message : "Could not refresh placement. Existing observations are retained."]); }
    }
  });
}
