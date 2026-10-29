import { foreignKey, index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskWatchers = pgTable(
  "task_watchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_watchers_task_fk",
    }).onDelete("cascade"),
    uniqueIndex("task_watchers_task_user_unique").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.userId,
    ),
    index("task_watchers_user_idx").on(table.workspaceId, table.userId),
  ],
);

export type TaskWatcher = typeof taskWatchers.$inferSelect;
