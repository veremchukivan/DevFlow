ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'epic';--> statement-breakpoint
CREATE TYPE "public"."project_release_status" AS ENUM('planned', 'in_progress', 'released', 'cancelled');--> statement-breakpoint
CREATE TABLE "project_releases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" text,
  "status" "project_release_status" DEFAULT 'planned' NOT NULL,
  "start_date" date,
  "release_date" date,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "epic_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "release_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "complexity_points" integer;--> statement-breakpoint
UPDATE "workspace_settings" SET "enabled_task_types" = "enabled_task_types" || '["epic"]'::jsonb WHERE NOT ("enabled_task_types" @> '["epic"]'::jsonb);--> statement-breakpoint
ALTER TABLE "project_releases" ADD CONSTRAINT "project_releases_project_fk" FOREIGN KEY ("workspace_id", "project_id") REFERENCES "public"."projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_releases" ADD CONSTRAINT "project_releases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_releases_project_date_idx" ON "project_releases" USING btree ("workspace_id", "project_id", "release_date");--> statement-breakpoint
CREATE INDEX "tasks_project_epic_idx" ON "tasks" USING btree ("workspace_id", "project_id", "epic_id");--> statement-breakpoint
CREATE INDEX "tasks_project_release_idx" ON "tasks" USING btree ("workspace_id", "project_id", "release_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_complexity_points_nonnegative_check" CHECK ("tasks"."complexity_points" is null or "tasks"."complexity_points" >= 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_epic_id_tasks_id_fk" FOREIGN KEY ("epic_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_release_id_project_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."project_releases"("id") ON DELETE set null ON UPDATE no action;
