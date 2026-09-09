# New Dawn Pathways — Notification Command Center

**Status:** Product policy, implementation, simulator walkthrough, and isolated staging validation complete; production remains prelaunch

## Purpose

Notifications make New Dawn Pathways useful between visits. The product watches the user's chosen pathway, dates, and official sources, then explains what changed, why it matters, and the safest next action. It is not a breaking-news feed, a legal status calculator, or a guarantee of an appointment or outcome.

## Notification categories

| Category | Default | Value |
|---|---:|---|
| Next action | On | The most useful business-side action for the user's current pathway stage. |
| Appointments | On | Seven-day, 24-hour, and two-hour reminders for confirmed meetings. |
| FDD milestones | On | Recorded delivery and 14-calendar-day review reminders, with franchise-counsel guidance. |
| Embassy/consulate | On | Human-reviewed changes from an approved official source for the selected post. |
| Passport, visa, and I-94 checks | On | Private reminders to inspect current official records; never a legal conclusion. |
| Secure status/documents | On | Business-side review, receipt, and document-ready events. |
| Weekly digest | On | One action, one important change, and one approaching date. |
| Opportunities | Off | Optional marketing based on saved business interests; explicit opt-in is required. |
| Referral updates | On | Permissioned business-side updates for referral professionals. |
| Owner operations | On | Licensing, insurance, training, and operating deadlines after launch. |

## Safety and claims policy

- The lock screen always uses the generic title `New Dawn Pathways` and body `You have an update in your pathway.`
- Push payloads never expose immigration facts, document names, investment amounts, referral identities, or legal conclusions.
- Government alerts require HTTPS, an approved official host, a recorded reviewer, and review time before publication.
- Public wait-time estimates are labeled as estimates and are never represented as live E-2 appointment inventory or guaranteed availability.
- Routine alerts respect 9:00 PM–8:00 AM local quiet hours. Opportunity marketing is never treated as urgent.
- Users can change categories, remove a device, delete reminders, and open source-linked details inside the authenticated app.

## Implemented architecture

- Expo Notifications provides the iOS permission flow, local scheduling, foreground behavior, and deep-link responses.
- SecureStore keeps prototype preferences and local-reminder identifiers on the device.
- The versioned mobile API owns authenticated preferences, device registration, reminders, inbox/read state, and scoped category authorization.
- The server delivery service uses generic push copy, Expo ticket submission, bounded retry with jitter, and structured failure logging.
- Four mobile-only tables persist preferences, revocable devices, reminders, and inbox records. The migration cannot modify core CRM tables or write customer data.

## Remaining connected-delivery gates

1. Configure an authorized Expo project and Apple push credentials for internal distribution.
2. Connect authoritative pathway, scheduling, FDD, referral, and owner-operation events through an idempotent outbox/worker.
3. Reconcile Expo tickets/receipts, deactivate invalid tokens, and add delivery-health monitoring.
4. Complete legal, privacy, English/Spanish, accessibility, and physical-device review before an external cohort.
5. Keep production accounts, schema changes, and remote delivery disabled until a separate signed production release gate.
