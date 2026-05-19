import { test, expect } from "@playwright/test";

test.describe("Broker Portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/brokers", { waitUntil: "domcontentloaded" });
  });

  test("broker portal shows login form by default", async ({ page }) => {
    await expect(page.locator('[data-testid="input-login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-login"]')).toBeVisible();
  });

  test("switch to register shows registration form fields", async ({ page }) => {
    await page.locator('[data-testid="link-switch-register"]').click();
    await expect(page.locator('[data-testid="input-reg-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-reg-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-reg-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-reg-confirm"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-register"]')).toBeVisible();
  });

  test("switch back to login from register form", async ({ page }) => {
    await page.locator('[data-testid="link-switch-register"]').click();
    await expect(page.locator('[data-testid="input-reg-name"]')).toBeVisible();
    await page.locator('[data-testid="link-switch-login"]').click();
    await expect(page.locator('[data-testid="input-login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-reg-name"]')).not.toBeVisible();
  });

  test("invalid login shows an error message", async ({ page }) => {
    await page.locator('[data-testid="input-login-email"]').fill("notabroker@fake.com");
    await page.locator('[data-testid="input-login-password"]').fill("wrongpass123");
    await page.locator('[data-testid="button-login"]').click();
    await expect(
      page.locator("text=/invalid|incorrect|wrong|error|not found/i").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("register form shows password mismatch error", async ({ page }) => {
    await page.locator('[data-testid="link-switch-register"]').click();
    await page.locator('[data-testid="input-reg-name"]').fill("Test Broker");
    await page.locator('[data-testid="input-reg-email"]').fill(`broker-${Date.now()}@test.com`);
    await page.locator('[data-testid="input-reg-password"]').fill("SecurePass123");
    await page.locator('[data-testid="input-reg-confirm"]').fill("DifferentPass456");
    await page.locator('[data-testid="button-register"]').click();
    await expect(
      page.locator("text=/match|password|confirm/i").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("registration form has optional phone and company fields", async ({ page }) => {
    await page.locator('[data-testid="link-switch-register"]').click();
    await expect(page.locator('[data-testid="input-reg-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-reg-company"]')).toBeVisible();
  });
});
