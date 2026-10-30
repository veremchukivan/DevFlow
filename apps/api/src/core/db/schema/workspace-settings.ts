import { index, jsonb, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceSettings = pgTable(
  "workspace_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    defaultAssigneeUserId: uuid("default_assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    enabledTaskTypes: jsonb("enabled_task_types").$type<string[]>().notNull().default(["task", "bug", "feature", "story"]),
    customFields: jsonb("custom_fields").$type<Array<{ id: string; name: string; options?: string[]; type: "number" | "select" | "text" }>>().notNull().default([]),
    features: jsonb("features").$type<Record<string, boolean>>().notNull().default({ automation: true, attachments: true, sprints: true }),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("workspace_settings_workspace_unique").on(table.workspaceId)],
);

export const workspaceSavedFilters = pgTable(
  "workspace_saved_filters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
    ...timestampColumns(),
  },
  (table) => [index("workspace_saved_filters_workspace_user_idx").on(table.workspaceId, table.userId)],
);
