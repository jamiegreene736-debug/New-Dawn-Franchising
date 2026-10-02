import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_TEMPLATES, templateStepValues } from "../shared/campaign-templates";
import { smsPermissionIssue, inTemplateSmsWindow, templateTouchAllowedAt, templateSmsContentIssue } from "../server/campaign-template-safety";
import { smsPermissionSchema, templateCreateSchema } from "../server/campaign-template-routes";
import { sequenceIssue } from "../server/outreach-readiness";
import { makePersonalize } from "../server/campaign-personalization";

const now = new Date("2026-10-01T15:00:00Z");
const permission = { consented_at: "2026-09-01T15:00:00Z", revoked_at: null, source: "Signed website form", disclosure: "New Dawn marketing texts about business review resources", evidence: "Signed opt-in reference 1234", timezone: "America/New_York" };

test("three audience-specific templates produce only timed email and text steps", () => {
  assert.deepEqual(CAMPAIGN_TEMPLATES.map(t => t.audience), ["broker", "attorney", "client"]);
  for (const template of CAMPAIGN_TEMPLATES) {
    const steps = templateStepValues(template, true);
    assert.deepEqual(steps.map(s => s.delayDays), [0,4,7,11,16,21]);
    assert.deepEqual(steps.map(s => s.stepType), ["email","email","sms","email","sms","email"]);
    assert.ok(steps.every(s => s.triggerType === "time"));
    assert.ok(steps.filter(s => s.stepType === "sms").every(s => s.bodyHtml.includes("New Dawn") && s.bodyHtml.includes("Reply STOP")));
  }
  assert.notEqual(CAMPAIGN_TEMPLATES[0].steps[0].body, CAMPAIGN_TEMPLATES[1].steps[0].body);
  assert.match(CAMPAIGN_TEMPLATES[1].steps[3].body, /no attorney referral compensation/);
});
test("email-only copies retain offsets and contiguous step orders", () => {
  const steps = templateStepValues(CAMPAIGN_TEMPLATES[2], false);
  assert.deepEqual(steps.map(s => s.delayDays), [0,4,11,21]);
  assert.deepEqual(steps.map(s => s.stepOrder), [1,2,3,4]);
  assert.ok(steps.every(s => s.stepType === "email"));
});
test("copy includes usable subjects, preview text, supported merge fields and commercial disclosure", () => {
  for (const template of CAMPAIGN_TEMPLATES) for (const step of templateStepValues(template, true)) {
    const rendered = makePersonalize("Karina Navarro", "karina@example.com", "")(step.bodyHtml);
    assert.doesNotMatch(rendered, /\{\{|\}\}/);
    assert.match(rendered, /Karina/);
    if (step.stepType === "email") {
      assert.ok(step.subject.length > 0 && step.subject.length < 50);
      assert.ok(step.previewText && step.previewText.length <= 150);
      assert.doesNotMatch(step.subject, /^Re:|^Fwd:/i);
      assert.match(rendered, /Commercial message/);
    }
  }
});
test("missing, revoked, incomplete and future consent cannot enable a text", () => {
  assert.equal(smsPermissionIssue(permission, now), null);
  assert.ok(smsPermissionIssue(undefined, now));
  for (const change of [{ revoked_at: now }, { consented_at: "2027-01-01" }, { disclosure: "Email consent only" }, { evidence: "" }, { timezone: "unknown" }])
    assert.ok(smsPermissionIssue({ ...permission, ...change }, now));
});
test("editing a text cannot remove sender identification or STOP instructions", () => {
  assert.equal(templateSmsContentIssue("New Dawn Franchising. Reply STOP to opt out."), null);
  assert.ok(templateSmsContentIssue("Reply STOP to opt out."));
  assert.ok(templateSmsContentIssue("New Dawn Franchising. Want the guide?"));
});
test("quiet hours apply in the recipient timezone across weekends and DST", () => {
  assert.equal(inTemplateSmsWindow("America/New_York", now), true);
  assert.equal(inTemplateSmsWindow("America/Los_Angeles", now), false);
  assert.equal(inTemplateSmsWindow("America/New_York", new Date("2026-10-01T20:00:00Z")), false);
  assert.equal(inTemplateSmsWindow("America/New_York", new Date("2026-10-03T15:00:00Z")), false);
  assert.equal(inTemplateSmsWindow("America/New_York", new Date("2026-11-02T15:00:00Z")), true);
  assert.equal(inTemplateSmsWindow("America/New_York", new Date("2026-11-02T14:59:00Z")), false);
  assert.equal(inTemplateSmsWindow("invalid", now), false);
});
test("delayed email or text cannot collapse the next touch's spacing", () => {
  const steps = [{ id: "email", delayDays: 4 }, { id: "sms", delayDays: 7 }, { id: "later", delayDays: 11 }];
  assert.equal(templateTouchAllowedAt(7, steps, [{ stepId: "email", channel: "email", sentAt: now }]), now.getTime() + 3*86400_000);
  assert.equal(templateTouchAllowedAt(11, steps, [{ stepId: "sms", channel: "sms", sentAt: now }]), now.getTime() + 4*86400_000);
  assert.equal(templateTouchAllowedAt(11, steps, [{ stepId: "sms", channel: "sms", sentAt: null }]), 0);
});
test("a four-email template policy preserves the existing three-email cold limit", () => {
  assert.equal(sequenceIssue(now, 3, now, "template_drip"), null);
  assert.ok(sequenceIssue(now, 4, now, "template_drip"));
  assert.ok(sequenceIssue(now, 3, now, "cold"));
  assert.ok(sequenceIssue("2026-07-01", 0, now, "template_drip"));
});
test("create requests reject active flags, invalid keys, oversized or empty names", () => {
  const valid = { name: "Broker review", includeSms: true, requestKey: "450c0785-e9f5-4d7a-b27a-96735f66c934" };
  assert.equal(templateCreateSchema.safeParse(valid).success, true);
  for (const input of [{ ...valid, isActive: true }, { ...valid, requestKey: "bad" }, { ...valid, name: " " }, { ...valid, name: "a".repeat(151) }, { ...valid, includeSms: "yes" }]) assert.equal(templateCreateSchema.safeParse(input).success, false);
});
test("permission records need a real number, known timezone and actual written proof", () => {
  const valid = { email: "person@example.com", phone: "+14155552671", consentedAt: "2026-09-01T15:00:00Z", source: permission.source, disclosure: permission.disclosure, evidence: permission.evidence, timezone: permission.timezone };
  assert.equal(smsPermissionSchema.safeParse(valid).success, true);
  for (const change of [{ phone: "person@example.com" }, { timezone: "unknown" }, { evidence: "yes" }, { disclosure: "Permission from a partner" }, { consentedAt: "2099-01-01T00:00:00Z" }]) assert.equal(smsPermissionSchema.safeParse({ ...valid, ...change }).success, false);
});
