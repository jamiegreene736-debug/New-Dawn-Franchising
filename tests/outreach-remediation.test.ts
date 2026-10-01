import assert from "node:assert/strict";
import test from "node:test";
import { qualificationIssue, sequenceIssue, campaignWindowIssue } from "../server/outreach-readiness";
import { campaignOutcomes } from "../server/campaign-metrics";
import { replyFolders, originalMessageIds } from "../server/mailbox-evidence";
import { qualifyIntroducer } from "../server/introducer-qualify";
const now = new Date("2026-10-01T16:00:00Z");
const qualified = { status: "approved", audience: "broker", source_url: "https://firm.example/e2", reason: "Your firm's practice includes U.S. E-2 investors.", role: "Partner", firm_domain: "firm.example", reviewed_at: now };
test("labels, stale reviews and wrong audiences do not qualify recipients", () => {
  assert.ok(qualificationIssue(undefined, "broker", now));
  assert.equal(qualificationIssue(qualified, "broker", now), null);
  assert.ok(qualificationIssue(qualified, "client", now));
  assert.ok(qualificationIssue({ ...qualified, reviewed_at: "2026-08-01" }, "broker", now));
  assert.ok(qualificationIssue({ ...qualified, reason: "Attorney" }, "broker", now));
  assert.equal(qualifyIntroducer({ fullName: "Jane Doe", title: "Programs Director", category: "business_broker", email: "jane@firm.example", namedAccount: true }).pass, false);
});
test("stale enrollment and excessive cross-campaign emails stay held", () => {
  assert.equal(sequenceIssue(now, 2, now), null);
  assert.ok(sequenceIssue(now, 3, now));
  assert.ok(sequenceIssue("2026-08-01", 0, now));
});
test("opt-outs cannot become positive replies; unverified bounces remain separate", () => {
  const base = { channel: "email", sentAt: now, status: "replied", recipientEmail: "one@firm.example" };
  const stats = campaignOutcomes([base, { ...base, replySignal: "opt_out" }, { ...base, recipientEmail: "two@firm.example", replySignal: "information_requested" }, { ...base, recipientEmail: "THREE@firm.example", status: "bounced" }, { ...base, recipientEmail: "three@firm.example", status: "sent" }]);
  assert.equal(stats.acceptedRecipients, 3);
  assert.equal(stats.positiveReplies, 1);
  assert.equal(stats.optOutReplies, 1);
  assert.equal(stats.verifiedBounces, 0);
  assert.equal(stats.legacyBounces, 1);
  assert.equal(campaignOutcomes([]).positiveReplyRate, null);
});
test("sync includes archived, spam and trash while deduplicating Inbox through All Mail", () => {
  assert.deepEqual(replyFolders([{ path: "INBOX" }, { path: "Archive", specialUse: "\\All" }, { path: "Spam", specialUse: "\\Junk" }, { path: "Trash", specialUse: "\\Trash" }]), ["Archive", "Spam", "Trash"]);
  assert.deepEqual(replyFolders([]), ["INBOX"]);
});
test("bounce attribution excludes the report's own Message-ID", () => {
  assert.deepEqual(originalMessageIds("Message-ID: <report@google.com>\r\n\r\nStatus: 5.1.1\r\nMessage-ID: <drip-original@newdawnfranchising.com>"), ["<drip-original@newdawnfranchising.com>"]);
  assert.deepEqual(originalMessageIds("Message-ID: <report@google.com>\n\nDelivery failed"), []);
});


test("broker nurture permits step ten but preserves cold limits and monthly review", () => {
  assert.equal(sequenceIssue("2026-07-03", 9, now, "broker_nurture_10"), null);
  assert.ok(sequenceIssue("2026-07-03", 10, now, "broker_nurture_10"));
  assert.ok(sequenceIssue("2026-05-01", 0, now, "broker_nurture_10"));
  assert.ok(sequenceIssue(now, 3, now, "unknown"));
  assert.ok(sequenceIssue("invalid", 0, now, "broker_nurture_10"));
  assert.ok(qualificationIssue({ ...qualified, reviewed_at: "2026-08-01" }, "broker", now));
});
test("broker window observes weekdays and daylight saving time", () => {
  for (const iso of ["2026-10-01T14:00:00Z", "2026-12-01T15:00:00Z"]) assert.equal(campaignWindowIssue("broker_nurture_10", new Date(iso)), null);
  for (const iso of ["2026-10-01T13:59:00Z", "2026-10-01T17:00:00Z", "2026-10-03T15:00:00Z", "2026-12-01T14:59:00Z"]) assert.ok(campaignWindowIssue("broker_nurture_10", new Date(iso)));
  assert.equal(campaignWindowIssue("cold", new Date("2026-10-03T15:00:00Z")), null);
});
