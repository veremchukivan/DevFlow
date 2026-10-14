import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { workspaces } from "./workspaces.js";

export const projectStatusCategoryEnum = pgEnum("project_status_category", [
  "todo",
  "in_progress",
  "done"
]);

export const projectStatuses = pgTable(
  "project_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    category: projectStatusCategoryEnum("category").notNull(),
    color: varchar("color", { length: 32 }).notNull(),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestampColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "project_statuses_project_fk"
    }).onDelete("cascade"),
    uniqueIndex("project_statuses_project_name_unique").on(
      table.workspaceId,
      table.projectId,
      table.name
    ),
    index("project_statuses_project_position_idx").on(
      table.workspaceId,
      table.projectId,
      table.position
    ),
    check("project_statuses_position_positive_check", sql`${table.position} > 0`)
  ]
);

export type ProjectStatus = typeof projectStatuses.$inferSelect;
export type NewProjectStatus = typeof projectStatuses.$inferInsert;
