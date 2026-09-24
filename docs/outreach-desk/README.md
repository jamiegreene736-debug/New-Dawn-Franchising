# New Dawn Outreach Desk

Design and implementation · 24 September 2026

**Decision:** Make Outreach Desk the first and default tab in the existing backend. Give the agent a prioritized list of people to contact, the evidence behind each recommendation, an actionable contact workspace, and a dependable follow-up engine.

The approved design is implemented in the application. Outreach Desk is the default `/crm` tab, backed by real authenticated APIs, a shared call queue, persistent drafts and a bounded follow-up worker. See the [implementation and operating notes](IMPLEMENTATION.md) for shipped capabilities, provider requirements and activation controls. The original interactive prototype and renders remain fictional design examples.

- [Open the interactive mockup](mockups/index.html)
- [Implementation and operating plan](PLAN.md)
- [Design and interaction specification](DESIGN.md)
- [Research and provider decisions](RESEARCH.md)
- [Implementation and operations](IMPLEMENTATION.md)
- [Verification record](VERIFICATION.md)
- Implemented application screenshots (local fixtures): [desk](renders/implemented/default-desk.png), [calling](renders/implemented/call-workspace.png), [campaign explorer](renders/implemented/campaign-explorer.png), [follow-ups](renders/implemented/followups.png), [automations](renders/implemented/automations.png), [mobile](renders/implemented/mobile-desk.png).
- [Browse all eight renders](renders/index.html): [daily desk](renders/01-outreach-desk.png), [campaign explorer](renders/02-campaign-explorer.png), [call workspace](renders/03-call-workspace.png), [automations](renders/04-automations.png), [connections](renders/05-connections.png), [follow-ups](renders/06-follow-ups.png), [mobile](renders/07-mobile-desk.png), [performance](renders/08-performance.png).

## Review path

1. Open Today: inspect the call queue and select a person.
2. Open Campaign explorer: choose a campaign, filter by opens, and search a contact.
3. Open the call workspace: review the brief, simulate a call handoff, and record an outcome.
4. Open Automations: inspect what runs automatically and what needs the agent.
5. Open Connections: inspect data freshness, missing access, and recovery behavior.

## Local preview

From this directory: `python3 -m http.server 4179 --bind 127.0.0.1`

Then open `http://127.0.0.1:4179/mockups/`. The prototype uses only local assets, performs no API calls, and stores simulation state only in memory. Refresh resets it. This static preview remains separate from the implemented application.

## Basis and assumptions

Inspected GitHub repository: `jamiegreene736-debug/New-Dawn-Franchising`, `origin/main` at `1daa778`. Work is isolated in a managed worktree because the original local checkout was behind the remote. Existing mobile/Pathways functionality remains a separate product boundary.

Assumptions pending Jamie's audience/tool preferences: one primary human outbound agent; buyer and professional-referral tracks; a US-first policy pilot with international markets enabled individually; Quo, Meta WhatsApp, existing email transport, and Calendly retained initially. Provider subscriptions, permissions, balances, and production configuration have not been verified.
