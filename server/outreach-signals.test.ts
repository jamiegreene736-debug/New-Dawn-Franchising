import { test } from "node:test";
import assert from "node:assert/strict";
import { simpleParser } from "mailparser";
import { authoredReply, classifyReply, qualifiesForCall, replyEvidenceFromMetadata } from "./outreach-signals";
import { isAutomatedOrBulkEmail } from "./crm-email-filter";
import { channelEligibility } from "./outreach-desk/policy";

for (const body of ["Please call me tomorrow.", "Could you call me?", "Help me schedule a call.", "I'd like to book a meeting."]) {
  test(`explicit request: ${body}`, () => assert.equal(classifyReply(body), "call_requested"));
}
for (const body of ["Thanks!", "Interesting. What are the fees?", "Don't call me; email only.", "Please call me if your prices change.", 'My client said "please call me".', "Maybe we can schedule a call.", "Please call me. Actually, no—email is better."]) {
  test(`no call from ambiguous/general reply: ${body}`, () => assert.equal(classifyReply(body), "reply_received"));
}
test("classify only new reply, not quoted outreach", () => {
  assert.equal(classifyReply("Thank you\n\nOn Mon, Dylan wrote:\nPlease call me"), "reply_received");
  assert.equal(authoredReply("Thanks\n> Please call me"), "Thanks");
  assert.equal(classifyReply("Not interested. Please call me."), "declined");
  assert.equal(classifyReply("Unsubscribe"), "opt_out");
  assert.equal(classifyReply("STOP"), "opt_out");
  assert.equal(classifyReply("Please send the FDD."), "information_requested");
  assert.equal(classifyReply("[FDD Request]"), "information_requested");
  assert.equal(classifyReply("Please call me", "Automatic reply: away"), "automated");
});
test("call evidence must have an actual source and timestamp", () => {
  assert.equal(qualifiesForCall(), false);
  assert.equal(qualifiesForCall({ sourceId: "", text: "Please call me", receivedAt: new Date() }), false);
  assert.equal(qualifiesForCall({ sourceId: "id", text: "Please call me", receivedAt: new Date("invalid") }), false);
  assert.equal(replyEvidenceFromMetadata({ preview: "Please call me" }, new Date(), "id"), undefined);
});
test("MIME decoding does not mistake encoded text or HTML for intent", async () => {
  const parsed = await simpleParser('From: person@example.com\r\nSubject: Re: hello\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + Buffer.from('Please call me tomorrow.').toString('base64'));
  assert.equal(classifyReply(parsed.text || ""), "call_requested");
});
test("opt-out replies remain visible while automatic replies are excluded", () => {
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Unsubscribe", "", "Please unsubscribe me"), false);
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Re: hello", "Auto-Submitted: auto-replied", "Please call me"), true);
  assert.equal(isAutomatedOrBulkEmail("person@example.com", "Re: hello", "Auto-Submitted: no", "Please call me"), false);
});
test("unqualified tasks cannot dispatch; review tasks cannot call or text", () => {
  const context = { status: "needs_response", triggerType: "reply_received", phone: "+15125551212", email: "a@example.com", timezone: "America/New_York", permissions: {}, suppressed: false, booked: false, attemptCount: 0, nextAttemptAt: null, linkedinUrl: null };
  for (const channel of ["call", "sms", "whatsapp", "linkedin"] as const) assert.equal(channelEligibility(context, channel).allowed, false);
  assert.equal(channelEligibility({ ...context, status: "unqualified" }, "email").allowed, false);
});
