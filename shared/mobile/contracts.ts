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
