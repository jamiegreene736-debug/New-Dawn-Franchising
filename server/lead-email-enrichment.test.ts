/**
 * Focused verification for the daily-campaign email enrichment fix.
 * Exercises enrichLeadEmail with an injected (mocked) Hunter surface so the
 * finder→pattern fallback is proven without touching the network or the DB.
 */
import { enrichLeadEmail, domainFromWebsite, type EmailFinderDeps } from "./lead-email-enrichment";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// A Hunter mock whose behaviour is configured per test, and that records calls.
function makeDeps(cfg: {
  finder?: { email: string } | null;
  pattern?: string | null;
}): EmailFinderDeps & { calls: { find: number; pattern: number } } {
  const calls = { find: 0, pattern: 0 };
  return {
    calls,
    async findEmail() {
      calls.find++;
      return cfg.finder
        ? { email: cfg.finder.email, confidence: 95, pattern: null, status: "valid" }
        : null;
    },
    async domainPattern() {
      calls.pattern++;
      return cfg.pattern ?? null;
    },
    buildFromPattern(first: string, last: string, domain: string, pattern: string) {
      const f = first.toLowerCase(), l = last.toLowerCase();
      return pattern
        .replace("{first}", f).replace("{last}", l)
        .replace("{f}", f[0] || "").replace("{l}", l[0] || "")
        .replace("{first.last}", `${f}.${l}`).replace("{f.last}", `${f[0]}.${l}`)
        .concat(`@${domain}`);
    },
  };
}

async function main() {
  console.log("domainFromWebsite:");
  assert("bare firm domain", domainFromWebsite("smithlaw.com") === "smithlaw.com");
  assert("peels www", domainFromWebsite("https://www.smithlaw.com/about") === "smithlaw.com");
  assert("peels careers sub-domain", domainFromWebsite("careers.smithlaw.com") === "smithlaw.com");
  assert("rejects directory site (avvo)", domainFromWebsite("https://www.avvo.com/attorneys/x") === null);
  assert("rejects linkedin", domainFromWebsite("https://linkedin.com/in/jane") === null);
  assert("blank → null", domainFromWebsite("") === null && domainFromWebsite(null) === null);

  console.log("enrichLeadEmail — happy path (finder hits):");
  {
    const d = makeDeps({ finder: { email: "jane.doe@smithlaw.com" } });
    const email = await enrichLeadEmail({ fullName: "Jane Doe", website: "smithlaw.com" }, d);
    assert("returns finder email", email === "jane.doe@smithlaw.com", `got ${email}`);
    assert("does not call pattern fallback", d.calls.pattern === 0);
  }

  console.log("enrichLeadEmail — THE FIX: finder misses, pattern fallback recovers:");
  {
    const d = makeDeps({ finder: null, pattern: "{first}.{last}" });
    const email = await enrichLeadEmail({ fullName: "Jane Doe", website: "https://www.smithlaw.com" }, d);
    assert("constructs email from firm pattern", email === "jane.doe@smithlaw.com", `got ${email}`);
    assert("tried finder first", d.calls.find === 1);
    assert("fell back to domain pattern", d.calls.pattern === 1);
  }

  console.log("enrichLeadEmail — finder misses AND no pattern → null (unchanged):");
  {
    const d = makeDeps({ finder: null, pattern: null });
    const email = await enrichLeadEmail({ fullName: "Jane Doe", website: "smithlaw.com" }, d);
    assert("no email available", email === null, `got ${email}`);
  }

  console.log("enrichLeadEmail — guards (no wasted Hunter calls):");
  {
    const d = makeDeps({ finder: { email: "x@y.com" }, pattern: "{first}" });
    const noSite = await enrichLeadEmail({ fullName: "Jane Doe", website: "https://avvo.com/x" }, d);
    assert("directory website → null, no Hunter call", noSite === null && d.calls.find === 0);
  }
  {
    const d = makeDeps({ finder: { email: "x@y.com" }, pattern: "{first}" });
    const org = await enrichLeadEmail({ fullName: "Smith Immigration Law", website: "smithlaw.com" }, d);
    assert("org-name → null, no Hunter call", org === null && d.calls.find === 0);
  }
  {
    const d = makeDeps({ finder: { email: "x@y.com" }, pattern: "{first}" });
    const single = await enrichLeadEmail({ fullName: "Cher", website: "smithlaw.com" }, d);
    assert("single-word name → null, no Hunter call", single === null && d.calls.find === 0);
  }

  console.log("");
  if (failures) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("All assertions passed.");
}

main();
