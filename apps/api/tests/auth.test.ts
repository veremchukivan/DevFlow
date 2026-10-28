import express from "express";
import rateLimit from "express-rate-limit";
import { and, eq, isNull, ne } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { authTokens } from "../src/core/db/schema/auth-tokens.js";
import { sessions } from "../src/core/db/schema/sessions.js";
import { users } from "../src/core/db/schema/users.js";
import { workspaceMembers } from "../src/core/db/schema/workspace-members.js";
import { workspaces } from "../src/core/db/schema/workspaces.js";
import {
  issueEmailVerificationToken,
  requestEmailChange,
  verifyEmail,
} from "../src/modules/auth/auth.service.js";
import {
  cleanupDatabase,
  createTestApp,
  db,
  request,
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Auth Module Integration Tests", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  it("registers a new user and sets session cookie", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      displayName: "Alice Developer",
      email: "alice@devflow.io",
      password: "Password123!",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      displayName: "Alice Developer",
      email: "alice@devflow.io",
      isEmailVerified: false,
      isPlatformAdmin: false,
    });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.token).toBeUndefined();

    const [workspace] = await db
      .select({ name: workspaces.name, role: workspaceMembers.role })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, workspaces.id),
      )
      .where(eq(workspaceMembers.userId, res.body.user.id));
    expect(workspace).toEqual({
      name: "Alice Developer's workspace",
      role: "owner",
    });

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain("devflow_session=");
  });

  it("rejects registration with duplicate email", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      displayName: "Alice Clone",
      email: "alice@devflow.io",
      password: "AnotherPassword123!",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("authenticates an existing user via login", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("alice@devflow.io");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects login with invalid password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "WrongPassword999!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns the authenticated user profile with valid session cookie", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
    });

    const cookie = loginRes.headers["set-cookie"][0];

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("alice@devflow.io");
  });

  it("exports account data without authentication secrets", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
    });
    const cookie = loginRes.headers["set-cookie"][0];

    const exported = await request(app)
      .get("/api/v1/auth/data-export")
      .set("Cookie", cookie);

    expect(exported.status).toBe(200);
    expect(exported.headers["content-disposition"]).toContain("attachment");
    expect(exported.body.user).toMatchObject({ email: "alice@devflow.io" });
    expect(exported.body.workspaces).toHaveLength(1);
    expect(JSON.stringify(exported.body)).not.toContain("passwordHash");
    expect(JSON.stringify(exported.body)).not.toContain("tokenHash");
  });

  it("updates the authenticated user's display name", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice@devflow.io", password: "Password123!" });
    const cookie = loginRes.headers["set-cookie"][0];

    const updateRes = await request(app)
      .patch("/api/v1/auth/profile")
      .set("Cookie", cookie)
      .send({ displayName: "Alice Product" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.displayName).toBe("Alice Product");
  });

  it("uploads and removes the authenticated user's avatar", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice@devflow.io", password: "Password123!" });
    const cookie = loginRes.headers["set-cookie"][0];

    const uploaded = await request(app)
      .put("/api/v1/auth/profile/avatar")
      .set("Cookie", cookie)
      .attach(
        "image",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        {
          contentType: "image/png",
          filename: "avatar.png",
        },
      );

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.user.avatarUrl).toMatch(/^\/uploads\/avatars\//);

    const removed = await request(app)
      .delete("/api/v1/auth/profile/avatar")
      .set("Cookie", cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.user.avatarUrl).toBeNull();
  });

  it("rejects an incorrect current password without ending the session", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice@devflow.io", password: "Password123!" });
    const cookie = loginRes.headers["set-cookie"][0];

    const changeRes = await request(app)
      .post("/api/v1/auth/password/change")
      .set("Cookie", cookie)
      .send({
        currentPassword: "NotThePassword",
        newPassword: "NewPassword123!",
      });

    expect(changeRes.status).toBe(400);
    expect(changeRes.body.error.code).toBe("INVALID_CURRENT_PASSWORD");

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);
    expect(meRes.status).toBe(200);
  });

  it("rejects /api/v1/auth/me when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("terminates session upon logout", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
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
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "nonexistent@devflow.io",
      password: "WrongPassword999!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("throttles session lastSeenAt update on rapid requests within 5 minutes", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
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
      sessionBefore?.lastSeenAt.getTime(),
    );
  });

  it("replaces an active verification token when a signed-in user requests another email", async () => {
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
    });
    const cookie = loginRes.headers["set-cookie"][0];

    const resendRes = await request(app)
      .post("/api/v1/auth/email-verification/resend")
      .set("Cookie", cookie);

    expect(resendRes.status).toBe(204);

    const activeTokens = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.type, "email_verification"),
          isNull(authTokens.consumedAt),
        ),
      );
    expect(activeTokens).toHaveLength(1);
  });

  it("verifies an email once and rejects reused verification links", async () => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, "alice@devflow.io"));
    expect(user).toBeDefined();

    const firstToken = await issueEmailVerificationToken(user!);
    const secondToken = await issueEmailVerificationToken(user!);

    const staleTokenRes = await request(app)
      .post("/api/v1/auth/email-verification/confirm")
      .send({ token: firstToken });
    expect(staleTokenRes.status).toBe(400);
    expect(staleTokenRes.body.error.code).toBe(
      "INVALID_EMAIL_VERIFICATION_TOKEN",
    );

    const verificationRes = await request(app)
      .post("/api/v1/auth/email-verification/confirm")
      .send({ token: secondToken });
    expect(verificationRes.status).toBe(204);

    const reusedTokenRes = await request(app)
      .post("/api/v1/auth/email-verification/confirm")
      .send({ token: secondToken });
    expect(reusedTokenRes.status).toBe(400);
    expect(reusedTokenRes.body.error.code).toBe(
      "INVALID_EMAIL_VERIFICATION_TOKEN",
    );

    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "alice@devflow.io",
      password: "Password123!",
    });
    const cookie = loginRes.headers["set-cookie"][0];
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.isEmailVerified).toBe(true);
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
          message: "Too many authentication attempts, please try again later",
        },
      },
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
      message: "Too many authentication attempts, please try again later",
    });
  });

  it("soft deletes an account after password confirmation and revokes its session", async () => {
    const email = `delete-me-${Date.now()}@devflow.io`;
    const registered = await request(app).post("/api/v1/auth/register").send({
      displayName: "Delete Me",
      email,
      password: "Password123!",
    });
    expect(registered.status).toBe(201);
    const cookie = registered.headers["set-cookie"][0];

    const authenticated = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie);
    expect(authenticated.body.user.id).toBe(registered.body.user.id);

    const workspaceMembersBeforeDeletion = await db
      .select({
        userId: workspaceMembers.userId,
        workspaceId: workspaces.id,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, workspaces.id),
      )
      .where(eq(workspaces.ownerUserId, registered.body.user.id));
    expect(workspaceMembersBeforeDeletion).toEqual([
      {
        userId: registered.body.user.id,
        workspaceId: expect.any(String),
      },
    ]);

    const sharedWorkspaceMembers = await db
      .select({
        userId: workspaceMembers.userId,
        workspaceId: workspaces.id,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.status, "active"),
          ne(workspaceMembers.userId, registered.body.user.id),
        ),
      )
      .where(eq(workspaces.ownerUserId, registered.body.user.id));
    expect(sharedWorkspaceMembers).toEqual([]);

    const deleted = await request(app)
      .delete("/api/v1/auth/account")
      .set("Cookie", cookie)
      .send({ currentPassword: "Password123!" });
    expect(deleted.status).toBe(204);

    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(401);

    const [user] = await db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.emailNormalized, email));
    expect(user?.deletedAt).not.toBeNull();
  });

  it("requires transferring shared workspace ownership before account deletion", async () => {
    const ownerEmail = `workspace-owner-${Date.now()}@devflow.io`;
    const memberEmail = `workspace-member-${Date.now()}@devflow.io`;
    const owner = await request(app).post("/api/v1/auth/register").send({
      displayName: "Workspace Owner",
      email: ownerEmail,
      password: "Password123!",
    });
    const member = await request(app).post("/api/v1/auth/register").send({
      displayName: "Workspace Member",
      email: memberEmail,
      password: "Password123!",
    });
    expect(owner.status).toBe(201);
    expect(member.status).toBe(201);

    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, owner.body.user.id));
    expect(workspace?.id).toBeDefined();
    await db.insert(workspaceMembers).values({
      role: "member",
      status: "active",
      userId: member.body.user.id,
      workspaceId: workspace!.id,
    });

    const deletion = await request(app)
      .delete("/api/v1/auth/account")
      .set("Cookie", owner.headers["set-cookie"][0])
      .send({ currentPassword: "Password123!" });
    expect(deletion.status).toBe(409);
    expect(deletion.body.error.code).toBe(
      "WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED",
    );

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", owner.headers["set-cookie"][0]);
    expect(me.status).toBe(200);
  });

  it("changes an email only after confirmation and revokes existing sessions", async () => {
    const oldEmail = `email-change-${Date.now()}@devflow.io`;
    const newEmail = `new-email-${Date.now()}@devflow.io`;
    const registered = await request(app).post("/api/v1/auth/register").send({
      displayName: "Email Change User",
      email: oldEmail,
      password: "Password123!",
    });
    expect(registered.status).toBe(201);
    const cookie = registered.headers["set-cookie"][0];

    const change = await requestEmailChange(registered.body.user.id, {
      currentPassword: "Password123!",
      email: newEmail,
    });
    const [pending] = await db
      .select({ email: users.email, pendingEmail: users.pendingEmail })
      .from(users)
      .where(eq(users.id, registered.body.user.id));
    expect(pending).toEqual({ email: oldEmail, pendingEmail: newEmail });

    await verifyEmail(change.token);
    const [updated] = await db
      .select({ email: users.email, pendingEmail: users.pendingEmail })
      .from(users)
      .where(eq(users.id, registered.body.user.id));
    expect(updated).toEqual({ email: newEmail, pendingEmail: null });

    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(401);
  });
});
