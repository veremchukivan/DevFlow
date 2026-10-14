import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { softDeleteColumn, timestampColumns } from "./_common.js";
import { users } from "./users.js";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ...timestampColumns(),
    ...softDeleteColumn()
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique")
      .on(table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    index("workspaces_owner_user_id_idx").on(table.ownerUserId),
    index("workspaces_deleted_at_idx").on(table.deletedAt),
    check(
      "workspaces_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'`
    )
  ]
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
