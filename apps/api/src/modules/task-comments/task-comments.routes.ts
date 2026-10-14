import {
  createTaskCommentRequestSchema,
  taskCommentsParamsSchema,
  type TaskCommentListResponse,
  type TaskCommentResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import { createComment, listComments } from "./task-comments.service.js";

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
