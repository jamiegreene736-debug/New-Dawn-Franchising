# New Dawn Pathways — Platform Audit and Gap Assessment

**Audit date:** August 30, 2026
**Scope:** Local `main` checkout of the existing New Dawn web, CRM, broker, training, scheduling, messaging, and database implementation.
**Method:** Read-only code and schema review plus the existing TypeScript check. No production data, provider settings, or live deployment state was changed.

## Executive finding

The current platform is a useful foundation, but it is not safe to expose directly as a mobile API. The fastest reliable path is to reuse the business data and services behind a new mobile boundary, while correcting identity, authorization, consent, content-versioning, and sensitive-data risks.

The existing platform meaningfully reduces the amount of work required for:

- investor lead and CRM records;
- broker accounts, agreements, and referral lists;
- franchisee training concepts and disclaimer acknowledgements;
- appointment and Calendly synchronization;
- email, SMS, WhatsApp, and operational notification infrastructure;
- partner prospecting and campaign operations;
- existing React/TypeScript and Express/PostgreSQL experience.

It does **not** yet provide a production mobile identity system, investor accounts, mobile-safe object authorization, versioned bilingual content, readiness assessments, path milestones, consented referral deduplication, push notifications, account deletion, or mobile privacy controls.

## Current reusable capabilities

| Capability | Current implementation | Mobile decision |
|---|---|---|
| Investor CRM | `crm_clients` includes contact, country, citizenship, investment, visa type, language, broker attribution, and stage fields. | Reuse as the operational investor record after data normalization; expose only a purpose-limited projection. |
| Investor activity | `crm_client_activities` records typed timeline events. | Extend to authoritative, typed pathway events rather than deriving completion from loose status text. |
| Broker accounts | `brokers` has profile, password hash, agreement state, and signed PDF. | Reuse the profile and agreement status; add approval, verification, role, jurisdiction, training, and mobile identity links. |
| Broker referrals | `broker_clients` isolates lists by broker and resolves a simplified CRM status by email. | Replace email-only linkage with consented, transaction-safe referral records connected to one CRM investor. |
| Agreements | Broker agreement generation, signature status, and PDF retrieval exist. | Show agreement status and an approved view/download link; do not put raw PDF data in mobile responses. |
| Training | Franchisee training tracks, progress, quizzes, certificates, acknowledgements, and announcements exist. | Reuse service patterns, not franchisee permissions; create partner-specific training assignments and versions. |
| Scheduling | Calendly user/event reads and webhook-created meeting records exist. | Use a server-created scheduling link and mobile-safe appointment projection; verify webhook authenticity before trusting events. |
| Messaging | Email, SMS, WhatsApp, and staff outreach services exist. | Use one mobile support thread with server-controlled delivery; never expose the broad CRM sending endpoints. |
| Notifications | Internal notification records and event-bus patterns exist. | Add device tokens, transactional preferences, APNs delivery receipts, idempotency, and privacy-safe payloads. |
| Content | Public E-2 pages, blogs, training content, and AI content tools exist. | Create an approved-content service; never pull controlling copy directly from marketing pages or generated drafts. |
| Operations | Existing CRM and administrative web pages cover contacts, pipeline, tasks, meetings, content, and campaigns. | Keep staff operations web-only for MVP; add mobile journey views to the existing administration later. |

## Critical gaps and required decisions

### 1. Identity and session security — release blocker

Current browser authentication uses server sessions. Brokers and administrators share the same general login surface, while investors have no account model. The server contains development fallback values for the administrator credential and session secret. The production environment may override them, but the application must fail closed if those variables are absent.

Required before a mobile pilot:

- no fallback administrator password or session secret;
- secure production cookies for the web application;
- mobile access tokens that expire quickly and rotating refresh tokens stored hashed at rest;
- email verification, password reset, session/device listing, revocation, and suspicious-login controls;
- explicit mobile role assignments and server-side object authorization;
- rate limiting and audit events for every authentication action;
- in-app account deletion initiation and a documented retention workflow.

### 2. Partner approval — release blocker

The current broker registration flow authenticates a newly created broker immediately. The approved mobile flow requires verification, jurisdiction review, agreement completion, and training before client registration.

Decision:

- registration creates an **applicant**, not an active referral partner;
- states are `application_started`, `submitted`, `under_review`, `changes_requested`, `approved`, `suspended`, and `declined`;
- only `approved` partners with current agreement and training versions receive the `referral:create` permission;
- attorneys use a separate role and are uncompensated by default.

### 3. Referral consent and duplicate safety — release blocker

The current broker-client record accepts contact details without a recorded permission statement and relies on email matching for CRM status. There is no transaction-safe cross-partner duplicate decision model.

Decision:

- require the partner to attest that the person gave permission to share the specified details;
- store the consent statement version, timestamp, partner, source, and request identifier;
- normalize email and phone before deduplication;
- perform duplicate review on the server in one transaction;
- return only `accepted`, `duplicate_review`, or `prior_contact` without revealing another partner's identity;
- route ambiguous ownership to New Dawn operations instead of resolving it automatically.

### 4. Investor identity and My Path — missing capability

There is no investor login, saved readiness assessment, or authoritative pathway model.

Decision:

- link one mobile identity to one CRM investor record;
- store versioned assessment responses separately from the CRM summary;
- store pathway milestones with owner, state, authoritative source, visible explanation, and timestamps;
- use `not_started`, `available`, `in_progress`, `awaiting_professional`, `awaiting_new_dawn`, `completed`, and `not_applicable` as user-facing milestone states;
- never infer `completed` from an email being sent, a document being requested, or a meeting being scheduled.

### 5. Sensitive document custody — excluded from MVP

The current CRM stores uploaded files as base64 data in PostgreSQL and exposes them to administrators. That feature must not become the mobile document design.

Decision:

- the app collects no passports, bank statements, tax records, immigration filings, biometrics, or source-of-funds evidence;
- the app may show a non-sensitive document/status card such as “FDD available” or “Receipt recorded” when backed by an authoritative event;
- any future sensitive-document feature requires a specialized provider, a separate privacy/security review, and provider-status references rather than raw files in New Dawn's normal application tables.

### 6. Content and legal claims — release blocker

The public codebase contains marketing statements about E-2 timing, qualification characteristics, refunds, substantiality, at-risk requirements, and possible EB-5 progression. Those statements cannot be copied into the app without a source, owner, effective date, and legal approval.

Decision:

- create a claims matrix before prototype approval;
- controlling mobile content comes only from the approved-content service;
- every controlling item has version, locale, reviewer, effective date, expiration date, source references, and applicable audience;
- generated AI content and general marketing-page content are never controlling sources;
- expired or unapproved content fails closed and produces a human-support action.

### 7. Authorization and privacy — release blocker

The current broker endpoints isolate broker-client lists by session broker, but the implementation loads all CRM clients and filters them in application memory to derive status. Mobile projections should query only rows the caller may access. The app also needs negative authorization tests proving denial across roles and partner accounts.

Required controls:

- object-level database query constraints, not response-time filtering;
- minimum mobile projections that omit internal notes, raw messages, documents, other partner attribution, and admin fields;
- structured logs that do not serialize API response bodies containing personal data;
- audit records for consent, role changes, status changes, account access, exports, and deletion;
- privacy-safe push notifications and analytics events;
- documented retention periods and deletion exceptions.

### 8. Scheduling and webhooks — gap

Calendly reads and meeting records exist, but webhook authenticity is not established in the reviewed route.

Decision:

- use a signed, verified Calendly webhook or reconcile events through authenticated API reads;
- never display a meeting as booked until an authoritative event exists;
- keep a fallback server-generated Calendly link for initial pilot reliability;
- display timezone explicitly and provide calendar handoff.

### 9. Localization and accessibility — missing release capability

The existing website is primarily English and does not provide a versioned localization system.

Required:

- complete English and Spanish string catalogs;
- human review for legal, privacy, assessment, error, and notification text;
- no mixed-language controlling screen;
- Dynamic Type, VoiceOver labels, sufficient contrast, logical focus order, reduced-motion support, and 44-point touch targets;
- Spanish and accessibility checks in automated and manual release gates.

### 10. Observability and reliability — partial foundation

Event, notification, and queue concepts exist, but the app requires mobile-specific delivery receipts, idempotency, and release health.

Required:

- request IDs and idempotency keys on state-changing endpoints;
- bounded retry with backoff and jitter for provider calls;
- first-party analytics events with prohibited-field enforcement;
- crash-free sessions, API success, latency, notification delivery, refresh failure, and duplicate-write dashboards;
- feature flags and kill switches for assessment release, referrals, notifications, and future AI.

## Data-model findings

1. `crm_clients` is the best current investor system of record, but free-form status and mixed-profile fields need normalization.
2. `broker_clients` is a referral intake table, not a sufficient ownership or consent ledger.
3. `brokers` is a useful starting profile but lacks approval state, jurisdiction, partner type, training version, and role assignments.
4. `partner_leads` represents outbound prospects, not authenticated partners. Conversion must create or link an approved partner identity without duplicating the person.
5. `franchisees` and training tables provide patterns but should remain separate from pre-sale investor and referral-partner roles.
6. Several training and activity relationships use string IDs without complete foreign-key enforcement; new mobile tables should use explicit constraints and deletion behavior.
7. Email casing and phone normalization need canonical fields before identity or duplicate matching.

## Baseline verification

- `npm run check` passes on the current local checkout.
- The checkout contains unrelated, pre-existing modified and untracked work. This audit added documentation only and did not alter those application files.
- Live production configuration, provider custody, deployed database state, and Railway environment variables were not treated as verified by this local audit.

## Release blockers summary

The prototype may use mock data while these are designed. A TestFlight pilot may not begin until all items below are resolved or explicitly accepted by the accountable owner:

1. production secrets fail closed;
2. mobile authentication and object authorization are implemented and tested;
3. partner approval and consented referral deduplication exist;
4. legal claims matrix and approved content versions are complete;
5. sensitive documents and payments remain excluded;
6. account deletion, retention, privacy policy, and App Store privacy declarations agree;
7. verified scheduling events and privacy-safe notifications exist;
8. English/Spanish and accessibility gates pass;
9. security review finds no critical or high unresolved issues.
