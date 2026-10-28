import { and, desc, eq, gt, inArray, isNull, lte, ne } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { authTokens } from "../../core/db/schema/auth-tokens.js";
import { apiTokens } from "../../core/db/schema/api-tokens.js";
import { sessions } from "../../core/db/schema/sessions.js";
import { projects } from "../../core/db/schema/projects.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users, type NewUser, type User } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

export async function getAccountDataExport(userId: string) {
  const [user] = await db
    .select({
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) return null;

  const workspaceRows = await db
    .select({
      createdAt: workspaces.createdAt,
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      slug: workspaces.slug,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(desc(workspaces.createdAt));
  const workspaceIds = workspaceRows.map((workspace) => workspace.id);
  if (!workspaceIds.length)
    return { projects: [], tasks: [], user, workspaces: [] };

  const projectRows = await db
    .select({
      createdAt: projects.createdAt,
      description: projects.description,
      id: projects.id,
      key: projects.key,
      name: projects.name,
      updatedAt: projects.updatedAt,
      workspaceId: projects.workspaceId,
    })
    .from(projects)
    .where(
      and(
        inArray(projects.workspaceId, workspaceIds),
        isNull(projects.deletedAt),
      ),
    )
    .orderBy(desc(projects.createdAt));

  const taskRows = await db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      createdAt: tasks.createdAt,
      description: tasks.description,
      dueDate: tasks.dueDate,
      id: tasks.id,
      number: tasks.number,
      parentTaskId: tasks.parentTaskId,
      priority: tasks.priority,
      projectId: tasks.projectId,
      reporterUserId: tasks.reporterUserId,
      sprintId: tasks.sprintId,
      statusId: tasks.statusId,
      title: tasks.title,
      type: tasks.type,
      updatedAt: tasks.updatedAt,
      workspaceId: tasks.workspaceId,
    })
    .from(tasks)
    .where(
      and(inArray(tasks.workspaceId, workspaceIds), isNull(tasks.deletedAt)),
    )
    .orderBy(desc(tasks.updatedAt));

  return {
    projects: projectRows,
    tasks: taskRows,
    user,
    workspaces: workspaceRows,
  };
}

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

export async function listActiveSessionsForUser(userId: string) {
  return db
    .select({
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      lastSeenAt: sessions.lastSeenAt,
      tokenHash: sessions.tokenHash,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
}

export async function deleteSessionForUser(input: {
  sessionId: string;
  userId: string;
}) {
  const [session] = await db
    .delete(sessions)
    .where(
      and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)),
    )
    .returning({ tokenHash: sessions.tokenHash });

  return session ?? null;
}

export async function deleteOtherSessionsForUser(input: {
  tokenHash: string;
  userId: string;
}) {
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, input.userId),
        ne(sessions.tokenHash, input.tokenHash),
      ),
    );
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

export async function updateUserAvatar(
  userId: string,
  avatarUrl: string | null,
) {
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
    .select({
      emailNormalized: users.emailNormalized,
      id: users.id,
      passwordHash: users.passwordHash,
    })
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

export async function replaceEmailChangeToken(input: {
  email: string;
  emailNormalized: string;
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
          eq(authTokens.type, "email_change"),
          isNull(authTokens.consumedAt),
        ),
      );
    const [user] = await tx
      .update(users)
      .set({
        pendingEmail: input.email,
        pendingEmailNormalized: input.emailNormalized,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
      .returning({ displayName: users.displayName, id: users.id });
    if (!user) return null;
    await tx.insert(authTokens).values({
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
      type: "email_change",
      userId: user.id,
    });
    return user;
  });
}

export async function consumeEmailChangeToken(tokenHash: string) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [token] = await tx
      .update(authTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, "email_change"),
          gt(authTokens.expiresAt, now),
          isNull(authTokens.consumedAt),
        ),
      )
      .returning({ userId: authTokens.userId });
    if (!token) return null;

    const [pending] = await tx
      .select({ email: users.pendingEmail, emailNormalized: users.pendingEmailNormalized })
      .from(users)
      .where(and(eq(users.id, token.userId), isNull(users.deletedAt)))
      .for("update");
    if (!pending?.email || !pending.emailNormalized) return null;

    const [user] = await tx
      .update(users)
      .set({
        email: pending.email,
        emailNormalized: pending.emailNormalized,
        emailVerifiedAt: now,
        pendingEmail: null,
        pendingEmailNormalized: null,
        updatedAt: now,
      })
      .where(eq(users.id, token.userId))
      .returning();
    if (!user) return null;
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return user;
  });
}

export async function deleteAccountAndPersonalWorkspaces(userId: string) {
  return db.transaction(async (tx) => {
    const [sharedWorkspace] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.status, "active"),
          ne(workspaceMembers.userId, userId),
        ),
      )
      .where(
        and(eq(workspaces.ownerUserId, userId), isNull(workspaces.deletedAt)),
      )
      .limit(1);
    if (sharedWorkspace) return { kind: "shared_workspace" } as const;
    const now = new Date();
    await tx
      .update(workspaces)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(eq(workspaces.ownerUserId, userId), isNull(workspaces.deletedAt)),
      );
    const [user] = await tx
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (!user) return { kind: "user_not_found" } as const;
    await tx
      .update(users)
      .set({ avatarUrl: null, deletedAt: now, updatedAt: now })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(authTokens).where(eq(authTokens.userId, userId));
    return { avatarUrl: user.avatarUrl, kind: "deleted" } as const;
  });
}

export async function deleteExpiredSessions(now = new Date()) {
  return db
    .delete(sessions)
    .where(lte(sessions.expiresAt, now))
    .returning({ id: sessions.id });
}

export async function createApiToken(input: { userId: string; name: string; tokenHash: string; tokenPrefix: string; expiresAt: Date | null }) {
  const [token] = await db.insert(apiTokens).values({ ...input, scopes: ["api:access"] }).returning();
  return token!;
}
export async function listApiTokens(userId: string) {
  return db.select().from(apiTokens).where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt))).orderBy(desc(apiTokens.createdAt));
}
export async function revokeApiToken(userId: string, tokenId: string) {
  const [token] = await db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt))).returning({ id: apiTokens.id });
  return token ?? null;
}

export async function findUserByApiTokenHash(tokenHash: string) {
  const now = new Date();
  const [result] = await db
    .select({ tokenId: apiTokens.id, scopes: apiTokens.scopes, user: { id: users.id, avatarUrl: users.avatarUrl, createdAt: users.createdAt, displayName: users.displayName, email: users.email, emailVerifiedAt: users.emailVerifiedAt, isPlatformAdmin: users.isPlatformAdmin } })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt), isNull(users.deletedAt)))
    .limit(1);
  if (!result) return null;
  const [token] = await db.select({ expiresAt: apiTokens.expiresAt }).from(apiTokens).where(eq(apiTokens.id, result.tokenId)).limit(1);
  if (token?.expiresAt && token.expiresAt <= now) return null;
  await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, result.tokenId));
  return { scopes: result.scopes, user: result.user };
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
