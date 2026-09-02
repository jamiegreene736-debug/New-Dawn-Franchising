# New Dawn Pathways — Staging Migration Validation

**Execution date:** September 2, 2026

**Result:** Passed in isolated staging; production unchanged

## Target boundary

- Railway project: `New Dawn Franchising`
- Environment: `staging` (`8b13ef91-c513-49a0-90d8-bc351b1f48ec`)
- Database service: `Postgres-wJ5s` (`729a3f3f-6f23-4b29-8d50-7039973c1e7e`)
- Database deployment: `b9990105-64bf-4697-b734-a35946dba6f3`
- Migration: `migrations/mobile/0000_mobile_identity_foundation.sql`
- Reviewed SHA-256: `4cada0636c31ea4e876dac682f629b9549b77b5e2e5a0492d26f55a1666c2f71`

The environment was created empty rather than duplicated from production. It contains no production customer rows or third-party production credentials. A minimal empty `crm_clients` table containing only its `id` primary key was created as the foreign-key prerequisite. This is a migration-validation database, not yet a complete application staging environment.

## Preflight

- The Railway CLI link and service selection both resolved to `staging`.
- The fresh PostgreSQL 18 service deployed successfully.
- `crm_clients` and all ten `mobile_*` tables were absent before initialization.
- Static migration verification passed: 57 allowlisted statements, ten mobile tables, eight mobile enums, and `crm_clients` as the only external reference.

## Transactional rehearsal and rollback

The complete reviewed migration was first executed inside a PostgreSQL transaction:

- ten mobile tables were created;
- all mobile tables contained zero rows;
- both foreign keys to `crm_clients` used `ON DELETE RESTRICT`;
- the transaction was rolled back;
- the post-rollback readback showed zero mobile tables and the prerequisite remained present.

## Staging application and readback

The same checksum-verified migration was then applied to staging:

- all ten expected mobile tables are present;
- all eight expected mobile enums are present;
- 38 mobile indexes are present, including primary-key indexes;
- all ten mobile tables contain zero rows;
- both CRM foreign keys retain restrictive deletion behavior.

## Production non-impact evidence

A separate read-only production transaction after the staging application confirmed:

- the production `crm_clients` prerequisite remains present;
- production contains zero `mobile_*` tables;
- no production migration or CRM backfill was executed;
- production mobile authentication remains disabled.

## Investor pathway increment

The generated `migrations/mobile/0001_mobile_pathway_pilot.sql` artifact (SHA-256 `6c72edceb57b3a5f5b831bfbd6f1b9d9774e3fa4a30f400b2e300e2070f09c8e`) was separately rehearsed inside a transaction, where all three pathway tables were visible, and then rolled back. The post-rollback readback remained at zero pathway tables. The same artifact was then applied to isolated staging, producing exactly three pathway tables. No customer data or production schema was copied or changed.

The pathway API deployment `f4968022-13cd-4901-bff2-6474c087cf92` completed successfully. A synthetic end-to-end smoke run verified investor registration, verification, authenticated pathway readback, the first milestone detail, refresh-token reuse revocation, recovery, deletion, and partner approval gating. The two synthetic identities and their related records were then removed; staging readback returned zero identities, pathway instances, milestones, and pathway events. A separate read-only production transaction returned zero `mobile_pathway_*` tables.

The native Expo project was generated and opened as `NewDawnPathways.xcworkspace`. Xcode built it for the iOS 26.5 iPhone 17 Pro Max simulator with zero errors, installed it, and launched the connected staging configuration successfully.

## Remaining gates

1. Build a staging-safe API service profile that disables every email, campaign, sync, posting, scheduled, and paid-provider background job.
2. Replace the minimal prerequisite with an approved schema-only application baseline before staging API integration.
3. Implement transactional authentication repositories and endpoints behind the disabled feature flag.
4. Complete the CRM duplicate review and data-flow/retention approvals.
5. Require a separate production migration approval after staging authentication and rollback evidence pass.
