# New Dawn Pathways Mobile Control Pack

**Status:** Approved product direction; connected identity pilot deployed to isolated staging and ready for internal testing
**Approval source:** Jamie Greene approved the August 30, 2026 Product Requirements Document as proposed.
**Working product name:** New Dawn Pathways
**Executive sponsor and interim product owner:** Jamie Greene

This folder is the implementation source of truth for the New Dawn Pathways iOS app. It translates the approved PRD into decisions that engineering, design, operations, security, and counsel can review without reopening the entire product direction.

## Current decision

Build one iPhone app with three permissioned experiences:

1. **Investor** — education, readiness assessment, My Path, opportunities, appointments, and support.
2. **Referral partner** — application, approval, training, permitted client registration, referral status, resources, and support.
3. **Independent attorney** — an uncompensated-by-default resource and coordination track. Attorneys do not receive investor legal files through the MVP.

New Dawn staff continue using the existing web administration and CRM surfaces. The MVP does not create a second staff CRM.

## Product decisions made on the owner's behalf

| Area | Decision |
|---|---|
| Name | Retain **New Dawn Pathways** through prototype testing. |
| Platform | React Native, Expo, and TypeScript, starting with iOS and preserving an Android path. |
| Repository | Add the app under `mobile/`; add mobile backend modules under `server/mobile/`; keep shared validated contracts under `shared/mobile/`. |
| Backend | Reuse the current Express/PostgreSQL platform through a dedicated, versioned `/api/mobile/v1` boundary. |
| Identity | Introduce mobile identities and explicit role assignments. Do not reuse the browser's cookie session as the mobile authentication design. |
| Investor record | Keep one authoritative investor/CRM record. A partner referral links to that record rather than creating a permanent duplicate. |
| Partner access | Approval, agreement, and required training must be complete before a partner can register a client. |
| Attorney access | Resource and coordination access only; compensation is disabled unless separately approved in writing. |
| Legal posture | Education and business-pathway coordination only. No visa eligibility decision or immigration advice. |
| Documents | Do not expose or collect passports, bank records, tax records, immigration filings, biometrics, or source-of-funds evidence in MVP. |
| Payments | No investments, wires, commissions, or payment-status screens in MVP. |
| AI | Defer the AI concierge until the approved-content service and refusal/escalation controls exist. |
| Languages | English and Spanish are both release requirements, including disclosures and errors. |
| Content | All controlling content must be server-managed, versioned, reviewable, localizable, and capable of expiration. |
| Analytics | First-party product events with no sensitive answer text, immigration facts, message bodies, or legal content in analytics payloads. |
| Launch | Founding TestFlight cohort before public App Store release. |

## Active phase gate

Approval of the PRD authorizes the requirements, audit, and clickable-prototype phase. Production implementation begins only after these are approved together:

- screen-level specification;
- mobile API and data contract;
- legal claims/content review plan;
- security remediation plan;
- clickable prototype and pilot findings;
- delivery estimate and staffed backlog.

## Control-pack documents

- [`01_PLATFORM_AUDIT.md`](./01_PLATFORM_AUDIT.md) — reusable capabilities, gaps, risks, and release blockers.
- [`02_SCREEN_SPECIFICATION.md`](./02_SCREEN_SPECIFICATION.md) — navigation, screen inventory, states, actions, and acceptance notes.
- [`03_API_DATA_SECURITY_CONTRACT.md`](./03_API_DATA_SECURITY_CONTRACT.md) — mobile boundary, identity, data ownership, endpoint plan, security, and events.
- [`04_IMPLEMENTATION_BACKLOG.md`](./04_IMPLEMENTATION_BACKLOG.md) — sequenced work, gates, estimates, owners, and immediate next actions.
- [`05_PROTOTYPE_HANDOFF.md`](./05_PROTOTYPE_HANDOFF.md) — prototype journeys, verification results, limitations, and review checklist.
- [`06_CLAIMS_CONTENT_MATRIX.md`](./06_CLAIMS_CONTENT_MATRIX.md) — counsel-ready inventory of controlling claims, boundaries, sources, and approvals.
- [`07_DATA_OWNERSHIP_MIGRATION_PLAN.md`](./07_DATA_OWNERSHIP_MIGRATION_PLAN.md) — production schema readback, authoritative-record decisions, aggregate quality findings, and duplicate-safe migration sequence.
- [`08_STAGING_MIGRATION_RUNBOOK.md`](./08_STAGING_MIGRATION_RUNBOOK.md) — fail-closed commands and gates for staging migration validation.
- [`09_STAGING_MIGRATION_VALIDATION.md`](./09_STAGING_MIGRATION_VALIDATION.md) — recorded isolated migration rehearsal and rollback evidence.
- [`STAGING_TEST_RUNBOOK.md`](./STAGING_TEST_RUNBOOK.md) — internal iPhone acceptance flow and strict synthetic-data boundary.

## Definition of prototype approval

The prototype is approved when representative investors and partners can complete the primary journeys without coaching, understand that the app does not give legal advice, identify the next human action, and correctly interpret every visible status. Counsel must approve the controlling English content and the Spanish reviewer must confirm meaning parity before production development begins.
