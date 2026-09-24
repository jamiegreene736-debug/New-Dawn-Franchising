# Design handoff: Outreach Desk

## Visual direction

A calm operator workspace: deep navy navigation, warm green actions, white work surfaces, muted gold for decisions that need attention. Keep primary actions close to the person and use plain status labels. The agent should spend her attention on the conversation, not a dense analytics dashboard.

The interactive HTML prototype includes Today, Campaign explorer, Call workspace, Follow-ups, Automations, Connections and Performance. All illustrated records are fictional. Prototype interactions intentionally simulate actions rather than opening real dialers, sending messages or booking calendar events.

## Layout and tokens

| Token | Value | Purpose |
|---|---|---|
| `--navy` | `#152b38` | Portal navigation and dark action |
| `--ink` | `#1b3441` | Primary text |
| `--muted` | `#657580` | Secondary text; verify final size/contrast in production |
| `--paper` | `#f3f6f5` | Workspace background |
| `--green` | `#176c58` | Primary action and positive state |
| `--mint` | `#e4f1eb` | Selected/ready surfaces |
| `--gold` | `#c5954a` | Brand accent |
| `--line` | `#dce4e5` | Dividers and input outlines |
| `--radius` | `14px` | Major panels |
| spacing scale | 4, 8, 12, 16, 20, 24, 32px | Reuse in production Tailwind tokens |
| font | DM Sans variable | Local packaged font; Arial fallback |

Desktop sidebar: 230px; topbar: 74px; main gutter: 34px. Today has a header, daily brief, four compact metrics, then approximately 45% queue / 55% contact detail. Keep selected person visible while queue updates. A production virtualization layer must preserve the selected item and scroll anchor.

Headings use 32/22/18px sizes; production body content should use 14–16px and controls at least 12px. Compact render labels are illustrative and should be increased as needed during accessibility validation. Use at least 44px tap targets on touch layouts.

## Production components

| Component | Important props | Behavior |
|---|---|---|
| `OutreachDeskPage` | actor, shift, view, filters | Authenticated default CRM tab |
| `DailyBrief` | sources, freshness, exceptions, priorities | Partial/stale result never looks fully ready |
| `WorkQueue` | items, cursor, selectedId, loading | Cursor pagination, no duplicate people, stable selection |
| `QueueCard` | person, reason, dueAt, localTime, eligibility | Name selects; call action evaluates eligibility separately |
| `PersonWorkspace` | profile, contactPoints, timeline, brief | One clear channel bar and full provenance |
| `ChannelAction` | channel, allowed/held/unavailable, reason | Always explain holds; cannot bypass server policy |
| `CampaignExplorer` | filters, facets, uniquePeople, eventCounts | Search and facet state shareable by URL |
| `CallSession` | claim, providerIntent, callEvent, outcomeDraft | Handoff and actual call statuses separate |
| `OutcomeForm` | outcome, notes, nextAction, timezone | Preserve notes while changing outcome; validate commitments |
| `AutomationPanel` | version, mode, preview, caps, state | Review/sample before activating; pause affects pending work |
| `IntegrationCard` | configured, authorized, lastSuccess, lag, capability | Error, disconnected, partial and empty remain distinct |

Use existing shadcn/Radix components for dialogs, tabs, selects, toast and accessible focus behavior in the production React implementation. The lightweight prototype is a design artifact, not the production component architecture.

## Interaction contract

1. Login lands in Outreach Desk for authorized agent/admin users; explicit deep links retain their destination.
2. Selecting a queue card updates the adjacent profile without mutating the queue item. URL can identify the selected person for handoff.
3. Campaign card filters people. Campaign, signal, dates and search combine visibly; a Reset action clears them. Production saved views persist per user, with explicit sharing permission.
4. Call now claims the work item, re-evaluates permission and opens the approved Quo handoff. A launch shows “Waiting for call activity”; only a provider event can show connected/ended.
5. Outcome choices include requested details, callback, no answer, voicemail, ready to meet, not interested, wrong number and do-not-contact. Callback requires recipient-local date/time and confirmed IANA timezone. Booking requires a provider receipt or a clearly labelled pending/manual state.
6. Save and next atomically records the outcome and next action. Repeated clicks return the same result. A failed save keeps the notes visible and does not advance.
7. Email, SMS and WhatsApp show the eligible sender, recipient, exact content and why the action is allowed/held. Draft, approved, queued, accepted, delivered and failed are distinct states.
8. LinkedIn offers a verified profile and a draft; the human sends the message. Missing profile creates research work.
9. Automation pause confirms persisted state, cancels scheduled actions and explains any already in-flight sends. The prototype only changes local visual state.
10. Keyboard: Tab reaches navigation then workspace; Enter/Space activates; Escape closes modal and restores trigger focus. Production queue may add j/k selection with documented shortcuts disabled inside inputs.

## Loading, empty and failure states

| Situation | UI and recovery |
|---|---|
| Initial loading | Queue/profile skeletons; accessible loading status; no fabricated counters |
| Queue empty | “You’re caught up”; show next callback/window; optional approved prospecting view |
| No search matches | Describe current filters, offer reset, preserve query |
| Missing phone | “Phone needed”; research action and other independently eligible channels |
| Unknown timezone | “Confirm local time”; block timed outreach until resolved |
| Scanner/open uncertainty | “Observed open · confidence uncertain”; source event details |
| Delayed provider | Last good timestamp plus “Delayed”; hold dependent automation |
| Provider unavailable | Repair task and owner; existing notes/known records stay usable |
| Outcome save failed | Inline error, preserve form values, retry with same operation ID |
| Simultaneous claim | “Being handled by [agent]”; read-only view or explicit transfer |
| AI unavailable | Deterministic source facts and approved static script remain available |
| Message status unknown | “Checking provider”; prevent blind resend and show repair action |
| Permission expired | Held state and evidence required to resolve it; no hidden bypass |

## Content, accessibility and responsive behavior

Keep names visible; two-line wrap for long international names. Never truncate phone/email without a full accessible value. Timeline bodies collapse after three lines with Show more. Suggested production limits: notes 4,000 characters, search 200, saved-view name 80, brief 1,200; channel-specific limits come from provider validation.

Above 1150px use the two-pane desktop workspace. From 900–1150px reduce sidebar/gutters. Below 900px move portal navigation to a compact top strip. Below 700px stack queue and person detail, keep actionable controls touch sized, and allow campaign tables to scroll horizontally with clear headings. Production mobile should offer queue → person as explicit navigation rather than force long scrolling.

Use text labels as well as colors. Provide labelled controls, live save/error statuses, semantic table headers, visible focus, skip navigation and focus restoration. Honor reduced motion; use at most 150ms opacity/color transitions with no essential animation. Test WCAG AA contrast, 200% zoom and screen readers before release. The current prototype has basic semantic controls and responsive CSS; it is not a completed accessibility certification.

Prototype limitations: no real integrations, authentication, permission checks, record persistence, date-range backend, saved views or dispatch. The prototype preserves edited call notes across outcome changes in memory. Main navigation, sample search/filters, person selection, dialogs, simulated handoff/outcomes and automation switches are interactive for review.
