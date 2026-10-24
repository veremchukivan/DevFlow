import { and, eq, gt, isNull, lte } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { authTokens } from "../../core/db/schema/auth-tokens.js";
import { sessions } from "../../core/db/schema/sessions.js";
import { users, type NewUser, type User } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

export type SessionUser = Pick<
  User,
  | "avatarUrl"
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
      and(eq(users.emailNormalized, emailNormalized), isNull(users.deletedAt)),
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

export async function createUserWithDefaultWorkspace(
  input: NewUser & { workspaceSlug: string },
) {
  return db.transaction(async (tx) => {
    const { workspaceSlug, ...userInput } = input;
    const [user] = await tx.insert(users).values(userInput).returning();
    if (!user) throw new Error("Failed to create user");

    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: `${user.displayName}'s workspace`,
        ownerUserId: user.id,
        slug: workspaceSlug,
      })
      .returning({ id: workspaces.id });
    if (!workspace) throw new Error("Failed to create default workspace");

    await tx.insert(workspaceMembers).values({
      role: "owner",
      status: "active",
      userId: user.id,
      workspaceId: workspace.id,
    });

    return user;
  });
}

export async function ensureDefaultWorkspaceForUser(input: {
  displayName: string;
  userId: string;
  workspaceSlug: string;
}) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update");

    const [membership] = await tx
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, input.userId),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .limit(1);
    if (membership) return;

    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: `${input.displayName}'s workspace`,
        ownerUserId: input.userId,
        slug: input.workspaceSlug,
      })
      .returning({ id: workspaces.id });
    if (!workspace) throw new Error("Failed to create default workspace");

    await tx.insert(workspaceMembers).values({
      role: "owner",
      status: "active",
      userId: input.userId,
      workspaceId: workspace.id,
    });
  });
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
      userId: input.userId,
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
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        id: users.id,
        isPlatformAdmin: users.isPlatformAdmin,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
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

export async function updateUserDisplayName(
  userId: string,
  displayName: string,
) {
  const [user] = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      id: users.id,
      isPlatformAdmin: users.isPlatformAdmin,
    });

  return user ?? null;
}

export async function updateUserAvatar(userId: string, avatarUrl: string | null) {
  const [user] = await db
    .update(users)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      id: users.id,
      isPlatformAdmin: users.isPlatformAdmin,
    });

  return user ?? null;
}

export async function findUserAvatarById(userId: string) {
  const [user] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function findUserPasswordById(userId: string) {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return user ?? null;
}

export async function updatePasswordAndDeleteSessions(
  userId: string,
  passwordHash: string,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!user) {
      return null;
    }

    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return user;
  });
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
          isNull(authTokens.consumedAt),
        ),
      );

    const [token] = await tx
      .insert(authTokens)
      .values({
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        type: "email_verification",
        userId: input.userId,
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
          isNull(authTokens.consumedAt),
        ),
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
          isNull(authTokens.consumedAt),
        ),
      );

    const [token] = await tx
      .insert(authTokens)
      .values({
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        type: "password_reset",
        userId: input.userId,
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
          isNull(authTokens.consumedAt),
        ),
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
        updatedAt: now,
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
