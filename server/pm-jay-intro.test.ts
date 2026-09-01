/**
 * Dylan's one-click CRM follow-up: introduce Jay Carpenter from the Texas PM team.
 */
import { buildPmJayIntroEmail, firstNameFromFullName, JAY_PM_EMAIL, JAY_PM_NAME } from "./email-service";

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

  console.log("Jay identity:");
  assert("full name", JAY_PM_NAME === "Jay Carpenter");
  assert("email", JAY_PM_EMAIL === "jay@newdawnfranchising.com");

  console.log("intro copy:");
  const email = buildPmJayIntroEmail("Juan Chavez");
  assert("subject names Jay", /Jay/.test(email.subject) && !/John/.test(email.subject));
  assert("greets first name", email.bodyHtml.includes("Hi Juan"));
  assert("hello / nice to meet you", /nice to meet you/i.test(email.bodyHtml));
  assert("introduces Jay Carpenter", /introduce <strong>Jay Carpenter<\/strong>/.test(email.bodyHtml));
  assert("Texas onsite PM", /onsite property management team down in Texas/.test(email.bodyHtml));
  assert("Jay is copied to follow up", /copied Jay/.test(email.bodyHtml) && /reply-all/.test(email.bodyHtml));
  assert("plain text matches", /Hi Juan/.test(email.bodyText) && /Jay Carpenter/.test(email.bodyText) && /copied Jay/.test(email.bodyText));
  assert("escapes HTML in name", buildPmJayIntroEmail(`<img src=x>`).bodyHtml.includes("Hi &lt;img"));
  assert("no leftover John", !/John/.test(email.bodyHtml) && !/John/.test(email.bodyText));

  if (failures) {
    console.error(`\n${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nall passed");
}

main();
