ALTER TABLE "workspace_calls"
  ADD COLUMN "recurrence_rule" varchar(120),
  ADD COLUMN "reminder_minutes" integer;
--> statement-breakpoint
CREATE TABLE "workspace_call_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "call_id" uuid NOT NULL REFERENCES "workspace_calls"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "promoted_task_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "workspace_call_decisions_call_created_idx" ON "workspace_call_decisions" ("workspace_id", "call_id", "created_at");
