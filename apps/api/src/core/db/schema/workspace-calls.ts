import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceCallStatusEnum = pgEnum("workspace_call_status", [
  "scheduled",
  "completed",
  "cancelled",
]);

export const workspaceCallAttendeeStatusEnum = pgEnum(
  "workspace_call_attendee_status",
  ["invited", "accepted", "declined"],
);

export const workspaceCalls = pgTable(
  "workspace_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
    location: varchar("location", { length: 300 }),
    meetingUrl: varchar("meeting_url", { length: 2048 }),
    status: workspaceCallStatusEnum("status").notNull().default("scheduled"),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "workspace_calls_project_fk",
    }).onDelete("restrict"),
    index("workspace_calls_workspace_starts_at_idx").on(
      table.workspaceId,
      table.startsAt,
    ),
    index("workspace_calls_workspace_project_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    check(
      "workspace_calls_dates_valid_check",
      sql`${table.startsAt} < ${table.endsAt}`,
    ),
  ],
);

export const workspaceCallAttendees = pgTable(
  "workspace_call_attendees",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => workspaceCalls.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    responseStatus: workspaceCallAttendeeStatusEnum("response_status")
      .notNull()
      .default("invited"),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.callId, table.userId],
      name: "workspace_call_attendees_pk",
    }),
    index("workspace_call_attendees_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export type WorkspaceCall = typeof workspaceCalls.$inferSelect;
export type NewWorkspaceCall = typeof workspaceCalls.$inferInsert;
