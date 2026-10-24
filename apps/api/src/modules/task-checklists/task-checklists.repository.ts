import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { type DbExecutor, db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskChecklistItems } from "../../core/db/schema/task-checklist-items.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type TaskScope = {
  projectId: string;
  taskId: string;
  workspaceId: string;
};

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
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
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);

  return task;
}

export async function listTaskChecklistItems(input: TaskScope) {
  return db
    .select()
    .from(taskChecklistItems)
    .where(taskChecklistConditions(input))
    .orderBy(asc(taskChecklistItems.position), asc(taskChecklistItems.id));
}

export async function findTaskChecklistItemById(
  input: TaskScope & { itemId: string },
  executor: DbExecutor = db,
) {
  const [item] = await executor
    .select()
    .from(taskChecklistItems)
    .where(
      and(
        taskChecklistConditions(input),
        eq(taskChecklistItems.id, input.itemId),
      ),
    )
    .limit(1);

  return item;
}

export async function createTaskChecklistItem(
  input: TaskScope & { content: string },
  executor: DbExecutor = db,
) {
  const [positionRow] = await executor
    .select({
      position: sql<number>`coalesce(max(${taskChecklistItems.position}), 0)`,
    })
    .from(taskChecklistItems)
    .where(taskChecklistConditions(input));
  const [item] = await executor
    .insert(taskChecklistItems)
    .values({ ...input, position: (positionRow?.position ?? 0) + 1 })
    .returning();

  if (!item) throw new Error("Failed to create task checklist item");
  return item;
}

export async function updateTaskChecklistItem(
  input: TaskScope & {
    content?: string;
    isCompleted?: boolean;
    itemId: string;
  },
  executor: DbExecutor = db,
) {
  const [item] = await executor
    .update(taskChecklistItems)
    .set({
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.isCompleted === undefined
        ? {}
        : { isCompleted: input.isCompleted }),
      updatedAt: new Date(),
    })
    .where(
      and(
        taskChecklistConditions(input),
        eq(taskChecklistItems.id, input.itemId),
      ),
    )
    .returning();

  return item;
}

export async function deleteTaskChecklistItem(
  input: TaskScope & { itemId: string },
) {
  const [item] = await db
    .delete(taskChecklistItems)
    .where(
      and(
        taskChecklistConditions(input),
        eq(taskChecklistItems.id, input.itemId),
      ),
    )
    .returning({ id: taskChecklistItems.id });

  return item;
}

function taskChecklistConditions(input: TaskScope) {
  return and(
    eq(taskChecklistItems.workspaceId, input.workspaceId),
    eq(taskChecklistItems.projectId, input.projectId),
    eq(taskChecklistItems.taskId, input.taskId),
  );
}
