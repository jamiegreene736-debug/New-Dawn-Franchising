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
  "notifications:read-own",
  "notifications:manage-own",
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
    notifications: z.boolean(),
    officialSourceAlerts: z.boolean(),
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

export const mobileNotificationCategorySchema = z.enum([
  "next_action",
  "appointment",
  "fdd",
  "embassy",
  "expiration",
  "secure_status",
  "opportunity",
  "weekly_digest",
  "referral",
  "owner_operations",
]);
export const mobileNotificationUrgencySchema = z.enum(["passive", "active", "time_sensitive"]);
export const mobileNotificationPlatformSchema = z.enum(["ios", "android"]);
export const mobileReminderKindSchema = z.enum([
  "appointment",
  "fdd_review",
  "passport_check",
  "visa_check",
  "i94_check",
  "business_deadline",
]);

export const mobileNotificationPreferencesSchema = z.object({
  nextAction: z.boolean(),
  appointments: z.boolean(),
  fdd: z.boolean(),
  embassy: z.boolean(),
  expiration: z.boolean(),
  secureStatus: z.boolean(),
  opportunities: z.boolean(),
  weeklyDigest: z.boolean(),
  referrals: z.boolean(),
  ownerOperations: z.boolean(),
  followedEmbassyPost: z.string().trim().min(2).max(120).nullable(),
  timezone: z.string().trim().min(1).max(64),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  updatedAt: z.string().datetime(),
});
export const mobileNotificationPreferencesRequestSchema = mobileNotificationPreferencesSchema
  .omit({ updatedAt: true })
  .strict();
export const mobileNotificationPreferencesResponseSchema = mobileNotificationPreferencesSchema.extend({
  requestId: z.string().min(1).max(128),
});

export const mobilePushDeviceRequestSchema = z.object({
  expoPushToken: z.string().trim().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
  platform: mobileNotificationPlatformSchema,
  deviceLabel: z.string().trim().min(1).max(120).optional(),
  locale: mobileLocaleSchema,
}).strict();
export const mobilePushDeviceResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("registered"),
  requestId: z.string().min(1).max(128),
});

export const mobileNotificationSourceSchema = z.object({
  label: z.string().min(1).max(160),
  url: z.string().url().startsWith("https://"),
  publishedAt: z.string().datetime().nullable(),
}).nullable();
export const mobileNotificationSchema = z.object({
  id: z.string().uuid(),
  category: mobileNotificationCategorySchema,
  urgency: mobileNotificationUrgencySchema,
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  deepLink: z.string().regex(/^\/[A-Za-z0-9_?=&/().:-]+$/),
  source: mobileNotificationSourceSchema,
  availableAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export const mobileNotificationsResponseSchema = z.object({
  notifications: z.array(mobileNotificationSchema).max(100),
  unreadCount: z.number().int().nonnegative(),
  requestId: z.string().min(1).max(128),
});

export const mobileReminderRequestSchema = z.object({
  kind: mobileReminderKindSchema,
  eventAt: z.string().datetime(),
}).strict();
export const mobileReminderSchema = z.object({
  id: z.string().uuid(),
  kind: mobileReminderKindSchema,
  eventAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export const mobileReminderResponseSchema = mobileReminderSchema.extend({
  requestId: z.string().min(1).max(128),
});
export const mobileRemindersResponseSchema = z.object({
  reminders: z.array(mobileReminderSchema).max(100),
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
export type MobileNotificationCategory = z.infer<typeof mobileNotificationCategorySchema>;
export type MobileNotificationUrgency = z.infer<typeof mobileNotificationUrgencySchema>;
export type MobileNotificationPreferences = z.infer<typeof mobileNotificationPreferencesSchema>;
export type MobileNotification = z.infer<typeof mobileNotificationSchema>;
export type MobileReminderKind = z.infer<typeof mobileReminderKindSchema>;
export type MobileReminder = z.infer<typeof mobileReminderSchema>;
