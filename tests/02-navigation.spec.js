import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("header-site")).toBeVisible();
  });

  test("brand logo links to homepage", async ({ page }) => {
    await page.getByTestId("link-brand").click();
    await expect(page.getByTestId("page-home")).toBeVisible();
  });

  test("desktop navigation goes directly to the business and E-2 sections", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const nav = page.getByTestId("nav-site");
    await expect(nav).toBeVisible();

    for (const [label, fragment] of [["How it works", "opportunities"], ["E-2 pathway", "how"]]) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("href", new RegExp(`#${fragment}$`));
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${fragment}$`));
      await expect(page.locator(`#${fragment}`)).toBeInViewport();
    }
  });

  test("top CTA button is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId("button-top-cta")).toBeVisible();
  });

  test("mobile navigation exposes the two section links without a menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const nav = page.getByTestId("nav-site");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "How it works", exact: true })).toBeVisible();
    const pathway = nav.getByRole("link", { name: "E-2 pathway", exact: true });
    await expect(pathway).toBeVisible();
    await pathway.click();
    await expect(page).toHaveURL(/#how$/);
    await expect(page.locator("#how")).toBeInViewport();
  });

  test("footer provides company information, team, partners, and portal links", async ({ page }) => {
    const footer = page.getByTestId("footer-site");
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("text-footer-brand")).toBeVisible();
    await expect(page.getByTestId("link-footer-address")).toBeVisible();
    await expect(footer.getByRole("link", { name: /Meet the team/ })).toHaveAttribute("href", /\/team$/);
    await expect(footer.getByRole("link", { name: /Partners & referrals/ })).toHaveAttribute("href", /\/partners$/);
    await expect(footer.getByRole("link", { name: /Portal login/ })).toHaveAttribute("href", /\/login$/);
  });

  test("other businesses opens a separate page and the brand returns home", async ({ page }) => {
    const otherBusinesses = page.getByTestId("footer-site").getByRole("link", { name: /Other businesses/ });
    await expect(otherBusinesses).toHaveAttribute("href", "/other-businesses");
    await otherBusinesses.click();
    await expect(page).toHaveURL(/\/other-businesses$/);
    await expect(page.getByTestId("page-other-businesses")).toBeVisible();

    await page.getByTestId("link-brand").click();
    await expect(page.getByTestId("page-home")).toBeVisible();
  });

  for (const path of ["about", "contact", "blog", "quiz"]) {
    test(`direct navigation to /${path}`, async ({ page }) => {
      await page.goto(`/${path}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(`page-${path}`)).toBeVisible();
    });
  }
});
