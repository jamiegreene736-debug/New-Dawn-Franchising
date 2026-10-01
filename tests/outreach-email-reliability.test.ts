import assert from "node:assert/strict";
import test, { mock } from "node:test";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { isAutomatedOrBulkEmail } from "../server/crm-email-filter";
import { campaignMessageId, findReplySend, isOptOutReply } from "../server/campaign-replies";
import { chooseSenderForKey, getAvailableSenders, sendEmail } from "../server/email-service";
import { processOne, emailQueue, type QueuedEmail } from "../server/core/email-queue";
import { BROKER_TRACK, BROKER_2_TRACK, CLIENT_TRACK } from "../shared/campaign-tracks";

import brokerEscrow from "../shared/broker-escrow-campaign.json";

const now = new Date("2026-09-30T12:00:00Z");
const sent = { id: "one", enrollmentId: "completed", subject: "Business options", status: "sent", channel: "email", sentAt: new Date("2026-09-20") };
test("human replies quoting unsubscribe footer are kept", () => {
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Re: Business options", "In-Reply-To: <original>", "Yes, please send it.\nOn Monday Dylan wrote:\nUnsubscribe"), false);
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Unsubscribe", "", "Please unsubscribe me"), false);
  assert.equal(isOptOutReply("Yes please\nOn Monday Dylan wrote:\nUnsubscribe"), false);
  assert.equal(isOptOutReply("Please remove me"), true);
  assert.equal(isOptOutReply("Yes, send the details.\n\nUnsubscribe from this mailing list"), false);
});
test("automated responses and newsletters remain excluded", () => {
  for (const head of ["Auto-Submitted: auto-replied", "Precedence: bulk", "List-Unsubscribe: <https://example.com>"]) {
    assert.equal(isAutomatedOrBulkEmail("person@example.com", "Re: Business options", head, "hello"), true);
  }
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Re: Business options", "Auto-Submitted: no", "hello"), false);
});
test("completed sequences can receive replies; unrelated and pre-send mail cannot", () => {
  assert.equal(findReplySend([sent], { subject: "Re: Business options", receivedAt: now, references: [] })?.id, "one");
  assert.equal(findReplySend([sent], { subject: "Lunch?", receivedAt: now, references: [] }), undefined);
  assert.equal(findReplySend([sent], { subject: "Re: Business options", receivedAt: new Date("2026-09-01"), references: [] }), undefined);
  assert.equal(findReplySend([{ ...sent, status: "failed" }], { subject: sent.subject, receivedAt: now, references: [] }), undefined);
});
test("message ID attributes exactly one campaign despite identical subjects", () => {
  const newer = { ...sent, id: "two", enrollmentId: "another", sentAt: new Date("2026-09-25") };
  assert.equal(findReplySend([sent, newer], { subject: "Edited subject", receivedAt: now, references: [campaignMessageId("one")] })?.id, "one");
  assert.equal(findReplySend([sent], { subject: sent.subject, receivedAt: now, references: [campaignMessageId("missing")] }), undefined);
});
test("MIME replies are decoded before filtering and storage", async () => {
  const parsed = await simpleParser(Buffer.from("From: person@example.com\r\nSubject: Re: Business options\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + Buffer.from("Yes, please send the overview.").toString("base64")));
  assert.equal(parsed.text?.trim(), "Yes, please send the overview.");
});
test("campaigns use Dylan regardless of old rotation setting", () => {
  assert.equal(chooseSenderForKey("a", true), "dylan@newdawnfranchising.com");
  assert.equal(chooseSenderForKey("b", false), "dylan@newdawnfranchising.com");
  assert.deepEqual(getAvailableSenders().map(p => p.email), ["dylan@newdawnfranchising.com"]);
});
test("campaign email copy has one reply ask, personal signoff and no investment promises", () => {
  for (const track of [BROKER_TRACK, BROKER_2_TRACK, CLIENT_TRACK]) for (const step of track.filter(s => s.stepType === "email")) {
    assert.ok(step.bodyText.split(/\s+/).length < 110);
    assert.match(step.bodyText, /Dylan$/);
    assert.doesNotMatch(step.bodyText, /\$|guarantee|hands.off|300\+|franchising@/i);
    assert.equal((step.bodyText.match(/\?/g) || []).length, 1);
  }
  assert.doesNotMatch(CLIENT_TRACK.find(s => s.stepType === "email")!.bodyText, /your clients|your practice/);
});
test("SMTP rejection queues a retry; accepted send uses Dylan From and Reply-To", async () => {
  process.env.GMAIL_APP_PASSWORD_DYLAN = "test-password";
  let reject = true;
  const envelopes: Record<string, unknown>[] = [];
  const fake = { sendMail: async (mail: Record<string, unknown>) => { envelopes.push(mail); return reject ? { rejected: ["person@example.com"], accepted: [] } : { accepted: ["person@example.com"], rejected: [], messageId: "ok" }; } };
  const transportMock = mock.method(nodemailer, "createTransport", () => fake as unknown as ReturnType<typeof nodemailer.createTransport>);
  const item: QueuedEmail = { id: "test", to: "person@example.com", subject: "Test", html: "Hello", priority: "NORMAL", attempts: 0, maxAttempts: 3, nextAttemptAt: now, createdAt: now };
  try {
    const before = emailQueue.size();
    await processOne(item);
    assert.equal(item.attempts, 1);
    assert.equal(emailQueue.size(), before + 1);
    assert.ok(item.nextAttemptAt.getTime() > Date.now());
    const exhausted = { ...item, id: "exhausted", attempts: 2 };
    const queuedBefore = emailQueue.size();
    await processOne(exhausted);
    assert.equal(exhausted.attempts, 3);
    assert.equal(emailQueue.size(), queuedBefore);
    reject = false;
    assert.equal((await sendEmail(item.to, item.subject, item.html)).success, true);
    assert.equal(envelopes.at(-1)?.from, '"Dylan Delaney" <dylan@newdawnfranchising.com>');
    assert.equal(envelopes.at(-1)?.replyTo, "dylan@newdawnfranchising.com");
    for (const step of brokerEscrow.steps) {
      let captured = "";
      assert.equal((await sendEmail(item.to, step.subject, step.bodyHtml, undefined, undefined, { minimalSignature: true, previewText: step.previewText, onPrepared: async html => { captured = html; } })).success, true);
      assert.equal(envelopes.at(-1)?.html, captured);
      assert.ok(captured.indexOf(step.previewText) < captured.indexOf("Hi {{firstName}}"));
      assert.doesNotMatch(captured, /api\/track\//);
      assert.ok(envelopes.at(-1)?.headers);
    }
    await sendEmail(item.to, "Escaping", "<p>Hello</p>", undefined, undefined, { previewText: '<img src="x"> & $&' });
    const html = String(envelopes.at(-1)?.html);
    assert.ok(html.includes("&lt;img src=&quot;x&quot;&gt; &amp; $&"));
    assert.doesNotMatch(html, /<img src="x">/);
  } finally { transportMock.mock.restore(); delete process.env.GMAIL_APP_PASSWORD_DYLAN; }
});

test("mailto opt-outs with a changed subject match the latest preceding send", () => {
  assert.equal(findReplySend([sent], { subject: "unsubscribe person@example.com", receivedAt: now, references: [], bodyText: "Unsubscribe" })?.id, "one");
  assert.equal(findReplySend([sent], { subject: "unsubscribe person@example.com", receivedAt: new Date("2026-09-01"), references: [], bodyText: "Unsubscribe" }), undefined);
});

test("broker escrow campaign is ten concise email-only touches with no speculative claims", () => {
  assert.deepEqual(brokerEscrow.steps.map(s => s.delayDays), [0,3,7,14,21,30,42,56,70,90]);
  for (const step of brokerEscrow.steps) {
    assert.equal(step.stepType, "email");
    assert.equal(step.triggerType, "time");
    assert.ok(step.bodyText.split(/\s+/).length < 100);
    assert.ok(step.subject.length < 50);
    assert.ok(step.previewText.length >= 40 && step.previewText.length <= 90);
    assert.doesNotMatch(step.bodyText, /risk.free|12\.5|300\+|guaranteed|100%/i);
  }
});
