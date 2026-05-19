import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-login"]')).toBeVisible();
  });

  test("login form renders with email, password and button", async ({ page }) => {
    await expect(page.locator('[data-testid="input-login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-login"]')).toBeVisible();
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.locator('[data-testid="input-login-email"]').fill("bad@fake.com");
    await page.locator('[data-testid="input-login-password"]').fill("wrongpass");
    await page.locator('[data-testid="button-login"]').click();
    // Toast may render in multiple elements — use .first() to avoid strict mode violation
    await expect(page.locator("text=/invalid|incorrect|wrong|error|failed/i").first()).toBeVisible({ timeout: 10000 });
  });

  test("valid credentials redirect away from /login", async ({ page }) => {
    const email = process.env.ADMIN_EMAIL || "dylan@newdawnfranchising.com";
    const password = process.env.ADMIN_PASSWORD || "NewHorizons@12";
    await page.locator('[data-testid="input-login-email"]').fill(email);
    await page.locator('[data-testid="input-login-password"]').fill(password);
    await page.locator('[data-testid="button-login"]').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });
});
