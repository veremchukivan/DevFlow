import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { softDeleteColumn, timestampColumns } from "./_common.js";
import { projectStatuses } from "./project-statuses.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent"
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    number: integer("number").notNull(),
    statusId: uuid("status_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestampColumns(),
    ...softDeleteColumn()
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "tasks_project_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.statusId],
      foreignColumns: [
        projectStatuses.workspaceId,
        projectStatuses.projectId,
        projectStatuses.id
      ],
      name: "tasks_project_status_fk"
    }).onDelete("restrict"),
    uniqueIndex("tasks_project_number_unique").on(
      table.workspaceId,
      table.projectId,
      table.number
    ),
    index("tasks_project_status_idx").on(
      table.workspaceId,
      table.projectId,
      table.statusId
    ),
    index("tasks_project_deleted_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.deletedAt
    ),
    index("tasks_assignee_user_id_idx").on(table.assigneeUserId),
    index("tasks_reporter_user_id_idx").on(table.reporterUserId),
    check("tasks_number_positive_check", sql`${table.number} > 0`)
  ]
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
