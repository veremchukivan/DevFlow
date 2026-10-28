import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestUser,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Figma integration routes", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await cleanupDatabase();
    user = await createTestUser(app, { email: "figma@devflow.io" });
  });

  afterAll(async () => closeDbConnection());

  it("reports that a user has no connected Figma account", async () => {
    const response = await request(app)
      .get("/api/v1/integrations/figma/connection")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: false,
      connected: false,
      connection: null,
    });
  });

  it("does not start OAuth when the integration is not configured", async () => {
    const response = await request(app)
      .get("/api/v1/integrations/figma/connect")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("FIGMA_NOT_CONFIGURED");
  });

  it("allows disconnecting even when no Figma account is connected", async () => {
    const response = await request(app)
      .delete("/api/v1/integrations/figma/connection")
      .set("Cookie", user.cookie);

    expect(response.status).toBe(204);
  });
});
