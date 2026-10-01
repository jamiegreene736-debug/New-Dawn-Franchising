import assert from "node:assert/strict";
import { test } from "node:test";
import { getPageShell } from "../server/page-shells";
import { franchiseServiceNode } from "../server/structured-data";
import express from "express";
import {
  BROKER_PAGE_TITLE,
  BROKER_PAGE_DESCRIPTION,
  PARTNER_HOME_TITLE,
  PARTNER_HOME_DESCRIPTION,
} from "../shared/partner-homepage";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serveStatic } from "../server/static";

test("homepage search content describes the approved offer without old visa promises", () => {
  const home = getPageShell("/");
  assert.ok(home);
  assert.match(home.html, /Your next chapter/);
  assert.match(home.html, /FOR IMMIGRATION ATTORNEYS/);
  assert.match(home.html, /FOR FRANCHISE &amp; BUSINESS BROKERS/);
  assert.equal(home.title, PARTNER_HOME_TITLE);
  assert.equal(home.description, PARTNER_HOME_DESCRIPTION);
  assert.match(home.html, /property management franchise/i);
  assert.match(home.html, /70\+ E-2 visa approvals/);
  assert.match(home.html, /supported by our team/);
  assert.match(home.html, /All franchise investment funds are held in escrow/);
  assert.match(home.html, /refunded in full under the written escrow agreement/);
  assert.match(home.html, /Office space provided/);
  assert.match(home.html, /oversee your business remotely/);
  assert.match(home.html, /Your attorney reviews your location plans/);
  assert.match(home.html, /U.S. job creation/);
  assert.match(home.html, /Online training and owner dashboards/);
  assert.match(home.html, /applications and renewals/);
  assert.match(home.html, /recurring monthly management fees/);
  assert.match(home.html, /does not protect against business losses/);
  assert.doesNotMatch(
    home.html + home.description,
    /31,250|31250|12[.]5|250,000|generous referral|earn up to/i,
  );
  assert.match(home.html, /New Dawn may compensate participating brokers/);
  assert.match(home.html, /Ask your broker who pays them/);
  assert.match(
    home.html,
    /attorney pathway does not offer referral compensation/,
  );
  assert.match(home.html, /current Franchise Disclosure Document/);
  assert.match(home.html, /does not guarantee visa eligibility or approval/);
  assert.match(home.html, /calendly\.com\/dylan-newdawnfranchising\/30min/);
  assert.equal((home.html.match(/<details\b/g) ?? []).length, 6);
  assert.equal(home.faq, undefined);
  assert.doesNotMatch(
    home.html,
    /Three Industries|passive income|hands.off|work anywhere|live anywhere|100% success/i,
  );
});

test("secondary-business search content follows the same route variants as the UI", () => {
  const other = getPageShell("/other-businesses");
  assert.ok(other);
  assert.match(other.html, /Telecom/i);
  assert.match(other.html, /Insurance/i);
  assert.equal(getPageShell("/other-businesses/"), other);
  assert.equal(getPageShell("/Other-Businesses"), other);
  assert.equal(getPageShell("/not-a-public-page"), null);
});

test("E-2 process search content explains visa-contingent escrow and commercial risk together", () => {
  const process = getPageShell("/e-2-visa-process");
  assert.ok(process);
  assert.match(process.html, /purchase contingent on E-2 visa approval can use escrow/);
  assert.match(process.html, /independent attorney should review/);
  assert.match(process.html, /does not remove the risk of business losses/);
});

test("homepage structured data does not treat a general package minimum as every vertical's price", () => {
  const service = franchiseServiceNode();
  assert.equal(service.name, "Property Management Franchise");
  assert.equal(service.hasOfferCatalog, undefined);
  assert.match(String(service.description), /current FDD/);
  assert.match(String(service.description), /does not guarantee visa approval/);
});

test("production HTML fallback preserves the requested page, metadata, and static assets", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "new-dawn-shell-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, "index.html"),
    '<html><head><title>App</title><meta name="description" content="App" /></head><body><div id="root"></div></body></html>',
  );
  await writeFile(path.join(directory, "asset.txt"), "static asset");
  const app = express();
  serveStatic(app, directory);
  const server = app.listen(0, "127.0.0.1");
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const route of [
    "/",
    "/other-businesses",
    "/other-businesses/?utm_source=release-check",
    "/about",
    "/partners",
    "/partners/?utm_source=release-check",
  ]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const pathname = route.split("?")[0];
    const shell = getPageShell(pathname);
    assert.ok(shell);
    assert.ok(html.includes(shell.html), `Wrong page content for ${route}`);
    assert.ok(
      html.includes(shell.title.replace(/&/g, "&amp;")),
      `Wrong title for ${route}`,
    );
    assert.ok(
      html.includes(
        `rel="canonical" href="https://www.newdawnfranchising.com${pathname === "/" ? "" : pathname}"`,
      ),
    );
    assert.ok(!html.includes("utm_source"));
  }
  const asset = await fetch(`${baseUrl}/asset.txt`);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), "static asset");
});

test("broker recruitment requests private terms while explaining the paid relationship", () => {
  const partners = getPageShell("/partners");
  assert.ok(partners);
  assert.equal(partners.title, BROKER_PAGE_TITLE);
  assert.equal(partners.description, BROKER_PAGE_DESCRIPTION);
  assert.match(partners.html, /Request referral terms/);
  assert.match(partners.html, /explain that New Dawn may pay you/);
  assert.match(partners.html, /how your compensation is calculated/);
  assert.match(
    partners.html,
    /That pathway does not offer referral compensation/,
  );
  assert.doesNotMatch(
    partners.html + partners.description,
    /31,250|31250|12[.]5|250,000|same price|no added cost|no extra charge/i,
  );
  assert.equal(partners.faq, undefined);
});
