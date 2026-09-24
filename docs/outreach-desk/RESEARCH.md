# Research and provider decisions

Reviewed 24 September 2026. Recommendations are design judgments for this repository, not independently measured claims that one vendor is universally best. Commercial access and actual account capabilities need a read-only connection audit before implementation.

## System choice

| Option | Strength | Cost of adopting it here | Decision |
|---|---|---|---|
| Extend New Dawn with an Outreach Desk | Preserves buyer/partner context, campaigns, Quo, WhatsApp, appointments, and existing CRM records | Requires hardening identity, event processing, and shared send gates | Recommended; best fit to the requested default backend tab |
| Move outreach into Close | Strong calling workflow and saved views | New system of record, migration, custom New Dawn context and WhatsApp integration work | Benchmark the agent workflow; consider later if a native dialer becomes essential |
| Move outreach into HubSpot | Mature sequence and relationship workflows | Subscription/seat evaluation, synchronization, migration, duplicated campaign ownership | Benchmark stop rules; no migration in the initial plan |

Close documents channel-specific workflows and calling Smart Views. Apply that pattern as saved, dynamic work queues in New Dawn, with one next action per person. The benefit of retaining the current stack is an inference from the existing integration footprint, not a vendor performance claim. [Close workflow guidance](https://help.close.com/best-practices/creating-a-multi-channel-sales-workflow-in-close)

HubSpot documents automatic sequence unenrollment on reply or meeting booking. Adopt the underlying principle across every New Dawn sender and channel: a conversation or booking takes precedence over scheduled prospecting. [HubSpot sequence stops](https://knowledge.hubspot.com/sequences/unenroll-from-sequence)

## Evidence that changes the design

| Source | Finding | Product consequence |
|---|---|---|
| [Apple Mail Privacy Protection](https://support.apple.com/en-ca/guide/iphone/iphf084865c7/ios) | Mail privacy features prevent reliable observation of whether recipients opened a message | Show observed opens as uncertain; never label them verified human interest or infer consent |
| [Quo API reference](https://www.quo.com/docs/mdx/api-reference/introduction) | Documented call APIs cover retrieval, recordings, summaries and transcripts; SMS has a send endpoint | Retain Quo for agent-led calls and SMS. Outbound call initiation was not verified in the public reference; pilot a desktop/tel handoff before promising an embedded dialer |
| [Quo webhook payloads](https://www.quo.com/docs/mdx/guides/webhooks) | Call, message, summary and transcript events are available | Import provider facts and reconcile missed events; launching a dialer is only an attempted handoff |
| [Quo rate limits](https://openphone.mintlify.dev/docs/mdx/api-reference/rate-limits) | Published per-key ceiling is 10 requests/second | Use shared per-account throttling; configure below the provider limit and honor 429 responses |
| [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy) | Requires recipient permission; business-initiated conversations use approved templates; free-form replies have a 24-hour customer-service window | Evidence of permission and template eligibility determine available actions. An enriched mobile number does not unlock messaging |
| [LinkedIn automated activity policy](https://www.linkedin.com/help/linkedin/answer/a1340567/automated-activity-on-linkedin?lang=en) | Prohibits third-party software that scrapes or automates activity on its website | Prepare a draft and a manual profile task; do not build an automated connection/DM browser bot |
| [Apollo enrichment API](https://docs.apollo.io/reference/people-enrichment) | Reveals may consume credits; phone/waterfall results can arrive asynchronously | Enrich missing fields only, cap spend, correlate request IDs, and keep records pending until results arrive |
| [Hunter API](https://hunter.io/api-documentation) | Provides email discovery and verification endpoints | Use as a bounded fallback to the preferred enrichment provider; retain verification status and time |
| [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push) | Mailbox updates use Pub/Sub; watches expire and must be renewed at least every seven days | If Gmail OAuth replaces the current mailbox polling, renew daily, persist history cursors, and reconcile gaps |
| [Calendly event webhooks](https://developer.calendly.com/docs/api-guides/trigger-automations-with-other-apps-when-invitees-schedule-or-cancel-events) | Rescheduling produces creation and cancellation events | Model booking identity and replacement links; do not briefly restart prospecting when a reschedule arrives |

The Meta policy page retrieved for this research reports a September 23, 2026 update. Store policy/configuration versions with eligibility decisions and recheck provider requirements at implementation.

## Outreach requirements built into the machine

For US franchise outreach, the FTC specifically describes continuing Do Not Call and calling-hour obligations even where franchise calls are exempt from other Telemarketing Sales Rule provisions. Apply jurisdiction-aware screening before dialing; buyer and professional-partner tracks need distinct treatment. [FTC telemarketing guide](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule)

Commercial email needs an enforceable unsubscribe path and compliant sender/content handling. Make suppression immediate inside New Dawn and reconcile it with every provider. [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)

These sources establish baseline requirements, not a complete multi-country legal determination. Configure the actual approved jurisdictions, recording disclosures, DNC source, retention periods and messaging rules before each market is activated. Unknown jurisdiction or missing policy evidence routes a contact to review, rather than assuming US rules apply worldwide.

## API strategy

Use all **relevant, authorized** APIs behind one normalized data model. Calling every vendor for every person every day would waste credits, increase conflicts and expose more contact data without necessarily improving it.

Recommended order: existing first-party records → fresh cached evidence → preferred enrichment provider → one approved fallback → verification → manual exception. For consumer franchise buyers, self-submitted information and relationship history take priority over B2B enrichment coverage. Do not infer wealth, citizenship, visa eligibility, or readiness from names, nationality, or social profiles.

Keep the existing email transport during the first UI phase, then assess mailbox OAuth/push for reliable replies. Keep Quo and Meta independently: replacing both with Twilio adds migration work without a demonstrated requirement. Keep Calendly as booking authority. Do not activate legacy integrations simply because an environment-variable name exists. Apollo, Hunter, ZeroBounce, Seamless, PDL, Origami, Proxycurl and other legacy adapters each need a current availability/access check before selection.

## Spend model

No subscription prices or savings are asserted here. Obtain current quotes and actual account allowances first. Monthly operating cost = telephony seats and usage + messaging charges + mailbox costs + enrichment reveals and verification + model tokens + job/storage infrastructure. Record cost per enriched reachable contact and cost per held qualified meeting, not merely API volume.

Suggested pilot limits, to configure with the owner: enrich at most 50 prioritized contacts/day, reveal at most one new phone per contact unless manually requested, stop at the account's daily monetary/credit cap, reuse valid cached data, and show consumption before a bulk job. These are planning defaults, not provider quotas or approved purchasing authority.
