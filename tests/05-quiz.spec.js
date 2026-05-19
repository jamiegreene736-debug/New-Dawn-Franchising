import { test, expect } from "@playwright/test";

test.describe("E-2 Eligibility Quiz", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="page-quiz"]')).toBeVisible();
  });

  test("quiz title and progress bar render", async ({ page }) => {
    await expect(page.locator('[data-testid="quiz-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="quiz-progress"]')).toBeVisible();
  });

  test("first question renders with answer options", async ({ page }) => {
    await expect(page.locator('[data-testid^="quiz-question-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="quiz-answer-"]').first()).toBeVisible();
  });

  test("selecting an answer enables Next button", async ({ page }) => {
    await page.locator('[data-testid^="quiz-answer-"]').first().click();
    await expect(page.locator('[data-testid="quiz-next"]')).toBeEnabled();
  });

  test("completes quiz flow and shows results", async ({ page }) => {
    for (let i = 0; i < 20; i++) {
      const result = page.locator('[data-testid="quiz-result"]');
      if (await result.isVisible().catch(() => false)) break;

      const answers = page.locator('[data-testid^="quiz-answer-"]');
      if ((await answers.count()) === 0) break;
      await answers.first().click();
      await page.waitForTimeout(150);

      const nextBtn = page.locator('[data-testid="quiz-next"]');
      if (await nextBtn.isVisible().catch(() => false) && await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(250);
      }
    }

    await expect(page.locator('[data-testid="quiz-result"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="quiz-result-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="quiz-cta"]')).toBeVisible();
  });

  test("restart button resets the quiz", async ({ page }) => {
    // Complete the quiz
    for (let i = 0; i < 20; i++) {
      if (await page.locator('[data-testid="quiz-result"]').isVisible().catch(() => false)) break;
      const answers = page.locator('[data-testid^="quiz-answer-"]');
      if ((await answers.count()) === 0) break;
      await answers.first().click();
      await page.waitForTimeout(150);
      const nextBtn = page.locator('[data-testid="quiz-next"]');
      if (await nextBtn.isVisible().catch(() => false) && await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(250);
      }
    }
    await page.locator('[data-testid="quiz-restart"]').click();
    await expect(page.locator('[data-testid^="quiz-question-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="quiz-result"]')).not.toBeVisible();
  });
});
