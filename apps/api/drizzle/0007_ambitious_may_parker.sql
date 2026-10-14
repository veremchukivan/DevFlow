DROP INDEX "projects_workspace_key_unique";--> statement-breakpoint
DROP INDEX "users_email_normalized_unique";--> statement-breakpoint
DROP INDEX "workspaces_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_key_unique" ON "projects" USING btree ("workspace_id","key") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users" USING btree ("email_normalized") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" USING btree ("slug") WHERE "workspaces"."deleted_at" IS NULL;