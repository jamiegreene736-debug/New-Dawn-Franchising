import assert from "node:assert/strict";
import { test } from "node:test";
import { getPageShell } from "../server/page-shells";
import { franchiseServiceNode } from "../server/structured-data";
import express from "express";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serveStatic } from "../server/static";

test("homepage search content describes the approved offer without old visa promises", () => {
  const home = getPageShell("/");
  assert.ok(home);
  assert.match(home.html, /Live in the USA/);
  assert.match(home.html, /property management franchise/i);
  assert.match(home.html, /225,000/);
  assert.match(home.html, /current Franchise Disclosure Document/);
  assert.match(home.html, /does not guarantee visa eligibility or approval/);
  assert.match(home.html, /calendly\.com\/dylan-newdawnfranchising\/30min/);
  assert.equal((home.html.match(/<details\b/g) ?? []).length, 9);
  assert.equal(home.faq, undefined);
  assert.doesNotMatch(
    home.html,
    /Three Industries|released only|live anywhere/i,
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
