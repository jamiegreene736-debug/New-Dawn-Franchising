# New Dawn Pathways — Data Ownership and Migration Plan

**Status:** Architecture decision, local schema, aggregate dry-run tooling, and mobile-only migration package implemented; migration applied only to an isolated empty staging database
**Production readback:** August 30, 2026
**Evidence boundary:** Table/column/index metadata and aggregate counts only; no names, email addresses, phone numbers, notes, or customer rows were displayed

## Authoritative ownership decision

| Existing table | Current purpose | Mobile decision |
|---|---|---|
| `crm_clients` | Investor/customer CRM and journey status | Authoritative investor business record. A mobile investor identity links to one reviewed CRM record. |
| `leads` | Raw public lead capture | Intake only. Normalize and match before creating or linking a CRM client; do not use as the saved mobile journey. |
| `contacts` | Outreach and professional relationship database | Outreach source only. Do not treat it as an authenticated investor or partner account. |
| `brokers` | Legacy broker login, agreement, and partner profile | Legacy partner record. Link to a new mobile identity/partner profile rather than reusing cookie-session authentication. |
| `broker_clients` | Legacy partner referral intake | Referral staging and attribution source. Match transactionally to one CRM client or create a review item. |
| `users` | Generic legacy username/password table | Not a mobile identity source. Do not migrate password material into the mobile authentication system. |

## Production quality snapshot

| Table | Total rows | Missing/blank email | Usable email rows | Normalized unique emails | Duplicate excess |
|---|---:|---:|---:|---:|---:|
| `crm_clients` | 417 | 8 | 409 | 395 | 14 |
| `contacts` | 1,296 | 410 | 886 | 886 | 0 |
| `brokers` | 0 | 0 | 0 | 0 | 0 |
| `broker_clients` | 0 | 0 | 0 | 0 | 0 |

`crm_clients.email` has no unique index. The 14 excess normalized duplicates must be reviewed before adding identity links or any uniqueness constraint. `contacts.email` and `brokers.email` have unique indexes; `broker_clients.email` does not.

## New mobile identity boundary

Create new mobile-owned tables rather than adding authentication secrets to CRM records:

- `mobile_identities` — normalized unique email, verification state, password/auth-provider metadata, lifecycle status, and timestamps;
- `mobile_identity_roles` — investor, partner, and attorney assignments with approval and suspension state;
- `mobile_investor_links` — one reviewed mobile identity to one authoritative `crm_clients` record;
- `mobile_partner_profiles` — application, agreement, training, jurisdiction, and approval state;
- `mobile_referrals` — immutable consent receipt, normalized minimum contact details, attribution, and review status;
- `mobile_referral_matches` — restricted staff-only link to the authoritative CRM record after transactional review;
- `mobile_pathway_instances`, `mobile_pathway_milestones`, and `mobile_pathway_events` — investor-owned progress, explicit ownership/state, and append-only authoritative event history;
- `mobile_refresh_sessions`, `mobile_audit_events`, and `mobile_deletion_requests` — authentication and accountability controls.

These tables are now defined locally in `shared/mobile/schema.ts`. The implementation also includes hash-only, expiring, one-time email verification/password-reset tokens; refresh-token family, rotation, revocation, and reuse-detection fields; idempotency and match-key hashes for referrals; and explicit referral retention expiry.

The generated staging package comprises `migrations/mobile/0000_mobile_identity_foundation.sql` and `migrations/mobile/0001_mobile_pathway_pilot.sql`. Its static verifier permits only mobile-namespaced enum, table, foreign-key, and index creation; the existing `crm_clients` table may be referenced by foreign keys but cannot be altered. It rejects data writes, drops, executable SQL, core-table changes, unexpected objects, and incomplete packages. The reviewed package currently contains 73 statements across 13 mobile tables and ten mobile enums, with aggregate SHA-256 `0aeec917eee062a344a2eae13e2f095f16f52c039ea2ba4e43d4a90ea6676db3`.

Run `npm run mobile:migration:verify` to validate the committed artifacts without connecting to a database. Run `npm run mobile:schema:readiness` only with an intentionally selected environment; it opens a read-only transaction, reports table presence only, and always rolls back. Both migrations were transactionally rehearsed, rolled back, and then applied to the isolated Railway `staging` database on September 2, 2026. Neither has been applied to production.

No mobile table stores passports, banking/tax records, immigration filings, biometrics, source-of-funds evidence, or legal documents.

## Duplicate-safe backfill sequence

1. Create the mobile tables and indexes in a non-production migration; do not backfill during schema creation.
2. Generate a dry-run report using normalized email and phone signals. The report contains record IDs and confidence classifications for restricted staff review, not automatic merges.
3. Place the 14 excess normalized CRM duplicates and all eight missing/blank-email records into a review queue.
4. Classify each candidate as same person, shared/household contact, placeholder/bad data, or distinct people. Preserve an immutable decision receipt.
5. Create one mobile identity only after email verification. Link it to a CRM client only on a unique high-confidence match or an approved staff decision.
6. When a partner submits a referral, lock on the normalized contact key inside one transaction, then return a neutral review receipt. Never reveal an existing record or referring partner.
7. Backfill legacy broker links only if broker records exist and the person verifies the same email; do not migrate password hashes or cookie sessions.
8. Add any CRM uniqueness constraint only after duplicates and blank values are resolved, downstream writers are validated, and the migration dry run is clean.
9. Reconcile counts, orphan links, and audit events before enabling connected mobile mode.

## Dry-run acceptance criteria

- zero production writes;
- every proposed link has a reason, confidence, source IDs, and reversible review state;
- no two active mobile identities link to the same investor without an explicit approved household/business rule;
- no mobile identity is created from an unverified outreach contact;
- duplicate review responses disclose no third-party existence or attribution;
- rerunning the dry run produces the same result from unchanged source data;
- aggregate before/after counts reconcile before any migration is authorized.

## Next authorization point

Engineering can apply the reviewed package to an isolated non-production database only after the staging prerequisites and target are verified. Running a production write migration, merging CRM records, or enabling connected mobile authentication requires review of the dry-run output and approval from the product, operations, and privacy/security owners.

The aggregate-only dry-run command is `npm run mobile:identity:dry-run`. It opens a read-only transaction, reports counts and duplicate quality only, and always rolls back. It never prints names, email addresses, phone numbers, or customer rows.

The controlled staging procedure and stop conditions are documented in `docs/mobile/08_STAGING_MIGRATION_RUNBOOK.md`. The completed execution evidence is recorded in `docs/mobile/09_STAGING_MIGRATION_VALIDATION.md`.
