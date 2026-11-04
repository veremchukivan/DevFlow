ALTER TABLE "workspace_automation_rules"
  ADD COLUMN "name" varchar(160),
  ADD COLUMN "trigger_type" varchar(48) NOT NULL DEFAULT 'task_status_changed',
  ADD COLUMN "conditions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "actions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "last_error" varchar(500);
--> statement-breakpoint
UPDATE "workspace_automation_rules"
SET "name" = CASE "rule_type"
  WHEN 'children_completed_close_parent' THEN 'Close parent when all child work items are complete'
  WHEN 'task_transition_assign' THEN 'Automatically assign on transition'
  WHEN 'parent_completed_close_children' THEN 'Close child work items when the parent is complete'
  ELSE "rule_type"
END
WHERE "name" IS NULL;
--> statement-breakpoint
ALTER TABLE "workspace_automation_rules" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "workspace_automation_rules_workspace_trigger_enabled_idx"
  ON "workspace_automation_rules" ("workspace_id", "trigger_type", "enabled");
