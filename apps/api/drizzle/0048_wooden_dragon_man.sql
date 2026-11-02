CREATE TYPE "public"."workspace_call_attendee_status" AS ENUM('invited', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."workspace_call_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "workspace_call_attendees" (
	"call_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"response_status" "workspace_call_attendee_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_call_attendees_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"created_by_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(80) DEFAULT 'UTC' NOT NULL,
	"location" varchar(300),
	"meeting_url" varchar(2048),
	"status" "workspace_call_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_calls_dates_valid_check" CHECK ("workspace_calls"."starts_at" < "workspace_calls"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "workspace_call_attendees" ADD CONSTRAINT "workspace_call_attendees_call_id_workspace_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."workspace_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_call_attendees" ADD CONSTRAINT "workspace_call_attendees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_call_attendees" ADD CONSTRAINT "workspace_call_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_calls" ADD CONSTRAINT "workspace_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_calls" ADD CONSTRAINT "workspace_calls_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_calls" ADD CONSTRAINT "workspace_calls_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_call_attendees_workspace_user_idx" ON "workspace_call_attendees" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_calls_workspace_starts_at_idx" ON "workspace_calls" USING btree ("workspace_id","starts_at");--> statement-breakpoint
CREATE INDEX "workspace_calls_workspace_project_idx" ON "workspace_calls" USING btree ("workspace_id","project_id");
