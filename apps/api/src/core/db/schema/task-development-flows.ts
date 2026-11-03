import {
  boolean,
  index,
  jsonb,
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
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const developmentFlowStateEnum = pgEnum("development_flow_state", [
  "idea",
  "planning",
  "approval",
  "ready",
  "in_progress",
  "review",
  "done",
]);

export const developmentFlowCiStatusEnum = pgEnum("development_flow_ci_status", [
  "not_configured",
  "pending",
  "passing",
  "failing",
]);

export const developmentFlowSessionStatusEnum = pgEnum(
  "development_flow_session_status",
  ["active", "paused", "completed", "failed"],
);

export const taskDevelopmentFlows = pgTable(
  "task_development_flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    state: developmentFlowStateEnum("state").notNull().default("idea"),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .$type<string[]>()
      .notNull()
      .default([]),
    implementationPlan: text("implementation_plan"),
    testInstructions: text("test_instructions"),
    summary: text("summary"),
    branchName: varchar("branch_name", { length: 255 }),
    pullRequestUrl: varchar("pull_request_url", { length: 2048 }),
    ciStatus: developmentFlowCiStatusEnum("ci_status")
      .notNull()
      .default("not_configured"),
    planApprovedAt: timestamp("plan_approved_at", { withTimezone: true }),
    planApprovedByUserId: uuid("plan_approved_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewApprovedAt: timestamp("review_approved_at", { withTimezone: true }),
    reviewApprovedByUserId: uuid("review_approved_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    isEnabled: boolean("is_enabled").notNull().default(true),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("task_development_flows_task_unique").on(table.taskId),
    uniqueIndex("task_development_flows_workspace_project_task_unique").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
    ),
    index("task_development_flows_project_state_idx").on(
      table.workspaceId,
      table.projectId,
      table.state,
    ),
  ],
);

export const taskDevelopmentFlowSessions = pgTable(
  "task_development_flow_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    developmentFlowId: uuid("development_flow_id")
      .notNull()
      .references(() => taskDevelopmentFlows.id, { onDelete: "cascade" }),
    startedByUserId: uuid("started_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    client: varchar("client", { length: 80 }).notNull(),
    agentName: varchar("agent_name", { length: 120 }),
    status: developmentFlowSessionStatusEnum("status")
      .notNull()
      .default("active"),
    summary: text("summary"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [
    index("task_development_flow_sessions_flow_started_idx").on(
      table.developmentFlowId,
      table.startedAt,
    ),
  ],
);

export type TaskDevelopmentFlow = typeof taskDevelopmentFlows.$inferSelect;
export type NewTaskDevelopmentFlow = typeof taskDevelopmentFlows.$inferInsert;
