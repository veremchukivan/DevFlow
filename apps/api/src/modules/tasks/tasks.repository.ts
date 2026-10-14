import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { projects } from "../../core/db/schema/projects.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type TaskPriority = "low" | "medium" | "high" | "urgent";

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

export async function findActiveWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const [member] = await db
    .select({
      userId: workspaceMembers.userId
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active")
      )
    )
    .limit(1);

  return member;
}

export async function findProjectInWorkspace(input: {
  projectId: string;
  workspaceId: string;
}) {
  const [project] = await db
    .select({
      id: projects.id,
      key: projects.key,
      workspaceId: projects.workspaceId
    })
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

export async function findProjectStatusInProject(input: {
  projectId: string;
  statusId: string;
  workspaceId: string;
}) {
  const [status] = await db
    .select()
    .from(projectStatuses)
    .where(
      and(
        eq(projectStatuses.id, input.statusId),
        eq(projectStatuses.projectId, input.projectId),
        eq(projectStatuses.workspaceId, input.workspaceId)
      )
    )
    .limit(1);

  return status;
}

export async function findDefaultProjectStatus(input: {
  projectId: string;
  workspaceId: string;
}) {
  const [status] = await db
    .select()
    .from(projectStatuses)
    .where(
      and(
        eq(projectStatuses.projectId, input.projectId),
        eq(projectStatuses.workspaceId, input.workspaceId),
        eq(projectStatuses.category, "todo"),
        eq(projectStatuses.isDefault, true)
      )
    )
    .orderBy(projectStatuses.position)
    .limit(1);

  return status;
}

export async function createTaskWithNextNumber(input: {
  assigneeUserId?: string;
  description?: string;
  priority?: TaskPriority;
  projectId: string;
  reporterUserId: string;
  statusId: string;
  title: string;
  workspaceId: string;
}) {
  return db.transaction(async (tx) => {
    const [nextNumber] = await tx
      .select({
        value: sql<number>`coalesce(max(${tasks.number}), 0) + 1`
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, input.workspaceId),
          eq(tasks.projectId, input.projectId)
        )
      );

    const values = {
      number: nextNumber?.value ?? 1,
      projectId: input.projectId,
      reporterUserId: input.reporterUserId,
      statusId: input.statusId,
      title: input.title,
      workspaceId: input.workspaceId,
      ...(input.assigneeUserId ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.priority ? { priority: input.priority } : {})
    };

    const [task] = await tx
      .insert(tasks)
      .values(values)
      .returning();

    if (!task) {
      throw new Error("Failed to create task");
    }

    return task;
  });
}

export async function listTasksForProject(input: {
  projectId: string;
  workspaceId: string;
}) {
  return taskSelect()
    .where(
      and(
        eq(tasks.workspaceId, input.workspaceId),
        eq(tasks.projectId, input.projectId),
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt)
      )
    )
    .orderBy(desc(tasks.createdAt));
}

export async function findTaskInProject(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await taskSelect()
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.workspaceId, input.workspaceId),
        eq(tasks.projectId, input.projectId),
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt)
      )
    )
    .limit(1);

  return task;
}

export async function updateTaskInProject(input: {
  assigneeUserId?: string | null;
  description?: string | null;
  priority?: TaskPriority;
  projectId: string;
  statusId?: string;
  taskId: string;
  title?: string;
  workspaceId: string;
}) {
  const [task] = await db
    .update(tasks)
    .set(toTaskUpdateValues(input))
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.workspaceId, input.workspaceId),
        eq(tasks.projectId, input.projectId),
        isNull(tasks.deletedAt)
      )
    )
    .returning();

  return task;
}

function taskSelect() {
  return db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      createdAt: tasks.createdAt,
      description: tasks.description,
      id: tasks.id,
      number: tasks.number,
      priority: tasks.priority,
      projectId: tasks.projectId,
      projectKey: projects.key,
      reporterUserId: tasks.reporterUserId,
      statusId: tasks.statusId,
      status: {
        category: projectStatuses.category,
        color: projectStatuses.color,
        id: projectStatuses.id,
        name: projectStatuses.name,
        position: projectStatuses.position,
        projectId: projectStatuses.projectId,
        workspaceId: projectStatuses.workspaceId
      },
      title: tasks.title,
      updatedAt: tasks.updatedAt,
      workspaceId: tasks.workspaceId
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId)
      )
    )
    .innerJoin(
      projectStatuses,
      and(
        eq(projectStatuses.id, tasks.statusId),
        eq(projectStatuses.projectId, tasks.projectId),
        eq(projectStatuses.workspaceId, tasks.workspaceId)
      )
    );
}

function toTaskUpdateValues(input: {
  assigneeUserId?: string | null;
  description?: string | null;
  priority?: TaskPriority;
  statusId?: string;
  title?: string;
}) {
  const values: {
    assigneeUserId?: string | null;
    description?: string | null;
    priority?: TaskPriority;
    statusId?: string;
    title?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.assigneeUserId !== undefined) {
    values.assigneeUserId = input.assigneeUserId;
  }

  if (input.description !== undefined) {
    values.description = input.description;
  }

  if (input.priority) {
    values.priority = input.priority;
  }

  if (input.statusId) {
    values.statusId = input.statusId;
  }

  if (input.title) {
    values.title = input.title;
  }

  return values;
}
