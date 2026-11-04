import {
  createWorkspaceAutomationRuleRequestSchema,
  updateWorkspaceAutomationRuleRequestSchema,
  workspaceAutomationParamsSchema,
  workspaceAutomationRuleParamsSchema,
  workspaceAutomationRuleSchema,
  workspaceAutomationRunParamsSchema,
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
  createWorkspaceAutomationRuleForUser,
  deleteWorkspaceAutomationRuleForUser,
  getWorkspaceAutomationRules,
  getWorkspaceAutomationRuns,
  getWorkspaceAutomationTemplates,
  getWorkspaceAutomationUsageForUser,
  patchWorkspaceAutomationRule,
  retryWorkspaceAutomationRun,
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

workspaceAutomationRouter.post("/rules", async (req, res) => {
  const { workspaceId } = workspaceAutomationParamsSchema.parse(req.params);
  const rule = await createWorkspaceAutomationRuleForUser({ input: createWorkspaceAutomationRuleRequestSchema.parse(req.body), userId: getUserId(req), workspaceId });
  res.status(201).json({ rule: toRuleResponse(rule) } satisfies typeof workspaceAutomationRuleResponseSchema._output);
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

workspaceAutomationRouter.delete("/rules/:ruleId", async (req, res) => {
  const { ruleId, workspaceId } = workspaceAutomationRuleParamsSchema.parse(req.params);
  await deleteWorkspaceAutomationRuleForUser({ ruleId, userId: getUserId(req), workspaceId });
  res.status(204).end();
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

workspaceAutomationRouter.post("/rules/:ruleId/runs/:runId/retry", async (req, res) => {
  const { runId, workspaceId } = workspaceAutomationRunParamsSchema.parse(req.params);
  await retryWorkspaceAutomationRun({ runId, userId: getUserId(req), workspaceId });
  res.status(202).json({ ok: true });
});

workspaceAutomationRouter.get("/templates", async (req, res) => {
  const { workspaceId } = workspaceAutomationParamsSchema.parse(req.params);
  const templates = await getWorkspaceAutomationTemplates({
    userId: getUserId(req),
    workspaceId,
  });
  res.json({ templates: [...templates] } satisfies typeof workspaceAutomationTemplatesResponseSchema._output);
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

function toRuleResponse(rule: {
  actions: Array<Record<string, unknown>>;
  conditions: Record<string, unknown>;
  configuration: Record<string, unknown>;
  createdAt: Date;
  enabled: boolean;
  id: string;
  lastError: string | null;
  name: string;
  ruleType: string;
  triggerType: string;
  updatedAt: Date;
}) {
  return workspaceAutomationRuleSchema.parse({
    configuration: rule.configuration ?? {},
    actions: rule.actions ?? [],
    conditions: rule.conditions ?? {},
    createdAt: rule.createdAt.toISOString(),
    enabled: rule.enabled,
    id: rule.id,
    lastError: rule.lastError ?? null,
    name: rule.name,
    ruleType: rule.ruleType,
    triggerType: rule.triggerType as "task_created" | "task_status_changed" | "task_due" | "comment_created" | "pull_request_merged",
    updatedAt: rule.updatedAt.toISOString(),
  });
}
