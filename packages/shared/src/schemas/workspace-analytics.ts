import { z } from "zod";

export const workspaceAnalyticsQuerySchema = z.object({
  assigneeUserId: z
    .union([z.uuid(), z.literal("all"), z.literal("unassigned")])
    .optional(),
  period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  projectId: z.union([z.uuid(), z.literal("all")]).optional(),
  sprintId: z
    .union([z.uuid(), z.literal("all"), z.literal("backlog")])
    .optional(),
});

export const workspaceAnalyticsParamsSchema = z.object({
  workspaceId: z.uuid(),
});

const metricSchema = z.object({
  count: z.number().int().nonnegative(),
  name: z.string(),
});

export const workspaceAnalyticsResponseSchema = z.object({
  ai: z.object({
    activeSessions: z.number().int().nonnegative(),
    completedSessions: z.number().int().nonnegative(),
    failedSessions: z.number().int().nonnegative(),
  }),
  cycle: z.object({
    averageCycleHours: z.number().nonnegative().nullable(),
    averageLeadHours: z.number().nonnegative().nullable(),
    completedWithMeasurements: z.number().int().nonnegative(),
  }),
  git: z.object({
    linkedTasks: z.number().int().nonnegative(),
    pipelinesFailing: z.number().int().nonnegative(),
    pullRequests: z.number().int().nonnegative(),
  }),
  statusDistribution: z.array(metricSchema.extend({ color: z.string() })),
  summary: z.object({
    completed: z.number().int().nonnegative(),
    completionRate: z.number().int().min(0).max(100),
    open: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    unassigned: z.number().int().nonnegative(),
  }),
  velocity: z.array(
    z.object({ completed: z.number().int().nonnegative(), date: z.string() }),
  ),
  workload: z.array(
    z.object({
      completed: z.number().int().nonnegative(),
      open: z.number().int().nonnegative(),
      userId: z.uuid(),
      userName: z.string(),
    }),
  ),
});

export type WorkspaceAnalyticsQuery = z.infer<
  typeof workspaceAnalyticsQuerySchema
>;
export type WorkspaceAnalyticsResponse = z.infer<
  typeof workspaceAnalyticsResponseSchema
>;
