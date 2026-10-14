import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDbConnection, db } from "./client.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../../../drizzle");

try {
  await migrate(db, { migrationsFolder });
  console.info("Database migrations applied successfully");
} finally {
  await closeDbConnection();
}
