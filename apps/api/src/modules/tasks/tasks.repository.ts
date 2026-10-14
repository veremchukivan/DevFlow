import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  sql
} from "drizzle-orm";

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
  filters: {
    statusId?: string;
    priority?: TaskPriority;
    assigneeUserId?: string | "none";
    search?: string;
    archived?: boolean;
    limit: number;
    offset: number;
    sortBy?: "createdAt" | "updatedAt" | "priority" | "number";
    sortOrder?: "asc" | "desc";
  };
}) {
  const f = input.filters ?? {};
  const conditions: SQL[] = [
    eq(tasks.workspaceId, input.workspaceId),
    eq(tasks.projectId, input.projectId),
    isNull(projects.deletedAt)
  ];

  // archived: show only soft-deleted; default: show only active
  if (f.archived === true) {
    conditions.push(isNotNull(tasks.deletedAt));
  } else {
    conditions.push(isNull(tasks.deletedAt));
  }

  if (f.statusId !== undefined) {
    conditions.push(eq(tasks.statusId, f.statusId));
  }

  if (f.priority !== undefined) {
    conditions.push(eq(tasks.priority, f.priority));
  }

  if (f.assigneeUserId === "none") {
    conditions.push(isNull(tasks.assigneeUserId));
  } else if (f.assigneeUserId !== undefined) {
    conditions.push(eq(tasks.assigneeUserId, f.assigneeUserId));
  }

  if (f.search !== undefined) {
    conditions.push(ilike(tasks.title, `%${f.search}%`));
  }

  // Build ORDER BY
  const sortColumn = toSortColumn(f.sortBy ?? "createdAt");
  const orderBy =
    (f.sortOrder ?? "desc") === "asc" ? asc(sortColumn) : desc(sortColumn);

  const where = and(...conditions);
  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId)
      )
    )
    .where(where);

  const rows = await taskSelect()
    .where(where)
    .orderBy(orderBy, desc(tasks.id))
    .limit(f.limit)
    .offset(f.offset);

  return {
    tasks: rows,
    total: totalRow?.total ?? 0
  };
}

function toSortColumn(field: "createdAt" | "updatedAt" | "priority" | "number") {
  switch (field) {
    case "updatedAt":
      return tasks.updatedAt;
    case "priority":
      // Sort priority as: urgent > high > medium > low using CASE
      return sql`CASE ${tasks.priority}
        WHEN 'urgent' THEN 4
        WHEN 'high'   THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 1
        ELSE 0
      END`;
    case "number":
      return tasks.number;
    default:
      return tasks.createdAt;
  }
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

export async function softDeleteTaskInProject(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const now = new Date();
  const [task] = await db
    .update(tasks)
    .set({
      deletedAt: now,
      updatedAt: now
    })
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
