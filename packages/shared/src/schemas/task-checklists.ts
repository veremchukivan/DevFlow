import { z } from "zod";

export const taskChecklistParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskChecklistItemParamsSchema = taskChecklistParamsSchema.extend({
  itemId: z.uuid(),
});

export const createTaskChecklistItemRequestSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

export const updateTaskChecklistItemRequestSchema = z
  .object({
    content: z.string().trim().min(1).max(500).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one checklist item field is required",
  });

export const taskChecklistItemSchema = z.object({
  content: z.string(),
  createdAt: z.string().datetime(),
  id: z.uuid(),
  isCompleted: z.boolean(),
  position: z.number().int().positive(),
  projectId: z.uuid(),
  taskId: z.uuid(),
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid(),
});

export const taskChecklistSummarySchema = z.object({
  completed: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const taskChecklistResponseSchema = z.object({
  item: taskChecklistItemSchema,
});

export const taskChecklistListResponseSchema = z.object({
  items: z.array(taskChecklistItemSchema),
  progress: taskChecklistSummarySchema,
});

export type CreateTaskChecklistItemRequest = z.infer<
  typeof createTaskChecklistItemRequestSchema
>;
export type UpdateTaskChecklistItemRequest = z.infer<
  typeof updateTaskChecklistItemRequestSchema
>;
export type TaskChecklistItem = z.infer<typeof taskChecklistItemSchema>;
export type TaskChecklistResponse = z.infer<typeof taskChecklistResponseSchema>;
export type TaskChecklistListResponse = z.infer<
  typeof taskChecklistListResponseSchema
>;
