# Campaign spam readiness — October 1, 2026 (Eastern)

## Observed evidence

Safari Postmaster Tools for `newdawnfranchising.com` showed all eight compliance requirements as compliant: SPF/DKIM, From alignment, DMARC, encryption, user-reported spam, DNS, one-click unsubscribe, and honoring unsubscribe. Its displayed update was **August 30, 8 PM**, so this is historical evidence, not a current inbox-placement clearance. The seven-day Spam, Authentication, Encryption and Delivery Errors dashboards showed no data. Deliverability analysis said there was not enough outgoing email to personal Gmail accounts.

The production DNS check at 9:23 PM Eastern on October 1 confirmed a single SPF chain authorizing Google Workspace, the Google DKIM public key, Google MX, and DMARC `p=none`. A monitor-only DMARC policy is allowed under Google's minimum sender requirements; changing it to reject is not a treatment for legitimate mail going to Spam. DNS existence does not prove the headers on any particular message.

The latest observed independent test remains `1631a4a5-1d13-49ab-9fe8-c63956335888`: one message accepted, one observed in Gmail Spam, and SPF/DKIM/DMARC passing in the receiving server's Authentication-Results. The receiving account was a Google-hosted Workspace mailbox, while Postmaster statistics cover personal Gmail. The seed result is therefore useful placement evidence for that mailbox, not the Postmaster user-reported spam-rate denominator.

Production Postmaster API credentials are not configured and no traffic snapshots are stored. Browser verification does not configure the application's API connection. No credentials or permissions were changed in this release.

The pilot has 66 staged, paused recipients and zero accepted prospect messages. Its first subject is “A review guide for franchise referrals”; the body is short and asks whether a review guide would be useful. The follow-up is “What to check before a referral” with a direct first-party link. Neither the observed authentication nor an editorial checklist establishes the exact reason Google put the seed in Spam. Do not blame a keyword without controlled evidence.

## Product behavior

Each campaign now has a read-only Spam risk panel. It combines current DNS checks, domain-scoped and dated Postmaster snapshots, latest observed workspace seed placement, and all saved email subjects, bodies and previews. Unknown, stale and failed sources remain visible. A later pending seed does not erase an older observed Spam result. A workspace Inbox result does not certify other campaign content. The panel never claims a Gmail score or inbox probability and never changes sending state.

The existing content checker is labeled as a local heuristic checklist. It no longer presents Primary Inbox / Promotions / Spam as predicted outcomes or describes its points as SpamAssassin-equivalent. Its legacy API placement fields remain for compatibility; the UI uses `contentRisk`. Normal `p=none` is not assigned spam points. Content flags are editorial prompts rather than Google's disclosed classifier rules.

## Next diagnostic actions

1. Keep current campaign pauses and volume caps until placement readiness is resolved. Do not expand sourcing or send a correction blast.
2. Connect read-only Postmaster API access when available; low-volume or stale data remains unknown even with credentials. Do not send more mail simply to populate a dashboard.
3. Review recipient expectations and relevance. Verified work addresses from Apollo do not prove consent or that recipients want this outreach. Google warns against unsolicited and purchased lists; list accuracy alone does not address that risk.
4. Use a small, controlled test to owned independent mailboxes only after a meaningful change. Keep sender, recipient and timing comparable; change subject or body/link structure one variable at a time. Record original placement and receiving headers. A single successful test is limited evidence, not a guarantee across providers or recipients.
5. Treat manual “Not spam” moves, automated replies and warmup activity separately from original placement. They cannot establish that a new prospect's message reached the inbox.

## References

- [Google email sender guidelines](https://support.google.com/mail/answer/81126): authentication, accurate headers/content, recipient expectations, gradual consistent volume, and user-reported spam targets below 0.10%, avoiding 0.30% or higher.
- [Postmaster dashboards](https://support.google.com/mail/answer/14668346): personal Gmail scope, reporting delay, low-volume suppression, and user-reported spam rather than all automatic filtering.
