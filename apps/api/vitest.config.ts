import dotenv from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://devflow_runtime:devflow_runtime@localhost:5432/devflow_test";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globals: true,
    hookTimeout: 20000,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test"
    }
  }
});
