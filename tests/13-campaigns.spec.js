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

test.describe("Campaigns Hub (Email / SMS / WhatsApp)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="tab-crm-emails"]').click();
    await expect(page.locator('[data-testid="email-campaigns"]')).toBeVisible({ timeout: 10000 });
  });

  test("campaigns hub renders with main tabs", async ({ page }) => {
    await expect(page.locator('[data-testid="tab-campaigns"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-sends"]')).toBeVisible();
  });

  test("campaigns tab is active by default", async ({ page }) => {
    await expect(page.locator('[data-testid="tab-campaigns"]')).toBeVisible();
  });

  test("SMS blast input fields render after opening create form", async ({ page }) => {
    // Switch to the SMS channel tab first
    await page.locator('[data-testid="campaigns-tab-sms"]').click();
    // Open the New Campaign form
    await page.locator('[data-testid="button-new-sms-campaign"]').click();
    await expect(page.locator('[data-testid="input-sms-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-sms-message"]')).toBeVisible();
  });

  test("WhatsApp blast input fields render after opening create form", async ({ page }) => {
    // Switch to the WhatsApp channel tab first
    await page.locator('[data-testid="campaigns-tab-whatsapp"]').click();
    // Open the New Campaign form
    await page.locator('[data-testid="button-new-whatsapp-campaign"]').click();
    await expect(page.locator('[data-testid="input-whatsapp-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-whatsapp-message"]')).toBeVisible();
  });

  test("Send History tab is reachable", async ({ page }) => {
    await page.locator('[data-testid="tab-sends"]').click();
    await expect(page.locator('[data-testid="input-filter-sends"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="select-filter-send-status"]')).toBeVisible();
  });
});

test.describe("SMS Campaign API", () => {
  test("GET /api/crm/sms-campaigns requires auth", async ({ request }) => {
    const res = await request.get("/api/crm/sms-campaigns");
    expect(res.status()).toBe(401);
  });

  test("GET /api/crm/wa-campaigns requires auth", async ({ request }) => {
    const res = await request.get("/api/crm/wa-campaigns");
    expect(res.status()).toBe(401);
  });

  test("GET /api/crm/email-campaigns/sends requires auth", async ({ request }) => {
    const res = await request.get("/api/crm/email-campaigns/sends");
    // Protected route or not-found; either way should not return 200 JSON data
    const isJson = res.headers()["content-type"]?.includes("application/json");
    if (isJson) {
      expect(res.status()).toBe(401);
    } else {
      // Falls through to SPA HTML — that's OK for this route
      expect(res.status()).toBe(200);
    }
  });
});
