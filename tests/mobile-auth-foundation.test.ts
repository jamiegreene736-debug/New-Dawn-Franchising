import assert from "node:assert/strict";
import test from "node:test";

import {
  MobileAccessTokenService,
  MobileAuthenticationError,
  type MobilePrincipal,
} from "../server/mobile/access-tokens";
import { createMobileApiError } from "../server/mobile/api-errors";
import { readMobileAuthRuntimeConfig } from "../server/mobile/auth-config";
import {
  capabilitiesForMobilePrincipal,
  MobileAuthorizationError,
  requireInvitedMobileResource,
  requireMobileCapability,
  requireOwnedMobileResource,
} from "../server/mobile/authorization";
import {
  createMobileRefreshToken,
  evaluateMobileRefreshTokenUse,
  hashMobileOpaqueToken,
  type MobileRefreshSessionSnapshot,
} from "../server/mobile/refresh-tokens";
import { mobileBootstrapResponseSchema } from "../shared/mobile/contracts";

const ACCESS_TOKEN_SECRET = "a-production-shaped-secret-with-at-least-32-bytes";
const IDENTITY_ID = "be4b8082-513a-4d9c-9df1-3898ed98b70c";
const OTHER_IDENTITY_ID = "5be23d62-8eb6-47e4-926a-1c6503fb1cc4";
const SESSION_ID = "cfaebfd0-5670-4b7e-9f8e-86862167afc5";
const NOW = new Date("2026-09-01T12:00:00.000Z");

function principal(roles: MobilePrincipal["roles"]): MobilePrincipal {
  return {
    identityId: IDENTITY_ID,
    sessionId: SESSION_ID,
    roles,
    tokenId: "2728bcdc-7ff4-4ddf-af68-0f646696cc7e",
    issuedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 10 * 60 * 1000),
  };
}

test("mobile authentication remains disabled without explicit secure configuration", () => {
  assert.deepEqual(readMobileAuthRuntimeConfig({}), {
    enabled: false,
    accessTokenSecret: null,
  });
  assert.throws(
    () => readMobileAuthRuntimeConfig({ MOBILE_AUTH_ENABLED: "sometimes" }),
    /must be true or false/,
  );
  assert.throws(
    () => readMobileAuthRuntimeConfig({ MOBILE_AUTH_ENABLED: "true" }),
    /MOBILE_ACCESS_TOKEN_SECRET is required/,
  );
  assert.throws(
    () => readMobileAuthRuntimeConfig({
      MOBILE_AUTH_ENABLED: "true",
      MOBILE_ACCESS_TOKEN_SECRET: "too-short",
    }),
    /at least 32 bytes/,
  );
});

test("bootstrap advertises only production-ready capabilities", () => {
  const bootstrap = mobileBootstrapResponseSchema.parse({
    apiVersion: "v1",
    availability: "prelaunch",
    minimumAppVersion: "1.0.0",
    supportedLocales: ["en", "es"],
    features: {
      authentication: false,
      investorAccounts: false,
      partnerAccounts: false,
      attorneyAccounts: false,
    },
    security: {
      accessTokenExpiresInSeconds: 600,
      refreshTokenRotationRequired: true,
    },
    requestId: "bootstrap-test",
  });

  assert.equal(bootstrap.features.authentication, false);
  assert.equal(bootstrap.security.refreshTokenRotationRequired, true);
});

test("access tokens are short-lived, audience-bound, and reject tampering", async () => {
  const service = new MobileAccessTokenService(ACCESS_TOKEN_SECRET);
  const token = await service.issue({
    identityId: IDENTITY_ID,
    sessionId: SESSION_ID,
    roles: ["investor"],
  }, NOW);

  const verified = await service.verify(token, new Date(NOW.getTime() + 60_000));
  assert.equal(verified.identityId, IDENTITY_ID);
  assert.deepEqual(verified.roles, ["investor"]);
  assert.equal(verified.expiresAt.getTime() - verified.issuedAt.getTime(), 600_000);

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  await assert.rejects(() => service.verify(tamperedToken, NOW), MobileAuthenticationError);
  await assert.rejects(
    () => service.verify(token, new Date(NOW.getTime() + 11 * 60_000)),
    MobileAuthenticationError,
  );

  const wrongAudience = new MobileAccessTokenService(ACCESS_TOKEN_SECRET, {
    audience: "different-audience",
  });
  await assert.rejects(() => wrongAudience.verify(token, NOW), MobileAuthenticationError);
});

test("refresh tokens are hash-only and detect rotation reuse", () => {
  const token = createMobileRefreshToken();
  const tokenHash = hashMobileOpaqueToken(token);
  assert.notEqual(tokenHash, token);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);

  const baseSession: MobileRefreshSessionSnapshot = {
    tokenHash,
    expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    rotatedAt: null,
    revokedAt: null,
    reuseDetectedAt: null,
  };

  assert.equal(evaluateMobileRefreshTokenUse(baseSession, token, NOW), "allowed");
  assert.equal(evaluateMobileRefreshTokenUse(baseSession, "wrong-token", NOW), "invalid");
  assert.equal(
    evaluateMobileRefreshTokenUse({ ...baseSession, expiresAt: NOW }, token, NOW),
    "expired",
  );
  assert.equal(
    evaluateMobileRefreshTokenUse({ ...baseSession, revokedAt: NOW }, token, NOW),
    "revoked",
  );
  assert.equal(
    evaluateMobileRefreshTokenUse({ ...baseSession, rotatedAt: NOW }, token, NOW),
    "reuse_detected",
  );
});

test("role capabilities and object ownership deny cross-account access", () => {
  const investor = principal(["investor"]);
  const capabilities = capabilitiesForMobilePrincipal(investor);
  assert.equal(capabilities.has("account:read-own"), true);
  assert.equal(capabilities.has("investor:path:read-own"), true);
  assert.equal(capabilities.has("partner:referral:create"), false);

  assert.doesNotThrow(() => requireMobileCapability(investor, "investor:path:read-own"));
  assert.throws(
    () => requireMobileCapability(investor, "partner:referral:create"),
    MobileAuthorizationError,
  );
  assert.doesNotThrow(() => requireOwnedMobileResource(investor, IDENTITY_ID));
  assert.throws(
    () => requireOwnedMobileResource(investor, OTHER_IDENTITY_ID),
    MobileAuthorizationError,
  );
  assert.doesNotThrow(() => requireInvitedMobileResource(investor, [IDENTITY_ID]));
  assert.throws(
    () => requireInvitedMobileResource(investor, [OTHER_IDENTITY_ID]),
    MobileAuthorizationError,
  );
});

test("mobile API faults use stable privacy-safe messages", () => {
  const response = createMobileApiError("NOT_AUTHENTICATED", "request-123");
  assert.deepEqual(response, {
    error: {
      code: "NOT_AUTHENTICATED",
      message: "Authentication is required.",
      requestId: "request-123",
      retryable: false,
    },
  });
});
