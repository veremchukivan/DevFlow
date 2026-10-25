import {
  foreignKey,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    ...timestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.taskId],
      foreignColumns: [tasks.workspaceId, tasks.projectId, tasks.id],
      name: "task_attachments_task_fk",
    }).onDelete("cascade"),
    index("task_attachments_task_created_at_idx").on(
      table.workspaceId,
      table.projectId,
      table.taskId,
      table.createdAt,
    ),
    index("task_attachments_uploaded_by_user_id_idx").on(
      table.uploadedByUserId,
    ),
  ],
);
