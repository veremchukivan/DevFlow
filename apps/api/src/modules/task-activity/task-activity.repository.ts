import type { TaskActivityEventType } from "@devflow/shared";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskActivityEvents } from "../../core/db/schema/task-activity-events.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

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

export async function findTaskInProject(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
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
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt)
      )
    )
    .limit(1);

  return task;
}

export async function createTaskActivityEvent(input: {
  actorUserId: string;
  data: Record<string, unknown>;
  eventType: TaskActivityEventType;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [event] = await db
    .insert(taskActivityEvents)
    .values(input)
    .returning({
      id: taskActivityEvents.id
    });

  return event;
}

export async function listTaskActivityEvents(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  return db
    .select({
      actorDisplayName: users.displayName,
      actorId: users.id,
      actorUserId: taskActivityEvents.actorUserId,
      createdAt: taskActivityEvents.createdAt,
      data: taskActivityEvents.data,
      eventType: taskActivityEvents.eventType,
      id: taskActivityEvents.id,
      projectId: taskActivityEvents.projectId,
      taskId: taskActivityEvents.taskId,
      workspaceId: taskActivityEvents.workspaceId
    })
    .from(taskActivityEvents)
    .leftJoin(
      users,
      and(
        eq(users.id, taskActivityEvents.actorUserId),
        isNull(users.deletedAt)
      )
    )
    .where(
      and(
        eq(taskActivityEvents.projectId, input.projectId),
        eq(taskActivityEvents.taskId, input.taskId),
        eq(taskActivityEvents.workspaceId, input.workspaceId)
      )
    )
    .orderBy(asc(taskActivityEvents.createdAt));
}
