# Outreach audit remediation

The October 1 audit found failed submissions, unqualified recipient cohorts, dense overdue sequences, and response metrics that mixed opt-outs with interest. PR #204 already added actual-send spacing and first-contact capacity before this follow-up. This change preserves those protections.

## Sending requirements

- Open-based automatic resends and bulk replay are removed; neither can bypass suppression, qualification, pacing or caps.
- Automated outreach stays paused during recovery. The pause applies to forced campaign sends and automatic email adapters. Transactional receipts and internal messages continue using their existing paths.
- Each cold campaign recipient needs a qualification review with a current source, relevant role, firm domain, audience and a factual opening line. Reviews expire after 30 days. Category labels and named-account membership are research inputs, not approval.
- A valid address verification no older than 30 days is required; unknown, risky and unavailable verification results remain held. Hunter verifies uncached recipients. Address verification does not establish inbox placement.
- Three accepted emails per address across campaigns within 45 days; one person per firm in seven days; no release of sequences older than 45 days. Daily/hourly caps remain hard limits even with Send Due Now. Existing actual-send spacing remains in force.
- Qualification review in Campaigns shows hold reasons. Saving a review does not activate a campaign or send mail. Existing damaged cohorts are not automatically re-enrolled.

## Content and evidence

Cold campaign emails use Dylan, a minimal text signature and the visible unsubscribe footer, without tracking pixels or redirected links. The actual rendered HTML, From address and provider Message-ID are retained. The shared copy offers the published `/partner-review` diligence guide. The page directs professionals to request underlying documents without client citizenship or investment timing. It makes no new earnings, capital-protection or visa-approval claims. It is not a verified diligence pack or an independent assessment of the franchise documents.

Reply sync uses All Mail plus Spam and Trash where supported, with read-only mailbox locks and Message-ID deduplication. Positive requests, unknown replies, declines and opt-outs are separate. Historical bounce labels remain explicitly unverified unless an original Message-ID matches. Delivery reports are retained without inventing delivery outcomes.

Seed tests use Dylan and the minimal signature, retain receiving Authentication-Results, and distinguish missing messages from unavailable receiving-mailbox access. Content-analysis predictions are labeled as content checks, not measured placement.

## Production application

1. Back up settings, pause campaigns/autopilot/desk (completed before implementation).
2. Deploy the merged release; startup adds only additive columns/tables.
3. Run `script/apply-outreach-remediation.ts --apply --backup=/absolute/private/path.json` and `script/repair-outreach-email-copy.ts --apply --backup=/absolute/private/path.json`. Both preserve send/enrollment history and send no mail. The second updates known campaign families, retaining stable step IDs.
4. Read back paused settings, hold reasons, template changes, metrics and public page.
5. Use owner-controlled external receiving mailboxes for placement tests. Recover credentials for historical accounts that cannot authenticate. No account access or external receipt can be manufactured by this release.
6. Review a small cohort and supporting franchise documents before resuming a limited test. Reporting should use positive human requests per unique sender-accepted recipient; acceptance is not proof of inbox delivery.

## Validation

Type checking, existing unit tests, outreach regression tests, isolated PostgreSQL Outreach Desk and drip integration tests, and production build. Regression coverage includes the pause during forced sends, qualification holds, spacing/deduplication, exact and idempotent bounce attribution, reply categories and mailbox coverage.
