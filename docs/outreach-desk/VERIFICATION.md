# Application verification — 24 September 2026

- TypeScript: `npm run check` passed.
- Production client/server build: `npm run build` passed (existing bundle-size warning).
- Existing core unit suite: `npm run test:unit` passed.
- Outreach Desk: `npm run test:outreach-desk` passed 24 policy/database/API tests with no skips using dedicated local PostgreSQL `new_dawn_outreach_desk_test`.
- Database coverage: auth/origin/input validation, due filtering/keyset pagination, competing session claims, atomic/idempotent outcomes, DNC cancellation, concurrent dispatch exactly once, reply holds, ambiguous-response quarantine, saved views, campaign deduplication/filtering, handled-person requeue protection, cached verification/provider failure, stale draft edits pause/recipient changes phone-only inbound reply holds/timeline, and empty-phone identity isolation.
- Pure coverage: channel evidence/expiry, timezones/local hours, WhatsApp service window, safe phone/profile URLs, schema limits, callback daylight-saving gaps/ambiguity HTML escaping and provider request cancellation.
- Real-browser application smoke passed: default landing, search, contact update, call workspace/outcome, persisted draft editing, campaign-open filtering, all desk sections, existing CRM tab navigation/reload, and 390px layout. No browser JavaScript errors or document overflow. Desktop and mobile screenshots were visually inspected.
- CI now runs the desk tests against an ephemeral PostgreSQL 16 service, in addition to the existing typecheck/build/mobile checks.

Database tests refuse destructive setup unless BOTH database environment variables identify the exact dedicated localhost test database. Provider sends and verification are injected fakes. No real outbound messages were sent during local verification.

## Original prototype verification (historical)

Verified locally on 24 September 2026 against the design package based on repository commit `1daa778`.

## Completed

- JavaScript syntax validation: `node --check docs/outreach-desk/mockups/app.js` passed.
- Whitespace/error check: `git diff --check` passed.
- 50 browser assertions passed using Playwright with installed Chrome in a fresh headless session.
- Covered default landing screen, sample queue size, callback priority, campaign + signal filters, name search, no-result state, escaped search content in dialogs, campaign-to-contact navigation, WhatsApp hold explanation, missing-phone/calling-window holds, call-note preservation, callback-time requirement, simulated handoff status, saved-outcome queue removal, playbook pause, accessible switch state, provider cards and funnel stages.
- Seven views checked for document overflow at 390, 768, 1024 and 1512px widths: none.
- No browser JavaScript errors; no external requests during those checks.
- Additional focused check verifies a selected callback time survives the simulated Quo handoff re-render.
- Desktop renders generated at 1512px width; mobile render generated at 390px width. Main desk, campaign explorer, call workspace and mobile layout visually inspected; automation and connection renders inspected separately.

## Execution notes

The repository's Playwright package expected a bundled browser version not present locally. Verification used the already-installed Google Chrome through Playwright's `channel: 'chrome'`, with an isolated temporary browser context. No existing browser profile or user session was read.

The preview is served locally with Python's static HTTP server on `127.0.0.1:4179`. The package also works by opening `mockups/index.html` in a browser. DM Sans is included locally with its license; no external font/CDN request is needed.

## Scope of evidence

These checks validate the design prototype. They do not certify production integrations, delivery, actual booking, legal eligibility, WCAG compliance or application performance. Production source files and database schemas were not changed; application-wide tests/builds were not run for this documentation/prototype-only package. The plan includes the required implementation and provider validation gates.

All prototype actions are simulated in memory. Refresh resets outcomes, drafts and switches. Screen metrics and provider-health labels are explicitly fictional; they are not live New Dawn statistics.
