CREATE TYPE "workspace_agreement_status" AS ENUM ('draft', 'pending_confirmation', 'accepted', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "workspace_agreement_source" AS ENUM ('manual', 'call', 'task');
--> statement-breakpoint
CREATE TYPE "workspace_agreement_confirmation" AS ENUM ('pending', 'confirmed', 'declined');
--> statement-breakpoint
CREATE TABLE "workspace_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "description" text,
  "status" "workspace_agreement_status" DEFAULT 'draft' NOT NULL,
  "source_type" "workspace_agreement_source" DEFAULT 'manual' NOT NULL,
  "source_id" uuid,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_date" date,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_agreement_participants" (
  "agreement_id" uuid NOT NULL REFERENCES "workspace_agreements"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "confirmation" "workspace_agreement_confirmation" DEFAULT 'pending' NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_agreement_participants_pk" PRIMARY KEY ("agreement_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_agreement_tasks" (
  "agreement_id" uuid NOT NULL REFERENCES "workspace_agreements"("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_agreement_tasks_pk" PRIMARY KEY ("agreement_id", "task_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_agreement_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agreement_id" uuid NOT NULL REFERENCES "workspace_agreements"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" varchar(80) NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "workspace_agreements_workspace_status_due_idx" ON "workspace_agreements" ("workspace_id", "status", "due_date");
--> statement-breakpoint
CREATE INDEX "workspace_agreements_workspace_owner_idx" ON "workspace_agreements" ("workspace_id", "owner_user_id");
--> statement-breakpoint
CREATE INDEX "workspace_agreement_history_agreement_created_idx" ON "workspace_agreement_history" ("workspace_id", "agreement_id", "created_at");
