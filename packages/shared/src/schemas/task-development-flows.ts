import { z } from "zod";

import { taskParamsSchema, taskUserSchema } from "./tasks.js";

export const developmentFlowStateSchema = z.enum([
  "idea",
  "planning",
  "approval",
  "ready",
  "in_progress",
  "review",
  "done",
]);
export const developmentFlowCiStatusSchema = z.enum([
  "not_configured",
  "pending",
  "passing",
  "failing",
]);
export const developmentFlowSessionStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "failed",
]);

export const taskDevelopmentFlowParamsSchema = taskParamsSchema;
export const taskDevelopmentFlowSessionParamsSchema = taskParamsSchema.extend({
  sessionId: z.uuid(),
});

const compactTextSchema = z.string().trim().min(1).max(20_000);

export const createTaskDevelopmentFlowRequestSchema = z.object({
  acceptanceCriteria: z.array(z.string().trim().min(1).max(2_000)).max(50).default([]),
});

export const updateTaskDevelopmentFlowRequestSchema = z
  .object({
    acceptanceCriteria: z.array(z.string().trim().min(1).max(2_000)).max(50).optional(),
    branchName: z.string().trim().min(1).max(255).nullable().optional(),
    ciStatus: developmentFlowCiStatusSchema.optional(),
    implementationPlan: compactTextSchema.nullable().optional(),
    pullRequestUrl: z.url().max(2_048).nullable().optional(),
    summary: compactTextSchema.nullable().optional(),
    testInstructions: compactTextSchema.nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one development flow field is required",
  });

export const transitionTaskDevelopmentFlowRequestSchema = z.object({
  state: developmentFlowStateSchema,
});

export const rejectTaskDevelopmentFlowRequestSchema = z.object({
  comment: compactTextSchema,
});

export const createTaskDevelopmentFlowSessionRequestSchema = z.object({
  agentName: z.string().trim().min(1).max(120).optional(),
  client: z.string().trim().min(1).max(80),
});

export const updateTaskDevelopmentFlowSessionRequestSchema = z
  .object({
    status: developmentFlowSessionStatusSchema.optional(),
    summary: compactTextSchema.nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one session field is required",
  });

export const taskDevelopmentFlowSessionSchema = z.object({
  agentName: z.string().nullable(),
  client: z.string(),
  createdAt: z.string().datetime(),
  developmentFlowId: z.uuid(),
  endedAt: z.string().datetime().nullable(),
  id: z.uuid(),
  startedAt: z.string().datetime(),
  startedBy: taskUserSchema,
  startedByUserId: z.uuid(),
  status: developmentFlowSessionStatusSchema,
  summary: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const taskDevelopmentFlowSchema = z.object({
  acceptanceCriteria: z.array(z.string()),
  branchName: z.string().nullable(),
  ciStatus: developmentFlowCiStatusSchema,
  createdAt: z.string().datetime(),
  id: z.uuid(),
  implementationPlan: z.string().nullable(),
  isEnabled: z.boolean(),
  planApprovedAt: z.string().datetime().nullable(),
  planApprovedByUserId: z.uuid().nullable(),
  pullRequestUrl: z.url().nullable(),
  reviewApprovedAt: z.string().datetime().nullable(),
  reviewApprovedByUserId: z.uuid().nullable(),
  state: developmentFlowStateSchema,
  summary: z.string().nullable(),
  taskId: z.uuid(),
  testInstructions: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const taskDevelopmentFlowResponseSchema = z.object({
  flow: taskDevelopmentFlowSchema,
});
export const taskDevelopmentFlowDetailsResponseSchema = z.object({
  flow: taskDevelopmentFlowSchema.nullable(),
  sessions: z.array(taskDevelopmentFlowSessionSchema),
});
export const taskDevelopmentFlowSessionResponseSchema = z.object({
  session: taskDevelopmentFlowSessionSchema,
});

export type CreateTaskDevelopmentFlowRequest = z.infer<
  typeof createTaskDevelopmentFlowRequestSchema
>;
export type UpdateTaskDevelopmentFlowRequest = z.infer<
  typeof updateTaskDevelopmentFlowRequestSchema
>;
export type TaskDevelopmentFlow = z.infer<typeof taskDevelopmentFlowSchema>;
export type TaskDevelopmentFlowDetailsResponse = z.infer<
  typeof taskDevelopmentFlowDetailsResponseSchema
>;
export type TaskDevelopmentFlowResponse = z.infer<
  typeof taskDevelopmentFlowResponseSchema
>;
export type TaskDevelopmentFlowSession = z.infer<
  typeof taskDevelopmentFlowSessionSchema
>;
export type TaskDevelopmentFlowSessionResponse = z.infer<
  typeof taskDevelopmentFlowSessionResponseSchema
>;
