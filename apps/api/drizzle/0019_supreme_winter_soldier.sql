CREATE TYPE "public"."task_relation_type" AS ENUM('blocks', 'relates_to', 'duplicates');--> statement-breakpoint
CREATE TABLE "task_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_project_id" uuid NOT NULL,
	"source_task_id" uuid NOT NULL,
	"target_project_id" uuid NOT NULL,
	"target_task_id" uuid NOT NULL,
	"relation_type" "task_relation_type" NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_relations_distinct_tasks_check" CHECK ("task_relations"."source_task_id" <> "task_relations"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_source_task_fk" FOREIGN KEY ("workspace_id","source_project_id","source_task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_target_task_fk" FOREIGN KEY ("workspace_id","target_project_id","target_task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_relations_unique_edge" ON "task_relations" USING btree ("workspace_id","source_task_id","target_task_id","relation_type");--> statement-breakpoint
CREATE INDEX "task_relations_source_task_idx" ON "task_relations" USING btree ("workspace_id","source_task_id");--> statement-breakpoint
CREATE INDEX "task_relations_target_task_idx" ON "task_relations" USING btree ("workspace_id","target_task_id");