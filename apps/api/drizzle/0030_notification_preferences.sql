CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"task_assigned" boolean DEFAULT true NOT NULL,
	"task_commented" boolean DEFAULT true NOT NULL,
	"task_due_today" boolean DEFAULT true NOT NULL,
	"task_overdue" boolean DEFAULT true NOT NULL,
	"task_status_changed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
