import { z } from "zod";

export const mobileApiVersionSchema = z.literal("v1");
export const mobileLocaleSchema = z.enum(["en", "es"]);
export const mobileRoleSchema = z.enum(["investor", "partner", "attorney"]);
export const mobileAvailabilitySchema = z.enum(["prelaunch", "pilot", "available"]);

export const mobileCapabilitySchema = z.enum([
  "account:read-own",
  "account:sessions:manage-own",
  "account:deletion:request-own",
  "investor:path:read-own",
  "partner:application:write-own",
  "partner:referral:create",
  "partner:referral:read-own",
  "attorney:resources:read",
  "attorney:coordination:read-invited",
]);

export const mobileStatusResponseSchema = z.object({
  apiVersion: mobileApiVersionSchema,
  availability: mobileAvailabilitySchema,
  minimumAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  requestId: z.string().min(1).max(128),
});

export const mobileBootstrapResponseSchema = z.object({
  apiVersion: mobileApiVersionSchema,
  availability: mobileAvailabilitySchema,
  minimumAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  supportedLocales: z.array(mobileLocaleSchema).min(1),
  features: z.object({
    authentication: z.boolean(),
    investorAccounts: z.boolean(),
    partnerAccounts: z.boolean(),
    attorneyAccounts: z.boolean(),
  }),
  security: z.object({
    accessTokenExpiresInSeconds: z.number().int().min(300).max(900),
    refreshTokenRotationRequired: z.literal(true),
  }),
  requestId: z.string().min(1).max(128),
});

export const mobileApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "NOT_AUTHENTICATED",
  "NOT_AUTHORIZED",
  "CONTENT_NOT_APPROVED",
  "CONFLICT_REVIEW_REQUIRED",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const mobileRegistrationRoleSchema = z.enum(["investor", "partner"]);
export const mobileEmailSchema = z.string().trim().email().max(254);
export const mobilePasswordSchema = z.string().min(12).max(128);
export const mobileOpaqueTokenSchema = z.string().min(40).max(256);
export const mobileDeviceLabelSchema = z.string().trim().min(1).max(120).optional();

export const mobileRegisterRequestSchema = z.object({
  email: mobileEmailSchema,
  password: mobilePasswordSchema,
  role: mobileRegistrationRoleSchema,
  locale: mobileLocaleSchema,
  deviceLabel: mobileDeviceLabelSchema,
}).strict();

export const mobileAcceptedResponseSchema = z.object({
  status: z.enum(["verification_required", "recovery_requested"]),
  requestId: z.string().min(1).max(128),
  testToken: mobileOpaqueTokenSchema.optional(),
});

export const mobileVerifyEmailRequestSchema = z.object({
  token: mobileOpaqueTokenSchema,
  deviceLabel: mobileDeviceLabelSchema,
}).strict();

export const mobileLoginRequestSchema = z.object({
  email: mobileEmailSchema,
  password: z.string().min(1).max(128),
  deviceLabel: mobileDeviceLabelSchema,
}).strict();

export const mobileRefreshRequestSchema = z.object({
  refreshToken: mobileOpaqueTokenSchema,
}).strict();

export const mobileLogoutRequestSchema = mobileRefreshRequestSchema;

export const mobileRecoveryRequestSchema = z.object({
  email: mobileEmailSchema,
}).strict();

export const mobileRecoveryCompleteRequestSchema = z.object({
  token: mobileOpaqueTokenSchema,
  newPassword: mobilePasswordSchema,
}).strict();

export const mobileAccountSchema = z.object({
  id: z.string().uuid(),
  email: mobileEmailSchema,
  roles: z.array(mobileRoleSchema).min(1).max(3),
});

export const mobileAuthenticatedResponseSchema = z.object({
  status: z.literal("authenticated"),
  accessToken: z.string().min(1),
  refreshToken: mobileOpaqueTokenSchema,
  accessTokenExpiresInSeconds: z.literal(600),
  account: mobileAccountSchema,
  requestId: z.string().min(1).max(128),
});

export const mobilePendingApprovalResponseSchema = z.object({
  status: z.literal("pending_approval"),
  requestId: z.string().min(1).max(128),
});

export const mobileVerificationResponseSchema = z.discriminatedUnion("status", [
  mobileAuthenticatedResponseSchema,
  mobilePendingApprovalResponseSchema,
]);

export const mobileSessionSchema = z.object({
  id: z.string().uuid(),
  deviceLabel: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  current: z.boolean(),
});

export const mobileSessionsResponseSchema = z.object({
  sessions: z.array(mobileSessionSchema),
  requestId: z.string().min(1).max(128),
});

export const mobileMeResponseSchema = z.object({
  account: mobileAccountSchema,
  requestId: z.string().min(1).max(128),
});

export const mobileOkResponseSchema = z.object({
  status: z.literal("ok"),
  requestId: z.string().min(1).max(128),
});

export const mobileDeletionResponseSchema = z.object({
  status: z.literal("deletion_requested"),
  requestId: z.string().min(1).max(128),
});

export const mobilePathwayMilestoneStateSchema = z.enum([
  "not_started",
  "available",
  "your_action",
  "in_progress",
  "completed",
  "blocked",
]);
export const mobilePathwayOwnerSchema = z.enum([
  "investor",
  "new_dawn",
  "independent_counsel",
  "shared",
]);
export const mobilePathwayMilestoneKeySchema = z.enum([
  "initial_readiness",
  "counsel_consultation",
  "business_model_review",
  "fdd_review",
  "territory_operating_plan",
  "entity_investment_business_plan",
  "visa_preparation",
  "launch_training",
]);
export const mobilePathwayMilestoneSchema = z.object({
  key: mobilePathwayMilestoneKeySchema,
  sequence: z.number().int().min(1).max(100),
  owner: mobilePathwayOwnerSchema,
  state: mobilePathwayMilestoneStateSchema,
  updatedAt: z.string().datetime(),
});
export const mobilePathwayResponseSchema = z.object({
  pathwayVersion: z.string().min(1).max(32),
  completedMilestones: z.number().int().nonnegative(),
  totalMilestones: z.number().int().positive(),
  milestones: z.array(mobilePathwayMilestoneSchema).min(1),
  requestId: z.string().min(1).max(128),
});
export const mobilePathwayMilestoneResponseSchema = z.object({
  pathwayVersion: z.string().min(1).max(32),
  milestone: mobilePathwayMilestoneSchema,
  requestId: z.string().min(1).max(128),
});

export const mobileApiErrorSchema = z.object({
  error: z.object({
    code: mobileApiErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1).max(128),
    retryable: z.boolean(),
  }),
});

export type MobileLocale = z.infer<typeof mobileLocaleSchema>;
export type MobileRole = z.infer<typeof mobileRoleSchema>;
export type MobileCapability = z.infer<typeof mobileCapabilitySchema>;
export type MobileStatusResponse = z.infer<typeof mobileStatusResponseSchema>;
export type MobileBootstrapResponse = z.infer<typeof mobileBootstrapResponseSchema>;
export type MobileApiError = z.infer<typeof mobileApiErrorSchema>;
export type MobileRegisterRequest = z.infer<typeof mobileRegisterRequestSchema>;
export type MobileLoginRequest = z.infer<typeof mobileLoginRequestSchema>;
export type MobileAuthenticatedResponse = z.infer<typeof mobileAuthenticatedResponseSchema>;
export type MobileAccount = z.infer<typeof mobileAccountSchema>;
export type MobileSession = z.infer<typeof mobileSessionSchema>;
export type MobilePathwayMilestoneState = z.infer<typeof mobilePathwayMilestoneStateSchema>;
export type MobilePathwayOwner = z.infer<typeof mobilePathwayOwnerSchema>;
export type MobilePathwayMilestoneKey = z.infer<typeof mobilePathwayMilestoneKeySchema>;
export type MobilePathwayMilestone = z.infer<typeof mobilePathwayMilestoneSchema>;
export type MobilePathwayResponse = z.infer<typeof mobilePathwayResponseSchema>;
