import { test, expect } from "@playwright/test";
const BOOKING_URL = "https://calendly.com/dylan-newdawnfranchising/30min";
const DETAILS = [
  "owner-details",
  "how",
  "investment",
  "referral-details",
  "team-details",
  "eligibility-details",
];
const PRIVATE_FIGURES =
  /31,250|31250|12[.]5|250,000|generous referral fee|earn up to/i;

async function expectNoCommissionPitch(page) {
  await expect(page.locator("body")).not.toContainText(PRIVATE_FIGURES);
  for (const meta of await page
    .locator(
      'meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]',
    )
    .all()) {
    await expect(meta).not.toHaveAttribute("content", PRIVATE_FIGURES);
  }
  for (const link of await page.locator("main a[href]").all()) {
    expect(decodeURIComponent(await link.getAttribute("href"))).not.toMatch(
      PRIVATE_FIGURES,
    );
  }
}

for (const width of [375, 390, 768, 1280]) {
  test(`client homepage and dedicated broker page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("page-home")).toBeVisible();
    await expect(page).toHaveTitle(
      "Property Management Franchise & E-2 Plans | New Dawn Franchising",
    );
    await expect(page.getByTestId("text-hero-title")).toContainText(
      "Your next chapter.",
    );
    await expect(page.getByTestId("button-hero-booking")).toBeInViewport();
    await expect(page.getByTestId("button-hero-booking")).toHaveAttribute(
      "href",
      BOOKING_URL,
    );
    await expect(page.getByTestId("button-top-cta")).toHaveText(
      "For Brokers →",
    );
    await expect(page.getByTestId("button-top-cta")).toBeInViewport();
    await expect(page.getByTestId("button-top-cta")).toHaveAttribute(
      "href",
      "/partners",
    );
    await expectNoCommissionPitch(page);
    expect(
      await page.evaluate(
        () =>
          document.getElementById("opportunities").getBoundingClientRect().top <
          document.getElementById("attorneys").getBoundingClientRect().top,
      ),
    ).toBe(true);
    await expect(page.locator("#attorneys")).toContainText(
      "independent legal adviser",
    );
    await expect(page.locator("#attorneys")).toContainText(
      "does not offer referral compensation",
    );
    await expect(page.locator("#brokers a")).toHaveAttribute(
      "href",
      "/partners",
    );
    await expect(page.locator("main details[open]")).toHaveCount(0);
    for (const id of DETAILS) {
      const panel = page.locator(`details#${id}`);
      await panel.locator("summary").focus();
      await panel.locator("summary").press("Enter");
      await expect(panel).toHaveJSProperty("open", true);
    }
    await expect(page.locator("#referral-details")).toContainText(
      "New Dawn may compensate participating brokers",
    );
    await expect(page.locator("#referral-details")).toContainText(
      "Ask your broker who pays them",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(page.getByTestId("footer-site")).toContainText(
      "New Dawn Franchising LLC is a franchisor, not a law firm.",
    );
    if (width < 768) {
      const toggle = page.getByRole("button", { name: "Toggle navigation" });
      await toggle.click();
      await page
        .getByTestId("nav-site")
        .getByRole("link", { name: "For Attorneys" })
        .click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
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
    await page.getByTestId("button-top-cta").click();
    await expect(page).toHaveURL(/\/partners$/);
    await expect(page.getByTestId("page-partners")).toBeVisible();
    await expect(page).toHaveTitle("For Brokers | New Dawn Franchising");
    await expect(
      page.getByRole("link", { name: "Request referral terms" }),
    ).toBeVisible();
    await expectNoCommissionPitch(page);
    await expect(page.locator("main")).toContainText(
      "explain that New Dawn may pay you",
    );
    await expect(page.locator("main")).toContainText(
      "how your compensation is calculated",
    );
    const inquiry = new URL(
      await page.getByTestId("broker-terms-inquiry").getAttribute("href"),
    );
    expect(inquiry.protocol).toBe("mailto:");
    expect(inquiry.pathname).toBe("franchising@newdawnfranchising.com");
    expect(inquiry.searchParams.get("subject")).toBe(
      "Broker inquiry — request referral terms",
    );
    expect(inquiry.searchParams.get("body")).toContain(
      "client disclosure guidance",
    );
    await expect(page.locator('[data-booking="broker"]')).toHaveAttribute(
      "href",
      BOOKING_URL,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
}

test("mobile contact bar respects content, keyboard and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const bar = page.locator(".v5-mobile-cta");
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await expect(bar).toHaveAttribute("inert", "");
  await expect(bar.locator("a")).toHaveAttribute("tabindex", "-1");
  await page.locator("#opportunities").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await bar.locator("a").click();
  await expect(page.locator("#contact")).toBeInViewport();
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await page.locator("#opportunities").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await bar.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(bar).toHaveCount(0);
});

test("disclosures retain independent state and support keyboard closing", async ({
  page,
}) => {
  await page.goto("/");
  const owner = page.locator("#owner-details"),
    referral = page.locator("#referral-details");
  await owner.locator("summary").click();
  await referral.locator("summary").click();
  await owner.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(owner).toHaveJSProperty("open", false);
  await expect(referral).toHaveJSProperty("open", true);
});

test("attorney and broker inquiries keep distinct messages and tracking", async ({
  page,
}) => {
  async function interceptMail() {
    await page.evaluate(() => {
      window.partnerEvents = [];
      window.gtag = (...args) => window.partnerEvents.push(args);
      document.addEventListener("click", (event) => {
        if (event.target.closest('a[href^="mailto:"]')) event.preventDefault();
      });
    });
  }
  await page.goto("/");
  await interceptMail();
  const attorney = page.getByRole("link", {
    name: "Discuss attorney collaboration",
  });
  expect(
    new URL(await attorney.getAttribute("href")).searchParams.get("subject"),
  ).toContain("Attorney inquiry");
  await attorney.click();
  expect(await page.evaluate(() => window.partnerEvents)).toEqual([
    [
      "event",
      "partner_inquiry_click",
      { audience: "attorney", method: "email" },
    ],
  ]);
  await page.goto("/partners");
  await interceptMail();
  await page.getByTestId("broker-terms-inquiry").click();
  expect(await page.evaluate(() => window.partnerEvents)).toEqual([
    ["event", "partner_inquiry_click", { audience: "broker", method: "email" }],
  ]);
  await page
    .getByRole("link", { name: "Explore attorney collaboration" })
    .click();
  await expect(page.locator("#attorney-title")).toBeInViewport();
});

test("existing secondary-business route retains its booking destination", async ({
  page,
}) => {
  await page.goto("/other-businesses");
  await expect(page.getByRole("heading", { name: /connected/ })).toBeVisible();
  await expect(page.locator('[data-booking="header"]')).toHaveAttribute(
    "href",
    BOOKING_URL,
  );
});
