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
    await expect(bookingLinks).toHaveCount(4);

    for (const placement of ["header", "hero", "dylan", "mobile"]) {
      const link = page.locator(`a[data-booking="${placement}"]`);
      await expect(link).toContainText("Book a discovery call");
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
