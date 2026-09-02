import {
  ENGAGED_OPEN_MIN,
  MAX_ATTEMPTS,
  calendlySmsBody,
  inferTimezone,
  inferTrack,
  isBlockingCrmStatus,
  isGoodCallWindow,
  isQueueableOpenSignal,
  isTerminalStatus,
  isUsablePhone,
  nextAttemptAt,
  phoneDigits,
  priorityForTrigger,
  shouldUpgradePriority,
  triggerLabel,
} from "./call-queue-helpers.ts";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function main() {
  console.log("signals:");
  assert("single open is not queueable", !isQueueableOpenSignal(1));
  assert("two opens still ignored", !isQueueableOpenSignal(2));
  assert("three opens is engaged", isQueueableOpenSignal(3));
  assert("engaged min is 3", ENGAGED_OPEN_MIN === 3);

  console.log("priority:");
  assert("click is 1", priorityForTrigger("link_click") === 1);
  assert("reply is 2", priorityForTrigger("reply_no_meeting") === 2);
  assert("engaged open is 3", priorityForTrigger("engaged_open") === 3);
  assert("upgrade click over open", shouldUpgradePriority(3, 1));
  assert("do not downgrade", !shouldUpgradePriority(1, 3));

  console.log("track:");
  assert("audienceType client", inferTrack("Grok Campaign", "client") === "client");
  assert("name contains Clients", inferTrack("Grok Campaign 2.0 - Clients", "broker") === "client");
  assert("broker default", inferTrack("Grok Campaign", "broker") === "broker");

  console.log("timezone:");
  assert("Texas → Chicago", inferTimezone("Austin, TX") === "America/Chicago");
  assert("California → LA", inferTimezone("Los Angeles") === "America/Los_Angeles");
  assert("New York default-east", inferTimezone("New York, NY") === "America/New_York");
  assert("empty → Eastern", inferTimezone(null) === "America/New_York");

  console.log("call window:");
  const tuesday10et = new Date("2026-09-01T14:00:00.000Z"); // 10:00 America/New_York
  const windowOk = isGoodCallWindow("America/New_York", tuesday10et);
  assert("Tue 10am ET is good", windowOk.ok);
  const saturday = new Date("2026-09-05T14:00:00.000Z");
  assert("Saturday is not good", !isGoodCallWindow("America/New_York", saturday).ok);

  console.log("phone:");
  assert("10-digit ok", isUsablePhone("3055551212"));
  assert("formatted ok", isUsablePhone("(305) 555-1212"));
  assert("email rejected", !isUsablePhone("pat@example.com"));
  assert("empty rejected", !isUsablePhone(""));
  assert("last10", phoneDigits("+1 (305) 555-1212") === "3055551212");

  console.log("cadence:");
  assert("max 3 attempts", MAX_ATTEMPTS === 3);
  assert("attempt 1 has a next time", nextAttemptAt(1) instanceof Date);
  assert("attempt 3 is done", nextAttemptAt(3) === null);

  console.log("labels / terminal:");
  assert("click label names subject", triggerLabel("link_click", "E-2 director model").includes("Clicked"));
  assert("booked is terminal", isTerminalStatus("booked"));
  assert("queued is not terminal", !isTerminalStatus("queued"));
  assert("meeting_scheduled blocks", isBlockingCrmStatus("meeting_scheduled"));
  assert("new does not block", !isBlockingCrmStatus("new"));

  console.log("sms copy:");
  const broker = calendlySmsBody("Maria Lopez", "broker", "https://calendly.com/dylan");
  const client = calendlySmsBody("Sam Lee", "client", "https://calendly.com/dylan");
  assert("broker sms mentions referral", broker.includes("referral"));
  assert("client sms mentions E-2", client.includes("E-2"));
  assert("uses first name", broker.startsWith("Hi Maria"));

  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nall call-queue helper tests passed");
}

main();
