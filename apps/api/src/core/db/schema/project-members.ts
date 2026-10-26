import { index, pgEnum, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "lead",
  "member",
  "viewer",
]);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull().default("member"),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.userId],
      name: "project_members_pk",
    }),
    index("project_members_workspace_project_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    index("project_members_user_id_idx").on(table.userId),
  ],
);
