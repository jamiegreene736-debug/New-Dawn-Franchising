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
