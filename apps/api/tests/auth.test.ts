import { beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDatabase,
  createTestApp,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Auth Module Integration Tests", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  it("registers a new user and sets session cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        displayName: "Alice Developer",
        email: "alice@devflow.io",
        password: "Password123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      displayName: "Alice Developer",
      email: "alice@devflow.io",
      isPlatformAdmin: false
    });
    expect(res.body.user.id).toBeDefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain("devflow_session=");
  });

  it("rejects registration with duplicate email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        displayName: "Alice Clone",
        email: "alice@devflow.io",
        password: "AnotherPassword123!"
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("authenticates an existing user via login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "alice@devflow.io",
        password: "Password123!"
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("alice@devflow.io");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects login with invalid password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "alice@devflow.io",
        password: "WrongPassword999!"
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns the authenticated user profile with valid session cookie", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "alice@devflow.io",
        password: "Password123!"
      });

    const cookie = loginRes.headers["set-cookie"][0];

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("alice@devflow.io");
  });

  it("rejects /api/v1/auth/me when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("terminates session upon logout", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "alice@devflow.io",
        password: "Password123!"
      });

    const cookie = loginRes.headers["set-cookie"][0];

    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie);

    expect(logoutRes.status).toBe(204);

    // Subsequent access with old cookie should fail
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(401);
  });
});
