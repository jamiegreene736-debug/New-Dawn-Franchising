import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { crmClients } from "../schema";

export const mobileIdentityStatus = pgEnum("mobile_identity_status", [
  "pending_verification",
  "active",
  "suspended",
  "deletion_requested",
  "deleted",
]);

export const mobileRole = pgEnum("mobile_role", ["investor", "partner", "attorney"]);
export const mobileRoleStatus = pgEnum("mobile_role_status", ["pending", "active", "suspended", "revoked"]);
export const mobilePartnerStatus = pgEnum("mobile_partner_status", [
  "applying",
  "under_review",
  "approved",
  "suspended",
  "rejected",
]);
export const mobileReviewStatus = pgEnum("mobile_review_status", ["pending", "approved", "rejected"]);
export const mobileReferralStatus = pgEnum("mobile_referral_status", [
  "received",
  "duplicate_review",
  "in_review",
  "linked",
  "closed",
]);
export const mobileDeletionStatus = pgEnum("mobile_deletion_status", [
  "requested",
  "identity_verified",
  "in_progress",
  "completed",
  "rejected",
]);
export const mobileOneTimeTokenPurpose = pgEnum("mobile_one_time_token_purpose", [
  "verify_email",
  "reset_password",
]);

export const mobileIdentities = pgTable("mobile_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  normalizedEmail: text("normalized_email").notNull(),
  passwordHash: text("password_hash"),
  status: mobileIdentityStatus("status").default("pending_verification").notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  failedLoginCount: integer("failed_login_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  lastAuthenticatedAt: timestamp("last_authenticated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_identities_normalized_email_unique").on(table.normalizedEmail),
  check("mobile_identities_normalized_email_check", sql`${table.normalizedEmail} = lower(trim(${table.normalizedEmail}))`),
  check("mobile_identities_email_not_blank_check", sql`length(${table.normalizedEmail}) > 3`),
  check("mobile_identities_failed_login_count_check", sql`${table.failedLoginCount} >= 0`),
]);

export const mobileIdentityRoles = pgTable("mobile_identity_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "cascade" }),
  role: mobileRole("role").notNull(),
  status: mobileRoleStatus("status").default("pending").notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  suspendedAt: timestamp("suspended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_identity_roles_identity_role_unique").on(table.identityId, table.role),
  index("mobile_identity_roles_status_idx").on(table.status),
]);

export const mobileInvestorLinks = pgTable("mobile_investor_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "cascade" }),
  crmClientId: varchar("crm_client_id").notNull().references(() => crmClients.id, { onDelete: "restrict" }),
  reviewStatus: mobileReviewStatus("review_status").default("pending").notNull(),
  matchReason: text("match_reason").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_investor_links_identity_unique").on(table.identityId),
  uniqueIndex("mobile_investor_links_crm_client_unique").on(table.crmClientId),
  index("mobile_investor_links_review_status_idx").on(table.reviewStatus),
]);

export const mobilePartnerProfiles = pgTable("mobile_partner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "cascade" }),
  status: mobilePartnerStatus("status").default("applying").notNull(),
  category: text("category").notNull(),
  companyName: text("company_name"),
  jurisdiction: text("jurisdiction"),
  agreementVersion: text("agreement_version"),
  agreementSignedAt: timestamp("agreement_signed_at"),
  trainingVersion: text("training_version"),
  trainingCompletedAt: timestamp("training_completed_at"),
  compensationEnabled: boolean("compensation_enabled").default(false).notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_partner_profiles_identity_unique").on(table.identityId),
  index("mobile_partner_profiles_status_idx").on(table.status),
]);

export const mobileRefreshSessions = pgTable("mobile_refresh_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  tokenFamilyId: varchar("token_family_id").notNull(),
  deviceLabel: text("device_label"),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  rotatedAt: timestamp("rotated_at"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  reuseDetectedAt: timestamp("reuse_detected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_refresh_sessions_token_hash_unique").on(table.tokenHash),
  index("mobile_refresh_sessions_identity_idx").on(table.identityId),
  index("mobile_refresh_sessions_family_idx").on(table.tokenFamilyId),
  index("mobile_refresh_sessions_expires_at_idx").on(table.expiresAt),
]);

export const mobileOneTimeTokens = pgTable("mobile_one_time_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "cascade" }),
  purpose: mobileOneTimeTokenPurpose("purpose").notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  requestId: varchar("request_id", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_one_time_tokens_token_hash_unique").on(table.tokenHash),
  index("mobile_one_time_tokens_identity_purpose_idx").on(table.identityId, table.purpose),
  index("mobile_one_time_tokens_expires_at_idx").on(table.expiresAt),
  check("mobile_one_time_tokens_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const mobileReferrals = pgTable("mobile_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerIdentityId: varchar("partner_identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "restrict" }),
  receiptCode: varchar("receipt_code", { length: 64 }).notNull(),
  idempotencyKeyHash: varchar("idempotency_key_hash", { length: 128 }).notNull(),
  matchKeyHash: varchar("match_key_hash", { length: 128 }).notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  preferredLanguage: text("preferred_language").notNull(),
  businessTiming: text("business_timing"),
  consentTextVersion: text("consent_text_version").notNull(),
  consentConfirmedAt: timestamp("consent_confirmed_at").notNull(),
  status: mobileReferralStatus("status").default("received").notNull(),
  retentionExpiresAt: timestamp("retention_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_referrals_receipt_code_unique").on(table.receiptCode),
  uniqueIndex("mobile_referrals_idempotency_key_hash_unique").on(table.idempotencyKeyHash),
  index("mobile_referrals_partner_idx").on(table.partnerIdentityId),
  index("mobile_referrals_match_key_hash_idx").on(table.matchKeyHash),
  index("mobile_referrals_status_idx").on(table.status),
  check("mobile_referrals_contact_email_normalized_check", sql`${table.contactEmail} = lower(trim(${table.contactEmail}))`),
  check("mobile_referrals_preferred_language_check", sql`${table.preferredLanguage} in ('en', 'es')`),
  check("mobile_referrals_retention_expiry_check", sql`${table.retentionExpiresAt} > ${table.createdAt}`),
]);

export const mobileReferralMatches = pgTable("mobile_referral_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => mobileReferrals.id, { onDelete: "cascade" }),
  crmClientId: varchar("crm_client_id").references(() => crmClients.id, { onDelete: "restrict" }),
  reviewStatus: mobileReviewStatus("review_status").default("pending").notNull(),
  matchReason: text("match_reason").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mobile_referral_matches_referral_unique").on(table.referralId),
  index("mobile_referral_matches_crm_client_idx").on(table.crmClientId),
  index("mobile_referral_matches_review_status_idx").on(table.reviewStatus),
]);

export const mobileAuditEvents = pgTable("mobile_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorIdentityId: varchar("actor_identity_id").references(() => mobileIdentities.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: varchar("subject_id"),
  requestId: varchar("request_id", { length: 128 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("mobile_audit_events_actor_idx").on(table.actorIdentityId),
  index("mobile_audit_events_subject_idx").on(table.subjectType, table.subjectId),
  index("mobile_audit_events_created_at_idx").on(table.createdAt),
]);

export const mobileDeletionRequests = pgTable("mobile_deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: varchar("identity_id").notNull().references(() => mobileIdentities.id, { onDelete: "restrict" }),
  status: mobileDeletionStatus("status").default("requested").notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  completedAt: timestamp("completed_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("mobile_deletion_requests_identity_idx").on(table.identityId),
  index("mobile_deletion_requests_status_idx").on(table.status),
]);

export type MobileIdentity = typeof mobileIdentities.$inferSelect;
export type MobileIdentityRole = typeof mobileIdentityRoles.$inferSelect;
export type MobileInvestorLink = typeof mobileInvestorLinks.$inferSelect;
export type MobilePartnerProfile = typeof mobilePartnerProfiles.$inferSelect;
export type MobileRefreshSession = typeof mobileRefreshSessions.$inferSelect;
export type MobileOneTimeToken = typeof mobileOneTimeTokens.$inferSelect;
export type MobileReferral = typeof mobileReferrals.$inferSelect;
export type MobileReferralMatch = typeof mobileReferralMatches.$inferSelect;
export type MobileAuditEvent = typeof mobileAuditEvents.$inferSelect;
export type MobileDeletionRequest = typeof mobileDeletionRequests.$inferSelect;
