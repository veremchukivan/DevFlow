import { timestamp } from "drizzle-orm/pg-core";

export function createdAtColumn() {
  return timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
}

export function updatedAtColumn() {
  return timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
}

export function timestampColumns() {
  return {
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  };
}

export function softDeleteColumn() {
  return {
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  };
}
