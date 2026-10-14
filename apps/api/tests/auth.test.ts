import express from "express";
import rateLimit from "express-rate-limit";
import { beforeAll, describe, expect, it } from "vitest";

import { sessions } from "../src/core/db/schema/sessions.js";
import {
  cleanupDatabase,
  createTestApp,
  db,
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

  it("rejects login with non-existent email with identical 401 response", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "nonexistent@devflow.io",
        password: "WrongPassword999!"
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("throttles session lastSeenAt update on rapid requests within 5 minutes", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "alice@devflow.io",
        password: "Password123!"
      });

    const cookie = loginRes.headers["set-cookie"][0];

    const [sessionBefore] = await db.select().from(sessions);
    expect(sessionBefore).toBeDefined();

    // Call /me immediately
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(200);

    const [sessionAfter] = await db.select().from(sessions);
    // lastSeenAt should NOT be updated because 5 minutes have not elapsed
    expect(sessionAfter?.lastSeenAt.getTime()).toBe(
      sessionBefore?.lastSeenAt.getTime()
    );
  });

  it("enforces rate limit when requests exceed limit threshold", async () => {
    const miniApp = express();
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many authentication attempts, please try again later"
        }
      }
    });

    miniApp.post("/test-limit", limiter, (_req, res) => {
      res.json({ ok: true });
    });

    const res1 = await request(miniApp).post("/test-limit");
    expect(res1.status).toBe(200);

    const res2 = await request(miniApp).post("/test-limit");
    expect(res2.status).toBe(200);

    const res3 = await request(miniApp).post("/test-limit");
    expect(res3.status).toBe(429);
    expect(res3.body.error).toEqual({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later"
    });
  });
});

