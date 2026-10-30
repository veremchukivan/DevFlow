ALTER TABLE "tasks" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;
