import { describe, expect, it } from "vitest";

import { checkRedisReadiness } from "../src/core/redis/client.js";
import { createTestApp, request } from "./helpers/test-app.js";

describe("readiness", () => {
  it("reports the database and optional Redis state", async () => {
    const response = await request(createTestApp()).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      checks: {
        database: "ok",
        redis: "not_configured"
      },
      status: "ok"
    });
  });
});

describe("Redis readiness", () => {
  it("reports an optional Redis client as not configured", async () => {
    await expect(checkRedisReadiness(undefined)).resolves.toBe("not_configured");
  });

  it("reports a ready Redis client as healthy", async () => {
    await expect(
      checkRedisReadiness({
        isReady: true,
        ping: async () => "PONG"
      })
    ).resolves.toBe("ok");
  });

  it("reports disconnected and failing Redis clients as unhealthy", async () => {
    await expect(
      checkRedisReadiness({
        isReady: false,
        ping: async () => "PONG"
      })
    ).resolves.toBe("error");
    await expect(
      checkRedisReadiness({
        isReady: true,
        ping: async () => {
          throw new Error("Redis unavailable");
        }
      })
    ).resolves.toBe("error");
  });
});
