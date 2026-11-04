CREATE TYPE "public"."project_sprint_status" AS ENUM('planning', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('bug', 'feature', 'story', 'task');--> statement-breakpoint
CREATE TABLE "project_sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"goal" text,
	"status" "project_sprint_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"end_date" date,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sprints_dates_valid_check" CHECK ("project_sprints"."start_date" is null or "project_sprints"."end_date" is null or "project_sprints"."start_date" <= "project_sprints"."end_date")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type" "task_type" DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_sprints" ADD CONSTRAINT "project_sprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sprints" ADD CONSTRAINT "project_sprints_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sprints" ADD CONSTRAINT "project_sprints_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_sprints_project_status_created_at_idx" ON "project_sprints" USING btree ("workspace_id","project_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_sprints_workspace_project_id_unique" ON "project_sprints" USING btree ("workspace_id","project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_sprints_one_active_per_project" ON "project_sprints" USING btree ("workspace_id","project_id") WHERE "project_sprints"."status" = 'active';--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_sprint_fk" FOREIGN KEY ("workspace_id","project_id","sprint_id") REFERENCES "public"."project_sprints"("workspace_id","project_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_project_sprint_idx" ON "tasks" USING btree ("workspace_id","project_id","sprint_id");
