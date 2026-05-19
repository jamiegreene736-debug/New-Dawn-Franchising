#!/usr/bin/env bash
# Run both Playwright and Cypress test suites back to back
# Usage: bash test-all.sh
set -e

echo "========================================"
echo "  NEW DAWN FRANCHISING — Full Test Run"
echo "========================================"
echo ""

echo "[ 1/2 ]  Installing Playwright browser (chromium)..."
npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium

echo ""
echo "[ 1/2 ]  Running Playwright tests..."
npx playwright test
PW_EXIT=$?

echo ""
echo "[ 2/2 ]  Running Cypress tests..."
npx cypress run --headless
CY_EXIT=$?

echo ""
echo "========================================"
if [ $PW_EXIT -eq 0 ] && [ $CY_EXIT -eq 0 ]; then
  echo "  ✅  All tests passed!"
else
  echo "  ❌  Some tests failed. Check output above."
  exit 1
fi
echo "========================================"
