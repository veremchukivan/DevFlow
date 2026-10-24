ALTER TABLE "task_checklist_items" DROP CONSTRAINT "task_checklist_items_completed_boolean_check";--> statement-breakpoint
ALTER TABLE "task_checklist_items" ALTER COLUMN "is_completed" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ALTER COLUMN "is_completed" SET DATA TYPE boolean USING "is_completed" = 1;--> statement-breakpoint
ALTER TABLE "task_checklist_items" ALTER COLUMN "is_completed" SET DEFAULT false;
