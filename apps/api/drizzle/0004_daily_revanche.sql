CREATE TYPE "public"."task_activity_event_type" AS ENUM('task_created', 'task_updated', 'task_deleted', 'task_comment_created', 'task_comment_updated', 'task_comment_deleted');--> statement-breakpoint
CREATE TABLE "task_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" "task_activity_event_type" NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_activity_events" ADD CONSTRAINT "task_activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_events" ADD CONSTRAINT "task_activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_events" ADD CONSTRAINT "task_activity_events_task_fk" FOREIGN KEY ("workspace_id","project_id","task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_activity_events_task_created_at_idx" ON "task_activity_events" USING btree ("workspace_id","project_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_activity_events_actor_user_id_idx" ON "task_activity_events" USING btree ("actor_user_id");