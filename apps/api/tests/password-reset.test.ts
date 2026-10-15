import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { authTokens } from "../src/core/db/schema/auth-tokens.js";
import { users } from "../src/core/db/schema/users.js";
import { issuePasswordResetToken } from "../src/modules/auth/auth.service.js";
import {
  cleanupDatabase,
  createTestApp,
  createTestUser,
  db,
  request
} from "./helpers/test-app.js";

const app = createTestApp();

describe("Password Reset Integration Tests", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("returns the same response for registered and unregistered email addresses", async () => {
    const account = await createTestUser(app);

    const knownEmailRes = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: account.email });
    const unknownEmailRes = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "unknown@devflow.io" });

    expect(knownEmailRes.status).toBe(204);
    expect(unknownEmailRes.status).toBe(204);

    const tokens = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, account.user.id),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.consumedAt)
        )
      );
    expect(tokens).toHaveLength(1);
  });

  it("resets the password once and terminates existing sessions", async () => {
    const account = await createTestUser(app);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, account.user.id));
    expect(user).toBeDefined();

    const token = await issuePasswordResetToken(user!);
    const resetRes = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        password: "NewPassword456!",
        token
      });

    expect(resetRes.status).toBe(204);

    const oldSessionRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", account.cookie);
    expect(oldSessionRes.status).toBe(401);

    const oldPasswordRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: account.email, password: account.password });
    expect(oldPasswordRes.status).toBe(401);

    const newPasswordRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: account.email, password: "NewPassword456!" });
    expect(newPasswordRes.status).toBe(200);

    const reusedTokenRes = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        password: "AnotherPassword789!",
        token
      });
    expect(reusedTokenRes.status).toBe(400);
    expect(reusedTokenRes.body.error.code).toBe("INVALID_PASSWORD_RESET_TOKEN");
  });
});
