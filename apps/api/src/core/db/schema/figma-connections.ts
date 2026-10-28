import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { users } from "./users.js";

export const figmaConnections = pgTable(
  "figma_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    figmaUserId: varchar("figma_user_id", { length: 80 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("figma_connections_user_unique").on(table.userId)],
);
