/**
 * Dylan's one-click CRM follow-up: introduce John from the Texas PM team.
 */
import { buildPmJohnIntroEmail, firstNameFromFullName, johnPmIntroCc } from "./email-service";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function main() {
  console.log("first name:");
  assert("uses first token", firstNameFromFullName("Juan Chavez") === "Juan");
  assert("falls back when empty", firstNameFromFullName("   ") === "there");
  assert("falls back when missing", firstNameFromFullName(undefined) === "there");

  console.log("intro copy:");
  const email = buildPmJohnIntroEmail("Juan Chavez");
  assert("subject names John", /John/.test(email.subject));
  assert("greets first name", email.bodyHtml.includes("Hi Juan"));
  assert("hello / nice to meet you", /nice to meet you/i.test(email.bodyHtml));
  assert("introduces John", /introduce <strong>John<\/strong>/.test(email.bodyHtml));
  assert("Texas onsite PM", /onsite property management team down in Texas/.test(email.bodyHtml));
  assert("John will reach out", /John will reach out/.test(email.bodyHtml));
  assert("plain text matches", /Hi Juan/.test(email.bodyText) && /John will reach out/.test(email.bodyText));
  assert("escapes HTML in name", buildPmJohnIntroEmail(`<img src=x>`).bodyHtml.includes("Hi &lt;img"));

  const ccVersion = buildPmJohnIntroEmail("Juan Chavez", { ccJohn: true });
  assert("CC copy mentions reply-all", /copied John/.test(ccVersion.bodyHtml) && /reply-all/.test(ccVersion.bodyHtml));
  assert("CC copy does not say John will reach out separately", !/John will reach out/.test(ccVersion.bodyHtml));

  console.log("JOHN_PM_EMAIL:");
  const prev = process.env.JOHN_PM_EMAIL;
  delete process.env.JOHN_PM_EMAIL;
  assert("unset is undefined", johnPmIntroCc() === undefined);
  process.env.JOHN_PM_EMAIL = "not-an-email";
  assert("invalid is undefined", johnPmIntroCc() === undefined);
  process.env.JOHN_PM_EMAIL = "john@newdawnfranchising.com";
  assert("valid is returned", johnPmIntroCc() === "john@newdawnfranchising.com");
  if (prev === undefined) delete process.env.JOHN_PM_EMAIL;
  else process.env.JOHN_PM_EMAIL = prev;

  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nall passed");
}

main();
