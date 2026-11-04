ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'agreement_overdue';
--> statement-breakpoint
ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "agreement_overdue" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "agreement_id" uuid REFERENCES "workspace_agreements"("id") ON DELETE CASCADE;
