import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

// Use the system Chromium installed via Nix (required in Replit's NixOS environment)
function getChromiumPath() {
  try {
    return execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null", {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

const CHROMIUM_PATH = getChromiumPath();

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 45000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    // Use Nix-managed Chromium when available
    ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(CHROMIUM_PATH ? { launchOptions: { executablePath: CHROMIUM_PATH } } : {}),
      },
    },
  ],
});
