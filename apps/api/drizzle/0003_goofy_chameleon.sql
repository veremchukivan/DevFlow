CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_comments_body_not_empty_check" CHECK (length(trim("task_comments"."body")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_workspace_project_id_unique" ON "tasks" USING btree ("workspace_id","project_id","id");--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_fk" FOREIGN KEY ("workspace_id","project_id","task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_comments_task_created_at_idx" ON "task_comments" USING btree ("workspace_id","project_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_comments_task_deleted_at_idx" ON "task_comments" USING btree ("workspace_id","project_id","task_id","deleted_at");--> statement-breakpoint
CREATE INDEX "task_comments_author_user_id_idx" ON "task_comments" USING btree ("author_user_id");
