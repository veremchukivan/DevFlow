ALTER TYPE "public"."task_activity_event_type" ADD VALUE 'task_time_logged';--> statement-breakpoint
ALTER TYPE "public"."task_activity_event_type" ADD VALUE 'task_timer_started';--> statement-breakpoint
ALTER TYPE "public"."task_activity_event_type" ADD VALUE 'task_timer_stopped';--> statement-breakpoint
CREATE TABLE "task_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"stopped_at" timestamp with time zone,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"description" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_time_entries_duration_nonnegative_check" CHECK ("task_time_entries"."duration_minutes" >= 0),
	CONSTRAINT "task_time_entries_stop_after_start_check" CHECK ("task_time_entries"."stopped_at" is null or "task_time_entries"."stopped_at" >= "task_time_entries"."started_at")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_fk" FOREIGN KEY ("workspace_id","project_id","task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_time_entries_task_started_idx" ON "task_time_entries" USING btree ("workspace_id","project_id","task_id","started_at");--> statement-breakpoint
CREATE INDEX "task_time_entries_user_started_idx" ON "task_time_entries" USING btree ("workspace_id","user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_time_entries_one_active_timer_per_user" ON "task_time_entries" USING btree ("workspace_id","user_id") WHERE "task_time_entries"."stopped_at" is null;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_estimate_minutes_nonnegative_check" CHECK ("tasks"."estimate_minutes" is null or "tasks"."estimate_minutes" >= 0);