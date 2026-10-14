import type { PaginationQuery } from "@devflow/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

export async function findWorkspaceBySlug(slug: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)))
    .limit(1);

  return workspace;
}

export async function createWorkspaceWithOwner(input: {
  name: string;
  ownerUserId: string;
  slug: string;
}) {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: input.name,
        ownerUserId: input.ownerUserId,
        slug: input.slug
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to create workspace");
    }

    await tx.insert(workspaceMembers).values({
      role: "owner",
      status: "active",
      userId: input.ownerUserId,
      workspaceId: workspace.id
    });

    return {
      ...workspace,
      role: "owner" as const
    };
  });
}

export async function listWorkspacesForUser(input: {
  pagination: PaginationQuery;
  userId: string;
}) {
  const conditions = and(
    eq(workspaceMembers.userId, input.userId),
    eq(workspaceMembers.status, "active"),
    isNull(workspaces.deletedAt)
  );

  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id)
    )
    .where(conditions);

  const rows = await db
    .select({
      createdAt: workspaces.createdAt,
      id: workspaces.id,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      role: workspaceMembers.role,
      slug: workspaces.slug,
      updatedAt: workspaces.updatedAt
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id)
    )
    .where(conditions)
    .orderBy(desc(workspaces.createdAt), desc(workspaces.id))
    .limit(input.pagination.limit)
    .offset(input.pagination.offset);

  return {
    total: totalRow?.total ?? 0,
    workspaces: rows
  };
}

export async function findWorkspaceForUser(input: {
  userId: string;
  workspaceId: string;
}) {
  const [workspace] = await db
    .select({
      createdAt: workspaces.createdAt,
      id: workspaces.id,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      role: workspaceMembers.role,
      slug: workspaces.slug,
      updatedAt: workspaces.updatedAt
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id)
    )
    .where(
      and(
        eq(workspaces.id, input.workspaceId),
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return workspace;
}
