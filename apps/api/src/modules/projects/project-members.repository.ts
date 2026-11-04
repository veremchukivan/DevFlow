import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projectMembers } from "../../core/db/schema/project-members.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";

export async function listProjectMembers(input: {
  projectId: string;
  workspaceId: string;
}) {
  return db
    .select({
      joinedAt: projectMembers.createdAt,
      role: projectMembers.role,
      user: {
        displayName: users.displayName,
        email: users.email,
        id: users.id,
      },
      userId: projectMembers.userId,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.workspaceId, input.workspaceId),
      ),
    );
}

export async function listProjectTaskWorkloads(input: {
  projectId: string;
  workspaceId: string;
}) {
  return db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      statusCategory: projectStatuses.category,
    })
    .from(tasks)
    .innerJoin(
      projectStatuses,
      and(
        eq(projectStatuses.id, tasks.statusId),
        eq(projectStatuses.projectId, tasks.projectId),
        eq(projectStatuses.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
      ),
    );
}

export async function findProjectMember(input: {
  projectId: string;
  userId: string;
}) {
  const [member] = await db
    .select({ role: projectMembers.role, userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.userId),
      ),
    )
    .limit(1);
  return member;
}

export async function findActiveWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
      ),
    )
    .limit(1);
  return member;
}

export async function addProjectMember(input: {
  projectId: string;
  role: "lead" | "member" | "viewer";
  userId: string;
  workspaceId: string;
}) {
  await db
    .insert(projectMembers)
    .values(input)
    .onConflictDoUpdate({
      set: { role: input.role, updatedAt: new Date() },
      target: [projectMembers.projectId, projectMembers.userId],
    });
}

export async function updateProjectMemberRole(input: {
  projectId: string;
  role: "lead" | "member" | "viewer";
  userId: string;
}) {
  const [member] = await db
    .update(projectMembers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.userId),
      ),
    )
    .returning({ userId: projectMembers.userId });
  return member;
}

export async function removeProjectMember(input: {
  projectId: string;
  userId: string;
}) {
  const [member] = await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.userId),
      ),
    )
    .returning({ userId: projectMembers.userId });
  return member;
}
