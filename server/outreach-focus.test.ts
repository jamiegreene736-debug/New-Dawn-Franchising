/**
 * US immigration attorney focus helpers. No network, no DB.
 */
import {
  applyUsImmigrationFocusToPlan,
  getOutreachFocus,
  isImmigrationAttorneyPersona,
  isUsImmigrationAttorney,
  isUsImmigrationQuery,
  isUsLocation,
  namedAccountsForUsImmigration,
  pickUsCities,
} from "./outreach-focus";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("getOutreachFocus:");
assert("default is US attorneys", getOutreachFocus({}) === "us_immigration_attorneys");
assert("OUTREACH_FOCUS=all restores mix", getOutreachFocus({ OUTREACH_FOCUS: "all" }) === "all");

console.log("isUsLocation:");
assert("United States", isUsLocation("United States"));
assert("Houston TX", isUsLocation("Houston", "TX"));
assert("Mexico City is not US", !isUsLocation("Mexico City", "Mexico"));
assert("Seoul is not US", !isUsLocation("Seoul", "South Korea"));
assert("New Mexico is US", isUsLocation("Albuquerque", "New Mexico"));

console.log("persona:");
assert("category immigration_attorney", isImmigrationAttorneyPersona("immigration_attorney"));
assert("E-2 title", isImmigrationAttorneyPersona("", "E-2 Visa Attorney"));
assert("wealth manager is not", !isImmigrationAttorneyPersona("wealth_manager", "Managing Director"));

console.log("isUsImmigrationAttorney:");
assert(
  "Houston immigration partner",
  isUsImmigrationAttorney({
    category: "immigration_attorney",
    country: "United States",
    city: "Houston",
    title: "Partner",
  }),
);
assert(
  "Mexico attorney is out of focus",
  !isUsImmigrationAttorney({
    category: "immigration_attorney",
    country: "Mexico",
    city: "Mexico City",
  }),
);
assert(
  "US wealth manager is out of focus",
  !isUsImmigrationAttorney({
    category: "wealth_manager",
    country: "United States",
    city: "Dallas",
    title: "Managing Director",
  }),
);

console.log("queries:");
assert("keeps Houston E-2", isUsImmigrationQuery("immigration attorney E-2 visa Houston", "US attorneys"));
assert("drops Seoul", !isUsImmigrationQuery("immigration attorney — South Korea", "Angle 1 Seoul"));
assert("drops wealth manager Dallas", !isUsImmigrationQuery("wealth manager Dallas international clients"));

console.log("plan clamp:");
const clamped = applyUsImmigrationFocusToPlan({
  planSummary: "Mix of Korean brokers and Miami wealth managers",
  leadCategories: [
    { category: "wealth_manager", country: "United States", geoFocus: "Miami", reasoning: "x", estimatedLeads: 10, priority: "high" },
    { category: "immigration_attorney", country: "South Korea", geoFocus: "Seoul", reasoning: "x", estimatedLeads: 10, priority: "high" },
  ],
  searchQueries: [
    { query: "wealth manager Miami", source: "apollo", purpose: "HNW" },
    { query: "immigration attorney E-2 visa Houston", source: "serpapi", purpose: "US E-2 counsel" },
  ],
}, ["2026-08-30: immigration attorney · United States (Houston)"]);
assert("every category is US immigration", clamped.leadCategories!.every((c) => c.category === "immigration_attorney" && c.country === "United States"));
assert("no Seoul / wealth categories", !clamped.leadCategories!.some((c) => /seoul|wealth/i.test(c.geoFocus + c.category)));
assert("Houston rotated out", !clamped.leadCategories!.some((c) => /Houston/i.test(c.geoFocus)));
assert("keeps the Houston query or adds US ones", (clamped.searchQueries ?? []).some((q) => isUsImmigrationQuery(q.query, q.purpose) || q.source === "hunter"));
assert("drops wealth query", !(clamped.searchQueries ?? []).some((q) => /wealth manager/i.test(q.query)));
assert("summary names the focus", /US immigration/i.test(clamped.planSummary ?? ""));

console.log("named accounts:");
const us = namedAccountsForUsImmigration(5);
assert("US immigration seed is non-empty", us.length >= 5);
assert("all US immigration", us.every((a) => a.country === "United States" && a.category === "immigration_attorney"));

console.log("city rotation:");
assert("picks unused cities", pickUsCities(["Houston", "Dallas"], 3).every((c) => c !== "Houston" && c !== "Dallas"));

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll outreach-focus tests passed.");
