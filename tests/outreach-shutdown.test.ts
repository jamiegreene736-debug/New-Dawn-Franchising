import assert from "node:assert/strict";
import test, { mock } from "node:test";
import nodemailer from "nodemailer";
import express from "express";
import type { AddressInfo } from "node:net";
import approvalRouter from "../server/approval-routes";
import { pool } from "../server/db";
import { isLegacyOutreachDisabled, isParallelOutreachEnabled, OUTREACH_DISABLED_REASON } from "../server/outreach-owner";
import { isAutopilotEnabled } from "../server/outreach-autopilot-helpers";
import { sendAgentSms } from "../server/agent-sms-service";
import { sendEmailFromSender } from "../server/email-service";
import { runDailyPlanning, planDailyIntelligence, executeApprovedPlan } from "../server/outreach-intelligence-service";
import { runDailyPreparation, runDailyBrief, pollForApprovalReply, runApprovalDeadlineCheck, executeBatch, sendDailyBrief } from "../server/agent-service";
import { sendMorningDigest, sendWeeklyRollup } from "../server/approval-routes";
import { processDripEmails } from "../server/drip-processor";
import { processOneAction } from "../server/outreach-desk/worker";
import { processSequenceEvents } from "../server/broker-sequence-service";
import { processPartnerSequence } from "../server/partner-sequence-service";
import { approveAndSendTouch, runOutreachCampaignLoop } from "../server/outreach-agent-service";

test("shutdown overrides legacy enable flags", () => {
  for (const value of ["true", "1", "on", "YES", " true "]) {
    const env = { OUTREACH_DISABLED: value, OUTREACH_AUTOPILOT: "true", PARALLEL_OUTREACH: "true" };
    assert.equal(isLegacyOutreachDisabled(env), true);
    assert.equal(isAutopilotEnabled(env), false);
    assert.equal(isParallelOutreachEnabled(env), false);
  }
  assert.equal(isLegacyOutreachDisabled({}), false);
  assert.equal(isLegacyOutreachDisabled({ OUTREACH_DISABLED: "false" }), false);
});

test("shutdown blocks scheduled work, old approvals and phone texts before any external work", async () => {
  const previous = process.env.OUTREACH_DISABLED;
  process.env.OUTREACH_DISABLED = "true";
  const unexpected = () => { throw new Error("Unexpected external operation during shutdown"); };
  const fetchMock = mock.method(globalThis, "fetch", unexpected);
  const dbMock = mock.method(pool, "query", unexpected);
  const smtpMock = mock.method(nodemailer, "createTransport", unexpected);
  const dispatch = mock.fn(async () => ({ success: true }));
  try {
    for (const agent of ["outreach", "seo"] as const) {
      assert.deepEqual(await sendAgentSms(agent, "Should never be sent"), { success: false, error: OUTREACH_DISABLED_REASON });
    }
    assert.deepEqual(await sendEmailFromSender("dylan@newdawnfranchising.com", "test@example.com", "Test", "Test", undefined, undefined, { outreach: true }), { success: false, error: OUTREACH_DISABLED_REASON });
    await runDailyPlanning();
    await runDailyPreparation();
    await runDailyBrief();
    await pollForApprovalReply();
    await runApprovalDeadlineCheck();
    await sendMorningDigest();
    await sendWeeklyRollup();
    await processSequenceEvents();
    await processPartnerSequence();
    await processDripEmails({ force: true, templateTextsOnly: true });
    assert.equal(await sendDailyBrief("old-batch"), false);
    assert.equal(await processOneAction(dispatch), false);
    await assert.rejects(planDailyIntelligence(), { message: OUTREACH_DISABLED_REASON });
    await assert.rejects(executeApprovedPlan("old-plan"), { message: OUTREACH_DISABLED_REASON });
    await assert.rejects(executeBatch("old-batch"), { message: OUTREACH_DISABLED_REASON });
    assert.equal((await approveAndSendTouch("old-touch")).sent, false);
    assert.equal((await runOutreachCampaignLoop("old-campaign")).success, false);
    for (const spy of [fetchMock, dbMock, smtpMock, dispatch]) assert.equal(spy.mock.callCount(), 0);
  } finally {
    mock.restoreAll();
    if (previous === undefined) delete process.env.OUTREACH_DISABLED;
    else process.env.OUTREACH_DISABLED = previous;
  }
});


test("old approval and resume links return a disabled response without changing state", async () => {
  const previous = process.env.OUTREACH_DISABLED;
  process.env.OUTREACH_DISABLED = "true";
  const dbMock = mock.method(pool, "query", () => { throw new Error("Unexpected database mutation"); });
  const app = express();
  app.use(express.json());
  app.use("/api/approve", approvalRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    for (const [route, action] of [["plan", "approve"], ["plan", "resume_autopilot"], ["outreach", "approve"]]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/approve/${route}/old-token`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: OUTREACH_DISABLED_REASON });
    }
    assert.equal(dbMock.mock.callCount(), 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    dbMock.mock.restore();
    if (previous === undefined) delete process.env.OUTREACH_DISABLED;
    else process.env.OUTREACH_DISABLED = previous;
  }
});
