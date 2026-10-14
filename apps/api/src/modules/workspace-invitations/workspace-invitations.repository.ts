import type { PaginationQuery } from "@devflow/shared";
import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";

import { type DbExecutor, db } from "../../core/db/client.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceInvitations } from "../../core/db/schema/workspace-invitations.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type WorkspaceAssignableRole = "admin" | "member" | "viewer";

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({
      role: workspaceMembers.role,
      userId: workspaceMembers.userId,
      workspaceId: workspaceMembers.workspaceId
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return membership;
}

export async function findWorkspaceById(workspaceId: string) {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug
    })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)))
    .limit(1);

  return workspace;
}

export async function findActiveMemberByEmail(input: {
  emailNormalized: string;
  workspaceId: string;
}) {
  const [member] = await db
    .select({
      userId: workspaceMembers.userId
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(users.emailNormalized, input.emailNormalized),
        eq(workspaceMembers.status, "active"),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  return member;
}

export async function findUserByEmailNormalized(emailNormalized: string) {
  const [user] = await db
    .select({
      displayName: users.displayName,
      email: users.email,
      id: users.id
    })
    .from(users)
    .where(
      and(eq(users.emailNormalized, emailNormalized), isNull(users.deletedAt))
    )
    .limit(1);

  return user;
}

export async function findPendingInvitationByEmail(input: {
  emailNormalized: string;
  workspaceId: string;
}) {
  const now = new Date();
  const [invitation] = await invitationSelect()
    .where(
      and(
        eq(workspaceInvitations.workspaceId, input.workspaceId),
        eq(workspaceInvitations.emailNormalized, input.emailNormalized),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.rejectedAt),
        gt(workspaceInvitations.expiresAt, now)
      )
    )
    .limit(1);

  return invitation;
}

export async function createInvitationTx(input: {
  email: string;
  emailNormalized: string;
  expiresAt: Date;
  invitedByUserId: string;
  role: WorkspaceAssignableRole;
  targetUserId?: string;
  tokenHash: string;
  workspaceId: string;
}) {
  return db.transaction(async (tx) => {
    // Expired invitations still match the partial unique index until removed.
    await tx
      .delete(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.emailNormalized, input.emailNormalized),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.rejectedAt),
          lte(workspaceInvitations.expiresAt, new Date())
        )
      );

    if (input.targetUserId) {
      await tx
        .insert(workspaceMembers)
        .values({
          role: input.role,
          status: "invited",
          userId: input.targetUserId,
          workspaceId: input.workspaceId
        })
        .onConflictDoNothing();
    }

    const [created] = await tx
      .insert(workspaceInvitations)
      .values({
        email: input.email,
        emailNormalized: input.emailNormalized,
        expiresAt: input.expiresAt,
        invitedByUserId: input.invitedByUserId,
        role: input.role,
        tokenHash: input.tokenHash,
        workspaceId: input.workspaceId
      })
      .returning({ id: workspaceInvitations.id });

    if (!created) {
      throw new Error("Failed to create workspace invitation");
    }

    return findInvitationById(
      {
        invitationId: created.id,
        workspaceId: input.workspaceId
      },
      tx
    );
  });
}

export async function listPendingInvitationsForWorkspace(input: {
  pagination: PaginationQuery;
  workspaceId: string;
}) {
  const now = new Date();
  const conditions = and(
    eq(workspaceInvitations.workspaceId, input.workspaceId),
    isNull(workspaceInvitations.acceptedAt),
    isNull(workspaceInvitations.rejectedAt),
    gt(workspaceInvitations.expiresAt, now)
  );

  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(workspaceInvitations)
    .where(conditions);

  const rows = await invitationSelect()
    .where(conditions)
    .orderBy(
      desc(workspaceInvitations.createdAt),
      desc(workspaceInvitations.id)
    )
    .limit(input.pagination.limit)
    .offset(input.pagination.offset);

  return {
    invitations: rows,
    total: totalRow?.total ?? 0
  };
}

export async function findInvitationById(
  input: {
    invitationId: string;
    workspaceId: string;
  },
  executor: DbExecutor = db
) {
  const [invitation] = await invitationSelect(executor)
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId)
      )
    )
    .limit(1);

  return invitation;
}

export async function cancelInvitationTx(input: {
  invitationId: string;
  targetUserId?: string;
  workspaceId: string;
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.id, input.invitationId),
          eq(workspaceInvitations.workspaceId, input.workspaceId)
        )
      );

    if (input.targetUserId) {
      await tx
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.targetUserId),
            eq(workspaceMembers.status, "invited")
          )
        );
    }
  });
}

export async function deleteWorkspaceInvitation(input: {
  invitationId: string;
  workspaceId: string;
}) {
  const [deleted] = await db
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId)
      )
    )
    .returning();

  return deleted;
}

export async function updateInvitationToken(input: {
  expiresAt: Date;
  invitationId: string;
  tokenHash: string;
  workspaceId: string;
}) {
  const [updated] = await db
    .update(workspaceInvitations)
    .set({
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.rejectedAt)
      )
    )
    .returning({ id: workspaceInvitations.id });

  if (!updated) {
    return undefined;
  }

  return findInvitationById(
    {
      invitationId: input.invitationId,
      workspaceId: input.workspaceId
    },
    db
  );
}

export async function findInvitationByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({
      acceptedAt: workspaceInvitations.acceptedAt,
      createdAt: workspaceInvitations.createdAt,
      email: workspaceInvitations.email,
      emailNormalized: workspaceInvitations.emailNormalized,
      expiresAt: workspaceInvitations.expiresAt,
      id: workspaceInvitations.id,
      invitedBy: {
        displayName: users.displayName,
        email: users.email,
        id: users.id
      },
      invitedByUserId: workspaceInvitations.invitedByUserId,
      rejectedAt: workspaceInvitations.rejectedAt,
      role: workspaceInvitations.role,
      updatedAt: workspaceInvitations.updatedAt,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug
      },
      workspaceId: workspaceInvitations.workspaceId
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .leftJoin(users, eq(users.id, workspaceInvitations.invitedByUserId))
    .where(
      and(
        eq(workspaceInvitations.tokenHash, tokenHash),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return row;
}

export async function acceptInvitationTx(input: {
  invitationId: string;
  role: "owner" | "admin" | "member" | "viewer";
  tokenHash: string;
  userId: string;
  workspaceId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    // Confirm the token and state inside the transaction to prevent TOCTOU access.
    const [acceptedInvitation] = await tx
      .update(workspaceInvitations)
      .set({
        acceptedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(workspaceInvitations.id, input.invitationId),
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.tokenHash, input.tokenHash),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.rejectedAt),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .returning({ id: workspaceInvitations.id });

    if (!acceptedInvitation) {
      return false;
    }

    await tx
      .insert(workspaceMembers)
      .values({
        joinedAt: now,
        role: input.role,
        status: "active",
        userId: input.userId,
        workspaceId: input.workspaceId
      })
      .onConflictDoUpdate({
        set: {
          joinedAt: now,
          role: input.role,
          status: "active",
          updatedAt: now
        },
        target: [workspaceMembers.workspaceId, workspaceMembers.userId]
      });

    return true;
  });
}

export async function declineInvitationTx(input: {
  invitationId: string;
  tokenHash: string;
  userId?: string;
  workspaceId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [declinedInvitation] = await tx
      .update(workspaceInvitations)
      .set({
        rejectedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(workspaceInvitations.id, input.invitationId),
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          eq(workspaceInvitations.tokenHash, input.tokenHash),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.rejectedAt),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .returning({ id: workspaceInvitations.id });

    if (!declinedInvitation) {
      return false;
    }

    if (input.userId) {
      await tx
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.userId),
            eq(workspaceMembers.status, "invited")
          )
        );
    }

    return true;
  });
}

export async function upsertInvitedMember(input: {
  role: WorkspaceAssignableRole;
  userId: string;
  workspaceId: string;
}) {
  await db
    .insert(workspaceMembers)
    .values({
      role: input.role,
      status: "invited",
      userId: input.userId,
      workspaceId: input.workspaceId
    })
    .onConflictDoNothing();
}

export async function removeInvitedMemberIfPresent(input: {
  userId: string;
  workspaceId: string;
}) {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.status, "invited")
      )
    );
}

function invitationSelect(executor: DbExecutor = db) {
  return executor
    .select({
      acceptedAt: workspaceInvitations.acceptedAt,
      createdAt: workspaceInvitations.createdAt,
      email: workspaceInvitations.email,
      emailNormalized: workspaceInvitations.emailNormalized,
      expiresAt: workspaceInvitations.expiresAt,
      id: workspaceInvitations.id,
      invitedBy: {
        displayName: users.displayName,
        email: users.email,
        id: users.id
      },
      invitedByUserId: workspaceInvitations.invitedByUserId,
      rejectedAt: workspaceInvitations.rejectedAt,
      role: workspaceInvitations.role,
      updatedAt: workspaceInvitations.updatedAt,
      workspaceId: workspaceInvitations.workspaceId
    })
    .from(workspaceInvitations)
    .leftJoin(users, eq(users.id, workspaceInvitations.invitedByUserId));
}
