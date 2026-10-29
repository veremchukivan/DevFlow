CREATE TABLE "workspace_automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"rule_type" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"rule_id" uuid NOT NULL REFERENCES "workspace_automation_rules"("id") ON DELETE cascade,
	"trigger_task_id" uuid,
	"actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"outcome" varchar(24) NOT NULL,
	"summary" varchar(500) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_automation_rules_workspace_type_unique" ON "workspace_automation_rules" USING btree ("workspace_id","rule_type");
--> statement-breakpoint
CREATE INDEX "workspace_automation_rules_workspace_enabled_idx" ON "workspace_automation_rules" USING btree ("workspace_id","enabled");
--> statement-breakpoint
CREATE INDEX "workspace_automation_runs_workspace_created_idx" ON "workspace_automation_runs" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX "workspace_automation_runs_rule_created_idx" ON "workspace_automation_runs" USING btree ("rule_id","created_at");
