import "dotenv/config";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/core/db/schema/index.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://devflow:devflow@localhost:5432/devflow"
  },
  strict: true,
  verbose: true
});
