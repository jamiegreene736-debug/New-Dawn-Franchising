import assert from "node:assert/strict";

type Json = Record<string, any>;

const baseUrl = process.env.MOBILE_STAGING_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) throw new Error("MOBILE_STAGING_BASE_URL is required");

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const investorEmail = `codex-investor-${suffix}@example.test`;
const partnerEmail = `codex-partner-${suffix}@example.test`;
const password = "Pilot-password-2026!";
const recoveredPassword = "Recovered-password-2026!";

async function request(
  path: string,
  options: RequestInit = {},
  expectedStatus = 200,
): Promise<Json> {
  const response = await fetch(`${baseUrl}/api/mobile/v1${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json() as Json;
  assert.equal(
    response.status,
    expectedStatus,
    `${path} returned ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function main() {
  const bootstrap = await request("/bootstrap");
  assert.equal(bootstrap.availability, "pilot");
  assert.equal(bootstrap.features.authentication, true);
  assert.equal(bootstrap.features.attorneyAccounts, false);
  console.log("ok - isolated pilot bootstrap");

  const registration = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: investorEmail, password, role: "investor", locale: "en" }),
  }, 202);
  assert.equal(registration.status, "verification_required");
  assert.equal(typeof registration.testToken, "string");

  const duplicate = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: investorEmail, password, role: "investor", locale: "en" }),
  }, 202);
  assert.equal(duplicate.status, "verification_required");
  assert.equal(duplicate.testToken, undefined);
  console.log("ok - neutral duplicate-safe registration");

  const verified = await request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token: registration.testToken, deviceLabel: "staging smoke test" }),
  });
  assert.equal(verified.status, "authenticated");
  assert.equal(verified.account.email, investorEmail);
  assert.deepEqual(verified.account.roles, ["investor"]);

  const me = await request("/me", {
    headers: { Authorization: `Bearer ${verified.accessToken}` },
  });
  assert.equal(me.account.email, investorEmail);

  const sessions = await request("/sessions", {
    headers: { Authorization: `Bearer ${verified.accessToken}` },
  });
  assert.equal(sessions.sessions.length, 1);
  assert.equal(sessions.sessions[0].current, true);
  console.log("ok - verification, access control, and session readback");

  const rotated = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: verified.refreshToken }),
  });
  await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: verified.refreshToken }),
  }, 401);
  await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  }, 401);
  console.log("ok - refresh rotation and token-family reuse revocation");

  const loggedIn = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: investorEmail, password, deviceLabel: "staging smoke login" }),
  });
  assert.equal(loggedIn.status, "authenticated");

  const recovery = await request("/auth/recovery/request", {
    method: "POST",
    body: JSON.stringify({ email: investorEmail }),
  }, 202);
  assert.equal(typeof recovery.testToken, "string");
  await request("/auth/recovery/complete", {
    method: "POST",
    body: JSON.stringify({ token: recovery.testToken, newPassword: recoveredPassword }),
  });
  await request("/me", {
    headers: { Authorization: `Bearer ${loggedIn.accessToken}` },
  }, 401);
  const recoveredLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: investorEmail, password: recoveredPassword }),
  });
  console.log("ok - password recovery revokes prior sessions");

  await request("/deletion-request", {
    method: "POST",
    headers: { Authorization: `Bearer ${recoveredLogin.accessToken}` },
  }, 202);
  await request("/me", {
    headers: { Authorization: `Bearer ${recoveredLogin.accessToken}` },
  }, 401);
  console.log("ok - deletion request disables identity and sessions");

  const partnerRegistration = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: partnerEmail, password, role: "partner", locale: "es" }),
  }, 202);
  const partnerVerification = await request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token: partnerRegistration.testToken }),
  });
  assert.equal(partnerVerification.status, "pending_approval");
  await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: partnerEmail, password }),
  }, 401);
  console.log("ok - partner verification remains approval-gated");

  console.log("Mobile staging smoke test passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
