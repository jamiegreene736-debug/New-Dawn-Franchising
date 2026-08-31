# New Dawn Pathways Mobile Prototype

This is the iPhone-first clickable prototype for New Dawn Franchising's investor, referral-partner, and independent-attorney experiences.

## Current scope

- React Native, Expo SDK 57, Expo Router, and strict TypeScript.
- Investor readiness assessment, result, Home, My Path, opportunities, support, and profile.
- Partner application, approval/training simulation, consent-first referral registration, and duplicate-review-safe receipt.
- Bilingual launch and role selection.
- Typed English/Spanish launch and navigation content with parity checks.
- Explicit `prototype` and `connected` environments; connected mode fails closed without an API URL.
- Versioned mobile gateway with timeout and response validation.
- Typed local mock state only; no production CRM, authentication, payments, legal-document, or notification connection.

The prototype is for product, usability, accessibility, legal-copy, and pilot review. It must not be presented as a production immigration-advice or investment application.

## Run locally

```bash
npm install
npm run start
```

Press `i` to open the iOS simulator or `w` to open the browser preview.

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

## Primary review journeys

1. Choose **Investor** and complete the four-question assessment.
2. Review the result, then open Home and My Path.
3. Restart and choose **Referral partner**.
4. Submit the application, preview approval, finish training, accept the permission boundary, and register a referral.
5. Confirm that the final receipt communicates duplicate review without exposing another person's information.

## Production gate

Before live integration, New Dawn must approve the claims/content matrix, name the accountable legal and operational reviewers, confirm authoritative CRM data ownership, and complete the security remediations in the mobile control pack.

See [`../docs/mobile/README.md`](../docs/mobile/README.md) for the complete product, screen, API, data, security, and delivery plan.
