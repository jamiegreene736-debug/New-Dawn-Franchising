type Environment = Readonly<Record<string, string | undefined>>;

export type ApplicationRuntimeMode = "full" | "mobile-staging";

export type ApplicationRuntimeProfile = {
  mode: ApplicationRuntimeMode;
  legacySessionEnabled: boolean;
  legacyStartupWritesEnabled: boolean;
  legacyRoutesEnabled: boolean;
  backgroundJobsEnabled: boolean;
  staticWebsiteEnabled: boolean;
  providerWarmupsEnabled: boolean;
};

const FULL_RUNTIME_PROFILE: ApplicationRuntimeProfile = {
  mode: "full",
  legacySessionEnabled: true,
  legacyStartupWritesEnabled: true,
  legacyRoutesEnabled: true,
  backgroundJobsEnabled: true,
  staticWebsiteEnabled: true,
  providerWarmupsEnabled: true,
};

const MOBILE_STAGING_RUNTIME_PROFILE: ApplicationRuntimeProfile = {
  mode: "mobile-staging",
  legacySessionEnabled: false,
  legacyStartupWritesEnabled: false,
  legacyRoutesEnabled: false,
  backgroundJobsEnabled: false,
  staticWebsiteEnabled: false,
  providerWarmupsEnabled: false,
};

export function readApplicationRuntimeProfile(
  environment: Environment = process.env,
): ApplicationRuntimeProfile {
  const rawMode = environment.APP_RUNTIME_MODE?.trim().toLowerCase() || "full";

  if (rawMode === "full") {
    return FULL_RUNTIME_PROFILE;
  }

  if (rawMode !== "mobile-staging") {
    throw new Error("[runtime] APP_RUNTIME_MODE must be full or mobile-staging");
  }

  const railwayEnvironment = environment.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
  if (railwayEnvironment && railwayEnvironment !== "staging") {
    throw new Error(
      "[runtime] mobile-staging mode may only run in the Railway staging environment",
    );
  }

  return MOBILE_STAGING_RUNTIME_PROFILE;
}
