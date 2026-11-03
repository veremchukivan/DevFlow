import type {
  CreateTaskDevelopmentFlowRequest,
  UpdateTaskDevelopmentFlowRequest,
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import {
  findActiveWorkspaceMembership,
  findProjectInWorkspace,
  findTaskInProject,
} from "../tasks/tasks.repository.js";
import {
  createTaskDevelopmentFlowInDb,
  createTaskDevelopmentFlowSessionInDb,
  findTaskDevelopmentFlow,
  findTaskDevelopmentFlowSession,
  listTaskDevelopmentFlowSessions,
  updateTaskDevelopmentFlowInDb,
  updateTaskDevelopmentFlowSessionInDb,
} from "./task-development-flows.repository.js";

type Scope = { projectId: string; taskId: string; userId: string; workspaceId: string };
type FlowState = "idea" | "planning" | "approval" | "ready" | "in_progress" | "review" | "done";

export async function getTaskDevelopmentFlow(input: Scope) {
  await requireEditableTask(input, false);
  const flow = await findTaskDevelopmentFlow(input);
  if (!flow) return { flow: null, sessions: [] };
  return { flow, sessions: await listTaskDevelopmentFlowSessions(flow.id) };
}

export async function createTaskDevelopmentFlow(input: Scope & { input: CreateTaskDevelopmentFlowRequest }) {
  const task = await requireEditableTask(input);
  const created = await createTaskDevelopmentFlowInDb({
    acceptanceCriteria: input.input.acceptanceCriteria,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  const flow = created ?? (await findTaskDevelopmentFlow(input));
  if (!flow) throw new Error("Failed to create development flow");
  if (created) await recordFlowActivity(input, task, "enabled Development Flow");
  return flow;
}

export async function updateTaskDevelopmentFlow(input: Scope & { input: UpdateTaskDevelopmentFlowRequest }) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  const updated = await updateTaskDevelopmentFlowInDb({ id: flow.id, ...input.input });
  if (!updated) throw new Error("Failed to update development flow");
  await recordFlowActivity(input, task, "updated Development Flow details");
  return updated;
}

export async function transitionTaskDevelopmentFlow(input: Scope & { state: FlowState }) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  assertTransitionAllowed(flow.state, input.state, flow);
  const updated = await updateTaskDevelopmentFlowInDb({ id: flow.id, state: input.state });
  if (!updated) throw new Error("Failed to transition development flow");
  await recordFlowActivity(input, task, `moved Development Flow to ${flowLabel(input.state)}`);
  return updated;
}

export async function approveTaskDevelopmentPlan(input: Scope) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  if (flow.state !== "approval") {
    throw new AppError(409, "DEVELOPMENT_FLOW_STATE_INVALID", "The implementation plan must be submitted for approval first");
  }
  assertHasPlan(flow);
  const updated = await updateTaskDevelopmentFlowInDb({
    id: flow.id,
    planApprovedAt: new Date(),
    planApprovedByUserId: input.userId,
    state: "ready",
  });
  if (!updated) throw new Error("Failed to approve development plan");
  await recordFlowActivity(input, task, "approved the implementation plan");
  return updated;
}

export async function rejectTaskDevelopmentPlan(input: Scope & { comment: string }) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  if (flow.state !== "approval") {
    throw new AppError(409, "DEVELOPMENT_FLOW_STATE_INVALID", "Only a submitted plan can be rejected");
  }
  const updated = await updateTaskDevelopmentFlowInDb({
    id: flow.id,
    planApprovedAt: null,
    planApprovedByUserId: null,
    state: "planning",
  });
  if (!updated) throw new Error("Failed to reject development plan");
  await recordFlowActivity(input, task, `requested changes to the implementation plan: ${input.comment}`);
  return updated;
}

export async function approveTaskDevelopmentReview(input: Scope) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  if (flow.state !== "review") {
    throw new AppError(409, "DEVELOPMENT_FLOW_STATE_INVALID", "The flow must be in review before it can be completed");
  }
  assertReadyForReview(flow);
  const updated = await updateTaskDevelopmentFlowInDb({
    id: flow.id,
    reviewApprovedAt: new Date(),
    reviewApprovedByUserId: input.userId,
    state: "done",
  });
  if (!updated) throw new Error("Failed to approve development review");
  await recordFlowActivity(input, task, "approved the review and completed Development Flow");
  return updated;
}

export async function rejectTaskDevelopmentReview(input: Scope & { comment: string }) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  if (flow.state !== "review") {
    throw new AppError(409, "DEVELOPMENT_FLOW_STATE_INVALID", "Only a flow in review can be returned for changes");
  }
  const updated = await updateTaskDevelopmentFlowInDb({ id: flow.id, state: "in_progress" });
  if (!updated) throw new Error("Failed to reject development review");
  await recordFlowActivity(input, task, `requested changes after review: ${input.comment}`);
  return updated;
}

export async function createTaskDevelopmentFlowSession(input: Scope & { agentName?: string; client: string }) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  if (flow.state !== "in_progress") {
    throw new AppError(409, "DEVELOPMENT_FLOW_NOT_READY", "Start an agent session only after the approved flow is in progress");
  }
  const session = await createTaskDevelopmentFlowSessionInDb({
    agentName: input.agentName,
    client: input.client,
    developmentFlowId: flow.id,
    startedByUserId: input.userId,
  });
  if (!session) throw new Error("Failed to create agent session");
  await recordFlowActivity(input, task, `started an AI agent session in ${input.client}`);
  return session;
}

export async function updateTaskDevelopmentFlowSession(input: Scope & {
  sessionId: string;
  status?: "active" | "paused" | "completed" | "failed";
  summary?: string | null;
}) {
  const task = await requireEditableTask(input);
  const flow = await requireFlow(input);
  const session = await findTaskDevelopmentFlowSession({ developmentFlowId: flow.id, sessionId: input.sessionId });
  if (!session) throw new AppError(404, "DEVELOPMENT_FLOW_SESSION_NOT_FOUND", "Agent session not found");
  const terminal = input.status === "completed" || input.status === "failed";
  const updated = await updateTaskDevelopmentFlowSessionInDb({
    endedAt: terminal ? new Date() : undefined,
    id: session.id,
    status: input.status,
    summary: input.summary,
  });
  if (!updated) throw new Error("Failed to update agent session");
  await recordFlowActivity(input, task, `updated AI agent session (${updated.status})`);
  return updated;
}

export async function assertTaskCanMoveToDone(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const flow = await findTaskDevelopmentFlow(input);
  if (flow?.isEnabled && flow.state !== "done") {
    throw new AppError(
      409,
      "DEVELOPMENT_FLOW_REVIEW_REQUIRED",
      "Complete the Development Flow review before moving this task to Done",
    );
  }
}

async function requireEditableTask(input: Scope, requireUpdatePermission = true) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  if (requireUpdatePermission && !canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_UPDATE_FORBIDDEN", "You cannot update tasks in this workspace");
  }
  if (!(await findProjectInWorkspace(input))) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return task;
}

async function requireFlow(input: Pick<Scope, "projectId" | "taskId" | "workspaceId">) {
  const flow = await findTaskDevelopmentFlow(input);
  if (!flow || !flow.isEnabled) {
    throw new AppError(404, "DEVELOPMENT_FLOW_NOT_FOUND", "Development Flow is not enabled for this task");
  }
  return flow;
}

function assertTransitionAllowed(current: FlowState, target: FlowState, flow: {
  acceptanceCriteria: string[];
  implementationPlan: string | null;
  planApprovedAt: Date | null;
  branchName: string | null;
  pullRequestUrl: string | null;
  ciStatus: "not_configured" | "pending" | "passing" | "failing";
  summary: string | null;
  testInstructions: string | null;
}) {
  const allowed: Record<FlowState, FlowState[]> = {
    idea: ["planning"],
    planning: ["approval"],
    approval: [],
    ready: ["in_progress"],
    in_progress: ["review"],
    review: [],
    done: [],
  };
  if (!allowed[current].includes(target)) {
    throw new AppError(409, "DEVELOPMENT_FLOW_TRANSITION_INVALID", `Cannot move Development Flow from ${flowLabel(current)} to ${flowLabel(target)}`);
  }
  if (target === "approval") assertHasPlan(flow);
  if (target === "in_progress" && !flow.planApprovedAt) {
    throw new AppError(409, "DEVELOPMENT_FLOW_PLAN_APPROVAL_REQUIRED", "Approve the implementation plan before starting work");
  }
  if (target === "review") assertReadyForReview(flow);
}

function assertHasPlan(flow: { acceptanceCriteria: string[]; implementationPlan: string | null }) {
  if (!flow.acceptanceCriteria.length || !flow.implementationPlan?.trim()) {
    throw new AppError(409, "DEVELOPMENT_FLOW_PLAN_INCOMPLETE", "Add acceptance criteria and an implementation plan before requesting approval");
  }
}

function assertReadyForReview(flow: {
  branchName: string | null;
  ciStatus: "not_configured" | "pending" | "passing" | "failing";
  pullRequestUrl: string | null;
  summary: string | null;
  testInstructions: string | null;
}) {
  const missing = [
    !flow.branchName && "branch",
    !flow.pullRequestUrl && "pull request",
    flow.ciStatus !== "passing" && "passing CI",
    !flow.testInstructions?.trim() && "test instructions",
    !flow.summary?.trim() && "implementation summary",
  ].filter(Boolean);
  if (missing.length) {
    throw new AppError(409, "DEVELOPMENT_FLOW_REVIEW_INCOMPLETE", `Before review add: ${missing.join(", ")}`);
  }
}

async function recordFlowActivity(input: Scope, task: { number: number; projectKey: string; title: string }, message: string) {
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { fields: ["developmentFlow"], message, taskKey: `${task.projectKey}-${task.number}`, title: task.title },
    eventType: "task_updated",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
}

function flowLabel(state: FlowState) {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
