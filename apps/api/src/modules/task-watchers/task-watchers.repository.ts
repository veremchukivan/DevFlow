import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { taskWatchers } from "../../core/db/schema/task-watchers.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type TaskScope = { projectId: string; taskId: string; workspaceId: string };

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return membership;
}

export async function findTaskInProject(input: TaskScope) {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return task;
}

export async function listTaskWatchers(input: TaskScope) {
  return db
    .select({
      createdAt: taskWatchers.createdAt,
      taskId: taskWatchers.taskId,
      userDisplayName: users.displayName,
      userId: taskWatchers.userId,
    })
    .from(taskWatchers)
    .innerJoin(users, eq(users.id, taskWatchers.userId))
    .where(
      and(
        eq(taskWatchers.workspaceId, input.workspaceId),
        eq(taskWatchers.projectId, input.projectId),
        eq(taskWatchers.taskId, input.taskId),
      ),
    )
    .orderBy(asc(users.displayName), asc(taskWatchers.id));
}

export async function listTaskWatcherUserIds(input: TaskScope) {
  const rows = await db
    .select({ userId: taskWatchers.userId })
    .from(taskWatchers)
    .where(
      and(
        eq(taskWatchers.workspaceId, input.workspaceId),
        eq(taskWatchers.projectId, input.projectId),
        eq(taskWatchers.taskId, input.taskId),
      ),
    );
  return rows.map((row) => row.userId);
}

export async function createTaskWatcher(input: TaskScope & { userId: string }) {
  await db
    .insert(taskWatchers)
    .values(input)
    .onConflictDoNothing({
      target: [
        taskWatchers.workspaceId,
        taskWatchers.projectId,
        taskWatchers.taskId,
        taskWatchers.userId,
      ],
    });
}

export async function deleteTaskWatcher(input: TaskScope & { userId: string }) {
  await db
    .delete(taskWatchers)
    .where(
      and(
        eq(taskWatchers.workspaceId, input.workspaceId),
        eq(taskWatchers.projectId, input.projectId),
        eq(taskWatchers.taskId, input.taskId),
        eq(taskWatchers.userId, input.userId),
      ),
    );
}
