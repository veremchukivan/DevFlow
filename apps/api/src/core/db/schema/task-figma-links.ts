import { foreignKey, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskFigmaLinks = pgTable(
  "task_figma_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    url: text("url").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_figma_links_task_fk",
    }).onDelete("cascade"),
    index("task_figma_links_task_created_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.createdAt,
    ),
  ],
);
