/**
 * Website-inbound lead classification used by the CRM Sources filter
 * and the retroactive "Website Leads" backfill.
 */
import {
  hasWebsiteFormMarker,
  inferWebsiteLeadSourceFromMessage,
  isNewsletterSignup,
  isWebsiteCrmClient,
  isWebsiteLeadSource,
  websiteLeadSourceLabel,
} from "../shared/website-leads.ts";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function main() {
  console.log("lead source set:");
  assert("website is inbound", isWebsiteLeadSource("website"));
  assert("brochure is inbound", isWebsiteLeadSource("brochure-investor"));
  assert("partner is inbound", isWebsiteLeadSource("partner-broker"));
  assert("newsletter is not inbound", !isWebsiteLeadSource("newsletter"));
  assert("apollo is not inbound", !isWebsiteLeadSource("apollo_sync"));
  assert("empty is not inbound", !isWebsiteLeadSource(""));
  assert("null is not inbound", !isWebsiteLeadSource(null));

  console.log("labels:");
  assert("website label", websiteLeadSourceLabel("website") === "Website");
  assert("brochure label", websiteLeadSourceLabel("brochure-investor") === "Investor brochure");
  assert("apollo has no website label", websiteLeadSourceLabel("apollo_sync") === null);

  console.log("message inference:");
  assert(
    "visitor type → website",
    inferWebsiteLeadSourceFromMessage("Visitor type: I'm an investor exploring the E-2 visa") === "website",
  );
  assert("FDD request → website", inferWebsiteLeadSourceFromMessage("[FDD Request]") === "website");
  assert("chat widget → website", inferWebsiteLeadSourceFromMessage("[Chat Widget] Call me") === "website");
  assert("embassy → website", inferWebsiteLeadSourceFromMessage("[Embassy Checker] Wait time inquiry — Mexico") === "website");
  assert(
    "investor brochure",
    inferWebsiteLeadSourceFromMessage("[Investor Brochure] Country: Mexico. Preferred language: English.") === "brochure-investor",
  );
  assert(
    "partner brochure",
    inferWebsiteLeadSourceFromMessage("[Partner / Broker Inquiry] Company: Acme.") === "partner-broker",
  );
  assert("newsletter excluded", inferWebsiteLeadSourceFromMessage("[Newsletter Signup] Subscribed via website footer") === null);
  assert("unmarked form row still website", inferWebsiteLeadSourceFromMessage("Looking at territories") === "website");
  assert("empty message still website", inferWebsiteLeadSourceFromMessage("") === "website");

  console.log("form markers:");
  assert("visitor type is a marker", hasWebsiteFormMarker("Visitor type: I'm an immigration attorney\nHello"));
  assert("FDD is a marker", hasWebsiteFormMarker("[FDD Request]"));
  assert("plain note is not a marker", !hasWebsiteFormMarker("Spoke on the phone yesterday"));
  assert("newsletter detected", isNewsletterSignup("[Newsletter Signup] Subscribed via website footer"));

  console.log("CRM client classification:");
  assert("source website", isWebsiteCrmClient({ leadSource: "website", notes: null }));
  assert("source brochure", isWebsiteCrmClient({ leadSource: "brochure-investor" }));
  assert("notes visitor type even without source", isWebsiteCrmClient({
    leadSource: null,
    notes: "Visitor type: I'm an investor exploring the E-2 visa",
  }));
  assert("newsletter source excluded", !isWebsiteCrmClient({
    leadSource: "newsletter",
    notes: "Subscribed via website footer",
  }));
  assert("newsletter notes excluded", !isWebsiteCrmClient({
    leadSource: null,
    notes: "[Newsletter Signup] Subscribed via website footer",
  }));
  assert("apollo contact excluded", !isWebsiteCrmClient({
    leadSource: "apollo_sync",
    notes: "Imported from Apollo",
  }));
  assert("empty client excluded", !isWebsiteCrmClient({ leadSource: null, notes: null }));

  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nall passed");
}

main();
