import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  uuid
} from "drizzle-orm/pg-core";

import { softDeleteColumn, timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    body: text("body").notNull(),
    ...timestampColumns(),
    ...softDeleteColumn()
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_comments_task_fk"
    }).onDelete("cascade"),
    index("task_comments_task_created_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.createdAt
    ),
    index("task_comments_task_deleted_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.deletedAt
    ),
    index("task_comments_author_user_id_idx").on(table.authorUserId),
    check(
      "task_comments_body_not_empty_check",
      sql`length(trim(${table.body})) > 0`
    )
  ]
);

export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;
