import {
  foreignKey,
  index,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { tasks } from "./tasks.js";
import { workspaces } from "./workspaces.js";

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("labels_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
    uniqueIndex("labels_workspace_id_unique").on(table.workspaceId, table.id),
    index("labels_workspace_idx").on(table.workspaceId),
  ],
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id").notNull(),
    labelId: uuid("label_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    projectId: uuid("project_id").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("task_labels_task_label_unique").on(
      table.taskId,
      table.labelId,
    ),
    foreignKey({
      columns: [table.workspaceId, table.labelId],
      foreignColumns: [labels.workspaceId, labels.id],
      name: "task_labels_label_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_labels_task_fk",
    }).onDelete("cascade"),
    index("task_labels_task_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
    ),
  ],
);
