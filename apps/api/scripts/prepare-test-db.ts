import "dotenv/config";

import postgres from "postgres";

const defaultTestDatabaseUrl =
  "postgres://devflow:devflow@localhost:5432/devflow_test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
const adminDatabaseUrl =
  process.env.DATABASE_ADMIN_URL ?? toAdminDatabaseUrl(testDatabaseUrl);

const databaseName = getDatabaseName(testDatabaseUrl);

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
} finally {
  await sql.end({ timeout: 5 });
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

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(
      "Test database name must contain only letters, numbers, and underscores"
    );
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}
