import { index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const projectFigmaLinks = pgTable(
  "project_figma_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    url: text("url").notNull(),
    ...timestampColumns(),
  },
  (table) => [
    index("project_figma_links_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("project_figma_links_workspace_idx").on(table.workspaceId),
  ],
);
