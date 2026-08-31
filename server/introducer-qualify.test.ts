/**
 * Introducer gate + first-touch language + named-account helpers.
 * No network, no DB.
 */
import {
  qualifyIntroducer,
  hasE2PracticeSignal,
  hasSeniority,
  firstTouchLang,
  looksLikePersonName,
} from "./introducer-qualify";
import { isNamedAccountDomain, namedAccountsForCountries, hunterQueriesForAccounts, NAMED_ACCOUNT_SEED } from "./named-accounts";
import { isParallelOutreachEnabled, linkedInDailyQueueCap } from "./outreach-owner";
import { FIRST_TOUCH, isFirstEmailStep } from "@shared/first-touch";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("qualifyIntroducer:");
const partner = qualifyIntroducer({
  fullName: "Maria Lopez",
  title: "Managing Partner",
  company: "Lopez Immigration",
  email: "maria@lopezimmigration.com",
  website: "https://lopezimmigration.com",
  category: "immigration_attorney",
  country: "Mexico",
  notes: "E-2 treaty investor petitions for Mexican entrepreneurs",
});
assert("E-2 partner attorney passes", partner.pass, JSON.stringify(partner));

const usCounsel = qualifyIntroducer({
  fullName: "James Wright",
  title: "Partner",
  company: "Wright Immigration Law",
  email: "james@wrightimmigration.com",
  category: "immigration_attorney",
  country: "United States",
  notes: "employment and investor visas",
});
assert("US immigration partner passes without E-2 in notes", usCounsel.pass, JSON.stringify(usCounsel));
assert("score is a number", Number.isFinite(partner.score));

const generic = qualifyIntroducer({
  fullName: "John Smith",
  title: "Associate",
  company: "Smith Family Law",
  email: "john@smithfamilylaw.com",
  category: "immigration_attorney",
  country: "United States",
  notes: "family-based green cards and removal defense",
});
assert("family-law associate fails", !generic.pass);

const investor = qualifyIntroducer({
  fullName: "Alex Founder",
  title: "CEO",
  company: "SaaS Co",
  email: "alex@saas.com",
  country: "United Kingdom",
  notes: "looking to buy a US business",
});
assert("end-investor fails partner gate", !investor.pass);

const wealth = qualifyIntroducer({
  fullName: "Priya Shah",
  title: "Managing Director",
  company: "Shah Family Office",
  website: "https://shahfo.com",
  category: "wealth_manager",
  country: "UAE",
});
assert("wealth manager category passes practice filter", hasE2PracticeSignal({ category: "wealth_manager" }));
assert("wealth MD is senior", hasSeniority({ fullName: "Priya Shah", title: "Managing Director", category: "wealth_manager" }));
assert("wealth manager with website passes", wealth.pass, JSON.stringify(wealth));

assert("named account skips practice text", hasE2PracticeSignal({ namedAccount: true, category: "other" }));
assert("firm name is not a person", !looksLikePersonName("Lopez Immigration LLP"));
assert("person name detected", looksLikePersonName("Maria Lopez"));

console.log("firstTouchLang:");
assert("Mexico → es", firstTouchLang("Mexico City", "Mexico") === "es");
assert("Korea → ko", firstTouchLang("Seoul", "South Korea") === "ko");
assert("Houston → en", firstTouchLang("Houston", "United States") === "en");

console.log("FIRST_TOUCH:");
assert("EN has no fee in email 1", !/12\.5%|\$28,125|referral fee/i.test(FIRST_TOUCH.en.bodyText));
assert("ES has no fee in email 1", !/12\.5%|\$28,125|comisi[oó]n/i.test(FIRST_TOUCH.es.bodyText));
assert("KO has no fee in email 1", !/12\.5%|\$28,125/.test(FIRST_TOUCH.ko.bodyText));
assert("stepOrder 2 is first email", isFirstEmailStep({ stepOrder: 2, stepType: "email" }));
assert("later email is not first", !isFirstEmailStep({ stepOrder: 5, stepType: "email" }));

console.log("named accounts:");
assert("seed has 40+ firms", NAMED_ACCOUNT_SEED.length >= 40);
assert("visafranchise is named", isNamedAccountDomain("https://www.visafranchise.com/team"));
assert("Mexico list is non-empty", namedAccountsForCountries(["Mexico"]).length > 0);
assert("hunter queries use bare domains", hunterQueriesForAccounts(namedAccountsForCountries(["South Korea"], 3)).every((q) => !q.query.includes(" ")));

console.log("outreach owner:");
assert("parallel off by default", !isParallelOutreachEnabled({} as NodeJS.ProcessEnv));
assert("parallel on with true", isParallelOutreachEnabled({ PARALLEL_OUTREACH: "true" } as NodeJS.ProcessEnv));
assert("linkedin cap default 25", linkedInDailyQueueCap({} as NodeJS.ProcessEnv) === 25);
assert("linkedin cap override", linkedInDailyQueueCap({ LINKEDIN_DAILY_QUEUE_CAP: "10" } as NodeJS.ProcessEnv) === 10);

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nintroducer-qualify tests passed");
