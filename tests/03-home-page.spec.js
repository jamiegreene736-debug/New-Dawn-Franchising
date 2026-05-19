import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-home"]')).toBeVisible();
  });

  test("hero section renders with title and CTAs", async ({ page }) => {
    await expect(page.locator('[data-testid="section-hero"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-hero-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-hero-subtitle"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-hero-investor"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-hero-attorney"]')).toBeVisible();
  });

  test("investor CTA links to /contact", async ({ page }) => {
    await page.locator('[data-testid="button-hero-investor"]').click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test("trust strip section renders", async ({ page }) => {
    await expect(page.locator('[data-testid="section-trust-strip"]')).toBeVisible();
  });

  test("tech section renders with title", async ({ page }) => {
    await expect(page.locator('[data-testid="section-tech"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-tech-title"]')).toBeVisible();
  });

  test("how-it-works section renders", async ({ page }) => {
    await expect(page.locator('[data-testid="section-how"]')).toBeVisible();
  });

  test("Meet Dylan section renders with Calendly CTA", async ({ page }) => {
    await expect(page.locator('[data-testid="section-meet-dylan"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-dylan-calendly"]')).toBeVisible();
  });

  test("Calendly button href points to calendly.com", async ({ page }) => {
    const href = await page.locator('[data-testid="button-dylan-calendly"]').getAttribute("href");
    expect(href).toMatch(/calendly\.com/i);
  });

  test("quiz CTA section renders", async ({ page }) => {
    await expect(page.locator('[data-testid="section-quiz-cta"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-quiz-cta"]')).toBeVisible();
  });

  test("quiz CTA button navigates to /quiz", async ({ page }) => {
    await page.locator('[data-testid="button-quiz-cta"]').click();
    await expect(page).toHaveURL(/\/quiz/);
  });

  test("newsletter form renders", async ({ page }) => {
    await expect(page.locator('[data-testid="form-newsletter"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-newsletter-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-newsletter-submit"]')).toBeVisible();
  });
});
