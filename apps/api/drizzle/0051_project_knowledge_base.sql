CREATE TYPE "public"."knowledge_kind" AS ENUM('adr', 'pattern', 'runbook', 'guideline', 'note');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('draft', 'accepted', 'superseded', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."knowledge_link_kind" AS ENUM('task', 'pull_request', 'figma', 'release', 'external');--> statement-breakpoint
CREATE TABLE "project_knowledge_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "kind" "knowledge_kind" DEFAULT 'note' NOT NULL,
  "status" "knowledge_status" DEFAULT 'draft' NOT NULL,
  "title" varchar(240) NOT NULL,
  "summary" varchar(600),
  "content" text DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "project_knowledge_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "knowledge_entry_id" uuid NOT NULL,
  "kind" "knowledge_link_kind" NOT NULL,
  "label" varchar(240) NOT NULL,
  "url" varchar(2048) NOT NULL,
  "external_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_knowledge_entries" ADD CONSTRAINT "project_knowledge_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_entries" ADD CONSTRAINT "project_knowledge_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_entries" ADD CONSTRAINT "project_knowledge_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_entries" ADD CONSTRAINT "project_knowledge_entries_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_links" ADD CONSTRAINT "project_knowledge_links_knowledge_entry_id_project_knowledge_entries_id_fk" FOREIGN KEY ("knowledge_entry_id") REFERENCES "public"."project_knowledge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_knowledge_entries_project_updated_idx" ON "project_knowledge_entries" USING btree ("workspace_id","project_id","updated_at");--> statement-breakpoint
CREATE INDEX "project_knowledge_entries_project_status_idx" ON "project_knowledge_entries" USING btree ("workspace_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_knowledge_links_entry_url_unique" ON "project_knowledge_links" USING btree ("knowledge_entry_id","url");--> statement-breakpoint
CREATE INDEX "project_knowledge_links_entry_idx" ON "project_knowledge_links" USING btree ("knowledge_entry_id","created_at");
