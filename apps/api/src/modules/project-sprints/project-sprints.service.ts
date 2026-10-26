import type {
  CreateProjectSprintRequest,
  CompleteProjectSprintRequest,
  UpdateProjectSprintRequest,
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canUpdateProject } from "../projects/projects.policy.js";
import {
  countTasksInSprint,
  completeSprintAndCarryOver,
  createProjectSprint,
  deleteProjectSprint,
  findActiveWorkspaceMembership,
  findProjectInWorkspace,
  findProjectSprint,
  listProjectSprints,
  listSprintTaskMetrics,
  updateProjectSprint,
} from "./project-sprints.repository.js";

type SprintScope = { projectId: string; userId: string; workspaceId: string };

export async function listSprints(input: SprintScope) {
  await requireProject(input);
  return listProjectSprints(input);
}

export async function createSprint(
  input: SprintScope & { input: CreateProjectSprintRequest },
) {
  await requireProjectUpdatePermission(input);
  try {
    return await createProjectSprint({
      ...input,
      ...input.input,
      createdByUserId: input.userId,
    });
  } catch (error) {
    throwActiveSprintConflict(error);
  }
}

export async function updateSprint(
  input: SprintScope & { input: UpdateProjectSprintRequest; sprintId: string },
) {
  await requireProjectUpdatePermission(input);
  const existing = await requireSprint(input);
  const startDate =
    input.input.startDate === undefined
      ? existing.startDate
      : input.input.startDate;
  const endDate =
    input.input.endDate === undefined ? existing.endDate : input.input.endDate;
  if (startDate && endDate && startDate > endDate) {
    throw new AppError(
      400,
      "SPRINT_DATES_INVALID",
      "Sprint start date must be before its end date",
    );
  }
  try {
    const sprint = await updateProjectSprint({ ...input, ...input.input });
    if (!sprint)
      throw new AppError(404, "SPRINT_NOT_FOUND", "Sprint not found");
    return sprint;
  } catch (error) {
    throwActiveSprintConflict(error);
  }
}

export async function removeSprint(input: SprintScope & { sprintId: string }) {
  await requireProjectUpdatePermission(input);
  await requireSprint(input);
  if (await countTasksInSprint(input)) {
    throw new AppError(
      409,
      "SPRINT_TASKS_EXIST",
      "Move sprint tasks to the backlog before deleting this sprint",
    );
  }
  if (!(await deleteProjectSprint(input)))
    throw new AppError(404, "SPRINT_NOT_FOUND", "Sprint not found");
}

export async function completeSprint(
  input: SprintScope & {
    input: CompleteProjectSprintRequest;
    sprintId: string;
  },
) {
  await requireProjectUpdatePermission(input);
  const sprint = await requireSprint(input);
  if (sprint.status === "completed")
    throw new AppError(
      409,
      "SPRINT_ALREADY_COMPLETED",
      "This sprint is already completed",
    );
  if (input.input.carryOver === "sprint") {
    const target = await requireSprint({
      ...input,
      sprintId: input.input.targetSprintId!,
    });
    if (target.status === "completed")
      throw new AppError(
        400,
        "SPRINT_TARGET_COMPLETED",
        "Cannot carry tasks into a completed sprint",
      );
  }
  const completed = await completeSprintAndCarryOver({
    ...input,
    targetSprintId:
      input.input.carryOver === "sprint"
        ? input.input.targetSprintId
        : undefined,
  });
  if (!completed)
    throw new AppError(404, "SPRINT_NOT_FOUND", "Sprint not found");
  return completed;
}

export async function getSprintAnalytics(
  input: SprintScope & { sprintId: string },
) {
  await requireProject(input);
  await requireSprint(input);
  const tasks = await listSprintTaskMetrics(input);
  const today = new Date().toISOString().slice(0, 10);
  const statusDistribution = [
    ...new Map(
      tasks.map((task) => [
        task.statusId,
        {
          count: tasks.filter((item) => item.statusId === task.statusId).length,
          statusId: task.statusId,
          statusName: task.statusName,
        },
      ]),
    ).values(),
  ];
  const completed = tasks.filter(
    (task) => task.statusCategory === "done",
  ).length;
  const open = tasks.length - completed;
  return {
    completed,
    open,
    overdue: tasks.filter(
      (task) =>
        task.statusCategory !== "done" && task.dueDate && task.dueDate < today,
    ).length,
    statusDistribution,
    total: tasks.length,
    velocity: completed,
  };
}

async function requireProject(input: SprintScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership)
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  if (!(await findProjectInWorkspace(input)))
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  return membership;
}

async function requireProjectUpdatePermission(input: SprintScope) {
  const membership = await requireProject(input);
  if (!canUpdateProject(membership.role))
    throw new AppError(
      403,
      "PROJECT_UPDATE_FORBIDDEN",
      "You cannot manage sprints in this project",
    );
}

async function requireSprint(input: {
  projectId: string;
  sprintId: string;
  workspaceId: string;
}) {
  const sprint = await findProjectSprint(input);
  if (!sprint) throw new AppError(404, "SPRINT_NOT_FOUND", "Sprint not found");
  return sprint;
}

function throwActiveSprintConflict(error: unknown): never {
  if (hasPostgresErrorCode(error, "23505")) {
    throw new AppError(
      409,
      "SPRINT_ACTIVE_EXISTS",
      "Complete the active sprint before starting another one",
    );
  }
  throw error;
}

function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === code) return true;
  return "cause" in error && hasPostgresErrorCode(error.cause, code);
}
