import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskTimeEntries = pgTable(
  "task_time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    description: varchar("description", { length: 1000 }),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_time_entries_task_fk",
    }).onDelete("cascade"),
    index("task_time_entries_task_started_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.startedAt,
    ),
    index("task_time_entries_user_started_idx").on(
      table.workspaceId,
      table.userId,
      table.startedAt,
    ),
    uniqueIndex("task_time_entries_one_active_timer_per_user").on(
      table.workspaceId,
      table.userId,
    ).where(sql`${table.stoppedAt} is null`),
    check(
      "task_time_entries_duration_nonnegative_check",
      sql`${table.durationMinutes} >= 0`,
    ),
    check(
      "task_time_entries_stop_after_start_check",
      sql`${table.stoppedAt} is null or ${table.stoppedAt} >= ${table.startedAt}`,
    ),
  ],
);

export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type NewTaskTimeEntry = typeof taskTimeEntries.$inferInsert;
