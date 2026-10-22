CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_labels" (
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_fk" FOREIGN KEY ("workspace_id","label_id") REFERENCES "public"."labels"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_fk" FOREIGN KEY ("workspace_id","project_id","task_id") REFERENCES "public"."tasks"("workspace_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_workspace_name_unique" ON "labels" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "labels_workspace_idx" ON "labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_labels_task_label_unique" ON "task_labels" USING btree ("task_id","label_id");--> statement-breakpoint
CREATE INDEX "task_labels_task_idx" ON "task_labels" USING btree ("workspace_id","project_id","task_id");