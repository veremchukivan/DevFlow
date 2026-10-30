import {
  updateWorkspaceAutomationRuleRequestSchema,
  workspaceAutomationParamsSchema,
  workspaceAutomationRuleParamsSchema,
  workspaceAutomationRuleResponseSchema,
  workspaceAutomationRulesResponseSchema,
  workspaceAutomationRunsResponseSchema,
  workspaceAutomationTemplatesResponseSchema,
  workspaceAutomationUsageResponseSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  automationTemplates,
  getWorkspaceAutomationRules,
  getWorkspaceAutomationRuns,
  getWorkspaceAutomationUsageForUser,
  patchWorkspaceAutomationRule,
} from "./workspace-automation.service.js";

export const workspaceAutomationRouter = Router({ mergeParams: true });
workspaceAutomationRouter.use(requireAuth);

workspaceAutomationRouter.get("/rules", async (req, res) => {
  const { workspaceId } = workspaceAutomationParamsSchema.parse(req.params);
  const rules = await getWorkspaceAutomationRules({
    userId: getUserId(req),
    workspaceId,
  });
  res.json({
    rules: rules.map(toRuleResponse),
  } satisfies typeof workspaceAutomationRulesResponseSchema._output);
});

workspaceAutomationRouter.patch("/rules/:ruleId", async (req, res) => {
  const { ruleId, workspaceId } = workspaceAutomationRuleParamsSchema.parse(req.params);
  const rule = await patchWorkspaceAutomationRule({
    ruleId,
    input: updateWorkspaceAutomationRuleRequestSchema.parse(req.body),
    userId: getUserId(req),
    workspaceId,
  });
  res.json({ rule: toRuleResponse(rule) } satisfies typeof workspaceAutomationRuleResponseSchema._output);
});

workspaceAutomationRouter.get("/runs", async (req, res) => {
  const { workspaceId } = workspaceAutomationParamsSchema.parse(req.params);
  const runs = await getWorkspaceAutomationRuns({ userId: getUserId(req), workspaceId });
  res.json({
    runs: runs.map((run) => ({
      ...run,
      actorUserId: run.actorUserId ?? null,
      createdAt: run.createdAt.toISOString(),
      data: run.data ?? {},
      outcome: run.outcome as "succeeded" | "skipped" | "failed",
      triggerTaskId: run.triggerTaskId ?? null,
    })),
  } satisfies typeof workspaceAutomationRunsResponseSchema._output);
});

workspaceAutomationRouter.get("/templates", (_req, res) => {
  res.json({ templates: [...automationTemplates] } satisfies typeof workspaceAutomationTemplatesResponseSchema._output);
});

workspaceAutomationRouter.get("/usage", async (req, res) => {
  const { workspaceId } = workspaceAutomationParamsSchema.parse(req.params);
  const usage = await getWorkspaceAutomationUsageForUser({
    userId: getUserId(req),
    workspaceId,
  });
  res.json(usage satisfies typeof workspaceAutomationUsageResponseSchema._output);
});

function getUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toRuleResponse(rule: Awaited<ReturnType<typeof getWorkspaceAutomationRules>>[number]) {
  return {
    configuration: rule.configuration ?? {},
    createdAt: rule.createdAt.toISOString(),
    enabled: rule.enabled,
    id: rule.id,
    ruleType: rule.ruleType as "children_completed_close_parent" | "task_transition_assign" | "parent_completed_close_children",
    updatedAt: rule.updatedAt.toISOString(),
  };
}
