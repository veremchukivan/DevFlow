ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'workspace_invited';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "task_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "task_title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "invitation_id" uuid;
