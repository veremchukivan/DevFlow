import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { env } from "../src/config/env.js";
import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestUser,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();
const figmaConfigured = Boolean(
  env.FIGMA_CLIENT_ID &&
    env.FIGMA_CLIENT_SECRET &&
    env.FIGMA_REDIRECT_URI &&
    env.INTEGRATION_ENCRYPTION_KEY,
);

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
      configured: figmaConfigured,
      connected: false,
      connection: null,
    });
  });

  it("reports Figma OAuth availability", async () => {
    const response = await request(app)
      .get("/api/v1/integrations/figma/connect")
      .set("Cookie", user.cookie);

    if (figmaConfigured) {
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/^https:\/\/www\.figma\.com\/oauth\?/);
      return;
    }

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
