# Outreach Desk implementation

Implemented 24 September 2026. Entry point: `/crm` (default) or `/crm?tab=outreach-desk`. The public marketing shell is removed from the CRM home so the agent works in a dedicated workspace. Explicit links to existing CRM tabs continue to work.

## Available in this release

- My desk: due callbacks, replies, campaign engagement, research and handled views; text search, saved filters, keyset pagination, shareable/reloadable view state.
- Campaign explorer: campaign, observed-open/click/reply and date filters; deduplicated email identities; direct movement into the existing shared call queue.
- Contact workspace: phone/email/verified LinkedIn URL, confirmed timezone, local time, channel eligibility evidence, campaign context, sourced conversation brief, communication timeline and calendar link.
- Calling workflow: agent claim, native dialer handoff, notes, eight outcomes, recipient-timezone callbacks with daylight-saving validation, idempotent outcome writes and stale-record protection. Dialer clicks never count as completed calls.
- Follow-ups: durable email/SMS/WhatsApp/LinkedIn drafts, exact-content review and editing, scheduling, cancellation, provider acceptance receipts and held/uncertain exceptions. LinkedIn is a manual relationship task. WhatsApp freeform requires a recorded inbound service window; approved templates remain in existing Campaigns.
- Automations: preparation every 15 minutes, requested-details email drafting, optional automatic scheduling of the fixed requested-details playbook, pause, daily cap and one follow-up per identity per rolling 24 hours. Editing a playbook draft removes automatic scheduling eligibility.
- Connections: credential presence distinguished from recorded sync/provider evidence. Performance uses imported calls and Calendly event identifiers, without inventing calls, delivery or meetings.

## Daily data and providers

Reuse the existing campaign tracking, Gmail reply synchronization, Quo call history, Calendly meeting sync and Seamless/contact discovery jobs. The desk fills missing queue phone/company details from explicitly linked CRM/contact/prospect records; it never overwrites agent corrections or infers timezone from a phone number.

Hunter verifies stale priority email identities in batches of at most five per preparation, capped at 20 identities per UTC day across manual and background requests. Cached evidence is shared by normalized email. Provider failures preserve prior evidence, stop the batch, open a one-hour circuit and do not retry that identity the same day. Calls have a 20-second timeout. Email evidence older than 30 days is not sufficient for dispatch.

The existing APIs do not all have interchangeable permissions or guarantees. No new vendor subscription, automated LinkedIn messaging, number-purchase, account approval or template approval is implied by deploying this code.

## Execution boundary

Preparation starts automatically in the full backend runtime. The requested-details automatic-send playbook starts **off**, with an explicit activation control under Automations. The operator can review and approve drafts individually immediately. Before any dispatch, the worker rechecks current channel evidence, suppression, booking, recipient, local hours, recent inbound messages, identity pacing and the daily cap. Email also requires a successful franchising inbox reconciliation within 30 minutes and current valid verification.

A contact with missing eligibility or timezone remains visible with an actionable hold. Channel evidence can represent an approved contact policy or requested contact; an observed email open never grants permission. The operator must record the actual basis, scope and expiry. The desk does not run a national DNC screening service itself.

“Send details”, callbacks and relationship outcomes pause active drip enrollments for the email identity. DNC writes the existing shared suppression list. Existing campaign/agent systems retain their own controls; **Pause desk sending is not a global emergency stop**. Other legacy channels still depend on their existing suppression enforcement. Use their controls when stopping all platform-wide outreach.

Provider acceptance is distinct from delivery. A dispatch claim is persisted before network I/O. A crash or ambiguous provider failure moves the action to `unknown`, requiring provider-history reconciliation; it is never blindly retried. Eligibility failures hold the action for agent review. Quiet-hour actions are rescheduled into recipient business hours. Quo calls remain native-dialer handoffs with imported provider history, not an embedded browser dialer. Calendar links open Calendly; selecting “Ready to meet” records a pending outcome without fabricating a booking.

## Storage and security

Additive tables, initialized by `server/outreach-desk/schema.ts` under a PostgreSQL advisory lock:

- `outreach_desk_profiles`: per-queue timezone, LinkedIn, channel evidence and 15-minute session claim.
- `outreach_desk_actions`: durable drafts, approvals, scheduling, dispatch state and provider references.
- `outreach_desk_events`: append-only relationship/action audit and idempotency keys.
- `outreach_desk_settings`: desk pause, fixed playbook activation, cap and preparation result.
- `outreach_desk_views`: saved filters under the existing admin identity.
- `outreach_desk_email_evidence`: shared verification evidence and bounded provider attempts.

All endpoints require the existing admin session. Mutations require JSON and reject foreign origins/cross-site requests. Inputs are bounded and parsed, SQL is parameterized, message text is escaped before HTML transport, and sensitive provider configuration is never returned. Claims distinguish browser sessions because the existing application uses a shared admin identity; saved views are consequently shared by that admin account. Per-person staff accounts and permissions remain a broader authentication project.

The mobile/Pathways runtime does not register these routes or start the desk worker. Shared/mobile schema migrations are unchanged.

## Operations and recovery

1. Deploy the merged full-backend build. Additive schema initialization runs once per server process and is safe to repeat.
2. Open Connections and inspect actual sync evidence. Confirm Hunter, Quo, Meta and mail credentials using the existing integration controls where needed.
3. Confirm recipient timezone and eligible channels; review the first drafts and inspect provider receipts.
4. Activate the requested-details playbook only when its displayed fixed copy and existing pending eligible drafts are appropriate. Default daily desk cap: 20.
5. Review Follow-ups exceptions. For `unknown`, inspect provider history before creating replacement work. Held work needs review/rescheduling after its cause is resolved; unpausing does not silently release it.
6. To roll back, first pause desk sending, then redeploy the preceding application revision. Preserve the additive tables as the audit/recovery record. No destructive down migration is needed.

## Verification

See [verification](VERIFICATION.md). Implementation screenshots in `renders/implemented/` use isolated local fixtures, never production contacts or performance. Original mockups remain a design reference. The broader [plan](PLAN.md) also describes future refinements beyond this release: embedded telephony if the provider supports it, richer identity resolution, policy/screening integrations by market, and deeper attribution/transcript assistance. This release must not be described as proving those capabilities or guaranteeing provider delivery.
