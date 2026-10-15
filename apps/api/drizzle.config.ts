import dotenv from "dotenv";
import { resolve } from "node:path";

import { defineConfig } from "drizzle-kit";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/core/db/schema/index.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATION_URL ??
      process.env.DATABASE_URL ??
      "postgres://devflow_migrator:devflow_migrator@localhost:5432/devflow"
  },
  strict: true,
  verbose: true
});
