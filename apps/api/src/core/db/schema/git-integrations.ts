import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { projects } from "./projects.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const gitProviderEnum = pgEnum("git_provider", ["github", "gitlab"]);
export const gitLinkTypeEnum = pgEnum("git_link_type", ["branch", "commit", "pull_request", "pipeline", "deployment"]);

export const gitConnections = pgTable("git_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: gitProviderEnum("provider").notNull(),
  providerUserId: varchar("provider_user_id", { length: 120 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 2048 }),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  ...timestampColumns(),
}, (table) => [uniqueIndex("git_connections_user_provider_unique").on(table.userId, table.provider)]);

export const projectRepositories = pgTable("project_repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").notNull().references(() => gitConnections.id, { onDelete: "restrict" }),
  provider: gitProviderEnum("provider").notNull(),
  externalId: varchar("external_id", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 500 }).notNull(),
  webUrl: varchar("web_url", { length: 2048 }).notNull(),
  defaultBranch: varchar("default_branch", { length: 255 }).notNull(),
  isPrivate: boolean("is_private").notNull().default(true),
  webhookSecretEncrypted: text("webhook_secret_encrypted"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("project_repositories_project_unique").on(table.projectId),
  uniqueIndex("project_repositories_workspace_project_unique").on(table.workspaceId, table.projectId),
  index("project_repositories_connection_idx").on(table.connectionId),
]);

export const taskGitLinks = pgTable("task_git_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  provider: gitProviderEnum("provider").notNull(),
  type: gitLinkTypeEnum("type").notNull(),
  externalId: varchar("external_id", { length: 255 }).notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  status: varchar("status", { length: 80 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("task_git_links_unique").on(table.taskId, table.provider, table.type, table.externalId),
  index("task_git_links_task_created_idx").on(table.taskId, table.createdAt),
]);
