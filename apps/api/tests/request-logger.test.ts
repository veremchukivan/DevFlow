import { describe, expect, it } from "vitest";

import { redactSensitiveRequestUrl } from "../src/core/http/request-logger.js";
import { shouldExposeInvitationToken } from "../src/modules/workspace-invitations/workspace-invitations.routes.js";
import { createTestApp, request } from "./helpers/test-app.js";

describe("request logger", () => {
  it("returns a generated request ID when the client does not provide one", async () => {
    const response = await request(createTestApp()).get("/healthz");

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("preserves a valid client-provided request ID", async () => {
    const response = await request(createTestApp())
      .get("/healthz")
      .set("X-Request-Id", "postman-request-42");

    expect(response.headers["x-request-id"]).toBe("postman-request-42");
  });

  it("replaces unsafe client-provided request IDs", async () => {
    const response = await request(createTestApp())
      .get("/healthz")
      .set("X-Request-Id", "request id with spaces");

    expect(response.headers["x-request-id"]).not.toBe("request id with spaces");
  });

  it("redacts invitation tokens while preserving the endpoint action", () => {
    expect(
      redactSensitiveRequestUrl(
        "/api/v1/invitations/sensitive-token-value/accept?source=email"
      )
    ).toBe("/api/v1/invitations/[REDACTED]/accept?source=email");
  });

  it("does not alter URLs without invitation tokens", () => {
    expect(redactSensitiveRequestUrl("/api/v1/workspaces?page=2")).toBe(
      "/api/v1/workspaces?page=2"
    );
  });
});

describe("invitation token exposure", () => {
  it("only exposes raw tokens outside production for local and test workflows", () => {
    expect(shouldExposeInvitationToken("development")).toBe(true);
    expect(shouldExposeInvitationToken("test")).toBe(true);
    expect(shouldExposeInvitationToken("production")).toBe(false);
    expect(shouldExposeInvitationToken("staging")).toBe(false);
  });
});
