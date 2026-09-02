# New Dawn Pathways — Implementation Backlog and Delivery Gates

**Planning baseline:** August 30, 2026
**Target:** Founding TestFlight pilot in 16 weeks after owners, legal reviewers, and required platform access are ready
**Current phase:** Clickable prototype review, claims review, and production-readiness discovery

## Delivery approach

Use one cross-functional delivery stream with weekly demonstrations. Build vertical slices—identity, one investor journey, one partner journey—rather than finishing the entire interface before the backend. Treat legal content, security, localization, and operations as product work, not end-of-project reviews.

## Phase 1 — Finalize requirements and controls (Weeks 1–2)

### P0: ownership and legal review

- [x] Name Jamie Greene as executive sponsor and interim product owner with scope and priority authority.
- [ ] Name immigration counsel and franchise counsel/compliance review owners.
- [ ] Name operations, technical, privacy/security, and Spanish localization owners.
- [ ] Confirm the initial approved opportunity set.
- [x] Draft the claims matrix for assessment, opportunity, status, notification, referral, and partner-resource content.
- [ ] Obtain named-owner, immigration-counsel, franchise/compliance, privacy, and Spanish-parity approvals in the matrix.
- [ ] Confirm partner categories and compensation rules by jurisdiction; keep attorneys uncompensated by default.

**Exit gate:** Every controlling content area has an accountable reviewer and approval workflow.

### P0: platform and data decisions

- [x] Complete local platform and schema audit.
- [x] Select React Native + Expo + TypeScript and `/api/mobile/v1` boundary.
- [x] Define mobile identity, role, referral, content, pathway, and assessment models.
- [x] Read back the deployed environment, production configuration keys, relevant schema, indexes, and aggregate-only identity quality without exposing secrets or customer rows.
- [x] Confirm `crm_clients` as the investor source of truth; treat `leads` as raw intake, `contacts` as outreach relationships, `brokers` as legacy partner accounts, and `broker_clients` as referral staging.
- [x] Create the duplicate-safe migration and backfill plan.
- [ ] Implement and approve migration dry-run reports before any production write.
- [ ] Approve the data-flow and retention map.

**Exit gate:** A deployable migration/API plan exists with no unresolved record-ownership ambiguity.

### P0: security remediation plan

- [x] Confirm production variable presence by name without reading secret values; remove runtime administrator-password and session-secret fallbacks.
- [x] Set fail-closed environment validation, proxy trust, and secure production cookie settings.
- [x] Patch the production dependency tree to zero known audit findings and enforce the production audit in CI.
- [ ] Design access/refresh token rotation, session management, verification, recovery, and deletion.
- [x] Stop logging serialized API response bodies; retain method, path, status, timing, and safe request ID only.
- [x] Define object authorization and negative test matrix.
- [ ] Replace Drizzle Kit's deprecated development-only loader when a stable compatible release removes its four moderate transitive advisories; do not force an unsupported override or downgrade.
- [ ] Verify provider webhook signatures and reconciliation paths.

**Exit gate:** Security owner accepts the threat model and remediation backlog.

## Phase 2 — Clickable prototype and validation (Weeks 2–3)

### Current completion

- [x] Create the Expo SDK 57 project with strict TypeScript and Expo Router.
- [x] Build the investor and referral-partner primary journeys with typed mock state.
- [x] Add non-advice boundaries and duplicate-review-safe referral language.
- [x] Verify type checking, linting, Expo compatibility, export, mobile layout, navigation, and browser runtime logs.
- [ ] Complete stakeholder, counsel, accessibility, and bilingual-content review.
- [ ] Run the representative research cohort and schedule approved findings.

### Prototype build order

1. Shared launch, language, role selection, boundaries, and account gate.
2. Investor assessment, result, home, and My Path.
3. Opportunity list/detail and consultation booking.
4. Partner application, approval simulation, agreement/training state.
5. Permissioned referral registration, duplicate-review result, and referral detail.
6. Attorney resource/coordination track.
7. Support, profile, sessions, notifications, privacy, and deletion.
8. Failure states: offline, stale content, revoked session, duplicate request, and provider outage.

### Prototype implementation decision

Create the prototype in the same Expo project intended for production, using a typed mock-service adapter. This provides realistic iPhone navigation and accessibility testing without connecting to live CRM data. The mock adapter is removed or restricted to development builds before pilot.

### Research cohort

- five prospective investors across different readiness and treaty-country profiles;
- five brokers/business advisers;
- two to three independent immigration attorneys;
- two New Dawn operations/sales users;
- at least three Spanish-first participants across roles.

**Exit gate:** Prototype approval metrics in the screen specification pass; counsel approves controlling prototype copy; open issues are classified and scheduled.

## Phase 3 — Foundation vertical slice (Weeks 4–6)

### Mobile foundation

- [x] Create `mobile/` Expo app, strict TypeScript, Expo Router, typed locale framework, design tokens, and accessibility primitives.
- [x] Add fail-closed prototype/connected environment separation and foundational unit tests.
- [x] Enforce the mobile foundation and security test suite in root CI.
- [ ] Add component tests and device preview builds.
- [ ] Resolve the monitored `xcode`/`uuid` advisory through an Expo-compatible dependency update; do not force an SDK-breaking downgrade.
- [ ] Implement secure session storage, generated API client, request IDs, idempotency, and error mapping.
- [ ] Add privacy-safe analytics allowlist and crash reporting.

### Backend foundation

- [x] Create the versioned `server/mobile/` route boundary, safe prelaunch status endpoint, and validated `shared/mobile/` contracts.
- [x] Define mobile identity, roles, investor links, partner profiles, rotating refresh sessions, hash-only one-time tokens, referrals, audit events, and deletion-request tables locally.
- [x] Add a prelaunch bootstrap endpoint, short-lived signed access-token service, hash-only refresh-token reuse evaluation, fail-closed authentication configuration, and privacy-safe error builder.
- [x] Generate and statically verify the staging migration from the local schema; no database migration was run.
- [ ] Implement registration, verification, login, refresh, logout, recovery, session management, and deletion initiation.
- [x] Add server authorization primitives and negative cross-account tests.
- [ ] Implement approved-content lifecycle and English/Spanish completeness rules.

### First production slice

- [ ] Investor signs up, verifies email, signs in, reads current boundaries, sees an empty My Path, manages sessions, and requests account deletion.

**Exit gate:** Security-reviewed identity slice passes automated and manual tests in a non-production environment.

## Phase 4 — Investor journey (Weeks 6–9)

- [ ] Implement assessment versions, sessions, answers, deterministic scoring, acknowledgements, results, and golden tests.
- [ ] Build investor assessment and result screens in English and Spanish.
- [ ] Implement pathway instances, milestone events, source receipts, and staff correction audit.
- [ ] Build Home and My Path.
- [ ] Create approved opportunity/content projections and information requests.
- [ ] Implement scheduling handoff, confirmed appointment projection, and support escalation.
- [ ] Add investor journey analytics and operational CRM views.

**Exit gate:** Investor acceptance criteria pass end to end with no legal-content or status ambiguity.

## Phase 5 — Partner and attorney journey (Weeks 8–11)

- [ ] Implement partner applications, review states, role/jurisdiction data, and staff decision workflow.
- [ ] Implement agreement metadata/provider handoff and versioned partner training.
- [ ] Implement consented referral intake, normalization, transactional duplicate review, and durable receipts.
- [ ] Create safe partner-visible status mapping from authoritative CRM events.
- [ ] Implement partner resources, approved sharing links, and support.
- [ ] Implement separate attorney verification, resource pack, and invited coordination projections.
- [ ] Prove cross-partner, investor, and attorney data isolation.

**Exit gate:** Approved partner can register and track a permitted referral; unapproved/suspended users and unrelated accounts are denied.

## Phase 6 — Notifications, hardening, and operations (Weeks 11–14)

- [ ] APNs/Expo push token lifecycle, transactional events, delivery receipts, retries, preferences, and safe lock-screen text.
- [ ] Staff mobile-journey views, support queue, duplicate-review queue, content approval, and audit lookup in the existing web administration.
- [ ] Offline cached approved content and local drafts with server-confirmed submission semantics.
- [ ] Accessibility, localization, performance, poor-network, interruption, device-size, and upgrade testing.
- [ ] Threat-model verification, dependency review, authorization test suite, retention/deletion test, and incident exercise.
- [ ] Privacy policy and App Store privacy labels finalized from the implemented data map.

**Exit gate:** No open release-blocking defects or critical/high unresolved security findings.

## Phase 7 — Founding pilot and App Store readiness (Weeks 15–16)

- [ ] Internal TestFlight group and release notes.
- [ ] Founding cohort invitations, consent, support channel, feedback capture, and daily issue review.
- [ ] Confirm primary investor and partner journey completion and status comprehension.
- [ ] Fix pilot blockers and complete regression testing.
- [ ] Prepare App Store screenshots, description, support URL, privacy URL, reviewer notes, demo account, and account-deletion instructions.
- [ ] Obtain executive, immigration counsel, franchise counsel, security/privacy, operations, and technical launch sign-off.

**Exit gate:** Submit only after signed launch authorization.

## First ten engineering work items after prototype approval

| Order | Work item | Why first |
|---:|---|---|
| 1 | Fail-closed production secret/config validation | Removes a foundational account-takeover risk. |
| 2 | Mobile contracts, error envelope, request IDs, and logging redaction | Establishes the safe API boundary before feature code. |
| 3 | Mobile identity and rotating sessions | Every saved journey depends on it. |
| 4 | Authorization primitives and negative test matrix | Prevents cross-account exposure as features expand. |
| 5 | Approved-content lifecycle and locale gate | Legal, privacy, assessment, and UI content depend on it. |
| 6 | Investor identity-to-CRM linking and dedupe migration | Preserves one investor record. |
| 7 | Versioned deterministic assessment | Delivers the first investor value without AI risk. |
| 8 | Pathway event/state engine | Makes every status accurate and auditable. |
| 9 | Partner approval/training permissions | Prevents unapproved referral activity. |
| 10 | Referral consent, dedupe, receipts, and isolation | Delivers partner value while protecting users and attribution. |

## Staffing recommendation

Minimum practical team during build:

- one accountable New Dawn product owner;
- one senior React Native engineer;
- one backend/TypeScript engineer;
- one product designer with mobile accessibility experience;
- fractional QA/accessibility and security/privacy support;
- immigration and franchise counsel at defined review gates;
- English/Spanish legal-content reviewer;
- New Dawn operations owner for approval, referrals, and support.

One strong full-stack engineer can prototype the experience, but the 16-week production target assumes at least two engineering contributors during implementation and reliable reviewer availability.

## Decision policy while work proceeds

The product and engineering team may make reversible UX and implementation decisions that stay inside the approved boundaries. The following require explicit accountable-owner approval:

- immigration or franchise claims;
- compensation eligibility or amounts;
- new sensitive data collection;
- payments or money movement;
- third-party custody of identity, financial, tax, immigration, or legal documents;
- changes to retention or account deletion;
- public App Store release;
- production development that materially expands the approved MVP.

## Immediate next actions

1. Retain **New Dawn Pathways** as the working name.
2. Review the completed Expo prototype with stakeholders and counsel.
3. Review and approve the drafted claims/content matrix from the screen specification.
4. Identify the named review owners and the initial approved opportunity set.
5. Provision an isolated staging database, verify its prerequisites, and explicitly approve applying the reviewed mobile-only migration there.
6. Run the migration, authentication, and rollback checks in staging; keep production authentication disabled.
7. Run prototype sessions, incorporate findings, and present the prototype plus final build estimate for the production authorization gate.
