import { test, expect } from "@playwright/test";

test.describe("AI Chat Widget", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="site-shell"]')).toBeVisible();
  });

  test("chat trigger button is visible", async ({ page }) => {
    await expect(page.locator('[data-testid="button-whatsapp-chat"]')).toBeVisible();
  });

  test("clicking trigger opens chat window", async ({ page }) => {
    await page.locator('[data-testid="button-whatsapp-chat"]').click();
    // Chat header transitions to opacity-100 — wait for it
    await page.waitForTimeout(400);
    await expect(page.getByText("Dylan Delaney").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Typically replies instantly").first()).toBeVisible();
  });

  test("opening message from Dylan is pre-loaded", async ({ page }) => {
    await page.locator('[data-testid="button-whatsapp-chat"]').click();
    await expect(page.locator("text=Dylan here")).toBeVisible({ timeout: 5000 });
  });

  test("Continue on WhatsApp links to wa.me", async ({ page }) => {
    await page.locator('[data-testid="button-whatsapp-chat"]').click();
    await expect(page.locator("text=Continue on WhatsApp")).toBeVisible({ timeout: 5000 });
    const href = await page.locator("a", { hasText: "Continue on WhatsApp" }).getAttribute("href");
    expect(href).toMatch(/wa\.me/);
  });

  test("Leave a Message button shows inline form", async ({ page }) => {
    await page.locator('[data-testid="button-whatsapp-chat"]').click();
    await page.locator("text=Leave a Message").click();
    await expect(page.locator('input[placeholder="Your name *"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Phone number"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Brief message… *"]')).toBeVisible();
  });

  test("Leave a Message form submits and shows confirmation", async ({ page }) => {
    await page.locator('[data-testid="button-whatsapp-chat"]').click();
    await page.locator("text=Leave a Message").click();

    // Use click + type to properly fire React onChange events
    await page.locator('input[placeholder="Your name *"]').click();
    await page.locator('input[placeholder="Your name *"]').type("Playwright Widget Test");
    await page.locator('textarea[placeholder="Brief message… *"]').click();
    await page.locator('textarea[placeholder="Brief message… *"]').type(
      "Automated test message please ignore"
    );

    // Wait for button to become enabled before clicking
    const sendBtn = page.locator("button").filter({ hasText: "Send Message" });
    await expect(sendBtn).toBeEnabled({ timeout: 5000 });
    await sendBtn.click();
    await expect(page.locator("text=Dylan will call you back shortly")).toBeVisible({ timeout: 12000 });
  });
});
