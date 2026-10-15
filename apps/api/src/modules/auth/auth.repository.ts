import { and, eq, gt, isNull, lte } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { authTokens } from "../../core/db/schema/auth-tokens.js";
import { sessions } from "../../core/db/schema/sessions.js";
import { users, type NewUser, type User } from "../../core/db/schema/users.js";

export type SessionUser = Pick<
  User,
  | "createdAt"
  | "displayName"
  | "email"
  | "emailVerifiedAt"
  | "id"
  | "isPlatformAdmin"
>;

export async function findUserByEmailNormalized(emailNormalized: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(eq(users.emailNormalized, emailNormalized), isNull(users.deletedAt))
    )
    .limit(1);

  return user;
}

export async function createUser(input: NewUser) {
  const [user] = await db.insert(users).values(input).returning();

  if (!user) {
    throw new Error("Failed to create user");
  }

  return user;
}

export async function createSession(input: {
  expiresAt: Date;
  ipAddress?: string;
  tokenHash: string;
  userAgent?: string;
  userId: string;
}) {
  const [session] = await db
    .insert(sessions)
    .values({
      expiresAt: input.expiresAt,
      ipAddress: input.ipAddress,
      tokenHash: input.tokenHash,
      userAgent: input.userAgent,
      userId: input.userId
    })
    .returning();

  if (!session) {
    throw new Error("Failed to create session");
  }

  return session;
}

export async function findSessionUserByTokenHash(tokenHash: string) {
  const [result] = await db
    .select({
      lastSeenAt: sessions.lastSeenAt,
      sessionId: sessions.id,
      user: {
        createdAt: users.createdAt,
        displayName: users.displayName,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        id: users.id,
        isPlatformAdmin: users.isPlatformAdmin
      }
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  return result;
}

export async function touchSession(sessionId: string) {
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteExpiredSessions(now = new Date()) {
  return db
    .delete(sessions)
    .where(lte(sessions.expiresAt, now))
    .returning({ id: sessions.id });
}

export async function replaceEmailVerificationToken(input: {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, input.userId),
          eq(authTokens.type, "email_verification"),
          isNull(authTokens.consumedAt)
        )
      );

    const [token] = await tx
      .insert(authTokens)
      .values({
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        type: "email_verification",
        userId: input.userId
      })
      .returning();

    if (!token) {
      throw new Error("Failed to create email verification token");
    }

    return token;
  });
}

export async function consumeEmailVerificationToken(tokenHash: string) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [token] = await tx
      .update(authTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, "email_verification"),
          gt(authTokens.expiresAt, now),
          isNull(authTokens.consumedAt)
        )
      )
      .returning({ userId: authTokens.userId });

    if (!token) {
      return null;
    }

    const [user] = await tx
      .update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(and(eq(users.id, token.userId), isNull(users.deletedAt)))
      .returning();

    return user ?? null;
  });
}

export async function replacePasswordResetToken(input: {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(authTokens)
      .where(
        and(
          eq(authTokens.userId, input.userId),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.consumedAt)
        )
      );

    const [token] = await tx
      .insert(authTokens)
      .values({
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        type: "password_reset",
        userId: input.userId
      })
      .returning();

    if (!token) {
      throw new Error("Failed to create password reset token");
    }

    return token;
  });
}

export async function consumePasswordResetToken(input: {
  passwordHash: string;
  tokenHash: string;
}) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [token] = await tx
      .update(authTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, input.tokenHash),
          eq(authTokens.type, "password_reset"),
          gt(authTokens.expiresAt, now),
          isNull(authTokens.consumedAt)
        )
      )
      .returning({ userId: authTokens.userId });

    if (!token) {
      return null;
    }

    const [user] = await tx
      .update(users)
      .set({
        emailVerifiedAt: now,
        passwordHash: input.passwordHash,
        updatedAt: now
      })
      .where(and(eq(users.id, token.userId), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!user) {
      return null;
    }

    await tx.delete(sessions).where(eq(sessions.userId, user.id));

    return user;
  });
}
