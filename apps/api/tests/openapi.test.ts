import { describe, expect, it } from "vitest";

import { createTestApp, request } from "./helpers/test-app.js";

describe("OpenAPI document", () => {
  it("serves the generated contract", async () => {
    const response = await request(createTestApp()).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      info: {
        title: "DevFlow API",
        version: "1.0.0"
      },
      openapi: "3.1.0"
    });
    expect(response.body.paths).toHaveProperty(
      "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}"
    );
  });
});
