import { defineConfig } from "vitest/config";

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
      DATABASE_URL: "postgres://devflow:devflow@localhost:5432/devflow_test",
      NODE_ENV: "test"
    }
  }
});
