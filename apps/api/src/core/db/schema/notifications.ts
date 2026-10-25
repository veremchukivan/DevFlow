import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { projects } from "./projects.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned",
  "task_commented",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    taskKey: varchar("task_key", { length: 64 }).notNull(),
    taskTitle: varchar("task_title", { length: 200 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("notifications_recipient_created_at_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    index("notifications_recipient_read_at_idx").on(
      table.recipientUserId,
      table.readAt,
    ),
  ],
);
