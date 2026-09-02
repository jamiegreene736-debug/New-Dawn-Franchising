CREATE TYPE "public"."mobile_pathway_milestone_state" AS ENUM('not_started', 'available', 'your_action', 'in_progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."mobile_pathway_owner" AS ENUM('investor', 'new_dawn', 'independent_counsel', 'shared');--> statement-breakpoint
CREATE TABLE "mobile_pathway_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" varchar NOT NULL,
	"actor_identity_id" varchar,
	"event_type" varchar(64) NOT NULL,
	"state_before" "mobile_pathway_milestone_state",
	"state_after" "mobile_pathway_milestone_state" NOT NULL,
	"request_id" varchar(128) NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"occurred_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_pathway_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" varchar NOT NULL,
	"pathway_version" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_pathway_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathway_instance_id" varchar NOT NULL,
	"milestone_key" varchar(64) NOT NULL,
	"sequence" integer NOT NULL,
	"owner" "mobile_pathway_owner" NOT NULL,
	"state" "mobile_pathway_milestone_state" DEFAULT 'not_started' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_pathway_milestones_sequence_check" CHECK ("mobile_pathway_milestones"."sequence" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "mobile_pathway_events" ADD CONSTRAINT "mobile_pathway_events_milestone_id_mobile_pathway_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."mobile_pathway_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_pathway_events" ADD CONSTRAINT "mobile_pathway_events_actor_identity_id_mobile_identities_id_fk" FOREIGN KEY ("actor_identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_pathway_instances" ADD CONSTRAINT "mobile_pathway_instances_identity_id_mobile_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."mobile_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_pathway_milestones" ADD CONSTRAINT "mobile_pathway_milestones_pathway_instance_id_mobile_pathway_instances_id_fk" FOREIGN KEY ("pathway_instance_id") REFERENCES "public"."mobile_pathway_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mobile_pathway_events_milestone_idx" ON "mobile_pathway_events" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "mobile_pathway_events_actor_idx" ON "mobile_pathway_events" USING btree ("actor_identity_id");--> statement-breakpoint
CREATE INDEX "mobile_pathway_events_recorded_at_idx" ON "mobile_pathway_events" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_pathway_instances_identity_unique" ON "mobile_pathway_instances" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_pathway_milestones_instance_key_unique" ON "mobile_pathway_milestones" USING btree ("pathway_instance_id","milestone_key");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_pathway_milestones_instance_sequence_unique" ON "mobile_pathway_milestones" USING btree ("pathway_instance_id","sequence");--> statement-breakpoint
CREATE INDEX "mobile_pathway_milestones_state_idx" ON "mobile_pathway_milestones" USING btree ("state");