import dotenv from "dotenv";
import { resolve } from "node:path";

import postgres from "postgres";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const defaultTestDatabaseUrl =
  "postgres://devflow:devflow@localhost:5432/devflow_test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
const testMigrationDatabaseUrl =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  toDatabaseUrlForRole(testDatabaseUrl, "devflow_migrator");
const adminDatabaseUrl =
  process.env.DATABASE_ADMIN_URL ?? toAdminDatabaseUrl(testDatabaseUrl);

const databaseName = getDatabaseName(testDatabaseUrl);
const migrationRole = getDatabaseRole(testMigrationDatabaseUrl);
const runtimeRole = getDatabaseRole(testDatabaseUrl);

const sql = postgres(adminDatabaseUrl, {
  max: 1
});

try {
  const rows = await sql`
    select exists(
      select 1 from pg_database where datname = ${databaseName}
    ) as "exists"
  `;

  if (!rows[0]?.exists) {
    await sql.unsafe(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Created test database "${databaseName}"`);
  } else {
    console.log(`Test database "${databaseName}" already exists`);
  }

  await sql.unsafe(
    `alter database ${quoteIdentifier(databaseName)} owner to ${quoteIdentifier(migrationRole)}`
  );
  await sql.unsafe(
    `grant connect on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(runtimeRole)}`
  );
} finally {
  await sql.end({ timeout: 5 });
}

const migrationSql = postgres(testMigrationDatabaseUrl, { max: 1 });

try {
  await migrationSql.unsafe(
    `grant usage on schema public to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `grant select, insert, update, delete on all tables in schema public to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `grant truncate on all tables in schema public to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `grant usage, select on all sequences in schema public to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `alter default privileges in schema public grant truncate on tables to ${quoteIdentifier(runtimeRole)}`
  );
  await migrationSql.unsafe(
    `alter default privileges in schema public grant usage, select on sequences to ${quoteIdentifier(runtimeRole)}`
  );
} finally {
  await migrationSql.end({ timeout: 5 });
}

function getDatabaseName(databaseUrl: string) {
  const pathname = new URL(databaseUrl).pathname;
  const databaseName = decodeURIComponent(pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("TEST_DATABASE_URL must include a database name");
  }

  return databaseName;
}

function toAdminDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  url.search = "";
  url.hash = "";

  return url.toString();
}

function toDatabaseUrlForRole(databaseUrl: string, role: string) {
  const url = new URL(databaseUrl);
  url.username = role;
  return url.toString();
}

function getDatabaseRole(databaseUrl: string) {
  const role = decodeURIComponent(new URL(databaseUrl).username);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) {
    throw new Error("Database role must contain only letters, numbers, and underscores");
  }

  return role;
}

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(
      "Test database name must contain only letters, numbers, and underscores"
    );
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}
