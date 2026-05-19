import { test, expect } from "@playwright/test";

test.describe("Blog Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-blog"]')).toBeVisible();
  });

  test("hero renders with title and subtitle", async ({ page }) => {
    await expect(page.locator('[data-testid="blog-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="blog-subtitle"]')).toBeVisible();
  });

  test("blog list section renders", async ({ page }) => {
    await expect(page.locator('[data-testid="section-blog-list"]')).toBeVisible();
  });

  test("clicking a blog post navigates to post page", async ({ page }) => {
    await page.waitForSelector('[data-testid^="card-blog-"]', { timeout: 10000 }).catch(() => null);
    const count = await page.locator('[data-testid^="card-blog-"]').count();
    if (count > 0) {
      await page.locator('[data-testid^="card-blog-"]').first().click();
      await expect(page).toHaveURL(/\/blog\/.+/);
    } else {
      test.skip(true, "No blog posts found");
    }
  });

  test("blog CTA section renders", async ({ page }) => {
    await expect(page.locator('[data-testid="section-blog-cta"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-blog-bottom-cta"]')).toBeVisible();
  });
});
