import { z } from "zod";

export const taskTimeEntryParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskTimeEntryIdParamsSchema = taskTimeEntryParamsSchema.extend({
  entryId: z.uuid(),
});

export const createManualTaskTimeEntryRequestSchema = z.object({
  description: z.string().trim().max(1000).optional(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  startedAt: z.string().datetime(),
});

export const taskTimeEntryUserSchema = z.object({
  displayName: z.string(),
  id: z.uuid(),
});

export const taskTimeEntrySchema = z.object({
  createdAt: z.string().datetime(),
  description: z.string().nullable(),
  durationMinutes: z.number().int().nonnegative(),
  id: z.uuid(),
  projectId: z.uuid(),
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().nullable(),
  taskId: z.uuid(),
  updatedAt: z.string().datetime(),
  user: taskTimeEntryUserSchema,
  userId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskTimeEntryListResponseSchema = z.object({
  entries: z.array(taskTimeEntrySchema),
  summary: z.object({
    activeEntry: taskTimeEntrySchema.nullable(),
    estimateMinutes: z.number().int().nonnegative().nullable(),
    loggedMinutes: z.number().int().nonnegative(),
    remainingMinutes: z.number().int().nullable(),
  }),
});

export const taskTimeEntryResponseSchema = z.object({
  entry: taskTimeEntrySchema,
});

export type CreateManualTaskTimeEntryRequest = z.infer<
  typeof createManualTaskTimeEntryRequestSchema
>;
export type TaskTimeEntry = z.infer<typeof taskTimeEntrySchema>;
export type TaskTimeEntryListResponse = z.infer<
  typeof taskTimeEntryListResponseSchema
>;
export type TaskTimeEntryResponse = z.infer<typeof taskTimeEntryResponseSchema>;
