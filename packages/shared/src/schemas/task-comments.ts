import { z } from "zod";

import { pageInfoSchema } from "./pagination.js";

export const createTaskCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const updateTaskCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const taskCommentsParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid()
});

export const taskCommentParamsSchema = taskCommentsParamsSchema.extend({
  commentId: z.uuid()
});

export const taskCommentAuthorSchema = z.object({
  displayName: z.string(),
  id: z.uuid()
});

export const taskCommentSchema = z.object({
  author: taskCommentAuthorSchema.nullable(),
  authorUserId: z.uuid().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  id: z.uuid(),
  projectId: z.uuid(),
  taskId: z.uuid(),
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid()
});

export const taskCommentResponseSchema = z.object({
  comment: taskCommentSchema
});

export const taskCommentListResponseSchema = z.object({
  comments: z.array(taskCommentSchema),
  pageInfo: pageInfoSchema
});

export type CreateTaskCommentRequest = z.infer<
  typeof createTaskCommentRequestSchema
>;
export type UpdateTaskCommentRequest = z.infer<
  typeof updateTaskCommentRequestSchema
>;
export type TaskComment = z.infer<typeof taskCommentSchema>;
export type TaskCommentResponse = z.infer<typeof taskCommentResponseSchema>;
export type TaskCommentListResponse = z.infer<
  typeof taskCommentListResponseSchema
>;
