import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { softDeleteColumn, timestampColumns } from "./_common.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 12 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestampColumns(),
    ...softDeleteColumn()
  },
  (table) => [
    uniqueIndex("projects_workspace_id_id_unique").on(
      table.workspaceId,
      table.id
    ),
    uniqueIndex("projects_workspace_key_unique").on(
      table.workspaceId,
      table.key
    ),
    index("projects_workspace_deleted_at_idx").on(
      table.workspaceId,
      table.deletedAt
    ),
    index("projects_owner_user_id_idx").on(table.ownerUserId),
    check("projects_key_format_check", sql`${table.key} ~ '^[A-Z][A-Z0-9]{1,11}$'`)
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
