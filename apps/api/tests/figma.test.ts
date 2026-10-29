import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { env } from "../src/config/env.js";
import { encryptIntegrationSecret } from "../src/core/crypto/integrations.js";
import { figmaConnections } from "../src/core/db/schema/figma-connections.js";
import {
  cleanupDatabase,
  closeDbConnection,
  createTestApp,
  createTestUser,
  db,
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

  afterEach(() => vi.unstubAllGlobals());

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
      const authorizationUrl = new URL(response.headers.location);
      expect(authorizationUrl.searchParams.get("scope")).toBe(
        "current_user:read file_content:read file_dev_resources:read file_dev_resources:write",
      );
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

  it("requires a personal Figma connection before loading a file preview", async () => {
    const response = await request(app)
      .get("/api/v1/integrations/figma/preview")
      .set("Cookie", user.cookie)
      .query({ url: "https://www.figma.com/design/Abcd1234/Example" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("FIGMA_CONNECTION_REQUIRED");
  });

  it("loads only safe metadata from an accessible Figma file", async () => {
    await db.insert(figmaConnections).values({
      accessTokenEncrypted: encryptIntegrationSecret("figma-access-token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      figmaUserId: "figma-user",
      refreshTokenEncrypted: encryptIntegrationSecret("figma-refresh-token"),
      userId: user.user.id,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          editorType: "figma",
          lastModified: "2026-10-29T10:00:00.000Z",
          name: "Checkout flow",
          thumbnailUrl: "https://s3.figma.com/thumbnail.png",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/v1/integrations/figma/preview")
      .set("Cookie", user.cookie)
      .query({ url: "https://www.figma.com/design/Abcd1234/Checkout-flow?node-id=1-2" });

    expect(response.status).toBe(200);
    expect(response.body.preview).toEqual({
      editorType: "figma",
      fileKey: "Abcd1234",
      lastModified: "2026-10-29T10:00:00.000Z",
      name: "Checkout flow",
      thumbnailUrl: "https://s3.figma.com/thumbnail.png",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.figma.com/v1/files/Abcd1234?depth=1",
      expect.objectContaining({
        headers: { Authorization: "Bearer figma-access-token" },
      }),
    );
  });

  it("refreshes an expired access token before requesting a Figma file", async () => {
    await db
      .update(figmaConnections)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(figmaConnections.userId, user.user.id));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "renewed-access-token", expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            lastModified: "2026-10-29T11:00:00.000Z",
            name: "Renewed file access",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/v1/integrations/figma/preview")
      .set("Cookie", user.cookie)
      .query({ url: "https://www.figma.com/file/Abcd1234/Renewed" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.figma.com/v1/oauth/token");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.figma.com/v1/files/Abcd1234?depth=1");
  });
});
