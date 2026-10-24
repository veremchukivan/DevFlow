import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  uuid
} from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskActivityEventTypeEnum = pgEnum("task_activity_event_type", [
  "task_created",
  "task_updated",
  "task_deleted",
  "task_restored",
  "task_comment_created",
  "task_comment_updated",
  "task_comment_deleted"
]);

export const taskActivityEvents = pgTable(
  "task_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    eventType: taskActivityEventTypeEnum("event_type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_activity_events_task_fk"
    }).onDelete("cascade"),
    index("task_activity_events_task_created_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.createdAt
    ),
    index("task_activity_events_actor_user_id_idx").on(table.actorUserId)
  ]
);

export type TaskActivityEvent = typeof taskActivityEvents.$inferSelect;
export type NewTaskActivityEvent = typeof taskActivityEvents.$inferInsert;
