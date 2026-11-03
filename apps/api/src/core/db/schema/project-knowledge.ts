import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const knowledgeKindEnum = pgEnum("knowledge_kind", ["adr", "pattern", "runbook", "guideline", "note"]);
export const knowledgeStatusEnum = pgEnum("knowledge_status", ["draft", "accepted", "superseded", "deprecated"]);
export const knowledgeLinkKindEnum = pgEnum("knowledge_link_kind", ["task", "pull_request", "figma", "release", "external"]);

export const projectKnowledgeEntries = pgTable("project_knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  kind: knowledgeKindEnum("kind").notNull().default("note"),
  status: knowledgeStatusEnum("status").notNull().default("draft"),
  title: varchar("title", { length: 240 }).notNull(),
  summary: varchar("summary", { length: 600 }),
  content: text("content").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  ...timestampColumns(),
}, (table) => [
  index("project_knowledge_entries_project_updated_idx").on(table.workspaceId, table.projectId, table.updatedAt),
  index("project_knowledge_entries_project_status_idx").on(table.workspaceId, table.projectId, table.status),
]);

export const projectKnowledgeLinks = pgTable("project_knowledge_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeEntryId: uuid("knowledge_entry_id").notNull().references(() => projectKnowledgeEntries.id, { onDelete: "cascade" }),
  kind: knowledgeLinkKindEnum("kind").notNull(),
  label: varchar("label", { length: 240 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  externalId: varchar("external_id", { length: 255 }),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("project_knowledge_links_entry_url_unique").on(table.knowledgeEntryId, table.url),
  index("project_knowledge_links_entry_idx").on(table.knowledgeEntryId, table.createdAt),
]);
