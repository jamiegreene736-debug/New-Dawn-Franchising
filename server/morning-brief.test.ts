import { formatYesterdayBrief } from "./morning-brief";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("formatYesterdayBrief:");
const quiet = formatYesterdayBrief({
  emailsSent: 0, emailsOpened: 0, peopleOpened: 0, textsSent: 0, campaigns: 0, replies: 0,
});
assert("quiet day", quiet === "Yesterday: no emails or texts went out.");

const full = formatYesterdayBrief({
  emailsSent: 42, emailsOpened: 11, peopleOpened: 9, textsSent: 6, campaigns: 3, replies: 2,
});
assert("opens + people + campaigns", full.includes("11 emails opened across 3 campaigns — 9 people"));
assert("texts sent, not opened", full.includes("6 texts sent"));
assert("emails sent", full.includes("42 emails sent"));
assert("replies", full.includes("2 replies"));
assert("no fake SMS opens", !/texts opened/i.test(full));

const singular = formatYesterdayBrief({
  emailsSent: 1, emailsOpened: 1, peopleOpened: 1, textsSent: 1, campaigns: 1, replies: 1,
});
assert("singular email opened", singular.includes("1 email opened"));
assert("singular person", singular.includes("1 person"));
assert("singular campaign", singular.includes("1 campaign"));
assert("singular text", singular.includes("1 text sent"));
assert("singular reply", singular.includes("1 reply"));

const opensOnly = formatYesterdayBrief({
  emailsSent: 0, emailsOpened: 4, peopleOpened: 3, textsSent: 0, campaigns: 2, replies: 0,
});
assert("opens without new sends still reports", opensOnly.startsWith("Yesterday 4 emails opened"));
assert("no sent line when zero sent", !opensOnly.includes("0 emails sent"));

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nmorning-brief tests passed");
