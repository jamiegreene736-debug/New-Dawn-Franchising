/**
 * Sender health + legacy-blast pause helpers. No network required.
 */
import {
  isSenderAuthFailure,
  isRecipientFailure,
  isTerminalDripSend,
  isSenderDisabled,
  markSenderAuthFailure,
  markSenderSuccess,
  allSendersDisabled,
  _resetSenderHealthForTests,
} from "./sender-health";
import { shouldPauseLegacyBlast } from "./legacy-campaign-pause";
import { chooseSenderForKey } from "./email-service";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("error classification:");
  assert(
    "535 is sender auth",
    isSenderAuthFailure("Invalid login: 535-5.7.8 Username and Password not accepted."),
  );
  assert(
    "534 browser challenge is sender auth",
    isSenderAuthFailure("Invalid login: 534-5.7.9 Please log in with your web browser and then try again."),
  );
  assert("553 invalid address is recipient", isRecipientFailure("Can't send mail: 553-5.1.3 not a valid RFC 5321"));
  assert("auth is not recipient", !isRecipientFailure("Invalid login: 535-5.7.8 Username and Password not accepted."));
  assert("empty is neither", !isSenderAuthFailure("") && !isRecipientFailure(""));

  console.log("terminal send:");
  assert("sent is terminal", isTerminalDripSend({ status: "sent" }));
  assert("skipped is terminal", isTerminalDripSend({ status: "skipped" }));
  assert(
    "auth fail is retryable",
    !isTerminalDripSend({
      status: "failed",
      errorMessage: "Invalid login: 535-5.7.8 Username and Password not accepted.",
    }),
  );
  assert(
    "bad address fail is terminal",
    isTerminalDripSend({
      status: "failed",
      errorMessage: "553-5.1.3 The recipient address is not a valid RFC 5321",
    }),
  );
  assert("pending is not terminal", !isTerminalDripSend({ status: "pending" }));

  console.log("legacy blast pause:");
  assert(
    "Aug 21 Grok clone pauses",
    shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-08-21 · immigration attorney + wealth manager"),
  );
  assert(
    "Aug 27 quality-gate stays",
    !shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-08-27 · immigration attorney + wealth manager"),
  );
  assert(
    "Aug 28 stays",
    !shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-08-28 · business broker + immigration attorney"),
  );
  assert("GlobeVisa pauses", shouldPauseLegacyBlast("GlobeVisa Apollo List Grok2.0 for Brokers"));
  assert("undated Grok template pauses", shouldPauseLegacyBlast("Grok 2.0 - for brokers"));
  assert("unrelated campaign stays", !shouldPauseLegacyBlast("Partner webinar follow-up"));

  console.log("in-memory disable:");
  _resetSenderHealthForTests();
  assert("fresh sender is healthy", !isSenderDisabled("franchising@newdawnfranchising.com"));
  await markSenderAuthFailure(
    "franchising@newdawnfranchising.com",
    "Invalid login: 535-5.7.8 Username and Password not accepted.",
  );
  assert("535 disables sender", isSenderDisabled("franchising@newdawnfranchising.com"));
  assert(
    "all disabled when only that mailbox listed",
    allSendersDisabled(["franchising@newdawnfranchising.com"]),
  );
  await markSenderSuccess("franchising@newdawnfranchising.com");
  assert("success clears disable", !isSenderDisabled("franchising@newdawnfranchising.com"));
  await markSenderAuthFailure("info@newdawnfranchising.com", "421 Temporary System Problem");
  assert("421 does not disable", !isSenderDisabled("info@newdawnfranchising.com"));

  console.log("chooseSenderForKey:");
  _resetSenderHealthForTests();
  const picked = chooseSenderForKey("enrollment-key-1", false);
  assert("rotation off uses franchising@", picked === "franchising@newdawnfranchising.com");

  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nAll sender-health tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
