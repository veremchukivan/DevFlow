import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskRelationTypeEnum = pgEnum("task_relation_type", [
  "blocks",
  "relates_to",
  "duplicates",
]);

export const taskRelations = pgTable(
  "task_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceProjectId: uuid("source_project_id").notNull(),
    sourceTaskId: uuid("source_task_id").notNull(),
    targetProjectId: uuid("target_project_id").notNull(),
    targetTaskId: uuid("target_task_id").notNull(),
    relationType: taskRelationTypeEnum("relation_type").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.sourceProjectId, table.sourceTaskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_relations_source_task_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.targetProjectId, table.targetTaskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_relations_target_task_fk",
    }).onDelete("cascade"),
    check(
      "task_relations_distinct_tasks_check",
      sql`${table.sourceTaskId} <> ${table.targetTaskId}`,
    ),
    uniqueIndex("task_relations_unique_edge").on(
      table.workspaceId,
      table.sourceTaskId,
      table.targetTaskId,
      table.relationType,
    ),
    index("task_relations_source_task_idx").on(
      table.workspaceId,
      table.sourceTaskId,
    ),
    index("task_relations_target_task_idx").on(
      table.workspaceId,
      table.targetTaskId,
    ),
  ],
);
