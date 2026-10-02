# Campaign inbox placement tests

Each campaign's Spam risk panel now includes **Test inbox placement**. Select a saved email, then start a test (one GlockApps credit). The panel reports observed Inbox, Tabs/Other, Spam, Missing and Unknown, separately from SMTP acceptance and local content warnings. It never predicts a universal probability or resumes campaigns.

## Connect the provider

Create a GlockApps account at https://glockapps.com/api-documentation-v2/ (API access is currently included on free plans; available test credits still determine whether a test can run).

Configure these private Railway service variables, never committed or pasted into campaign fields:

- `GLOCKAPPS_API_KEY`: account API key with test creation access.
- `GLOCKAPPS_PROJECT_ID`: numeric project ID obtained with GET `/api/projects`.
- `GLOCKAPPS_SEED_ACCOUNT_IDS`: comma-separated numeric seed IDs, 1–12, selected from GET `/api/providers`. Choose Gmail personal/Workspace, Microsoft personal/business and Yahoo where the account provides them. Coverage is limited to the chosen mailboxes. Review the provider list when its seed addresses change.

The fixed HTTPS base is `https://api.glockapps.com/gateway/spamtest-v2`; requests include `x-api-key`. Official contract: https://docs.spamtest.prod-k8s.glockapps.com/ . The service calls POST `/api/projects/{id}/manualTest` with `seedAccountIds`, then GET `/api/projects/{id}/tests?testId=...`. No account, project or subscription is created automatically. Setup alone sends nothing.

Before using a credit, verify account access and selected seed IDs with these read-only provider endpoints. Test only a changed email or sender setup while the existing delivery hold remains unresolved. The app requires a description of the meaningful change for a repeat of the same saved email within seven days.

## Sending and results

- Test snapshots contain the saved subject, body, preview and sender. They use the production email renderer, signature, plain-text alternative, Reply-To and unsubscribe headers/footer. The same personalization function as campaign outreach supplies sample `Alex Morgan`, each seed email address and an empty firm introduction. This is a sample, not every prospect's personalized message.
- The provider-supplied `X-API-Campaign-id` header identifies the test without adding a token to the subject/body. Initial connected-account acceptance testing must confirm report attribution before relying on the integration. The exact rendered HTML is retained privately for each copy.
- Only provider-returned addresses receive test mail. Client requests cannot supply recipients, sender or arbitrary HTML. Admin authentication protects all routes; the API key is never returned.
- Start explicitly uses one test credit. Creating or refreshing the UI does not send anything. A five-minute worker sends at most one copy, only while outreach is paused. Both the 15/hour and 80/24-hour maximums and any lower configured limits apply, including recent campaign sends and attempted test copies. Campaign scheduling also counts test attempts after outreach resumes. A 12-mailbox panel normally takes about an hour plus provider processing; existing volume may delay it.
- UUID idempotency and a database advisory lock prevent duplicate creation across workers. Paid POSTs and uncertain SMTP attempts are never retried automatically. Pending queues expire after 24 hours. Stop remaining copies cannot recall accepted emails or promise a credit refund.
- Placement is only attributed to this test's provider ID and returned seed address. Unknown folder values remain unknown. First observed Inbox/Tabs/Spam is retained, so manually moving a message cannot clear its initial spam result. Partial results and missing deliveries do not produce a pass.
- Changing saved content marks the earlier report outdated; reports older than seven days are stale. Domain authentication, reputation, recipient-specific behavior and other campaigns still need separate review. Changing rendering/signature behavior requires incrementing `rendererVersion` in `placementSnapshot`.

## Verification

Run `npm run check`, `npm run test:outreach-email`, and `npm run build`.
For isolated PostgreSQL integration tests, create local `new_dawn_placement_test`, then set both `DATABASE_URL` and `PLACEMENT_TEST_DATABASE_URL` to its localhost URL before running `npx tsx --test tests/campaign-placement.test.ts`. The test refuses other database names/hosts. SMTP and provider HTTP are mocked; no credits or real messages are used. CI runs this on a separate ephemeral database.

The connected-provider smoke test remains pending until account setup. Confirm a one-credit test is attributed correctly, recipients match the chosen panel, acceptance is counted separately, and Inbox/Tabs/Spam observations arrive. Do not infer readiness from a disabled setup panel or passing mocked tests.
