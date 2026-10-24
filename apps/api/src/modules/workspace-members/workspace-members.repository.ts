import type { PaginationQuery } from "@devflow/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type WorkspaceMemberRole = "owner" | "admin" | "member" | "viewer";
type WorkspaceMemberStatus = "active" | "invited" | "suspended";

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

export async function findWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const [member] = await workspaceMemberSelect()
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  return member;
}

export async function listWorkspaceMembers(input: {
  pagination: PaginationQuery;
  workspaceId: string;
}) {
  const conditions = and(
    eq(workspaceMembers.workspaceId, input.workspaceId),
    isNull(users.deletedAt)
  );

  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(conditions);

  const rows = await workspaceMemberSelect()
    .where(conditions)
    .orderBy(asc(workspaceMembers.joinedAt), asc(workspaceMembers.userId))
    .limit(input.pagination.limit)
    .offset(input.pagination.offset);

  return {
    members: rows,
    total: totalRow?.total ?? 0
  };
}

export async function createWorkspaceMember(input: {
  role: "admin" | "member" | "viewer";
  userId: string;
  workspaceId: string;
}) {
  await db.insert(workspaceMembers).values({
    role: input.role,
    status: "active",
    userId: input.userId,
    workspaceId: input.workspaceId
  });

  return findWorkspaceMember(input);
}

export async function updateWorkspaceMember(input: {
  role?: "admin" | "member" | "viewer";
  status?: "active" | "suspended";
  userId: string;
  workspaceId: string;
}) {
  const [member] = await db
    .update(workspaceMembers)
    .set({
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId)
      )
    )
    .returning({
      userId: workspaceMembers.userId
    });

  if (!member) {
    return undefined;
  }

  return findWorkspaceMember(input);
}

export async function deleteWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const [member] = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId)
      )
    )
    .returning({
      userId: workspaceMembers.userId
    });

  return member;
}

export async function transferWorkspaceOwnership(input: { fromUserId: string; toUserId: string; workspaceId: string }) {
  return db.transaction(async (tx) => {
    const [target] = await tx.select({ status: workspaceMembers.status }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, input.toUserId), eq(workspaceMembers.workspaceId, input.workspaceId))).limit(1);
    if (!target || target.status !== "active") return false;
    const now = new Date();
    const [workspace] = await tx.update(workspaces).set({ ownerUserId: input.toUserId, updatedAt: now }).where(and(eq(workspaces.id, input.workspaceId), eq(workspaces.ownerUserId, input.fromUserId), isNull(workspaces.deletedAt))).returning({ id: workspaces.id });
    if (!workspace) return false;
    await tx.update(workspaceMembers).set({ role: "admin", updatedAt: now }).where(and(eq(workspaceMembers.userId, input.fromUserId), eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.role, "owner")));
    await tx.update(workspaceMembers).set({ role: "owner", updatedAt: now }).where(and(eq(workspaceMembers.userId, input.toUserId), eq(workspaceMembers.workspaceId, input.workspaceId)));
    return true;
  });
}

function workspaceMemberSelect() {
  return db
    .select({
      createdAt: workspaceMembers.createdAt,
      joinedAt: workspaceMembers.joinedAt,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      updatedAt: workspaceMembers.updatedAt,
      user: {
        displayName: users.displayName,
        email: users.email,
        id: users.id
      },
      userId: workspaceMembers.userId,
      workspaceId: workspaceMembers.workspaceId
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId));
}

export type WorkspaceMemberRecord = {
  createdAt: Date;
  joinedAt: Date;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  updatedAt: Date;
  user: {
    displayName: string;
    email: string;
    id: string;
  };
  userId: string;
  workspaceId: string;
};
