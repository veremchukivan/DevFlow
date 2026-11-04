import { z } from "zod";

export const taskWatcherParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskWatcherUserParamsSchema = taskWatcherParamsSchema.extend({
  userId: z.uuid(),
});

export const createTaskWatcherRequestSchema = z.object({
  userId: z.uuid(),
});

export const taskWatcherSchema = z.object({
  createdAt: z.string().datetime(),
  taskId: z.uuid(),
  user: z.object({
    displayName: z.string(),
    id: z.uuid(),
  }),
  userId: z.uuid(),
});

export const taskWatcherListResponseSchema = z.object({
  isWatching: z.boolean(),
  watchers: z.array(taskWatcherSchema),
});

export type TaskWatcherListResponse = z.infer<typeof taskWatcherListResponseSchema>;
export type TaskWatcher = z.infer<typeof taskWatcherSchema>;
