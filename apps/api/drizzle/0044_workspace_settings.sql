CREATE TABLE "workspace_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "default_assignee_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "enabled_task_types" jsonb DEFAULT '["task","bug","feature","story"]'::jsonb NOT NULL,
  "custom_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "features" jsonb DEFAULT '{"automation":true,"attachments":true,"sprints":true}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_settings_workspace_unique" ON "workspace_settings" USING btree ("workspace_id");
--> statement-breakpoint
CREATE TABLE "workspace_saved_filters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "workspace_saved_filters_workspace_user_idx" ON "workspace_saved_filters" USING btree ("workspace_id","user_id");
