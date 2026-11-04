CREATE TYPE "public"."development_flow_ci_status" AS ENUM('not_configured', 'pending', 'passing', 'failing');--> statement-breakpoint
CREATE TYPE "public"."development_flow_session_status" AS ENUM('active', 'paused', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."development_flow_state" AS ENUM('idea', 'planning', 'approval', 'ready', 'in_progress', 'review', 'done');--> statement-breakpoint
CREATE TABLE "task_development_flow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"development_flow_id" uuid NOT NULL,
	"started_by_user_id" uuid NOT NULL,
	"client" varchar(80) NOT NULL,
	"agent_name" varchar(120),
	"status" "development_flow_session_status" DEFAULT 'active' NOT NULL,
	"summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_development_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"state" "development_flow_state" DEFAULT 'idea' NOT NULL,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"implementation_plan" text,
	"test_instructions" text,
	"summary" text,
	"branch_name" varchar(255),
	"pull_request_url" varchar(2048),
	"ci_status" "development_flow_ci_status" DEFAULT 'not_configured' NOT NULL,
	"plan_approved_at" timestamp with time zone,
	"plan_approved_by_user_id" uuid,
	"review_approved_at" timestamp with time zone,
	"review_approved_by_user_id" uuid,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_development_flow_sessions" ADD CONSTRAINT "task_development_flow_sessions_development_flow_id_task_development_flows_id_fk" FOREIGN KEY ("development_flow_id") REFERENCES "public"."task_development_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_development_flow_sessions" ADD CONSTRAINT "task_development_flow_sessions_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_development_flows" ADD CONSTRAINT "task_development_flows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_development_flows" ADD CONSTRAINT "task_development_flows_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_development_flows" ADD CONSTRAINT "task_development_flows_plan_approved_by_user_id_users_id_fk" FOREIGN KEY ("plan_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_development_flows" ADD CONSTRAINT "task_development_flows_review_approved_by_user_id_users_id_fk" FOREIGN KEY ("review_approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_development_flow_sessions_flow_started_idx" ON "task_development_flow_sessions" USING btree ("development_flow_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_development_flows_task_unique" ON "task_development_flows" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_development_flows_workspace_project_task_unique" ON "task_development_flows" USING btree ("workspace_id","project_id","task_id");--> statement-breakpoint
CREATE INDEX "task_development_flows_project_state_idx" ON "task_development_flows" USING btree ("workspace_id","project_id","state");