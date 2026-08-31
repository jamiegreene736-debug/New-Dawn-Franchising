# New Dawn Pathways — Mobile Screen Specification

**Status:** Prototype specification
**Primary device:** iPhone 15/16 class sizes, supporting all currently supported iPhone widths through responsive native layouts
**Languages:** English and Spanish

## Experience principles

1. Show one primary next action per screen.
2. Separate business education from legal advice in both language and visual hierarchy.
3. Explain why information is requested before collecting it.
4. Delay account creation until the user saves, books, messages, applies, or registers a referral.
5. Show who owns every pathway step: Investor, New Dawn, or Independent Counsel.
6. Use authoritative statuses and receipts; never overstate completion.
7. Give users a visible human-support route on every consequential screen.
8. Keep attorney and compensated-partner experiences separate.

## Global navigation

### Investor tabs

- **Home** — status, next action, upcoming appointment, recent resource.
- **Explore** — approved New Dawn opportunities and general E-2 education.
- **My Path** — readiness result and staged checklist.
- **Support** — appointments and secure support conversation.
- **Profile** — identity, language, consents, notifications, privacy, sessions, deletion.

### Referral-partner tabs

- **Home** — approval/training status and referrals requiring action.
- **Referrals** — own referrals only, plus permitted registration action.
- **Resources** — versioned partner materials and training.
- **Support** — assigned New Dawn contact, appointment, and support conversation.
- **Profile** — business identity, jurisdictions, agreement, settings, privacy, sessions, deletion.

### Attorney tabs

- **Home** — resource updates and invited coordination items.
- **Resources** — counsel diligence materials and source-controlled information.
- **Coordination** — client coordination items visible only with recorded client permission.
- **Support** — New Dawn contact and appointment.
- **Profile** — professional identity, jurisdictions, disclosures, settings, privacy, deletion.

## Shared entry and identity screens

| ID | Screen | Purpose and primary action | Required states |
|---|---|---|---|
| SH-01 | Launch | Brand entry and initialization. | loading, minimum-version block, offline cached-content option, maintenance |
| SH-02 | Language | Choose English or Spanish before controlling copy appears. | selected, unavailable-locale fallback |
| SH-03 | Choose a path | Investor, referral partner, or attorney selection. | default, role explanation expanded |
| SH-04 | Privacy and boundaries | Concise data use, no-legal-advice boundary, and source links. Primary action: Continue. | content unavailable, updated version acknowledgement |
| SH-05 | Create account | Email and password with terms/privacy links. | validation, email already used, rate limited |
| SH-06 | Verify email | Enter code or use verified link. | resend timer, expired, incorrect, success |
| SH-07 | Sign in | Email/password and recovery. | invalid credentials, locked/rate limited, unverified |
| SH-08 | Forgot/reset password | Request and complete password reset. | privacy-neutral request result, expired token, success |
| SH-09 | Session/security | View devices/sessions and revoke. | current session, other session, revoked |
| SH-10 | Profile/settings | Identity, locale, notification preferences, privacy links. | saved, validation, server conflict |
| SH-11 | Delete account | Explain deletion and retention exceptions; verify identity. | requested, pending, completed, legally retained subset |
| SH-12 | Global recovery | Human-readable retry and support path. | offline, timeout, maintenance, authorization expired, unknown receipt |

## Investor screens

### Entry and readiness

| ID | Screen | Required content and behavior |
|---|---|---|
| IN-01 | Investor welcome | Explain business-pathway purpose, time to complete, and non-legal boundary. Allow Explore first or Start assessment. |
| IN-02 | Assessment consent | Explain fields, retention, version, and that results are general business alignment—not visa eligibility. |
| IN-03 | Nationality and residence | Collect citizenship/nationalities separately from residence. Permit “prefer not to answer” where possible and route legal questions to counsel. |
| IN-04 | Investment range | Use ranges, not bank balances or source-of-funds evidence. Explain why the business range matters. |
| IN-05 | Timeline and location | Desired start window, U.S. location preference, and flexibility. |
| IN-06 | Experience and involvement | Business experience, desired operating involvement, and support needs. Avoid legal conclusions. |
| IN-07 | Current professional support | Whether the user already has independent immigration counsel; never rank attorneys. |
| IN-08 | Review answers | Editable summary, assessment version, privacy reminder, Submit. |
| IN-09 | Assessment result | One approved category: Strong Potential Alignment, Professional Review Recommended, Not Currently Aligned, or More Information Needed. Show business reasons, limitations, sources, and human next actions. |
| IN-10 | Save result/account gate | Create or sign into an account to save My Path. Do not force account creation to view the initial result. |

### Home and My Path

| ID | Screen | Required content and behavior |
|---|---|---|
| IN-11 | Investor home | Greeting, readiness summary, one next action, path progress, appointment, assigned support contact, recent approved resource. |
| IN-12 | My Path overview | Milestones ordered from initial readiness through launch/training, with owner and honest state. |
| IN-13 | Milestone detail | Purpose, owner, current state, authoritative event/source, completed/pending time, next action, approved resources, and support. |
| IN-14 | Activity and receipts | User-visible receipts for submitted assessment, booked meeting, consent, content acknowledgement, and status changes. No internal notes. |

### Explore

| ID | Screen | Required content and behavior |
|---|---|---|
| IN-15 | Opportunity list | Only currently approved offerings; filters limited to practical business dimensions, not legal eligibility. |
| IN-16 | Opportunity detail | Business overview, responsibilities, support model, territory/availability qualifier, current disclosure status, approved claim version, and Request information. |
| IN-17 | E-2 education hub | Source-controlled general articles, official government links, date reviewed, and counsel reminder. |
| IN-18 | Resource detail | Locale/version/review date, source links, save/share rules, report-a-problem action. |

### Appointments and support

| ID | Screen | Required content and behavior |
|---|---|---|
| IN-19 | Appointment list | Upcoming and past appointments, timezone, status, and join/reschedule/cancel link where supported. |
| IN-20 | Book appointment | Server-generated scheduling handoff with context and timezone. Booking remains pending until confirmed. |
| IN-21 | Support thread | New Dawn business-support conversation with attachment upload disabled in MVP and a reminder not to send sensitive immigration or financial documents. |
| IN-22 | Escalate to a person | Reason selection, expected response window, urgent-safety language, and durable request receipt. |

## Referral-partner screens

### Application and approval

| ID | Screen | Required content and behavior |
|---|---|---|
| PA-01 | Partner welcome | Define eligible partner types, approval steps, compensation review, and no automatic acceptance. |
| PA-02 | Partner type | Broker, franchise consultant, business adviser, CPA/wealth adviser, relocation adviser, immigration consultant, or other. Attorney is routed to the attorney track. |
| PA-03 | Professional identity | Name, title, company, work contact information, website, and LinkedIn as optional verification evidence. |
| PA-04 | Jurisdictions and markets | Business jurisdictions, client markets, languages, and license/professional details when applicable. |
| PA-05 | Compliance questions | Conflicts, prior relationship, compensation limitations, permission practices, and required attestations. |
| PA-06 | Review and submit | Versioned application attestation and durable submission receipt. |
| PA-07 | Approval status | Submitted, under review, changes requested, approved, suspended, or declined; show only appropriate explanations and next steps. |
| PA-08 | Agreement | Approved agreement version, key terms, external signature/view flow, status, and receipt. |
| PA-09 | Required training | Modules on approved/prohibited claims, consent, duplicate review, FDD boundaries, compensation, and escalation. |
| PA-10 | Training check | Short scored confirmation with retry and support; record version and completion. |

### Partner home and referrals

| ID | Screen | Required content and behavior |
|---|---|---|
| PA-11 | Partner home | Approval/agreement/training state, one next action, referral summary, alerts, and resource update. |
| PA-12 | Referral list | Only the partner's referrals; simplified safe statuses; search by the partner-provided name. |
| PA-13 | Register referral: permission | Explain required permission and record the current consent statement before contact fields. |
| PA-14 | Register referral: details | Minimum contact details, preferred language, general timing, and notes restricted to non-sensitive business context. |
| PA-15 | Register referral: review | Show submitted fields, consent receipt, duplicate-review explanation, and Submit once with idempotency. |
| PA-16 | Referral result | Accepted, duplicate review, or prior contact. Never identify another source. Show durable receipt and expected next action. |
| PA-17 | Referral detail | Partner-provided data, safe mapped status, status explanation, last New Dawn action date, next partner action, and support. No internal CRM notes. |
| PA-18 | Referral activity | Approved events only: received, under review, contact attempt, meeting scheduled, diligence stage, closed/declined when safe. |

### Partner resources and support

| ID | Screen | Required content and behavior |
|---|---|---|
| PA-19 | Resource library | Current partner overview, approved claims, prohibited claims, FDD process, consent rules, and sharing restrictions. |
| PA-20 | Share resource | Server-generated approved link with version/expiration; do not share raw internal files. |
| PA-21 | Partner support | Assigned contact, business question thread, appointment, and report-a-compliance-concern route. |
| PA-22 | Compensation status | **Deferred from MVP.** Profile may state whether compensation terms are approved, but no amount, accrual, or payout screen is built. |

## Attorney screens

| ID | Screen | Required content and behavior |
|---|---|---|
| AT-01 | Attorney welcome | State independent role, no endorsement requirement, and uncompensated default. |
| AT-02 | Professional profile | Identity, firm, jurisdictions, business-immigration focus, languages, and verification. |
| AT-03 | Attorney status | Review and access state with any changes requested. |
| AT-04 | Counsel resource pack | Current FDD request process, roles, operating model, business-plan inputs, approved/prohibited claims, and source dates. |
| AT-05 | Client coordination list | Only explicitly invited clients with recorded permission; no legal files, assessment detail, or other clients. |
| AT-06 | Coordination detail | Business-side milestones, owner, status, support contact, and request/receipt history. No visa determination fields. |
| AT-07 | Counsel support | Ask a business-diligence question, request current material, or schedule New Dawn. |

## Status language contract

The app may display only language mapped from authoritative backend events.

| Internal condition | User-visible label | Prohibited label |
|---|---|---|
| Request stored; staff has not reviewed | Received | Approved, complete |
| Email or notification queued | Sending | Sent |
| Provider accepted delivery | Sent | Read, completed |
| Appointment link opened | Scheduling | Booked |
| Confirmed provider event stored | Booked | Completed |
| FDD delivery event recorded | FDD delivered | FDD reviewed |
| Receipt signature event recorded | Receipt recorded | Legal review complete |
| Duplicate cannot be resolved automatically | Duplicate review | Rejected, owned by another partner |
| Attorney or New Dawn action needed | Awaiting professional / Awaiting New Dawn | In progress without owner |

## Universal states and quality requirements

Every networked screen must define:

- loading with accessible progress text;
- empty state with a useful action;
- offline behavior;
- retryable error;
- non-retryable validation error;
- authorization expired;
- stale/expired content;
- pending write with disabled duplicate submission;
- confirmed receipt;
- maintenance/minimum-version block.

The prototype must demonstrate at least these failure scenarios: lost connectivity during assessment save, duplicate referral review, expired legal content, revoked session, scheduling provider unavailable, delayed notification, and account-deletion request.

## Prototype test script

### Investor success path

Choose Spanish or English → explore without account → complete readiness assessment → interpret result → create account → view My Path → inspect an opportunity → request information → book consultation → find support and privacy controls.

### Partner success path

Apply → see under-review status → simulate approval → complete agreement/training → record permission → register referral → receive duplicate-review-safe response → view mapped status → contact support.

### Attorney success path

Apply/verify → acknowledge independent role → access counsel pack → view one permissioned coordination item → request current material → confirm no compensation or legal-advice ambiguity.

## Prototype approval metrics

- At least 80% of participants complete the primary journey without facilitator intervention.
- At least 90% correctly state that the result is not a visa eligibility decision.
- No participant interprets `received`, `sent`, `scheduled`, or `pending` as completed.
- Every participant can find human support and privacy/deletion controls.
- No attorney believes the app conditions compensation on professional judgment or endorsement.
- Spanish-first participants report equivalent meaning on all consequential screens.
