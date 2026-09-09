CREATE TYPE "public"."mobile_notification_category" AS ENUM('next_action', 'appointment', 'fdd', 'embassy', 'expiration', 'secure_status', 'opportunity', 'weekly_digest', 'referral', 'owner_operations');--> statement-breakpoint
CREATE TYPE "public"."mobile_notification_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."mobile_notification_urgency" AS ENUM('passive', 'active', 'time_sensitive');--> statement-breakpoint
CREATE TYPE "public"."mobile_reminder_kind" AS ENUM('appointment', 'fdd_review', 'passport_check', 'visa_check', 'i94_check', 'business_deadline');--> statement-breakpoint
CREATE TABLE "mobile_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"next_action" boolean DEFAULT true NOT NULL,
	"appointments" boolean DEFAULT true NOT NULL,
	"fdd" boolean DEFAULT true NOT NULL,
	"embassy" boolean DEFAULT true NOT NULL,
	"expiration" boolean DEFAULT true NOT NULL,
	"secure_status" boolean DEFAULT true NOT NULL,
	"opportunities" boolean DEFAULT false NOT NULL,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"referrals" boolean DEFAULT true NOT NULL,
	"owner_operations" boolean DEFAULT true NOT NULL,
	"followed_embassy_post" text,
	"timezone" varchar(64) DEFAULT 'America/New_York' NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_notification_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"kind" "mobile_reminder_kind" NOT NULL,
	"event_at" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"reminder_id" varchar,
	"category" "mobile_notification_category" NOT NULL,
	"urgency" "mobile_notification_urgency" DEFAULT 'active' NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"deep_link" varchar(240) NOT NULL,
	"source_label" varchar(160),
	"source_url" text,
	"source_published_at" timestamp,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"available_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_push_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"expo_push_token" text NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"platform" "mobile_notification_platform" NOT NULL,
	"device_label" text,
	"locale" varchar(2) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_registered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_push_devices_locale_check" CHECK ("mobile_push_devices"."locale" in ('en', 'es'))
);
--> statement-breakpoint
ALTER TABLE "mobile_notification_preferences" ADD CONSTRAINT "mobile_notification_preferences_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notification_reminders" ADD CONSTRAINT "mobile_notification_reminders_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notifications" ADD CONSTRAINT "mobile_notifications_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_notifications" ADD CONSTRAINT "mobile_notifications_reminder_id_mobile_notification_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."mobile_notification_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_push_devices" ADD CONSTRAINT "mobile_push_devices_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_notification_preferences_identity_unique" ON "mobile_notification_preferences" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "mobile_notification_reminders_identity_idx" ON "mobile_notification_reminders" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "mobile_notification_reminders_event_at_idx" ON "mobile_notification_reminders" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "mobile_notifications_identity_available_idx" ON "mobile_notifications" USING btree ("identity_id","available_at");--> statement-breakpoint
CREATE INDEX "mobile_notifications_identity_read_idx" ON "mobile_notifications" USING btree ("identity_id","read_at");--> statement-breakpoint
CREATE INDEX "mobile_notifications_reminder_idx" ON "mobile_notifications" USING btree ("reminder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_push_devices_token_hash_unique" ON "mobile_push_devices" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mobile_push_devices_identity_idx" ON "mobile_push_devices" USING btree ("identity_id");