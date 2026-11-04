import { z } from "zod";

export const workspaceAutomationRuleTypeSchema = z.string().min(1).max(64);
export const workspaceAutomationTriggerSchema = z.enum([
  "task_created",
  "task_status_changed",
  "task_due",
  "comment_created",
  "pull_request_merged",
]);
export const workspaceAutomationOutcomeSchema = z.enum(["succeeded", "skipped", "failed"]);
export const workspaceAutomationActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign"), userId: z.uuid() }),
  z.object({ type: z.literal("change_status"), statusId: z.uuid() }),
  z.object({ type: z.literal("create_subtask"), title: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("notify"), userId: z.uuid().optional() }),
  z.object({ type: z.literal("create_call"), title: z.string().trim().min(1).max(160), startsInHours: z.number().int().min(0).max(8760).default(24) }),
  z.object({ type: z.literal("add_to_sprint"), sprintId: z.uuid() }),
]);
export const workspaceAutomationConditionsSchema = z.object({
  assigneeUserId: z.uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  statusId: z.uuid().optional(),
  taskType: z.enum(["epic", "bug", "feature", "story", "task"]).optional(),
}).strict();

export const workspaceAutomationParamsSchema = z.object({ workspaceId: z.uuid() });
export const workspaceAutomationRuleParamsSchema = workspaceAutomationParamsSchema.extend({ ruleId: z.uuid() });
export const workspaceAutomationRunParamsSchema = workspaceAutomationRuleParamsSchema.extend({ runId: z.uuid() });

export const workspaceAutomationRuleSchema = z.object({
  actions: z.array(workspaceAutomationActionSchema),
  conditions: workspaceAutomationConditionsSchema,
  configuration: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  enabled: z.boolean(),
  id: z.uuid(),
  lastError: z.string().nullable(),
  name: z.string(),
  ruleType: workspaceAutomationRuleTypeSchema,
  triggerType: workspaceAutomationTriggerSchema,
  updatedAt: z.string().datetime(),
});

export const createWorkspaceAutomationRuleRequestSchema = z.object({
  actions: z.array(workspaceAutomationActionSchema).min(1).max(8),
  conditions: workspaceAutomationConditionsSchema.default({}),
  enabled: z.boolean().default(true),
  name: z.string().trim().min(1).max(160),
  triggerType: workspaceAutomationTriggerSchema,
});
export const updateWorkspaceAutomationRuleRequestSchema = z.object({
  actions: z.array(workspaceAutomationActionSchema).min(1).max(8).optional(),
  conditions: workspaceAutomationConditionsSchema.optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  triggerType: workspaceAutomationTriggerSchema.optional(),
}).refine((input) => Object.keys(input).length > 0, { message: "At least one automation rule field is required" });

export const workspaceAutomationRulesResponseSchema = z.object({ rules: z.array(workspaceAutomationRuleSchema) });
export const workspaceAutomationRuleResponseSchema = z.object({ rule: workspaceAutomationRuleSchema });
export const workspaceAutomationRunSchema = z.object({ actorUserId: z.uuid().nullable(), createdAt: z.string().datetime(), data: z.record(z.string(), z.unknown()), id: z.uuid(), outcome: workspaceAutomationOutcomeSchema, ruleId: z.uuid(), summary: z.string(), triggerTaskId: z.uuid().nullable() });
export const workspaceAutomationRunsResponseSchema = z.object({ runs: z.array(workspaceAutomationRunSchema) });
export const workspaceAutomationUsageResponseSchema = z.object({ enabledRules: z.number().int().nonnegative(), failedRuns: z.number().int().nonnegative(), successfulRuns: z.number().int().nonnegative(), totalRules: z.number().int().nonnegative(), totalRuns: z.number().int().nonnegative() });
export const workspaceAutomationTemplateSchema = z.object({ description: z.string(), ruleType: workspaceAutomationRuleTypeSchema, title: z.string() });
export const workspaceAutomationTemplatesResponseSchema = z.object({ templates: z.array(workspaceAutomationTemplateSchema) });

export type CreateWorkspaceAutomationRuleRequest = z.infer<typeof createWorkspaceAutomationRuleRequestSchema>;
export type UpdateWorkspaceAutomationRuleRequest = z.infer<typeof updateWorkspaceAutomationRuleRequestSchema>;
export type WorkspaceAutomationRulesResponse = z.infer<typeof workspaceAutomationRulesResponseSchema>;
export type WorkspaceAutomationRunsResponse = z.infer<typeof workspaceAutomationRunsResponseSchema>;
