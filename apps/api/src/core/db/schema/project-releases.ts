import { check, date, foreignKey, index, pgEnum, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projectReleaseStatusEnum = pgEnum("project_release_status", ["planned", "in_progress", "released", "cancelled"]);
export const projectReleases = pgTable("project_releases", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }), projectId: uuid("project_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(), description: text("description"), status: projectReleaseStatusEnum("status").notNull().default("planned"), startDate: date("start_date"), releaseDate: date("release_date"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }), ...timestampColumns(),
}, (table) => [foreignKey({ columns: [table.workspaceId, table.projectId], foreignColumns: [projects.workspaceId, projects.id], name: "project_releases_project_fk" }).onDelete("cascade"), index("project_releases_project_date_idx").on(table.workspaceId, table.projectId, table.releaseDate), check("project_releases_dates_valid_check", sql`${table.startDate} is null or ${table.releaseDate} is null or ${table.startDate} <= ${table.releaseDate}`)]);
