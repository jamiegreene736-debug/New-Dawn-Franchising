/**
 * Focused verification for the daily-campaign email enrichment waterfall.
 * Exercises enrichLeadEmail / findPeopleAtFirm with an injected (mocked)
 * provider surface so the Hunter→Apollo→PDL→verified-pattern order, the
 * alternate-pattern rescue, and the org-expansion path are proven without
 * touching the network or the DB.
 */
import {
  enrichLeadEmail,
  findPeopleAtFirm,
  domainFromWebsite,
  looksLikePersonName,
  type EmailFinderDeps,
} from "./lead-email-enrichment";
import type { HunterDomainSearchResult } from "./hunter-service";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// A provider mock whose behaviour is configured per test, and that records calls.
function makeDeps(cfg: {
  finder?: { email: string } | null;
  apollo?: { email: string } | null;
  pdl?: { work_email: string } | null;
  pattern?: string | null;
  domainEmails?: HunterDomainSearchResult["emails"];
  /** email → hunter verify result; missing key = verifier unavailable (null). */
  verify?: Record<string, "deliverable" | "undeliverable" | "risky">;
}): EmailFinderDeps & { calls: { find: number; apollo: number; pdl: number; domain: number; verify: string[] } } {
  const calls = { find: 0, apollo: 0, pdl: 0, domain: 0, verify: [] as string[] };
  return {
    calls,
    async findEmail() {
      calls.find++;
      return cfg.finder
        ? { email: cfg.finder.email, confidence: 95, pattern: null, status: "valid" }
        : null;
    },
    async apolloEnrich() {
      calls.apollo++;
      return cfg.apollo
        ? ({ email: cfg.apollo.email } as any)
        : null;
    },
    async pdlEnrich() {
      calls.pdl++;
      return cfg.pdl ? ({ work_email: cfg.pdl.work_email } as any) : null;
    },
    async domainSearch() {
      calls.domain++;
      if (cfg.pattern === undefined && !cfg.domainEmails) return null;
      return {
        pattern: cfg.pattern ?? null,
        organization: null,
        emails: cfg.domainEmails ?? [],
      };
    },
    async verifyEmail(email: string) {
      calls.verify.push(email);
      const result = cfg.verify?.[email];
      if (!result) return null; // verifier unavailable for this address
      return {
        email, result, status: result === "deliverable" ? "valid" : "invalid",
        score: 90, disposable: false, webmail: false, mxRecords: true, smtpServer: true,
      };
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

const JANE = { fullName: "Jane Doe", website: "smithlaw.com" };

async function main() {
  console.log("domainFromWebsite:");
  assert("bare firm domain", domainFromWebsite("smithlaw.com") === "smithlaw.com");
  assert("peels www", domainFromWebsite("https://www.smithlaw.com/about") === "smithlaw.com");
  assert("peels careers sub-domain", domainFromWebsite("careers.smithlaw.com") === "smithlaw.com");
  assert("rejects directory site (avvo)", domainFromWebsite("https://www.avvo.com/attorneys/x") === null);
  assert("rejects linkedin", domainFromWebsite("https://linkedin.com/in/jane") === null);
  assert("blank → null", domainFromWebsite("") === null && domainFromWebsite(null) === null);

  console.log("looksLikePersonName:");
  assert("person", looksLikePersonName("Jane Doe"));
  assert("org token → false", !looksLikePersonName("Smith Immigration Law"));
  assert("single word → false", !looksLikePersonName("Cher"));

  console.log("enrichLeadEmail — step 1 (Hunter finder hits):");
  {
    const d = makeDeps({ finder: { email: "jane.doe@smithlaw.com" } });
    const r = await enrichLeadEmail(JANE, d);
    assert("returns finder email", r?.email === "jane.doe@smithlaw.com", `got ${r?.email}`);
    assert("source is hunter_finder", r?.source === "hunter_finder");
    assert("no later providers called", d.calls.apollo === 0 && d.calls.pdl === 0 && d.calls.domain === 0);
  }

  console.log("enrichLeadEmail — step 2 (finder misses, Apollo hits):");
  {
    const d = makeDeps({ finder: null, apollo: { email: "jdoe@smithlaw.com" } });
    const r = await enrichLeadEmail(JANE, d);
    assert("returns apollo email", r?.email === "jdoe@smithlaw.com", `got ${r?.email}`);
    assert("source is apollo", r?.source === "apollo");
    assert("pdl/pattern not called", d.calls.pdl === 0 && d.calls.domain === 0);
  }

  console.log("enrichLeadEmail — step 3 (finder+Apollo miss, PDL hits):");
  {
    const d = makeDeps({ finder: null, apollo: null, pdl: { work_email: "jane@smithlaw.com" } });
    const r = await enrichLeadEmail(JANE, d);
    assert("returns pdl email", r?.email === "jane@smithlaw.com", `got ${r?.email}`);
    assert("source is pdl", r?.source === "pdl");
    assert("waterfall order: finder → apollo → pdl", d.calls.find === 1 && d.calls.apollo === 1 && d.calls.pdl === 1);
  }

  console.log("enrichLeadEmail — step 4 (pattern guess verifies deliverable):");
  {
    const d = makeDeps({
      pattern: "{first}.{last}",
      verify: { "jane.doe@smithlaw.com": "deliverable" },
    });
    const r = await enrichLeadEmail(JANE, d);
    assert("constructs email from firm pattern", r?.email === "jane.doe@smithlaw.com", `got ${r?.email}`);
    assert("source is hunter_pattern", r?.source === "hunter_pattern");
    assert("carries the verified verdict", r?.verifiedStatus === "valid");
  }

  console.log("enrichLeadEmail — step 4 rescue (primary guess dead, alternate pattern delivers):");
  {
    const d = makeDeps({
      pattern: "{f}{last}", // primary guess jdoe@ is undeliverable
      verify: {
        "jdoe@smithlaw.com": "undeliverable",
        "jane.doe@smithlaw.com": "deliverable",
      },
    });
    const r = await enrichLeadEmail(JANE, d);
    assert("rescued via alternate pattern", r?.email === "jane.doe@smithlaw.com", `got ${r?.email}`);
    assert("verified valid", r?.verifiedStatus === "valid");
    assert("primary guess was tried first", d.calls.verify[0] === "jdoe@smithlaw.com");
  }

  console.log("enrichLeadEmail — step 4: every candidate undeliverable → null:");
  {
    const d = makeDeps({
      pattern: "{first}.{last}",
      verify: {
        "jane.doe@smithlaw.com": "undeliverable",
        "jane@smithlaw.com": "undeliverable",
        "jdoe@smithlaw.com": "undeliverable",
        "janedoe@smithlaw.com": "undeliverable",
      },
    });
    const r = await enrichLeadEmail(JANE, d);
    assert("no usable address", r === null, `got ${r?.email}`);
    assert("verification capped at 3 candidates", d.calls.verify.length <= 3, `verified ${d.calls.verify.length}`);
  }

  console.log("enrichLeadEmail — step 4: verifier down → primary guess returned unverified:");
  {
    const d = makeDeps({ pattern: "{first}.{last}", verify: {} });
    const r = await enrichLeadEmail(JANE, d);
    assert("falls back to unverified primary guess", r?.email === "jane.doe@smithlaw.com", `got ${r?.email}`);
    assert("no verified verdict claimed", r?.verifiedStatus === undefined);
  }

  console.log("enrichLeadEmail — no pattern and all providers miss → null:");
  {
    const d = makeDeps({ finder: null, pattern: null });
    const r = await enrichLeadEmail(JANE, d);
    assert("no email available", r === null, `got ${r?.email}`);
  }

  console.log("enrichLeadEmail — guards (no wasted provider calls):");
  {
    const d = makeDeps({ finder: { email: "x@y.com" } });
    const noSite = await enrichLeadEmail({ fullName: "Jane Doe", website: "https://avvo.com/x" }, d);
    assert("directory website → null, no calls", noSite === null && d.calls.find === 0);
  }
  {
    const d = makeDeps({ finder: { email: "x@y.com" } });
    const org = await enrichLeadEmail({ fullName: "Smith Immigration Law", website: "smithlaw.com" }, d);
    assert("org-name → null, no calls", org === null && d.calls.find === 0);
  }
  {
    const d = makeDeps({ finder: { email: "x@y.com" } });
    const single = await enrichLeadEmail({ fullName: "Cher", website: "smithlaw.com" }, d);
    assert("single-word name → null, no calls", single === null && d.calls.find === 0);
  }

  console.log("findPeopleAtFirm — org lead → real people with work emails:");
  {
    const d = makeDeps({
      pattern: "{first}",
      domainEmails: [
        { email: "info@smithlaw.com", firstName: null, lastName: null, position: null, type: "generic", confidence: 95 },
        { email: "maria.garcia@smithlaw.com", firstName: "Maria", lastName: "Garcia", position: "Managing Partner", type: "personal", confidence: 92 },
        { email: "old@smithlaw.com", firstName: "Bob", lastName: "Old", position: null, type: "personal", confidence: 20 },
        { email: "j.kim@smithlaw.com", firstName: "James", lastName: "Kim", position: "Attorney", type: "personal", confidence: 80 },
      ],
    });
    const people = await findPeopleAtFirm("https://www.smithlaw.com", 3, d);
    assert("returns only confident personal mailboxes", people.length === 2, `got ${people.length}`);
    assert("highest confidence first", people[0]?.fullName === "Maria Garcia" && people[0]?.email === "maria.garcia@smithlaw.com");
    assert("carries job title", people[0]?.jobTitle === "Managing Partner");
    assert("generic info@ excluded", people.every(p => !p.email.startsWith("info@")));
  }
  {
    const d = makeDeps({ pattern: null });
    const people = await findPeopleAtFirm("https://linkedin.com/company/x", 3, d);
    assert("non-firm domain → no people, no call", people.length === 0 && d.calls.domain === 0);
  }

  console.log("");
  if (failures) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("All assertions passed.");
}

main();
