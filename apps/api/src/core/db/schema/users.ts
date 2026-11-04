import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import { softDeleteColumn, timestampColumns } from "./_common.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    pendingEmail: varchar("pending_email", { length: 320 }),
    pendingEmailNormalized: varchar("pending_email_normalized", {
      length: 320
    }),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    ...timestampColumns(),
    ...softDeleteColumn()
  },
  (table) => [
    uniqueIndex("users_email_normalized_unique")
      .on(table.emailNormalized)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("users_pending_email_normalized_unique")
      .on(table.pendingEmailNormalized)
      .where(
        sql`${table.pendingEmailNormalized} IS NOT NULL AND ${table.deletedAt} IS NULL`
      ),
    index("users_deleted_at_idx").on(table.deletedAt),
    check(
      "users_email_normalized_lowercase_check",
      sql`${table.emailNormalized} = lower(${table.emailNormalized})`
    )
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
