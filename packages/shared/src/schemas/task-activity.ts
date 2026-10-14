import { z } from "zod";

export const taskActivityEventTypeSchema = z.enum([
  "task_created",
  "task_updated",
  "task_deleted",
  "task_comment_created",
  "task_comment_updated",
  "task_comment_deleted"
]);

export const taskActivityParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid()
});

export const taskActivityActorSchema = z.object({
  displayName: z.string(),
  id: z.uuid()
});

export const taskActivityEventSchema = z.object({
  actor: taskActivityActorSchema.nullable(),
  actorUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
  eventType: taskActivityEventTypeSchema,
  id: z.uuid(),
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid()
});

export const taskActivityEventListResponseSchema = z.object({
  events: z.array(taskActivityEventSchema)
});

export type TaskActivityEventType = z.infer<
  typeof taskActivityEventTypeSchema
>;
export type TaskActivityEvent = z.infer<typeof taskActivityEventSchema>;
export type TaskActivityEventListResponse = z.infer<
  typeof taskActivityEventListResponseSchema
>;
