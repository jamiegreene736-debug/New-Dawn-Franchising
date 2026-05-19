import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="header-site"]')).toBeVisible();
  });

  test("brand logo links to homepage", async ({ page }) => {
    await page.locator('[data-testid="link-brand"]').click();
    await expect(page.locator('[data-testid="page-home"]')).toBeVisible();
  });

  test("desktop nav renders", async ({ page }) => {
    await expect(page.locator('[data-testid="nav-site"]')).toBeVisible();
  });

  test("top CTA button is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('[data-testid="button-top-cta"]')).toBeVisible();
  });

  test("mobile menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const burger = page.locator('[data-testid="button-mobile-menu"]');
    await expect(burger).toBeVisible();

    // Open the menu
    await burger.click();
    const menu = page.locator('[data-testid="mobile-menu"]');
    // Menu slides in — should no longer have translate-x-full class
    await expect(menu).not.toHaveClass(/translate-x-full/, { timeout: 5000 });

    // Close the menu
    await page.locator('[data-testid="button-close-mobile-menu"]').click();
    // Menu slides back out — translate-x-full class re-applied
    await expect(menu).toHaveClass(/translate-x-full/, { timeout: 5000 });
  });

  test("footer renders with brand and address", async ({ page }) => {
    await expect(page.locator('[data-testid="footer-site"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-footer-brand"]')).toBeVisible();
    await expect(page.locator('[data-testid="link-footer-address"]')).toBeVisible();
  });

  test("direct navigation to /about", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-about"]')).toBeVisible();
  });

  test("direct navigation to /contact", async ({ page }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-contact"]')).toBeVisible();
  });

  test("direct navigation to /blog", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-blog"]')).toBeVisible();
  });

  test("direct navigation to /quiz", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-quiz"]')).toBeVisible();
  });
});
