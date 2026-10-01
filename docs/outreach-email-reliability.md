# Outreach email reliability

Campaign email and Outreach Desk follow-ups use Dylan Delaney <dylan@newdawnfranchising.com>. Set `GMAIL_APP_PASSWORD_DYLAN` to an App Password for that exact Google Workspace account. There is no fallback to shared or rotated identities. Missing credentials hold drip dispatch; Gmail authentication and daily-limit failures keep steps retryable and trip the sender circuit breaker.

Inbox sync decodes MIME messages, examines only their own headers, and preserves human replies quoting our unsubscribe footer. A reply matches a preceding email through its campaign Message-ID, or an exact normalized subject for older sends. Completed enrollments can receive replies. The matched email gets reply credit; other active sequences for the same address stop without getting additional reply credit. Explicit opt-outs enter DNC. Historical sender inboxes continue syncing for earlier outreach.

Campaign reporting counts replies from matched campaign emails, includes replied/opened messages in sent totals, and separates failed dispatch attempts from asynchronous bounces. Repeated bounce scans no longer walk backwards through unrelated sends or modify call/SMS tasks.

The email queue checks the provider result before logging success and retries failures with bounded delays. Agent send paths also check failure results. Existing drip retry logic is retained. Saved campaign copy is sent as reviewed, without the previous first-touch override that could replace a client pitch with attorney copy.

## Verification

- `npm run check`
- `npm run test:outreach-email`
- `npm run test:unit`
- `npm run test:outreach-desk` (database integration cases require the isolated test database)
- `npm run build`

## Existing campaign copy

`npx tsx script/repair-outreach-email-copy.ts` previews updates to known campaign families and their daily clones. Apply with `--apply --backup=/absolute/path.json`. It updates email copy and disables rotation without changing enrollments, campaign activation, or send history. The private backup contains the exact prior values. No emails are dispatched by this repair.

A successful SMTP verification establishes authentication only. Confirm an actual message's From/Reply-To and inbox receipt separately before claiming sending works. Inbox placement and prospect response rates remain outcomes to measure, not guarantees.

## First-contact capacity and overdue sequences

The scheduled drip processor allocates accepted volume toward 60% first introductions and 40% follow-ups, using recipient-wide first-send history and rolling 24-hour counts. At the current 80/day cap this targets 48 new recipients when both groups have eligible work; either group can use otherwise idle capacity. Discovery/enrollment counts are not contacts reached or deliveries.

Untouched recipients no longer wait behind every overdue step in older enrollments. Follow-up timing is measured from actual previous email sends, retaining the difference between sequence delay days, with a 24-hour recipient-wide minimum across campaigns. Manual Send Due Now also respects this spacing. Tasks can still advance in the same pass. A database advisory lock serializes scheduled sweeps during overlapping deployments.

Names that look like teams, organizations, placeholders, or New Dawn itself receive a neutral “Hi there” greeting. This protects newly rendered campaign emails; it cannot repair messages already sent. A corrective resend should be a separately reviewed recipient group, excluding opt-outs, bounces, replies, bookings, and recent contacts.

Verification: `npm run test:outreach-email`; integration tests use the dedicated local database with `DRIP_TEST_DATABASE_URL=postgresql://localhost/new_dawn_outreach_desk_test DATABASE_URL=postgresql://localhost/new_dawn_outreach_desk_test npx tsx --test tests/drip-scheduling.integration.test.ts`. SMTP is mocked; no real email is sent by these tests.
