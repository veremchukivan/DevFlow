import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { sessions } from "../../core/db/schema/sessions.js";
import { users, type NewUser, type User } from "../../core/db/schema/users.js";

export type SessionUser = Pick<
  User,
  "createdAt" | "displayName" | "email" | "id" | "isPlatformAdmin"
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
