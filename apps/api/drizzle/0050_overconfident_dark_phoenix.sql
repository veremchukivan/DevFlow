CREATE TYPE "public"."git_link_type" AS ENUM('branch', 'commit', 'pull_request', 'pipeline', 'deployment');--> statement-breakpoint
CREATE TYPE "public"."git_provider" AS ENUM('github', 'gitlab');--> statement-breakpoint
CREATE TABLE "git_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "git_provider" NOT NULL,
	"provider_user_id" varchar(120) NOT NULL,
	"username" varchar(255) NOT NULL,
	"avatar_url" varchar(2048),
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" "git_provider" NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"full_name" varchar(500) NOT NULL,
	"web_url" varchar(2048) NOT NULL,
	"default_branch" varchar(255) NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"webhook_secret_encrypted" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_git_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"provider" "git_provider" NOT NULL,
	"type" "git_link_type" NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"label" varchar(500) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status" varchar(80),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "git_connections" ADD CONSTRAINT "git_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_connection_id_git_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_git_links" ADD CONSTRAINT "task_git_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_git_links" ADD CONSTRAINT "task_git_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_git_links" ADD CONSTRAINT "task_git_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "git_connections_user_provider_unique" ON "git_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "project_repositories_project_unique" ON "project_repositories" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_repositories_workspace_project_unique" ON "project_repositories" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_repositories_connection_idx" ON "project_repositories" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_git_links_unique" ON "task_git_links" USING btree ("task_id","provider","type","external_id");--> statement-breakpoint
CREATE INDEX "task_git_links_task_created_idx" ON "task_git_links" USING btree ("task_id","created_at");