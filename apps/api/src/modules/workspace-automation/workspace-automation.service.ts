import { randomUUID } from "node:crypto";
import type { CreateWorkspaceAutomationRuleRequest, UpdateWorkspaceAutomationRuleRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canUpdateWorkspace } from "../workspaces/workspaces.policy.js";
import { findWorkspaceForUser } from "../workspaces/workspaces.repository.js";
import {
  ensureWorkspaceAutomationRules,
  createWorkspaceAutomationRule,
  deleteWorkspaceAutomationRule,
  findWorkspaceAutomationRun,
  getWorkspaceAutomationUsage,
  listWorkspaceAutomationRules,
  listWorkspaceAutomationRuns,
  updateWorkspaceAutomationRule,
} from "./workspace-automation.repository.js";

export const automationTemplates = [
  {
    ruleType: "children_completed_close_parent",
    title: "Close parent when all child work items are complete",
    description:
      "Moves the parent item forward after every direct child is completed.",
  },
  {
    ruleType: "task_transition_assign",
    title: "Automatically assign on transition",
    description:
      "Assigns a chosen workspace member when a work item changes status.",
  },
  {
    ruleType: "parent_completed_close_children",
    title: "Close child work items when the parent is complete",
    description:
      "Completes all unfinished direct child items when their parent is completed.",
  },
] as const;

export async function getWorkspaceAutomationRules(input: {
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceAccess(input);
  await ensureWorkspaceAutomationRules({
    createdByUserId: input.userId,
    workspaceId: input.workspaceId,
  });
  return listWorkspaceAutomationRules(input.workspaceId);
}

export async function patchWorkspaceAutomationRule(input: {
  ruleId: string;
  input: UpdateWorkspaceAutomationRuleRequest;
  userId: string;
  workspaceId: string;
}) {
  const workspace = await requireWorkspaceAccess(input);
  if (!canUpdateWorkspace(workspace.role)) {
    throw new AppError(
      403,
      "WORKSPACE_UPDATE_FORBIDDEN",
      "You do not have permission to update this workspace",
    );
  }

  const rule = await updateWorkspaceAutomationRule({
    actions: input.input.actions,
    conditions: input.input.conditions,
    configuration: input.input.configuration,
    enabled: input.input.enabled,
    name: input.input.name,
    ruleId: input.ruleId,
    triggerType: input.input.triggerType,
    workspaceId: input.workspaceId,
  });
  if (!rule) {
    throw new AppError(404, "AUTOMATION_RULE_NOT_FOUND", "Automation rule not found");
  }

  return rule;
}

export async function createWorkspaceAutomationRuleForUser(input: {
  input: CreateWorkspaceAutomationRuleRequest;
  userId: string;
  workspaceId: string;
}) {
  const workspace = await requireWorkspaceAccess(input);
  if (!canUpdateWorkspace(workspace.role)) throw new AppError(403, "WORKSPACE_UPDATE_FORBIDDEN", "You do not have permission to update this workspace");
  const rule = await createWorkspaceAutomationRule({
    actions: input.input.actions,
    conditions: input.input.conditions,
    createdByUserId: input.userId,
    enabled: input.input.enabled,
    name: input.input.name,
    ruleType: `custom-${randomUUID()}`,
    triggerType: input.input.triggerType,
    workspaceId: input.workspaceId,
  });
  if (!rule) throw new Error("Failed to create automation rule");
  return rule;
}

export async function deleteWorkspaceAutomationRuleForUser(input: { ruleId: string; userId: string; workspaceId: string }) {
  const workspace = await requireWorkspaceAccess(input);
  if (!canUpdateWorkspace(workspace.role)) throw new AppError(403, "WORKSPACE_UPDATE_FORBIDDEN", "You do not have permission to update this workspace");
  if (!(await deleteWorkspaceAutomationRule(input))) throw new AppError(404, "AUTOMATION_RULE_NOT_FOUND", "Automation rule not found");
}

export async function retryWorkspaceAutomationRun(input: { runId: string; userId: string; workspaceId: string }) {
  const workspace = await requireWorkspaceAccess(input);
  if (!canUpdateWorkspace(workspace.role)) throw new AppError(403, "WORKSPACE_UPDATE_FORBIDDEN", "You do not have permission to update this workspace");
  const run = await findWorkspaceAutomationRun(input);
  if (!run) throw new AppError(404, "AUTOMATION_RUN_NOT_FOUND", "Automation run not found");
  if (!run.triggerTaskId) throw new AppError(400, "AUTOMATION_RUN_NOT_RETRYABLE", "This run has no task context to retry");
  const { runWorkspaceAutomation } = await import("./workspace-automation.engine.js");
  await runWorkspaceAutomation({ actorUserId: input.userId, projectId: String((run.data ?? {}).projectId ?? ""), taskId: run.triggerTaskId, triggerType: "task_status_changed", workspaceId: input.workspaceId });
}

export async function getWorkspaceAutomationRuns(input: {
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceAccess(input);
  return listWorkspaceAutomationRuns({ limit: 100, workspaceId: input.workspaceId });
}

export async function getWorkspaceAutomationTemplates(input: {
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceAccess(input);
  return automationTemplates;
}

export async function getWorkspaceAutomationUsageForUser(input: {
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceAccess(input);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return getWorkspaceAutomationUsage({ since, workspaceId: input.workspaceId });
}

async function requireWorkspaceAccess(input: { userId: string; workspaceId: string }) {
  const workspace = await findWorkspaceForUser(input);
  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  return workspace;
}
