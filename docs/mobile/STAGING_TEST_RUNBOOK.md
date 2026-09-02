# New Dawn Pathways staging test runbook

## Purpose

Validate the iOS pilot without touching production identities, CRM records, campaigns, provider integrations, or customer data.

## Test environment

- API: `https://new-dawn-mobile-staging-staging.up.railway.app`
- App mode: `connected`
- Data: isolated Railway staging Postgres service
- Allowed data: synthetic names and `example.test` email addresses only
- Prohibited data: passports, government identifiers, bank or tax data, legal documents, immigration filings, and real customer information

## Required checks

1. Open the app and confirm the footer reads **Internal pilot · Staging data only · No production connection**.
2. Create an investor account with a unique `example.test` email and a password of at least 12 characters.
3. Confirm the staging-only verification token is preloaded, then verify the account.
4. Confirm the app opens the investor workspace and Profile shows the correct email, an active secure session, and **Staging** environment.
5. Sign out, sign back in, close and reopen the app, and confirm the secure session restores successfully.
6. Confirm an invalid password produces a generic sign-in error without revealing whether an account exists.
7. Create a partner account and verify it; confirm the app shows **Application ready for review** and does not grant workspace access.
8. From an investor Profile, request account deletion and confirm the app signs out.
9. Confirm attorney registration is disabled for the pilot.
10. Confirm the public production website remains healthy and its mobile bootstrap still reports authentication disabled.

## Acceptance boundary

The pilot is ready to advance to TestFlight when all checks pass on at least two supported iPhones, VoiceOver labels are understandable, legal and privacy copy is approved, and Apple signing access is available. Production authentication remains off until transactional email, privacy operations, monitoring, and a separate production migration are approved.
