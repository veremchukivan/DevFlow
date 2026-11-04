ALTER TYPE "public"."notification_type" ADD VALUE 'task_due_today' BEFORE 'task_status_changed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'task_overdue' BEFORE 'task_status_changed';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" varchar(160);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_dedupe_key_unique" ON "notifications" USING btree ("recipient_user_id","dedupe_key");