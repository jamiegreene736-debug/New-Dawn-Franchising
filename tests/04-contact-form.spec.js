import { test, expect } from "@playwright/test";

test.describe("Contact Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-contact"]')).toBeVisible();
  });

  test("all required fields are visible", async ({ page }) => {
    await expect(page.locator('[data-testid="card-contact-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-fullname"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="select-country"]')).toBeVisible();
    await expect(page.locator('[data-testid="textarea-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-submit-lead"]')).toBeVisible();
  });

  test("submit button has correct label", async ({ page }) => {
    const text = await page.locator('[data-testid="button-submit-lead"]').innerText();
    expect(text).toMatch(/send|submit|request/i);
  });

  test("form fills and submits → shows success", async ({ page }) => {
    // Pick a non-empty visitor type (required field)
    const visitorSelect = page.locator('[data-testid="select-visitor-type"]');
    const vtOptions = await visitorSelect.locator("option:not([disabled])").allInnerTexts();
    const firstVt = vtOptions.find((o) => o.trim());
    if (firstVt) await visitorSelect.selectOption({ label: firstVt });

    await page.locator('[data-testid="input-fullname"]').fill("Test Investor PW");
    await page.locator('[data-testid="input-email"]').fill("playwright.test@newdawntest.com");
    await page.locator('[data-testid="input-phone"]').fill("+1 555-000-0001");

    // Pick a non-empty country
    const countrySelect = page.locator('[data-testid="select-country"]');
    const cOptions = await countrySelect.locator("option").allInnerTexts();
    const firstC = cOptions.find((o) => o.trim() && !o.toLowerCase().includes("select"));
    if (firstC) await countrySelect.selectOption({ label: firstC });

    await page.locator('[data-testid="textarea-message"]').fill(
      "Playwright automated test submission — please ignore."
    );

    await page.locator('[data-testid="button-submit-lead"]').click();
    await expect(page.locator('[data-testid="form-success"]')).toBeVisible({ timeout: 15000 });
  });

  test("what happens next card renders", async ({ page }) => {
    await expect(page.locator('[data-testid="card-contact-what"]')).toBeVisible();
  });
});
