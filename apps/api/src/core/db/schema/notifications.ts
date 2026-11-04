import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { projects } from "./projects.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaceAgreements } from "./workspace-agreements.js";
import { workspaces } from "./workspaces.js";

export const notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned",
  "task_commented",
  "task_due_today",
  "task_overdue",
  "task_status_changed",
  "workspace_invited",
  "agreement_overdue",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    agreementId: uuid("agreement_id").references(() => workspaceAgreements.id, {
      onDelete: "cascade",
    }),
    type: notificationTypeEnum("type").notNull(),
    invitationId: uuid("invitation_id"),
    taskKey: varchar("task_key", { length: 64 }),
    taskTitle: varchar("task_title", { length: 200 }),
    dedupeKey: varchar("dedupe_key", { length: 160 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("notifications_recipient_created_at_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    index("notifications_recipient_read_at_idx").on(
      table.recipientUserId,
      table.readAt,
    ),
    uniqueIndex("notifications_recipient_dedupe_key_unique").on(
      table.recipientUserId,
      table.dedupeKey,
    ),
  ],
);
