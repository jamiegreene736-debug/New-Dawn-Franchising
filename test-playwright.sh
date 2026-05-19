#!/usr/bin/env bash
# Run all Playwright end-to-end tests
# Usage: bash test-playwright.sh
set -e
echo "▶  Installing Playwright browser (chromium)..."
npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
echo ""
echo "▶  Running Playwright tests..."
npx playwright test "$@"
