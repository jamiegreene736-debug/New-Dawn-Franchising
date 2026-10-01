import assert from "node:assert/strict";
import test from "node:test";
import { greetingName, nextEmailAllowedAt, preferFirstContact } from "../server/drip-scheduling";

const day = 86_400_000;
const sentAt = new Date("2026-10-01T14:00:00Z");
const steps = [{ id: "intro", delayDays: 0 }, { id: "follow", delayDays: 3 }, { id: "last", delayDays: 7 }];
const send = { stepId: "intro", channel: "email", sentAt };

test("80 accepted emails allocate 48 first introductions and 32 follow-ups", () => {
  let first = 0;
  for (let total = 0; total < 80; total++) if (preferFirstContact(first, total)) first++;
  assert.equal(first, 48);
});
test("rolling counts prioritize untouched contacts after old sequences consumed capacity", () => {
  assert.equal(preferFirstContact(0, 49), true);
  assert.equal(preferFirstContact(48, 79), false);
  assert.equal(preferFirstContact(15, 15), false);
});
test("late enrollment does not collapse a three-day follow-up delay", () => {
  assert.equal(nextEmailAllowedAt(steps[1], steps, [send], sentAt), sentAt.getTime() + 3 * day);
  assert.equal(nextEmailAllowedAt(steps[2], steps, [send], sentAt), sentAt.getTime() + 7 * day);
});
test("later actual follow-up moves subsequent emails forward", () => {
  const later = new Date(sentAt.getTime() + 5 * day);
  assert.equal(nextEmailAllowedAt(steps[2], steps, [send, { ...send, stepId: "follow", sentAt: later }], later), later.getTime() + 4 * day);
});
test("duplicate campaigns and same-day email steps share a 24-hour minimum", () => {
  assert.equal(nextEmailAllowedAt(steps[0], steps, [], sentAt), sentAt.getTime() + day);
  assert.equal(nextEmailAllowedAt({ id: "follow", delayDays: 0 }, steps, [send], sentAt), sentAt.getTime() + day);
});
test("tasks and unsuccessful attempts do not postpone first contact", () => {
  assert.equal(nextEmailAllowedAt(steps[1], steps, [{ ...send, channel: "linkedin" }, { ...send, sentAt: null }], undefined), 0);
});
test("invalid personal names fall back to a neutral greeting", () => {
  for (const name of ["New Dawn Development Team", "Development Team", "Smith Immigration Law", "info@example.com", "{{name}}", ""]) {
    assert.deepEqual(greetingName(name), { firstName: "there", fullName: "there" });
  }
  assert.deepEqual(greetingName("Dr. María O'Neil"), { firstName: "María", fullName: "María O'Neil" });
  assert.deepEqual(greetingName("Karina Navarro"), { firstName: "Karina", fullName: "Karina Navarro" });
});
