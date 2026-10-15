import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { sessions } from "../src/core/db/schema/sessions.js";
import { purgeExpiredSessions } from "../src/modules/auth/session-cleanup.js";
import {
  cleanupDatabase,
  createTestApp,
  createTestUser,
  db
} from "./helpers/test-app.js";

const app = createTestApp();

describe("session cleanup", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("removes expired sessions without affecting active sessions", async () => {
    const user = await createTestUser(app);
    const now = new Date();
    const expiredTokenHash = "expired-session-token-hash";
    const activeTokenHash = "active-session-token-hash";

    await db.insert(sessions).values([
      {
        expiresAt: new Date(now.getTime() - 1_000),
        tokenHash: expiredTokenHash,
        userId: user.user.id
      },
      {
        expiresAt: new Date(now.getTime() + 1_000),
        tokenHash: activeTokenHash,
        userId: user.user.id
      }
    ]);

    expect(await purgeExpiredSessions(now)).toBe(1);

    const [expiredSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, expiredTokenHash));
    const [activeSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, activeTokenHash));

    expect(expiredSession).toBeUndefined();
    expect(activeSession).toBeDefined();
  });
});
