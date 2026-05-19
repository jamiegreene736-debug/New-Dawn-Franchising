#!/usr/bin/env bash
# Run all Cypress end-to-end tests headlessly
# Usage: bash test-cypress.sh
set -e
echo "▶  Running Cypress tests (headless)..."
npx cypress run --headless "$@"
