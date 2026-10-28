import type {
  CreateTaskCommentRequest,
  PaginationQuery,
  UpdateTaskCommentRequest,
} from "@devflow/shared";

import { db } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import { sanitizeRichText } from "../../core/rich-text/sanitize.js";
import { buildPageInfo } from "../../core/pagination.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import { notifyTaskCommented } from "../notifications/notifications.service.js";
import {
  canCreateTaskComment,
  canDeleteTaskComment,
  canUpdateTaskComment,
} from "./task-comments.policy.js";
import {
  createTaskComment,
  findActiveWorkspaceMembership,
  findTaskCommentById,
  findTaskInProject,
  listTaskComments,
  softDeleteTaskComment,
  updateTaskComment,
} from "./task-comments.repository.js";
import { listCommentAttachments } from "../task-attachments/task-attachments.repository.js";

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
      "You cannot comment on tasks in this workspace",
    );
  }

  const task = await requireTask(input);

  const comment = await db.transaction(async (tx) => {
    const comment = await createTaskComment(
      {
        authorUserId: input.userId,
        body: sanitizeRichText(input.input.body, "Comment"),
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    if (!comment) {
      throw new Error("Failed to load task comment");
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        data: {
          commentId: comment.id,
        },
        eventType: "task_comment_created",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    return comment;
  });
  await notifyTaskCommented({
    actorUserId: input.userId,
    projectId: input.projectId,
    recipientUserId: task.assigneeUserId,
    taskId: input.taskId,
    taskKey: `${task.projectKey}-${task.number}`,
    taskTitle: task.title,
    workspaceId: input.workspaceId,
  });
  return (await hydrateComments([comment], input))[0]!;
}

export async function listComments(input: {
  pagination: PaginationQuery;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireTask(input);

  const result = await listTaskComments({
    pagination: input.pagination,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });

  return {
    comments: await hydrateComments(result.items, input),
    pageInfo: buildPageInfo({ ...input.pagination, total: result.total }),
  };
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
      comment.authorUserId === input.userId,
    )
  ) {
    throw new AppError(
      403,
      "TASK_COMMENT_UPDATE_FORBIDDEN",
      "You cannot update this task comment",
    );
  }

  return db.transaction(async (tx) => {
    const updatedComment = await updateTaskComment(
      {
        body: sanitizeRichText(input.input.body, "Comment"),
        commentId: input.commentId,
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    if (!updatedComment) {
      throw new AppError(
        404,
        "TASK_COMMENT_NOT_FOUND",
        "Task comment not found",
      );
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        data: {
          commentId: input.commentId,
        },
        eventType: "task_comment_updated",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    return hydrateComments([updatedComment], input).then(
      (comments) => comments[0]!,
    );
  });
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
      comment.authorUserId === input.userId,
    )
  ) {
    throw new AppError(
      403,
      "TASK_COMMENT_DELETE_FORBIDDEN",
      "You cannot delete this task comment",
    );
  }

  return db.transaction(async (tx) => {
    const deletedComment = await softDeleteTaskComment(input, tx);

    if (!deletedComment) {
      throw new AppError(
        404,
        "TASK_COMMENT_NOT_FOUND",
        "Task comment not found",
      );
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        data: {
          commentId: input.commentId,
        },
        eventType: "task_comment_deleted",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );
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

async function hydrateComments<
  T extends { id: string; projectId: string; taskId: string; workspaceId: string },
>(comments: T[], scope: { projectId: string; taskId: string; workspaceId: string }) {
  const attachments = await listCommentAttachments({
    ...scope,
    commentIds: comments.map((comment) => comment.id),
  });
  const attachmentsByCommentId = new Map<string, typeof attachments>();

  for (const attachment of attachments) {
    if (!attachment.commentId) continue;
    const current = attachmentsByCommentId.get(attachment.commentId) ?? [];
    current.push(attachment);
    attachmentsByCommentId.set(attachment.commentId, current);
  }

  return comments.map((comment) => ({
    ...comment,
    attachments: attachmentsByCommentId.get(comment.id) ?? [],
  }));
}
