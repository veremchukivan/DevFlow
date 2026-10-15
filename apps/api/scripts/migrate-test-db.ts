import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const defaultTestMigrationDatabaseUrl =
  "postgres://devflow_migrator:devflow_migrator@localhost:5432/devflow_test";
const databaseUrl =
  process.env.TEST_MIGRATION_DATABASE_URL ?? defaultTestMigrationDatabaseUrl;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../drizzle");
const client = postgres(databaseUrl, { max: 1 });

try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log("Test database migrations applied successfully");
} finally {
  await client.end({ timeout: 5 });
}
