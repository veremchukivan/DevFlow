import type {
  CreateTaskCommentRequest,
  UpdateTaskCommentRequest
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import {
  canCreateTaskComment,
  canDeleteTaskComment,
  canUpdateTaskComment
} from "./task-comments.policy.js";
import {
  createTaskComment,
  findActiveWorkspaceMembership,
  findTaskCommentById,
  findTaskInProject,
  listTaskComments,
  softDeleteTaskComment,
  updateTaskComment
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

  await recordTaskActivity({
    actorUserId: input.userId,
    data: {
      commentId: comment.id
    },
    eventType: "task_comment_created",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });

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

export async function updateComment(input: {
  commentId: string;
  input: UpdateTaskCommentRequest;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);
  await requireTask(input);

  const comment = await requireComment(input);

  if (
    !canUpdateTaskComment(
      membership.role,
      comment.authorUserId === input.userId
    )
  ) {
    throw new AppError(
      403,
      "TASK_COMMENT_UPDATE_FORBIDDEN",
      "You cannot update this task comment"
    );
  }

  const updatedComment = await updateTaskComment({
    body: input.input.body,
    commentId: input.commentId,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });

  if (!updatedComment) {
    throw new AppError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found");
  }

  await recordTaskActivity({
    actorUserId: input.userId,
    data: {
      commentId: input.commentId
    },
    eventType: "task_comment_updated",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });

  return updatedComment;
}

export async function deleteComment(input: {
  commentId: string;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);
  await requireTask(input);

  const comment = await requireComment(input);

  if (
    !canDeleteTaskComment(
      membership.role,
      comment.authorUserId === input.userId
    )
  ) {
    throw new AppError(
      403,
      "TASK_COMMENT_DELETE_FORBIDDEN",
      "You cannot delete this task comment"
    );
  }

  const deletedComment = await softDeleteTaskComment(input);

  if (!deletedComment) {
    throw new AppError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found");
  }

  await recordTaskActivity({
    actorUserId: input.userId,
    data: {
      commentId: input.commentId
    },
    eventType: "task_comment_deleted",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });
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

async function requireComment(input: {
  commentId: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const comment = await findTaskCommentById(input);

  if (!comment) {
    throw new AppError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found");
  }

  return comment;
}
