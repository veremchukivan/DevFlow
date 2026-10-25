import { z } from "zod";

export const taskAttachmentsParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskAttachmentParamsSchema = taskAttachmentsParamsSchema.extend({
  attachmentId: z.uuid(),
});

export const taskAttachmentSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.uuid(),
  mimeType: z.string(),
  originalFilename: z.string(),
  projectId: z.uuid(),
  sizeBytes: z.number().int().positive(),
  taskId: z.uuid(),
  uploadedBy: z.object({ displayName: z.string(), id: z.uuid() }).nullable(),
  uploadedByUserId: z.uuid().nullable(),
  workspaceId: z.uuid(),
});

export const taskAttachmentResponseSchema = z.object({
  attachment: taskAttachmentSchema,
});

export const taskAttachmentListResponseSchema = z.object({
  attachments: z.array(taskAttachmentSchema),
});

export type TaskAttachment = z.infer<typeof taskAttachmentSchema>;
export type TaskAttachmentResponse = z.infer<
  typeof taskAttachmentResponseSchema
>;
export type TaskAttachmentListResponse = z.infer<
  typeof taskAttachmentListResponseSchema
>;
