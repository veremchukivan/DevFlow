import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { createdAtColumn } from "./_common.js";
import { users } from "./users.js";

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: varchar("token_prefix", { length: 20 }).notNull(),
    scopes: text("scopes").array().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    index("api_tokens_active_hash_idx").on(table.tokenHash),
  ],
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
