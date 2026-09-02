# New Dawn Pathways — Staging Migration Runbook

**Scope:** Create the empty mobile-owned schema in an isolated staging database

**Current state:** Migration generated and statically verified; not applied to any database

## Safety boundary

This runbook does not authorize a production migration, CRM record merge, identity backfill, or mobile-authentication launch. The staging database must be isolated from production and must not contain real customer data unless the privacy/security owner has explicitly approved its use.

The migration may create only the ten `mobile_*` tables, eight `mobile_*` enums, their constraints and indexes, and foreign keys that reference the existing `crm_clients` table. It must not change or write to `crm_clients` or any other core table.

## Required approvals and prerequisites

Before applying the migration:

1. Record the staging environment and database owner. Confirm that the target is not production.
2. Confirm that staging has a recoverable backup or disposable database snapshot.
3. Run `npm run mobile:migration:verify` and match the reviewed SHA-256 in the data-ownership plan.
4. Run `npm run mobile:schema:readiness` against staging. `crm_clients` must be present and every `mobile_*` table must be absent.
5. Obtain technical and privacy/security approval for the isolated staging execution.

Stop if the target cannot be positively identified, if any mobile table already exists, if `crm_clients` is absent, if the checksum differs, or if the verifier fails.

## Controlled staging execution

Apply `migrations/mobile/0000_mobile_identity_foundation.sql` through the approved staging database release mechanism. Do not use `db:push`, because it compares the complete application schema and is outside this mobile-only change boundary.

The operator must retain the deployment log, database target identifier, migration checksum, start/end time, and approver names. The migration intentionally performs no backfill and creates no identities, referrals, sessions, or tokens.

## Acceptance checks

After the staging release:

1. Run `npm run mobile:schema:readiness` again. Every prerequisite and mobile table must be present.
2. Confirm all ten mobile tables contain zero rows.
3. Confirm the two foreign keys to `crm_clients` use `ON DELETE RESTRICT`.
4. Run the mobile foundation/security tests and the API status/bootstrap checks against staging.
5. Confirm the bootstrap response still reports authentication as disabled.
6. Exercise rollback on a disposable copy before authentication endpoints are connected.

Stop and restore the staging snapshot if any unexpected object changes, data writes, missing constraints/indexes, non-empty mobile tables, or API regressions are observed.

## Production gate

Production remains unchanged until all of the following are complete: staging migration and rollback evidence, CRM duplicate review, data-flow and retention approval, named legal/privacy/security owners, transactional authentication tests, and a separate production change approval. Production mobile authentication remains disabled until that gate is signed.
