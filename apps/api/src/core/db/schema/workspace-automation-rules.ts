import { index, jsonb, pgTable, uniqueIndex, uuid, varchar, boolean } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceAutomationRules = pgTable(
  "workspace_automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ruleType: varchar("rule_type", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("workspace_automation_rules_workspace_type_unique").on(table.workspaceId, table.ruleType),
    index("workspace_automation_rules_workspace_enabled_idx").on(table.workspaceId, table.enabled),
  ],
);

export const workspaceAutomationRuns = pgTable(
  "workspace_automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull().references(() => workspaceAutomationRules.id, { onDelete: "cascade" }),
    triggerTaskId: uuid("trigger_task_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    outcome: varchar("outcome", { length: 24 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestampColumns().createdAt,
  },
  (table) => [
    index("workspace_automation_runs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("workspace_automation_runs_rule_created_idx").on(table.ruleId, table.createdAt),
  ],
);
