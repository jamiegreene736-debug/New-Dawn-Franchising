type Environment = Readonly<Record<string, string | undefined>>;

export interface MobileAuthRuntimeConfig {
  enabled: boolean;
  accessTokenSecret: string | null;
  testTokensEnabled: boolean;
}

const MINIMUM_ACCESS_TOKEN_SECRET_BYTES = 32;

export function readMobileAuthRuntimeConfig(
  environment: Environment = process.env,
): MobileAuthRuntimeConfig {
  const rawEnabled = environment.MOBILE_AUTH_ENABLED?.trim().toLowerCase() || "false";

  if (rawEnabled !== "true" && rawEnabled !== "false") {
    throw new Error("[mobile-auth] MOBILE_AUTH_ENABLED must be true or false");
  }

  if (rawEnabled === "false") {
    if (environment.MOBILE_AUTH_TEST_MODE?.trim().toLowerCase() === "true") {
      throw new Error("[mobile-auth] test mode requires mobile authentication to be enabled");
    }
    return { enabled: false, accessTokenSecret: null, testTokensEnabled: false };
  }

  const accessTokenSecret = environment.MOBILE_ACCESS_TOKEN_SECRET?.trim();
  if (!accessTokenSecret) {
    throw new Error(
      "[mobile-auth] MOBILE_ACCESS_TOKEN_SECRET is required when mobile authentication is enabled",
    );
  }

  if (Buffer.byteLength(accessTokenSecret, "utf8") < MINIMUM_ACCESS_TOKEN_SECRET_BYTES) {
    throw new Error(
      `[mobile-auth] MOBILE_ACCESS_TOKEN_SECRET must be at least ${MINIMUM_ACCESS_TOKEN_SECRET_BYTES} bytes`,
    );
  }

  const rawTestMode = environment.MOBILE_AUTH_TEST_MODE?.trim().toLowerCase() || "false";
  if (rawTestMode !== "true" && rawTestMode !== "false") {
    throw new Error("[mobile-auth] MOBILE_AUTH_TEST_MODE must be true or false");
  }

  const testTokensEnabled = rawTestMode === "true";
  if (testTokensEnabled) {
    if (environment.APP_RUNTIME_MODE?.trim().toLowerCase() !== "mobile-staging") {
      throw new Error("[mobile-auth] test tokens are allowed only in mobile-staging mode");
    }
    const railwayEnvironment = environment.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
    if (railwayEnvironment && railwayEnvironment !== "staging") {
      throw new Error("[mobile-auth] test tokens are allowed only in the Railway staging environment");
    }
  }

  return { enabled: true, accessTokenSecret, testTokensEnabled };
}
