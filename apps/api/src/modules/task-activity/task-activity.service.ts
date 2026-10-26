import type { PaginationQuery, TaskActivityEventType } from "@devflow/shared";

import type { DbExecutor } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  createTaskActivityEvent,
  findActiveWorkspaceMembership,
  findProjectInWorkspace,
  findTaskInProject,
  listTaskActivityEvents,
  listProjectActivityEvents,
} from "./task-activity.repository.js";

export async function listProjectActivity(input: {
  pagination: PaginationQuery;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireProject(input);
  const result = await listProjectActivityEvents(input);

  return {
    events: result.items,
    pageInfo: buildPageInfo({ ...input.pagination, total: result.total }),
  };
}

export async function recordTaskActivity(
  input: {
    actorUserId: string;
    data?: Record<string, unknown>;
    eventType: TaskActivityEventType;
    projectId: string;
    taskId: string;
    workspaceId: string;
  },
  executor?: DbExecutor,
) {
  await createTaskActivityEvent(
    {
      actorUserId: input.actorUserId,
      data: input.data ?? {},
      eventType: input.eventType,
      projectId: input.projectId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
    },
    executor,
  );
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
    workspaceId: input.workspaceId,
  });

  return {
    events: result.items,
    pageInfo: buildPageInfo({ ...input.pagination, total: result.total }),
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

async function requireProject(input: {
  projectId: string;
  workspaceId: string;
}) {
  const project = await findProjectInWorkspace(input);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  return project;
}
