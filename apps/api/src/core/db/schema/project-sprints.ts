import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projectSprintStatusEnum = pgEnum("project_sprint_status", [
  "planning",
  "active",
  "completed",
]);

export const projectSprints = pgTable(
  "project_sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    goal: text("goal"),
    status: projectSprintStatusEnum("status").notNull().default("planning"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "project_sprints_project_fk",
    }).onDelete("cascade"),
    index("project_sprints_project_status_created_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex("project_sprints_workspace_project_id_unique").on(
      table.workspaceId,
      table.projectId,
      table.id,
    ),
    uniqueIndex("project_sprints_one_active_per_project")
      .on(table.workspaceId, table.projectId)
      .where(sql`${table.status} = 'active'`),
    check(
      "project_sprints_dates_valid_check",
      sql`${table.startDate} is null or ${table.endDate} is null or ${table.startDate} <= ${table.endDate}`,
    ),
  ],
);

export type ProjectSprint = typeof projectSprints.$inferSelect;
export type NewProjectSprint = typeof projectSprints.$inferInsert;
