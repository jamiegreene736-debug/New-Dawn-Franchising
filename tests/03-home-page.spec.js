import { test, expect } from "@playwright/test";

const BOOKING_URL = "https://calendly.com/dylan-newdawnfranchising/30min";
const DETAIL_IDS = [
  "owner-details",
  "support-details",
  "technology-details",
  "team-details",
  "eligibility-details",
  "location-details",
  "investment-details",
  "financing-details",
  "fdd-details",
];

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("page-home")).toBeVisible();
  });

  test("hero introduces property management ownership and the discovery call", async ({ page }) => {
    await expect(page.getByTestId("section-hero")).toBeVisible();
    await expect(page.getByTestId("text-hero-title")).toContainText("Live in the USA.");
    await expect(page.getByTestId("section-hero")).toContainText("Own a property management franchise.");
    await expect(page.getByTestId("text-hero-subtitle")).toBeVisible();
    await expect(page.getByTestId("button-hero-booking")).toBeVisible();
  });

  test("every primary CTA has the same discovery call destination", async ({ page }) => {
    const bookingLinks = page.locator("a[data-booking]");
    await expect(bookingLinks).toHaveCount(3);

    for (const placement of ["header", "hero", "dylan"]) {
      const link = page.locator(`a[data-booking="${placement}"]`);
      await expect(link).toContainText(placement === "dylan" ? "Choose a time with Dylan" : "Book a discovery call");
      await expect(link).toHaveAttribute("href", BOOKING_URL);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("homepage keeps the discovery call as its only contact action", async ({ page }) => {
    await expect(page.getByTestId("button-whatsapp-chat")).toHaveCount(0);
    await expect(page.getByTestId("form-newsletter")).toHaveCount(0);
  });

  test("essential business and E-2 information remains visible with details closed", async ({ page }) => {
    await expect(page.getByTestId("section-trust-strip")).toBeVisible();
    await expect(page.locator("#opportunities")).toContainText("Your business.");
    await expect(page.getByTestId("section-how")).toBeVisible();
    await expect(page.getByTestId("section-meet-dylan")).toBeVisible();
    await expect(page.getByTestId("button-dylan-calendly")).toHaveAttribute("href", BOOKING_URL);
    await expect(page.locator("details[open]")).toHaveCount(0);
  });

  test("nine read-more panels start closed and support keyboard expansion", async ({ page }) => {
    await expect(page.locator("main details")).toHaveCount(DETAIL_IDS.length);

    for (const id of DETAIL_IDS) {
      const panel = page.locator(`details#${id}`);
      const summary = panel.locator("summary");
      await expect(panel).toHaveJSProperty("open", false);
      await summary.focus();
      await summary.press("Enter");
      await expect(panel).toHaveJSProperty("open", true);
      await summary.press("Space");
      await expect(panel).toHaveJSProperty("open", false);
    }
  });

  test("readers can keep multiple detail panels open", async ({ page }) => {
    const owner = page.locator("#owner-details");
    const technology = page.locator("#technology-details");
    await owner.locator("summary").click();
    await technology.locator("summary").click();
    await expect(owner).toHaveJSProperty("open", true);
    await expect(technology).toHaveJSProperty("open", true);

    await owner.locator("summary").click();
    await expect(owner).toHaveJSProperty("open", false);
    await expect(technology).toHaveJSProperty("open", true);
  });

  test("expanded details fit mobile screens and leave booking accessible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const id of DETAIL_IDS) {
      const panel = page.locator(`details#${id}`);
      await panel.locator("summary").click();
      await expect(panel).toHaveJSProperty("open", true);
    }

    const horizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ));
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    const mobileBooking = page.locator('a[data-booking="mobile"]');
    await expect(mobileBooking).toBeInViewport();
    await expect(mobileBooking).toHaveAttribute("href", BOOKING_URL);
  });
});

for (const width of [375, 390, 768, 1280]) {
  test(`homepage booking visibility and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const hero = page.locator('[data-booking="hero"]');
    const bar = page.locator('.v5-mobile-cta');
    await expect(hero).toBeInViewport();
    await expect(page.locator("details[open]")).toHaveCount(0);
    await expect(page.locator('#team-details')).toContainText("Together, our team has guided more than 70 E-2 investors through franchise ownership and the visa process.");
    await expect(page.getByTestId("section-trust-strip").locator("strong")).toHaveText([
      "70+ E-2 franchise placements guided by our team",
      "Operating roots in El Paso, Texas",
      "English & Spanish support",
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width < 768) {
      await expect(page.locator('[data-booking="header"]')).toBeHidden();
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await expect(bar).toHaveAttribute("inert", "");
      await expect(bar.locator('a')).toHaveAttribute("tabindex", "-1");
      await expect(page.getByRole("button", { name: "Toggle navigation" })).toBeVisible();
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await expect(page.getByTestId("nav-site").locator("a")).toHaveText(["How it works", "E-2 pathway", "The investment"]);
      await page.getByTestId("nav-site").getByText("The investment").click();
      await expect(page.getByTestId("nav-site")).toBeHidden();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await hero.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().bottom - 1));
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => window.scrollBy(0, 3));
      await expect(bar).toHaveAttribute("aria-hidden", "false");
      await expect(bar.locator("a")).toHaveText("Book a discovery call");
      await expect(bar.locator("a")).toBeInViewport();
      await page.locator("#contact").evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - innerHeight + 1));
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await hero.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().bottom + 5));
      await expect(bar).toHaveAttribute("aria-hidden", "false");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await bar.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(bar).toHaveAttribute("aria-hidden", "true");
      await page.setViewportSize({ width: 768, height: 844 });
      await expect(bar).toHaveCount(0);
    } else {
      await expect(page.locator('[data-booking="header"]')).toBeVisible();
      await expect(bar).toHaveCount(0);
      await expect(page.getByTestId("nav-site").locator("a")).toHaveText(["How it works", "E-2 pathway", "The investment"]);
    }
    for (const link of await page.locator('a[href^="/"] , a[href^="#"]').all()) {
      await expect(link).not.toHaveAttribute("target", "_blank");
      await expect(link).not.toContainText("↗");
    }
    for (const link of await page.locator('a[href^="https://"]').all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
    }
  });
}
