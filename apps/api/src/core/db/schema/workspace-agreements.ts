import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  date,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const workspaceAgreementStatusEnum = pgEnum(
  "workspace_agreement_status",
  [
    "draft",
    "pending_confirmation",
    "accepted",
    "in_progress",
    "completed",
    "cancelled",
  ],
);
export const workspaceAgreementSourceEnum = pgEnum(
  "workspace_agreement_source",
  ["manual", "call", "task"],
);
export const workspaceAgreementConfirmationEnum = pgEnum(
  "workspace_agreement_confirmation",
  ["pending", "confirmed", "declined"],
);

export const workspaceAgreements = pgTable(
  "workspace_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: workspaceAgreementStatusEnum("status").notNull().default("draft"),
    sourceType: workspaceAgreementSourceEnum("source_type")
      .notNull()
      .default("manual"),
    sourceId: uuid("source_id"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestampColumns(),
  },
  (table) => [
    index("workspace_agreements_workspace_status_due_idx").on(
      table.workspaceId,
      table.status,
      table.dueDate,
    ),
    index("workspace_agreements_workspace_owner_idx").on(
      table.workspaceId,
      table.ownerUserId,
    ),
  ],
);

export const workspaceAgreementParticipants = pgTable(
  "workspace_agreement_participants",
  {
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => workspaceAgreements.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    confirmation: workspaceAgreementConfirmationEnum("confirmation")
      .notNull()
      .default("pending"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.agreementId, table.userId],
      name: "workspace_agreement_participants_pk",
    }),
  ],
);

export const workspaceAgreementTasks = pgTable(
  "workspace_agreement_tasks",
  {
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => workspaceAgreements.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.agreementId, table.taskId],
      name: "workspace_agreement_tasks_pk",
    }),
  ],
);

export const workspaceAgreementHistory = pgTable(
  "workspace_agreement_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => workspaceAgreements.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_agreement_history_agreement_created_idx").on(
      table.workspaceId,
      table.agreementId,
      table.createdAt,
    ),
  ],
);
