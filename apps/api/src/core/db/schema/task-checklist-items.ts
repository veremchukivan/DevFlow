import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { workspaces } from "./workspaces.js";

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    content: varchar("content", { length: 500 }).notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    position: integer("position").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_checklist_items_task_fk",
    }).onDelete("cascade"),
    index("task_checklist_items_task_position_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.position,
    ),
    check(
      "task_checklist_items_content_not_empty_check",
      sql`length(trim(${table.content})) > 0`,
    ),
    check(
      "task_checklist_items_position_positive_check",
      sql`${table.position} > 0`,
    ),
  ],
);

export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type NewTaskChecklistItem = typeof taskChecklistItems.$inferInsert;
