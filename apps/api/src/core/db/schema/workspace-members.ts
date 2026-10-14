import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer"
]);

export const workspaceMemberStatusEnum = pgEnum("workspace_member_status", [
  "active",
  "invited",
  "suspended"
]);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    status: workspaceMemberStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestampColumns()
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
      name: "workspace_members_pk"
    }),
    index("workspace_members_user_id_idx").on(table.userId),
    index("workspace_members_workspace_role_idx").on(
      table.workspaceId,
      table.role
    )
  ]
);

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
