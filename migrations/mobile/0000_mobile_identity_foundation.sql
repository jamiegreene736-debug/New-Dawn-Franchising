CREATE TYPE "public"."mobile_deletion_status" AS ENUM('requested', 'identity_verified', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."mobile_identity_status" AS ENUM('pending_verification', 'active', 'suspended', 'deletion_requested', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."mobile_one_time_token_purpose" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."mobile_partner_status" AS ENUM('applying', 'under_review', 'approved', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."mobile_referral_status" AS ENUM('received', 'duplicate_review', 'in_review', 'linked', 'closed');--> statement-breakpoint
CREATE TYPE "public"."mobile_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."mobile_role" AS ENUM('investor', 'partner', 'attorney');--> statement-breakpoint
CREATE TYPE "public"."mobile_role_status" AS ENUM('pending', 'active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TABLE "mobile_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_identity_id" varchar,
	"event_type" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" varchar,
	"request_id" varchar(128) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_deletion_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"status" "mobile_deletion_status" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"completed_at" timestamp,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_identities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_email" text NOT NULL,
	"password_hash" text,
	"status" "mobile_identity_status" DEFAULT 'pending_verification' NOT NULL,
	"email_verified_at" timestamp,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_authenticated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_identities_normalized_email_check" CHECK ("mobile_identities"."normalized_email" = lower(trim("mobile_identities"."normalized_email"))),
	CONSTRAINT "mobile_identities_email_not_blank_check" CHECK (length("mobile_identities"."normalized_email") > 3),
	CONSTRAINT "mobile_identities_failed_login_count_check" CHECK ("mobile_identities"."failed_login_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mobile_identity_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"role" "mobile_role" NOT NULL,
	"status" "mobile_role_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp,
	"approved_by" text,
	"suspended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_investor_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"crm_client_id" varchar NOT NULL,
	"review_status" "mobile_review_status" DEFAULT 'pending' NOT NULL,
	"match_reason" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_one_time_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"purpose" "mobile_one_time_token_purpose" NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"request_id" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_one_time_tokens_expiry_check" CHECK ("mobile_one_time_tokens"."expires_at" > "mobile_one_time_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "mobile_partner_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"status" "mobile_partner_status" DEFAULT 'applying' NOT NULL,
	"category" text NOT NULL,
	"company_name" text,
	"jurisdiction" text,
	"agreement_version" text,
	"agreement_signed_at" timestamp,
	"training_version" text,
	"training_completed_at" timestamp,
	"compensation_enabled" boolean DEFAULT false NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_referral_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" varchar NOT NULL,
	"crm_client_id" varchar,
	"review_status" "mobile_review_status" DEFAULT 'pending' NOT NULL,
	"match_reason" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_identity_id" varchar NOT NULL,
	"receipt_code" varchar(64) NOT NULL,
	"idempotency_key_hash" varchar(128) NOT NULL,
	"match_key_hash" varchar(128) NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"preferred_language" text NOT NULL,
	"business_timing" text,
	"consent_text_version" text NOT NULL,
	"consent_confirmed_at" timestamp NOT NULL,
	"status" "mobile_referral_status" DEFAULT 'received' NOT NULL,
	"retention_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_referrals_contact_email_normalized_check" CHECK ("mobile_referrals"."contact_email" = lower(trim("mobile_referrals"."contact_email"))),
	CONSTRAINT "mobile_referrals_preferred_language_check" CHECK ("mobile_referrals"."preferred_language" in ('en', 'es')),
	CONSTRAINT "mobile_referrals_retention_expiry_check" CHECK ("mobile_referrals"."retention_expires_at" > "mobile_referrals"."created_at")
);
--> statement-breakpoint
CREATE TABLE "mobile_refresh_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"token_family_id" varchar NOT NULL,
	"device_label" text,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"rotated_at" timestamp,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"reuse_detected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mobile_audit_events" ADD CONSTRAINT "mobile_audit_events_actor_identity_id_mobile_identities_id_fk" FOREIGN KEY ("actor_identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_deletion_requests" ADD CONSTRAINT "mobile_deletion_requests_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_identity_roles" ADD CONSTRAINT "mobile_identity_roles_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_investor_links" ADD CONSTRAINT "mobile_investor_links_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_investor_links" ADD CONSTRAINT "mobile_investor_links_crm_client_id_crm_clients_id_fk" FOREIGN KEY ("crm_client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_one_time_tokens" ADD CONSTRAINT "mobile_one_time_tokens_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_partner_profiles" ADD CONSTRAINT "mobile_partner_profiles_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_referral_matches" ADD CONSTRAINT "mobile_referral_matches_referral_id_mobile_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."mobile_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_referral_matches" ADD CONSTRAINT "mobile_referral_matches_crm_client_id_crm_clients_id_fk" FOREIGN KEY ("crm_client_id") REFERENCES "public"."crm_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_referrals" ADD CONSTRAINT "mobile_referrals_partner_identity_id_mobile_identities_id_fk" FOREIGN KEY ("partner_identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_refresh_sessions" ADD CONSTRAINT "mobile_refresh_sessions_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mobile_audit_events_actor_idx" ON "mobile_audit_events" USING btree ("actor_identity_id");--> statement-breakpoint
CREATE INDEX "mobile_audit_events_subject_idx" ON "mobile_audit_events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "mobile_audit_events_created_at_idx" ON "mobile_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mobile_deletion_requests_identity_idx" ON "mobile_deletion_requests" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "mobile_deletion_requests_status_idx" ON "mobile_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_identities_normalized_email_unique" ON "mobile_identities" USING btree ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_identity_roles_identity_role_unique" ON "mobile_identity_roles" USING btree ("identity_id","role");--> statement-breakpoint
CREATE INDEX "mobile_identity_roles_status_idx" ON "mobile_identity_roles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_investor_links_identity_unique" ON "mobile_investor_links" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_investor_links_crm_client_unique" ON "mobile_investor_links" USING btree ("crm_client_id");--> statement-breakpoint
CREATE INDEX "mobile_investor_links_review_status_idx" ON "mobile_investor_links" USING btree ("review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_one_time_tokens_token_hash_unique" ON "mobile_one_time_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mobile_one_time_tokens_identity_purpose_idx" ON "mobile_one_time_tokens" USING btree ("identity_id","purpose");--> statement-breakpoint
CREATE INDEX "mobile_one_time_tokens_expires_at_idx" ON "mobile_one_time_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_partner_profiles_identity_unique" ON "mobile_partner_profiles" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "mobile_partner_profiles_status_idx" ON "mobile_partner_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_referral_matches_referral_unique" ON "mobile_referral_matches" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "mobile_referral_matches_crm_client_idx" ON "mobile_referral_matches" USING btree ("crm_client_id");--> statement-breakpoint
CREATE INDEX "mobile_referral_matches_review_status_idx" ON "mobile_referral_matches" USING btree ("review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_referrals_receipt_code_unique" ON "mobile_referrals" USING btree ("receipt_code");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_referrals_idempotency_key_hash_unique" ON "mobile_referrals" USING btree ("idempotency_key_hash");--> statement-breakpoint
CREATE INDEX "mobile_referrals_partner_idx" ON "mobile_referrals" USING btree ("partner_identity_id");--> statement-breakpoint
CREATE INDEX "mobile_referrals_match_key_hash_idx" ON "mobile_referrals" USING btree ("match_key_hash");--> statement-breakpoint
CREATE INDEX "mobile_referrals_status_idx" ON "mobile_referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_refresh_sessions_token_hash_unique" ON "mobile_refresh_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mobile_refresh_sessions_identity_idx" ON "mobile_refresh_sessions" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "mobile_refresh_sessions_family_idx" ON "mobile_refresh_sessions" USING btree ("token_family_id");--> statement-breakpoint
CREATE INDEX "mobile_refresh_sessions_expires_at_idx" ON "mobile_refresh_sessions" USING btree ("expires_at");