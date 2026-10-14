import type { PaginationQuery, TaskActivityEventType } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  createTaskActivityEvent,
  findActiveWorkspaceMembership,
  findTaskInProject,
  listTaskActivityEvents
} from "./task-activity.repository.js";

export async function recordTaskActivity(input: {
  actorUserId: string;
  data?: Record<string, unknown>;
  eventType: TaskActivityEventType;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  await createTaskActivityEvent({
    actorUserId: input.actorUserId,
    data: input.data ?? {},
    eventType: input.eventType,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });
}

export async function listTaskActivity(input: {
  pagination: PaginationQuery;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireTask(input);

  const result = await listTaskActivityEvents({
    pagination: input.pagination,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });

  return {
    events: result.items,
    pageInfo: buildPageInfo({ ...input.pagination, total: result.total })
  };
}

async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await findActiveWorkspaceMembership(input);

  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  return membership;
}

async function requireTask(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const task = await findTaskInProject(input);

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return task;
}
