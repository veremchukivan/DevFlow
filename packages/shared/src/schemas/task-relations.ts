import { z } from "zod";

export const taskRelationTypeSchema = z.enum([
  "blocks",
  "relates_to",
  "duplicates",
]);

export const createTaskRelationRequestSchema = z.object({
  relationType: taskRelationTypeSchema,
  targetTaskId: z.uuid(),
});

export const taskRelationsParamsSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskRelationParamsSchema = taskRelationsParamsSchema.extend({
  relationId: z.uuid(),
});

export const taskRelationSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.uuid(),
  relationType: z.enum(["blocks", "is_blocked_by", "relates_to", "duplicates"]),
  task: z.object({
    id: z.uuid(),
    key: z.string(),
    projectId: z.uuid(),
    title: z.string(),
  }),
});

export const taskRelationListResponseSchema = z.object({
  relations: z.array(taskRelationSchema),
});

export type CreateTaskRelationRequest = z.infer<
  typeof createTaskRelationRequestSchema
>;
export type TaskRelationType = z.infer<typeof taskRelationTypeSchema>;
export type TaskRelation = z.infer<typeof taskRelationSchema>;
export type TaskRelationListResponse = z.infer<
  typeof taskRelationListResponseSchema
>;
