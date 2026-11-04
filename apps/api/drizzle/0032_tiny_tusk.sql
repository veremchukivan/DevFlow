ALTER TYPE "public"."auth_token_type" ADD VALUE 'email_change' BEFORE 'password_reset';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email_normalized" varchar(320);--> statement-breakpoint
CREATE UNIQUE INDEX "users_pending_email_normalized_unique" ON "users" USING btree ("pending_email_normalized") WHERE "users"."pending_email_normalized" IS NOT NULL AND "users"."deleted_at" IS NULL;
