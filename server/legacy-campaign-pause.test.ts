/**
 * Date-gate for pausing pre-quality-gate clones. No network, no DB.
 */
import { shouldPauseLegacyBlast } from "./legacy-campaign-pause";

let failures = 0;
function assert(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

console.log("shouldPauseLegacyBlast:");
assert("Jul 25 pauses", shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-07-25 · immigration attorney + business broker"));
assert("Aug 26 pauses", shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-08-26 · business broker + franchise broker"));
assert("Aug 27 keeps", !shouldPauseLegacyBlast("Grok 2.0 Brokers — 2026-08-27 · immigration attorney + wealth manager"));
assert("GlobeVisa 50-test pauses", shouldPauseLegacyBlast("GlobeVisa - Brokers - 50 Contacts Test"));
assert("Sample pauses", shouldPauseLegacyBlast("Sample Campaign"));
assert("empty name stays", !shouldPauseLegacyBlast(""));

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll legacy-campaign-pause tests passed.");
