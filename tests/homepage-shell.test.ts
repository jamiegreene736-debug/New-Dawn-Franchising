import assert from "node:assert/strict";
import { test } from "node:test";
import { getPageShell } from "../server/page-shells";
import { franchiseServiceNode } from "../server/structured-data";

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
  assert.doesNotMatch(home.html, /Three Industries|released only|live anywhere/i);
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
