import { z } from "zod";

export const workspaceAutomationRuleTypeSchema = z.enum([
  "children_completed_close_parent",
  "task_transition_assign",
  "parent_completed_close_children",
]);

export const workspaceAutomationOutcomeSchema = z.enum([
  "succeeded",
  "skipped",
  "failed",
]);

export const workspaceAutomationParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export const workspaceAutomationRuleParamsSchema =
  workspaceAutomationParamsSchema.extend({
    ruleId: z.uuid(),
  });

export const workspaceAutomationRuleSchema = z.object({
  configuration: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  id: z.uuid(),
  ruleType: workspaceAutomationRuleTypeSchema,
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const updateWorkspaceAutomationRuleRequestSchema = z
  .object({
    configuration: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((input) => input.configuration !== undefined || input.enabled !== undefined, {
    message: "At least one automation rule field is required",
  });

export const workspaceAutomationRulesResponseSchema = z.object({
  rules: z.array(workspaceAutomationRuleSchema),
});

export const workspaceAutomationRunSchema = z.object({
  actorUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
  id: z.uuid(),
  outcome: workspaceAutomationOutcomeSchema,
  ruleId: z.uuid(),
  summary: z.string(),
  triggerTaskId: z.uuid().nullable(),
});

export const workspaceAutomationRunsResponseSchema = z.object({
  runs: z.array(workspaceAutomationRunSchema),
});

export const workspaceAutomationUsageResponseSchema = z.object({
  enabledRules: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  successfulRuns: z.number().int().nonnegative(),
  totalRules: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
});

export const workspaceAutomationTemplateSchema = z.object({
  description: z.string(),
  ruleType: workspaceAutomationRuleTypeSchema,
  title: z.string(),
});

export const workspaceAutomationTemplatesResponseSchema = z.object({
  templates: z.array(workspaceAutomationTemplateSchema),
});

export type UpdateWorkspaceAutomationRuleRequest = z.infer<
  typeof updateWorkspaceAutomationRuleRequestSchema
>;
