# New Dawn Pathways — API, Data, and Security Contract

**Status:** Design contract for prototype and production estimate
**Base path:** `/api/mobile/v1`
**Client:** React Native + Expo + TypeScript

## Architecture decision

The mobile app is a limited client of the existing New Dawn platform. It does not call administrator, CRM, outreach, SEO, campaign, franchisee, or broad broker endpoints. All mobile access passes through purpose-built routes with validated request/response contracts and object-level authorization.

```text
iPhone app
  -> TLS + short-lived access token
  -> /api/mobile/v1
      -> identity and authorization service
      -> assessment and pathway service
      -> approved-content service
      -> referral and consent service
      -> appointment/support adapters
      -> PostgreSQL system of record
      -> audited provider calls and notifications

Existing web CRM/admin
  -> existing web routes
  -> same authoritative business records
```

## Repository layout

```text
mobile/
  app/                  Expo Router screens
  src/components/       accessible reusable native components
  src/features/         auth, investor, partner, attorney, support
  src/locales/          English and Spanish catalogs
  src/services/         generated API client, secure session, analytics
  src/testing/          fixtures and mock service adapter

server/mobile/
  auth/
  authorization/
  content/
  assessments/
  pathways/
  partners/
  referrals/
  appointments/
  support/
  notifications/
  analytics/
  routes.ts

shared/mobile/
  contracts.ts          Zod schemas and TypeScript types
  permissions.ts
  statuses.ts
  events.ts
```

## Identity and authorization model

### Proposed tables

| Table | Purpose |
|---|---|
| `mobile_identities` | Canonical login identity, normalized email, verification state, password hash, locale, status, timestamps. |
| `mobile_roles` | Investor, referral partner, attorney; role status and effective dates. |
| `mobile_identity_links` | Purposeful link to `crm_clients`, `brokers`, or approved attorney/partner profile. |
| `mobile_refresh_sessions` | Hashed rotating refresh token, device label, expiry, last use, revocation, network/security metadata. |
| `mobile_audit_events` | Immutable security and consequential-business events. |
| `mobile_deletion_requests` | Requested, identity verified, processing, completed, retention exception, and completion timestamps. |

### Token rules

- Access tokens expire in approximately 10 minutes.
- Refresh tokens rotate on every use and are stored only in iOS Keychain on device.
- The server stores a one-way hash of each refresh token.
- Refresh-token reuse revokes the token family and creates a security alert.
- Password reset and email verification tokens are short-lived, single-use, hashed, and rate-limited.
- Sign-out revokes the current session; “sign out everywhere” revokes all sessions.
- The API returns a generic authentication error without disclosing whether an email exists.

### Permissions

Permissions are explicit capabilities, not UI assumptions. Examples:

- `investor:assessment:write-own`
- `investor:path:read-own`
- `investor:appointment:manage-own`
- `partner:application:write-own`
- `partner:training:write-own`
- `partner:referral:create`
- `partner:referral:read-own`
- `attorney:resources:read`
- `attorney:coordination:read-invited`
- `account:sessions:manage-own`
- `account:deletion:request-own`

Every query constrains both role and object ownership. Tests must prove denial across different partner accounts, different investors, partner-to-attorney access, and revoked/suspended roles.

## Core data additions

### Assessments

| Table | Key fields |
|---|---|
| `assessment_versions` | version, locale-independent schema, status, reviewer, effective/expiry dates |
| `assessment_sessions` | investor identity, version, state, started/submitted timestamps |
| `assessment_answers` | session, question key, typed value; encrypted fields where justified |
| `assessment_results` | approved result category, reason keys, content version, created timestamp |
| `assessment_acknowledgements` | disclaimer version, locale, timestamp, source network metadata |

Result logic is deterministic, versioned, testable, and reviewed. It does not call an LLM or infer visa eligibility.

### My Path

| Table | Key fields |
|---|---|
| `pathway_instances` | investor, pathway version, current summary, timestamps |
| `pathway_milestones` | instance, key, owner, state, source type/reference, visible content version |
| `pathway_events` | milestone, event type, actor, durable receipt, occurred/recorded timestamps, metadata |

Milestone state changes are derived from allowed event transitions. Staff may correct a state only through an audited event with a reason.

### Partner applications and training

| Table | Key fields |
|---|---|
| `partner_profiles` | identity, partner type, company, jurisdictions, languages, approval state |
| `partner_applications` | version, responses, submitted state, reviewer, decision timestamps |
| `partner_agreements` | template version, signature provider reference, status, signed timestamp |
| `partner_training_assignments` | required module/version, state, score, completion timestamp |
| `partner_compliance_reviews` | compensation permitted state, jurisdiction scope, reviewer, effective/expiry dates |

### Referrals and consent

| Table | Key fields |
|---|---|
| `referrals` | partner, canonical investor link when accepted, safe status, idempotency key, timestamps |
| `referral_contact_snapshots` | normalized minimum submitted details, encrypted where appropriate |
| `referral_consents` | statement version, attestation, timestamp, partner, source, request ID |
| `referral_reviews` | accepted/duplicate_review/prior_contact, reviewer, reason code, resolution timestamps |
| `referral_events` | authoritative event, partner-visible mapping, occurred/recorded timestamps |

A unique request constraint prevents duplicate writes. Normalized contact hashes assist duplicate detection without becoming the only ownership rule.

### Approved content

| Table | Key fields |
|---|---|
| `content_items` | stable key, audience, content type, lifecycle state |
| `content_versions` | item, locale, version, body/structured content, effective/expiry dates |
| `content_reviews` | reviewer role, reviewer identity, decision, timestamp, notes |
| `content_sources` | official or controlling source URL/reference, accessed date |
| `content_acknowledgements` | identity, item/version/locale, timestamp |

Only `approved` and currently effective versions are returned. If controlling content is missing, expired, or locale-incomplete, the API fails closed with a support action.

## Endpoint plan

### Authentication and account

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Start investor or applicant account registration. |
| POST | `/auth/verify-email` | Verify a single-use code/token. |
| POST | `/auth/login` | Issue access and rotating refresh session. |
| POST | `/auth/refresh` | Rotate session and issue new access token. |
| POST | `/auth/logout` | Revoke current session. |
| POST | `/auth/password/forgot` | Send privacy-neutral recovery response. |
| POST | `/auth/password/reset` | Complete single-use reset. |
| GET | `/account` | Purpose-limited profile and roles. |
| PATCH | `/account` | Locale and editable profile fields. |
| GET | `/account/sessions` | Device/session list. |
| DELETE | `/account/sessions/:id` | Revoke owned session. |
| POST | `/account/deletion` | Initiate verified deletion workflow. |

### Content and configuration

| Method | Path | Purpose |
|---|---|---|
| GET | `/bootstrap` | Minimum version, maintenance, roles, feature flags, locale support. |
| GET | `/content/:key` | Approved localized item and source metadata. |
| GET | `/resources` | Audience-filtered current resource list. |
| GET | `/resources/:id` | Approved resource detail. |

### Investor

| Method | Path | Purpose |
|---|---|---|
| GET | `/investor/home` | Aggregated, purpose-limited dashboard. |
| POST | `/investor/assessments` | Start a version-pinned assessment. |
| PATCH | `/investor/assessments/:id/answers` | Save validated answer batch with idempotency. |
| POST | `/investor/assessments/:id/submit` | Produce deterministic reviewed result and receipt. |
| GET | `/investor/assessments/:id/result` | Result, reasons, limitations, and next actions. |
| GET | `/investor/path` | Pathway and milestone summary. |
| GET | `/investor/path/:milestoneKey` | Authorized milestone detail. |
| GET | `/investor/opportunities` | Approved opportunity projections. |
| GET | `/investor/opportunities/:id` | Approved versioned detail. |
| POST | `/investor/opportunities/:id/interest` | Durable information-request receipt. |

### Partner and attorney

| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/partner/application` | Read or update the owned application. |
| POST | `/partner/application/submit` | Submit current version and receive receipt. |
| GET | `/partner/status` | Approval/agreement/training readiness. |
| GET | `/partner/agreement` | Current approved agreement metadata/link. |
| GET | `/partner/training` | Required current modules. |
| POST | `/partner/training/:key/complete` | Record reviewed training result. |
| GET | `/partner/referrals` | Own safe referral projections only. |
| POST | `/partner/referrals` | Submit consented referral with idempotency key. |
| GET | `/partner/referrals/:id` | Own safe detail and events. |
| GET | `/attorney/coordination` | Invited, permissioned coordination list. |
| GET | `/attorney/coordination/:id` | Business-side coordination projection only. |

### Appointments, support, and notifications

| Method | Path | Purpose |
|---|---|---|
| GET | `/appointments` | Owned confirmed/pending appointment projections. |
| POST | `/appointments/scheduling-link` | Create context-bound scheduling handoff. |
| GET | `/support/thread` | Owned support messages only. |
| POST | `/support/messages` | Send text-only MVP message with idempotency. |
| POST | `/support/escalations` | Durable human-support request. |
| PUT | `/devices/push-token` | Register/rotate device token. |
| DELETE | `/devices/push-token` | Revoke device token. |
| GET/PATCH | `/notification-preferences` | Transactional/optional settings within policy. |

## Response and error contract

All successful state-changing responses include:

- `requestId`;
- `receiptId`;
- `state`;
- `recordedAt`;
- `nextAction` when relevant.

Errors use stable codes, localized display keys, retryability, and optional support actions. Internal exception messages, SQL errors, provider bodies, stack traces, other-account identifiers, and sensitive values never enter the mobile response.

Example categories:

- `VALIDATION_FAILED`
- `AUTHENTICATION_REQUIRED`
- `AUTHORIZATION_DENIED`
- `ROLE_NOT_APPROVED`
- `CONTENT_VERSION_UNAVAILABLE`
- `DUPLICATE_REVIEW_REQUIRED`
- `PROVIDER_TEMPORARILY_UNAVAILABLE`
- `REQUEST_ALREADY_RECORDED`
- `MINIMUM_APP_VERSION_REQUIRED`

## Idempotency and concurrency

- Every consequential POST accepts an `Idempotency-Key` UUID scoped to identity, endpoint, and payload hash.
- Identical retries return the original receipt.
- Reuse with a different payload returns a conflict.
- Referral duplicate checks, consent writes, and receipt creation occur in one transaction.
- Assessment submission locks the session version and is immutable; corrections create a new assessment.
- State-transition updates use expected version numbers to reject stale writes.

## Logging, audit, and analytics

Application logs may contain request ID, route template, status, duration, actor ID surrogate, and error code. They must not contain raw tokens, passwords, assessment answers, message bodies, document data, complete email/phone values, or serialized response bodies.

Audited events include authentication, role changes, application decisions, training completion, consent, referral decisions, milestone corrections, content approvals, session revocation, privacy export, and deletion.

Product analytics uses an allowlist such as:

- `entry_path_selected`
- `assessment_started`
- `assessment_step_completed`
- `assessment_submitted`
- `result_viewed`
- `path_milestone_viewed`
- `consultation_requested`
- `partner_application_submitted`
- `partner_training_completed`
- `referral_submitted`
- `referral_receipt_viewed`
- `support_escalation_requested`

Analytics properties may include screen ID, locale, app version, result category, role, and coarse timing. They may not include answer text, citizenship, residence, contact details, legal status, financial facts, message content, or referral identities.

## Testing contract

Minimum automated coverage:

1. contract tests for every request and response schema;
2. authentication token rotation, replay, expiry, revocation, and rate-limit tests;
3. negative cross-account and cross-role authorization matrix;
4. deterministic assessment golden tests for every supported version and category boundary;
5. referral consent, normalization, duplicate, idempotency, and concurrency tests;
6. pathway transition and authoritative-receipt tests;
7. approved/expired/missing content and locale fallback tests;
8. webhook signature and reconciliation tests;
9. account deletion and retention-exception tests;
10. English/Spanish catalog completeness and prohibited analytics/log-field tests.

## Security and privacy gates

Before TestFlight:

- threat model and data-flow map approved;
- no default production secrets;
- dependency and secret scans clean of critical/high findings;
- mobile API authorization tests pass in CI;
- tokens use Keychain and do not appear in logs/backups;
- privacy policy, retention map, account deletion, and App Store labels agree;
- penetration review covers account takeover, insecure direct object access, referral enumeration, token theft/replay, rate limits, and provider webhooks;
- incident owner, credential rotation, kill switches, and user-notification workflow are documented.
