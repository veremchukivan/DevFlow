import {
  createTaskCommentRequestSchema,
  paginationQuerySchema,
  taskAttachmentResponseSchema,
  taskCommentParamsSchema,
  taskCommentsParamsSchema,
  updateTaskCommentRequestSchema,
  type TaskCommentListResponse,
  type TaskCommentResponse
} from "@devflow/shared";
import { Router } from "express";

import { AppError } from "../../core/errors/app-error.js";
import { sanitizeRichText } from "../../core/rich-text/sanitize.js";
import { taskAttachmentUpload } from "../../core/uploads/images.js";
import { addCommentAttachment } from "../task-attachments/task-attachments.service.js";

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
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listComments({
    pagination,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    comments: result.comments.map(toTaskCommentDto),
    pageInfo: result.pageInfo
  } satisfies TaskCommentListResponse);
});

taskCommentsRouter.post(
  "/:commentId/attachments",
  taskAttachmentUpload.single("file"),
  async (req, res) => {
    const params = taskCommentParamsSchema.parse(req.params);
    if (!req.file) {
      throw new AppError(
        400,
        "COMMENT_ATTACHMENT_REQUIRED",
        "Choose an image or video to upload",
      );
    }
    const attachment = await addCommentAttachment({
      ...params,
      file: req.file,
      userId: getAuthenticatedUserId(req),
    });
    res.status(201).json({
      attachment: toTaskAttachmentDto(attachment),
    } satisfies typeof taskAttachmentResponseSchema._output);
  },
);

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
  attachments: Array<Parameters<typeof toTaskAttachmentDto>[0]>;
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
    attachments: comment.attachments.map(toTaskAttachmentDto),
    body: sanitizeRichText(comment.body, "Comment"),
    createdAt: comment.createdAt.toISOString(),
    id: comment.id,
    projectId: comment.projectId,
    taskId: comment.taskId,
    updatedAt: comment.updatedAt.toISOString(),
    workspaceId: comment.workspaceId
  };
}

function toTaskAttachmentDto(attachment: {
  commentId: string | null;
  createdAt: Date;
  id: string;
  mimeType: string;
  originalFilename: string;
  projectId: string;
  sizeBytes: number;
  taskId: string;
  uploadedBy?: { displayName: string | null; id: string | null } | null;
  uploadedByUserId: string | null;
  workspaceId: string;
}) {
  return {
    commentId: attachment.commentId,
    createdAt: attachment.createdAt.toISOString(),
    id: attachment.id,
    mimeType: attachment.mimeType,
    originalFilename: attachment.originalFilename,
    projectId: attachment.projectId,
    sizeBytes: attachment.sizeBytes,
    taskId: attachment.taskId,
    uploadedBy:
      attachment.uploadedBy?.id && attachment.uploadedBy.displayName
        ? {
            displayName: attachment.uploadedBy.displayName,
            id: attachment.uploadedBy.id,
          }
        : null,
    uploadedByUserId: attachment.uploadedByUserId,
    workspaceId: attachment.workspaceId,
  };
}
