import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dylan@newdawnfranchising.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NewHorizons@12";

async function loginAsAdmin(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="input-login-email"]').fill(ADMIN_EMAIL);
  await page.locator('[data-testid="input-login-password"]').fill(ADMIN_PASSWORD);
  await page.locator('[data-testid="button-login"]').click();
  await expect(page.locator('[data-testid="page-crm"]')).toBeVisible({ timeout: 15000 });
}

test.describe("Admin CRM", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("CRM dashboard renders title and logout button", async ({ page }) => {
    await expect(page.locator('[data-testid="crm-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-admin-logout"]')).toBeVisible();
  });

  test("CRM shows pipeline stat cards", async ({ page }) => {
    await expect(page.locator('[data-testid="stat-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-fdd"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-receipt"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-active"]')).toBeVisible();
  });

  test("all main CRM tabs are visible", async ({ page }) => {
    await expect(page.locator('[data-testid="tab-crm-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-crm-prospects"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-crm-reports"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-crm-seo"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-crm-agent"]')).toBeVisible();
  });

  test("Clients tab shows search input and Add Client button", async ({ page }) => {
    await page.locator('[data-testid="tab-crm-clients"]').click();
    await expect(page.locator('[data-testid="input-crm-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-add-crm-client"]')).toBeVisible();
  });

  test("Add Client button opens the client form", async ({ page }) => {
    await page.locator('[data-testid="tab-crm-clients"]').click();
    await page.locator('[data-testid="button-add-crm-client"]').click();
    await expect(page.locator('[data-testid="input-crm-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-crm-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-crm-save"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-crm-cancel"]')).toBeVisible();
  });

  test("cancel button closes the client form", async ({ page }) => {
    await page.locator('[data-testid="tab-crm-clients"]').click();
    await page.locator('[data-testid="button-add-crm-client"]').click();
    await expect(page.locator('[data-testid="input-crm-name"]')).toBeVisible();
    await page.locator('[data-testid="button-crm-cancel"]').click();
    await expect(page.locator('[data-testid="input-crm-name"]')).not.toBeVisible();
  });

  test("Prospects tab is clickable and renders content", async ({ page }) => {
    await page.locator('[data-testid="tab-crm-prospects"]').click();
    await expect(page).toHaveURL(/\/crm/, { timeout: 5000 });
    // Prospects tab content area should render
    await expect(page.locator('[data-testid="page-crm"]')).toBeVisible();
  });

  test("Reports tab renders analytics sub-tabs", async ({ page }) => {
    await page.locator('[data-testid="tab-crm-reports"]').click();
    await expect(page.locator('[data-testid="tab-reports-analytics"]')).toBeVisible({ timeout: 8000 });
  });

  test("logout button ends session and redirects to login", async ({ page }) => {
    await page.locator('[data-testid="button-admin-logout"]').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
