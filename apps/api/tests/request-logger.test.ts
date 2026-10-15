import { describe, expect, it } from "vitest";

import { redactSensitiveRequestUrl } from "../src/core/http/request-logger.js";
import { shouldExposeInvitationToken } from "../src/modules/workspace-invitations/workspace-invitations.routes.js";

describe("request logger", () => {
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
