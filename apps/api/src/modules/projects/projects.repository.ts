import type { PaginationQuery } from "@devflow/shared";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { projects } from "../../core/db/schema/projects.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

const defaultProjectStatuses = [
  {
    category: "todo" as const,
    color: "#64748b",
    isDefault: true,
    name: "Backlog",
    position: 1000
  },
  {
    category: "in_progress" as const,
    color: "#2563eb",
    isDefault: true,
    name: "In Progress",
    position: 2000
  },
  {
    category: "done" as const,
    color: "#16a34a",
    isDefault: true,
    name: "Done",
    position: 3000
  }
];

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({
      role: workspaceMembers.role,
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

export async function findProjectByKey(input: {
  key: string;
  workspaceId: string;
}) {
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.key, input.key),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  return project;
}

export async function createProjectWithDefaultStatuses(input: {
  description?: string;
  key: string;
  name: string;
  ownerUserId: string;
  workspaceId: string;
}) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        description: input.description,
        key: input.key,
        name: input.name,
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId
      })
      .returning();

    if (!project) {
      throw new Error("Failed to create project");
    }

    const statuses = await tx
      .insert(projectStatuses)
      .values(
        defaultProjectStatuses.map((status) => ({
          ...status,
          projectId: project.id,
          workspaceId: input.workspaceId
        }))
      )
      .returning();

    return {
      ...project,
      statuses
    };
  });
}

export async function listProjectsForWorkspace(input: {
  pagination: PaginationQuery;
  workspaceId: string;
}) {
  const conditions = and(
    eq(projects.workspaceId, input.workspaceId),
    isNull(projects.deletedAt)
  );

  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(projects)
    .where(conditions);

  const rows = await db
    .select()
    .from(projects)
    .where(conditions)
    .orderBy(desc(projects.createdAt), desc(projects.id))
    .limit(input.pagination.limit)
    .offset(input.pagination.offset);

  return {
    projects: rows,
    total: totalRow?.total ?? 0
  };
}

export async function findProjectInWorkspace(input: {
  projectId: string;
  workspaceId: string;
}) {
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.workspaceId, input.workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  return project;
}

export async function listProjectStatuses(input: {
  projectId: string;
  workspaceId: string;
}) {
  return db
    .select()
    .from(projectStatuses)
    .where(
      and(
        eq(projectStatuses.workspaceId, input.workspaceId),
        eq(projectStatuses.projectId, input.projectId)
      )
    )
    .orderBy(asc(projectStatuses.position));
}
