CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assignee_user_id" uuid,
	"reporter_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_number_positive_check" CHECK ("tasks"."number" > 0)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_statuses_workspace_project_id_unique" ON "project_statuses" USING btree ("workspace_id","project_id","id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_status_fk" FOREIGN KEY ("workspace_id","project_id","status_id") REFERENCES "public"."project_statuses"("workspace_id","project_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_number_unique" ON "tasks" USING btree ("workspace_id","project_id","number");--> statement-breakpoint
CREATE INDEX "tasks_project_status_idx" ON "tasks" USING btree ("workspace_id","project_id","status_id");--> statement-breakpoint
CREATE INDEX "tasks_project_deleted_at_idx" ON "tasks" USING btree ("workspace_id","project_id","deleted_at");--> statement-breakpoint
CREATE INDEX "tasks_assignee_user_id_idx" ON "tasks" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "tasks_reporter_user_id_idx" ON "tasks" USING btree ("reporter_user_id");
