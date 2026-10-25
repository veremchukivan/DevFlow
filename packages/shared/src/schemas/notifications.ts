import { z } from "zod";

import { pageInfoSchema, paginationQuerySchema } from "./pagination.js";

export const notificationTypeSchema = z.enum([
  "task_assigned",
  "task_commented",
]);

export const notificationSchema = z.object({
  actor: z.object({ displayName: z.string(), id: z.uuid() }).nullable(),
  actorUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  id: z.uuid(),
  projectId: z.uuid(),
  readAt: z.string().datetime().nullable(),
  taskId: z.uuid(),
  taskKey: z.string(),
  taskTitle: z.string(),
  type: notificationTypeSchema,
  workspaceId: z.uuid(),
});

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  pageInfo: pageInfoSchema,
  unreadCount: z.number().int().min(0),
});

export const notificationParamsSchema = z.object({ notificationId: z.uuid() });

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
