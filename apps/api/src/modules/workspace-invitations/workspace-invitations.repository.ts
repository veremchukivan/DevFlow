import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
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

export async function createWorkspaceInvitation(input: {
  email: string;
  emailNormalized: string;
  expiresAt: Date;
  invitedByUserId: string;
  role: WorkspaceAssignableRole;
  tokenHash: string;
  workspaceId: string;
}) {
  const [created] = await db
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

  return findInvitationById({
    invitationId: created.id,
    workspaceId: input.workspaceId
  });
}

export async function listPendingInvitationsForWorkspace(workspaceId: string) {
  const now = new Date();
  return invitationSelect()
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.rejectedAt),
        gt(workspaceInvitations.expiresAt, now)
      )
    )
    .orderBy(desc(workspaceInvitations.createdAt));
}

export async function findInvitationById(input: {
  invitationId: string;
  workspaceId: string;
}) {
  const [invitation] = await invitationSelect()
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId)
      )
    )
    .limit(1);

  return invitation;
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
  await db
    .update(workspaceInvitations)
    .set({
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId)
      )
    );

  return findInvitationById({
    invitationId: input.invitationId,
    workspaceId: input.workspaceId
  });
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
  userId: string;
  workspaceId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    // 1. Mark invitation accepted
    await tx
      .update(workspaceInvitations)
      .set({
        acceptedAt: now,
        updatedAt: now
      })
      .where(eq(workspaceInvitations.id, input.invitationId));

    // 2. Insert or update workspace member to active
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
  });
}

export async function declineInvitationTx(input: {
  invitationId: string;
  userId?: string;
  workspaceId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(workspaceInvitations)
      .set({
        rejectedAt: now,
        updatedAt: now
      })
      .where(eq(workspaceInvitations.id, input.invitationId));

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

function invitationSelect() {
  return db
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
