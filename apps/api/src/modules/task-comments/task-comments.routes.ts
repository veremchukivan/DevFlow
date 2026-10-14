import {
  createTaskCommentRequestSchema,
  taskCommentParamsSchema,
  taskCommentsParamsSchema,
  updateTaskCommentRequestSchema,
  type TaskCommentListResponse,
  type TaskCommentResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment
} from "./task-comments.service.js";

export const taskCommentsRouter = Router({ mergeParams: true });

taskCommentsRouter.use(requireAuth);

taskCommentsRouter.post("/", async (req, res) => {
  const params = taskCommentsParamsSchema.parse(req.params);
  const input = createTaskCommentRequestSchema.parse(req.body);
  const comment = await createComment({
    input,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(201).json(toTaskCommentResponse(comment));
});

taskCommentsRouter.get("/", async (req, res) => {
  const params = taskCommentsParamsSchema.parse(req.params);
  const comments = await listComments({
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    comments: comments.map(toTaskCommentDto)
  } satisfies TaskCommentListResponse);
});

taskCommentsRouter.patch("/:commentId", async (req, res) => {
  const params = taskCommentParamsSchema.parse(req.params);
  const input = updateTaskCommentRequestSchema.parse(req.body);
  const comment = await updateComment({
    commentId: params.commentId,
    input,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toTaskCommentResponse(comment));
});

taskCommentsRouter.delete("/:commentId", async (req, res) => {
  const params = taskCommentParamsSchema.parse(req.params);
  await deleteComment({
    commentId: params.commentId,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toTaskCommentResponse(
  comment: Parameters<typeof toTaskCommentDto>[0]
): TaskCommentResponse {
  return {
    comment: toTaskCommentDto(comment)
  };
}

function toTaskCommentDto(comment: {
  authorDisplayName: string | null;
  authorId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  id: string;
  projectId: string;
  taskId: string;
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    author:
      comment.authorId && comment.authorDisplayName
        ? {
            displayName: comment.authorDisplayName,
            id: comment.authorId
          }
        : null,
    authorUserId: comment.authorUserId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    projectId: comment.projectId,
    taskId: comment.taskId,
    updatedAt: comment.updatedAt.toISOString(),
    workspaceId: comment.workspaceId
  };
}
