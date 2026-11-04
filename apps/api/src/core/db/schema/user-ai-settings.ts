import { pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestampColumns } from "./_common.js";
import { users } from "./users.js";

export const userAiSettings = pgTable(
  "user_ai_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 160 }),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("user_ai_settings_user_unique").on(table.userId)],
);
