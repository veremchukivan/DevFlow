CREATE TABLE "project_view_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_limit" integer DEFAULT 1 NOT NULL,
	"board_scrolling" varchar(16) DEFAULT 'board' NOT NULL,
	"column_size" varchar(16) DEFAULT 'flexible' NOT NULL,
	"column_widths" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hide_done_tasks" boolean DEFAULT false NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"visible_task_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_view_preferences_activity_limit_check" CHECK ("project_view_preferences"."activity_limit" between 1 and 25),
	CONSTRAINT "project_view_preferences_column_size_check" CHECK ("project_view_preferences"."column_size" in ('fixed', 'flexible')),
	CONSTRAINT "project_view_preferences_scrolling_check" CHECK ("project_view_preferences"."board_scrolling" in ('board', 'column'))
);
--> statement-breakpoint
ALTER TABLE "project_view_preferences" ADD CONSTRAINT "project_view_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_view_preferences" ADD CONSTRAINT "project_view_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_view_preferences" ADD CONSTRAINT "project_view_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_view_preferences_user_project_unique" ON "project_view_preferences" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "project_view_preferences_workspace_project_idx" ON "project_view_preferences" USING btree ("workspace_id","project_id");