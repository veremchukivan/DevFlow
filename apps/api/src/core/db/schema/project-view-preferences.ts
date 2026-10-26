import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projectViewPreferences = pgTable(
  "project_view_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityLimit: integer("activity_limit").notNull().default(1),
    boardScrolling: varchar("board_scrolling", { length: 16 })
      .notNull()
      .default("board"),
    columnSize: varchar("column_size", { length: 16 })
      .notNull()
      .default("flexible"),
    columnWidths: jsonb("column_widths").notNull().default({}),
    hideDoneTasks: boolean("hide_done_tasks").notNull().default(false),
    taskCardAccent: varchar("task_card_accent", { length: 16 })
      .notNull()
      .default("status"),
    taskCardColor: varchar("task_card_color", { length: 16 })
      .notNull()
      .default("neutral"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibleTaskFields: jsonb("visible_task_fields").notNull().default([]),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("project_view_preferences_user_project_unique").on(
      table.userId,
      table.projectId,
    ),
    index("project_view_preferences_workspace_project_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    check(
      "project_view_preferences_activity_limit_check",
      sql`${table.activityLimit} between 1 and 25`,
    ),
    check(
      "project_view_preferences_column_size_check",
      sql`${table.columnSize} in ('fixed', 'flexible')`,
    ),
    check(
      "project_view_preferences_scrolling_check",
      sql`${table.boardScrolling} in ('board', 'column')`,
    ),
    check(
      "project_view_preferences_task_card_accent_check",
      sql`${table.taskCardAccent} in ('none', 'status', 'priority')`,
    ),
    check(
      "project_view_preferences_task_card_color_check",
      sql`${table.taskCardColor} in ('neutral', 'blue', 'violet', 'sand')`,
    ),
  ],
);
