import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestUser,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("AI settings routes", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await cleanupDatabase();
    user = await createTestUser(app, { email: "ai-settings@devflow.io" });
  });

  afterAll(async () => closeDbConnection());

  it("returns configuration metadata without exposing a provider key", async () => {
    const response = await request(app)
      .get("/api/v1/ai-settings")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: false,
      model: null,
      provider: null,
      updatedAt: null,
    });
    expect(JSON.stringify(response.body)).not.toContain("apiKey");
  });

  it("allows removing AI configuration idempotently", async () => {
    const response = await request(app)
      .delete("/api/v1/ai-settings")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(204);
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/ai-settings");
    expect(response.status).toBe(401);
  });
});
