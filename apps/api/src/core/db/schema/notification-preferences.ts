import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  taskAssigned: boolean("task_assigned").notNull().default(true),
  taskCommented: boolean("task_commented").notNull().default(true),
  taskDueToday: boolean("task_due_today").notNull().default(true),
  taskOverdue: boolean("task_overdue").notNull().default(true),
  taskStatusChanged: boolean("task_status_changed").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
