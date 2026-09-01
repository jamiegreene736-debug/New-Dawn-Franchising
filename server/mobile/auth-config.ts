type Environment = Readonly<Record<string, string | undefined>>;

export interface MobileAuthRuntimeConfig {
  enabled: boolean;
  accessTokenSecret: string | null;
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
    return { enabled: false, accessTokenSecret: null };
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

  return { enabled: true, accessTokenSecret };
}
