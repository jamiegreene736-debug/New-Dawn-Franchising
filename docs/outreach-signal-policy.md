# Outreach signal policy

Clicks and opens are activity only. They never send a click alert, create a call task, or qualify for call-queue backfill. This includes booking links, information links, social links, and signature links. A visit does not prove a booking or a request.

- Explicit call requests in the recipient's new message become setter tasks. The task records the source message, timestamp and supporting text. Calls still require channel eligibility and local hours in Outreach Desk.
- General replies, questions and requests for information/FDD become `needs_response` tasks assigned to Dylan. Respond in writing and fulfill requests through the existing approved-material workflow. These tasks do not permit calls or texts.
- Confirmed bookings retain the existing meeting workflow and close pending setter tasks. Confirmed/completed meetings suppress new setter tasks.
- Negative replies and opt-outs suppress outreach and close pending calls. Automatic replies do not qualify. Personal replies continue to pause campaigns.
- Ambiguous wording, conditional requests and unrecognized languages require a written response/review. Historical previews alone cannot establish a call request because truncated text may omit a negation.
- Gmail replies are MIME-decoded and classified using only the newly authored text; quoted outreach does not count as intent. Replies still go to the sending mailbox via Reply-To and are imported into CRM.

On rollout, pending legacy click/open/unclassified-reply tasks become `unqualified`, preserving their history. Recorded callbacks and completed outcomes are retained. Old click-generated to-dos are marked completed. Pending outbound desk actions for unqualified rows are cancelled or blocked at dispatch.

The reply collector retains source metadata and uses a database lock to prevent overlapping collectors from creating duplicate tasks. Replaying the same request does not reset exhausted attempts. A later explicit request may reopen work; a later general reply moves it to written-response review.

Validation: `npm run check`, `npm run test:unit`, and `npm run test:outreach-desk`. Database integration tests require `DATABASE_URL` and `DESK_TEST_DATABASE_URL` to point to the dedicated local `new_dawn_outreach_desk_test` database. Never run test fixtures against production.
