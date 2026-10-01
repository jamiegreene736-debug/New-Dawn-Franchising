import { test, expect } from "@playwright/test";

const BOOKING_URL = "https://calendly.com/dylan-newdawnfranchising/30min";
const DETAIL_IDS = [
  "owner-details",
  "how",
  "investment",
  "eligibility-details",
];

for (const width of [375, 390, 768, 1280]) {
  test(`separate audience paths and referral terms at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("page-home")).toBeVisible();
    await expect(page).toHaveTitle(
      "For Immigration Attorneys & Brokers | New Dawn Franchising",
    );
    await expect(page.getByTestId("text-hero-title")).toContainText(
      "Your clients.",
    );
    await expect(page.getByTestId("button-top-cta")).toBeInViewport();
    await expect(page.getByTestId("button-top-cta")).toHaveAttribute(
      "href",
      "#brokers",
    );
    const heroActions = page.locator("[data-partner-hero]");
    await expect(
      heroActions.getByRole("link", { name: "For Attorneys" }),
    ).toBeInViewport();
    await expect(
      heroActions.getByRole("link", { name: "For Brokers" }),
    ).toBeInViewport();
    await heroActions.getByRole("link", { name: "For Attorneys" }).click();
    await expect(page.locator("#attorney-title")).toBeInViewport();
    await expect(page.locator("#attorneys")).toContainText(
      "Support client retention.",
    );
    await expect(page.locator("#attorneys")).toContainText(
      "does not offer referral compensation",
    );
    await expect(page.locator("#attorneys")).not.toContainText("31,250");
    const attorney = page.getByRole("link", {
      name: "Discuss attorney collaboration",
    });
    const attorneyUrl = new URL(await attorney.getAttribute("href"));
    expect(attorneyUrl.protocol).toBe("mailto:");
    expect(attorneyUrl.pathname).toBe("franchising@newdawnfranchising.com");
    expect(attorneyUrl.searchParams.get("subject")).toContain(
      "Attorney inquiry",
    );
    await page.getByTestId("button-top-cta").click();
    await expect(page.locator("#broker-title")).toBeInViewport();
    const fee = page.getByTestId("broker-fee-card");
    await expect(fee).toContainText("Earn up to $31,250");
    await expect(fee).toContainText("12.5% × $250,000");
    await expect(fee).toContainText("completed, funded sale");
    await expect(fee).toContainText(
      "An introduction alone does not earn a fee",
    );
    const brokerUrl = new URL(
      await page.getByTestId("broker-fee-inquiry").getAttribute("href"),
    );
    expect(brokerUrl.pathname).toBe("franchising@newdawnfranchising.com");
    expect(brokerUrl.searchParams.get("subject")).toContain("12.5%");
    expect(brokerUrl.searchParams.get("body")).toContain(
      "commission basis and payment terms",
    );
    for (const link of await page.locator("a[data-booking]").all()) {
      await expect(link).toHaveAttribute("href", BOOKING_URL);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
    }
    await expect(page.locator("main details[open]")).toHaveCount(0);
    for (const id of DETAIL_IDS) {
      const panel = page.locator(`details#${id}`);
      await panel.locator("summary").focus();
      await panel.locator("summary").press("Enter");
      await expect(panel).toHaveJSProperty("open", true);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(page.getByTestId("footer-site")).toContainText(
      "New Dawn Franchising LLC is a franchisor, not a law firm.",
    );
    if (width < 768) {
      const toggle = page.getByRole("button", { name: "Toggle navigation" });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page
        .getByTestId("nav-site")
        .getByRole("link", { name: "For Attorneys" })
        .click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("nav-site")).toBeHidden();
      await expect(page.locator("#attorney-title")).toBeInViewport();
      await toggle.click();
      await page
        .getByTestId("nav-site")
        .getByRole("link", { name: "For Attorneys" })
        .focus();
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(page.getByTestId("nav-site")).toBeHidden();
    }
  });
}

test("mobile contact bar respects visible content, keyboard and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const bar = page.locator(".v5-mobile-cta");
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await expect(bar).toHaveAttribute("inert", "");
  await expect(bar.locator("a")).toHaveAttribute("tabindex", "-1");
  await page.locator("#attorneys").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await expect(bar.locator("a")).toHaveAttribute("href", "#contact");
  await expect(bar.locator("a")).toBeInViewport();
  await bar.locator("a").click();
  await expect(page.locator("#contact")).toBeInViewport();
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await page.locator("#attorneys").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await bar.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(bar).toHaveCount(0);
});

test("disclosures support keyboard closing and keep independent state", async ({
  page,
}) => {
  await page.goto("/");
  const owner = page.locator("#owner-details");
  const investment = page.locator("#investment");
  await owner.locator("summary").click();
  await investment.locator("summary").click();
  await owner.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(owner).toHaveJSProperty("open", false);
  await expect(investment).toHaveJSProperty("open", true);
});

test("partner actions track the correct audience without opening mail", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.partnerEvents = [];
    window.gtag = (...args) => window.partnerEvents.push(args);
    document.addEventListener("click", (event) => {
      if (event.target.closest('a[href^="mailto:"]')) event.preventDefault();
    });
  });
  await page
    .getByRole("link", { name: "Discuss attorney collaboration" })
    .click();
  await page.getByTestId("broker-fee-inquiry").click();
  expect(await page.evaluate(() => window.partnerEvents)).toEqual([
    [
      "event",
      "partner_inquiry_click",
      { audience: "attorney", method: "email" },
    ],
    ["event", "partner_inquiry_click", { audience: "broker", method: "email" }],
  ]);
});

test("other business and existing partner routes retain useful destinations", async ({
  page,
}) => {
  await page.goto("/other-businesses");
  await expect(page.getByRole("heading", { name: /connected/ })).toBeVisible();
  await expect(page.locator('[data-booking="header"]')).toHaveAttribute(
    "href",
    BOOKING_URL,
  );
  await page.goto("/partners");
  await expect(page.getByTestId("partners-subtitle")).toContainText(
    "without a referral compensation offer",
  );
  await expect(
    page.getByRole("link", { name: "Explore attorney collaboration" }),
  ).toHaveAttribute("href", "/#attorneys");
});
