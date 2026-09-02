# New Dawn Pathways Mobile

This is the iPhone-first New Dawn Pathways app for investor and referral-partner pilot testing. The repository retains a disconnected prototype mode and adds an isolated connected staging mode.

## Current scope

- React Native, Expo SDK 57, Expo Router, and strict TypeScript.
- Investor readiness assessment, result, Home, My Path, opportunities, support, and profile.
- Partner application, approval/training simulation, consent-first referral registration, and duplicate-review-safe receipt.
- Bilingual launch and role selection.
- Typed English/Spanish launch and navigation content with parity checks.
- Explicit `prototype` and `connected` environments; connected mode fails closed without an API URL.
- Versioned mobile gateway with timeout and response validation.
- Connected staging registration, email verification, sign-in, token rotation, session restoration, sign-out, and account-deletion requests.
- Authenticated investors receive a private, persisted eight-step My Path with authoritative event-backed status.
- A generated native Xcode workspace can be produced with `npx expo prebuild --platform ios --clean`; `npm run ios -- --device "iPhone 17 Pro Max"` builds and launches it.
- Refresh tokens stored with iOS SecureStore; access tokens stay in memory and expire after ten minutes.
- Staging-only verification tokens for internal testing until an approved transactional-email provider is connected.
- No production CRM, payments, legal-document, notification, or provider connection.

The pilot is for product, usability, accessibility, legal-copy, authentication, and operational review. It must not be presented as a production immigration-advice or investment application.

## Run locally

```bash
npm install
npm run start
```

Press `i` to open the iOS simulator or `w` to open the browser preview.

For the isolated connected pilot:

```bash
EXPO_PUBLIC_APP_MODE=connected \
EXPO_PUBLIC_API_BASE_URL=https://new-dawn-mobile-staging-staging.up.railway.app \
npm run ios
```

## Verify

```bash
npm run verify
npm run test:foundation
npx expo-doctor
```

To verify the production-style web bundle:

```bash
npx expo export --platform web
```

The `preview` profile in `eas.json` is ready for an internal iOS distribution build once the Expo project and Apple signing credentials are authorized:

```bash
npx eas-cli build --platform ios --profile preview
```

## Primary review journeys

1. Choose **Investor** and complete the four-question assessment.
2. Review the result, then open Home and My Path.
3. Restart and choose **Referral partner**.
4. Submit the application, preview approval, finish training, accept the permission boundary, and register a referral.
5. Confirm that the final receipt communicates duplicate review without exposing another person's information.

## Staging safety boundary

- Use synthetic test identities only; never enter passports, bank details, tax records, or confidential immigration materials.
- Staging exposes only `/healthz` and `/api/mobile/v1`; the website, CRM routes, background campaigns, provider integrations, and startup data writes are disabled.
- The app displays the one-time verification token only in this staging runtime. Production test-token mode is rejected at startup.

## Production gate

Before live integration, New Dawn must approve the claims/content matrix, name the accountable legal and operational reviewers, confirm authoritative CRM data ownership, and complete the security remediations in the mobile control pack.

See [`../docs/mobile/README.md`](../docs/mobile/README.md) for the complete product, screen, API, data, security, and delivery plan.
