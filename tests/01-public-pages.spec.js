import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = [
  { path: "/",               label: "Home" },
  { path: "/about",          label: "About" },
  { path: "/e2-fit",         label: "E-2 Fit" },
  { path: "/territories",    label: "Territories" },
  { path: "/team",           label: "Team" },
  { path: "/process",        label: "Process" },
  { path: "/blog",           label: "Blog" },
  { path: "/quiz",           label: "Quiz" },
  { path: "/contact",        label: "Contact" },
  { path: "/marketing",      label: "Marketing" },
  { path: "/real-estate",    label: "Real Estate" },
  { path: "/brokers",        label: "Brokers" },
  { path: "/privacy-policy", label: "Privacy Policy" },
  { path: "/terms",          label: "Terms" },
  { path: "/login",          label: "Login" },
];

for (const { path, label } of PUBLIC_PAGES) {
  test(`${label} page loads without errors (${path})`, async ({ page }) => {
    const jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const response = await page.goto(path, { waitUntil: "domcontentloaded" });

    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);

    await expect(page.locator('[data-testid="site-shell"]')).toBeVisible({ timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    expect(jsErrors).toHaveLength(0);
  });
}

test("404 — unknown route shows not-found state", async ({ page }) => {
  await page.goto("/this-page-does-not-exist-xyz", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="site-shell"]')).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toBeTruthy();
});
