import type { CreateTaskCommentRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canCreateTaskComment } from "./task-comments.policy.js";
import {
  createTaskComment,
  findActiveWorkspaceMembership,
  findTaskInProject,
  listTaskComments
} from "./task-comments.repository.js";

export async function createComment(input: {
  input: CreateTaskCommentRequest;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canCreateTaskComment(membership.role)) {
    throw new AppError(
      403,
      "TASK_COMMENT_CREATE_FORBIDDEN",
      "You cannot comment on tasks in this workspace"
    );
  }

  await requireTask(input);

  const comment = await createTaskComment({
    authorUserId: input.userId,
    body: input.input.body,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });

  if (!comment) {
    throw new Error("Failed to load task comment");
  }

  return comment;
}

export async function listComments(input: {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireTask(input);

  return listTaskComments(input);
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
