ALTER TABLE "workspace_automation_runs"
  ADD COLUMN "dedupe_key" varchar(200);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_automation_runs_rule_dedupe_unique"
  ON "workspace_automation_runs" ("rule_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
