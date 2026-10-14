CREATE TYPE "public"."project_status_category" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "project_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"category" "project_status_category" NOT NULL,
	"color" varchar(32) NOT NULL,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_statuses_position_positive_check" CHECK ("project_statuses"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" varchar(12) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_key_format_check" CHECK ("projects"."key" ~ '^[A-Z][A-Z0-9]{1,11}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_id_id_unique" ON "projects" USING btree ("workspace_id","id");--> statement-breakpoint
ALTER TABLE "project_statuses" ADD CONSTRAINT "project_statuses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_statuses" ADD CONSTRAINT "project_statuses_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_statuses_project_name_unique" ON "project_statuses" USING btree ("workspace_id","project_id","name");--> statement-breakpoint
CREATE INDEX "project_statuses_project_position_idx" ON "project_statuses" USING btree ("workspace_id","project_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_key_unique" ON "projects" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "projects_workspace_deleted_at_idx" ON "projects" USING btree ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "projects_owner_user_id_idx" ON "projects" USING btree ("owner_user_id");
