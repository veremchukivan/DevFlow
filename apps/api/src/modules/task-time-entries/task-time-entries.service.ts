import type { CreateManualTaskTimeEntryRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import {
  findActiveWorkspaceMembership,
  findProjectInWorkspace,
  findTaskInProject,
} from "../tasks/tasks.repository.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import {
  createManualTaskTimeEntry,
  createRunningTaskTimeEntry,
  findActiveTimeEntryForUser,
  listTaskTimeEntries,
  stopTaskTimeEntry,
} from "./task-time-entries.repository.js";

type TaskTimeScope = {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
};

export async function listTimeEntries(input: TaskTimeScope) {
  await requireReadableTask(input);
  const [task, entries] = await Promise.all([
    findTaskInProject(input),
    listTaskTimeEntries(input),
  ]);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  const now = new Date();
  const mappedEntries = entries.map((entry) => toTimeEntry(entry, now));
  const loggedMinutes = mappedEntries.reduce(
    (total, entry) => total + entry.durationMinutes,
    0,
  );
  const activeEntry = mappedEntries.find(
    (entry) => entry.userId === input.userId && entry.stoppedAt === null,
  );

  return {
    entries: mappedEntries,
    summary: {
      activeEntry: activeEntry ?? null,
      estimateMinutes: task.estimateMinutes,
      loggedMinutes,
      remainingMinutes:
        task.estimateMinutes === null
          ? null
          : Math.max(0, task.estimateMinutes - loggedMinutes),
    },
  };
}

export async function startTimer(input: TaskTimeScope) {
  await requireTaskUpdatePermission(input);
  const activeEntry = await findActiveTimeEntryForUser(input);
  if (activeEntry) {
    throw new AppError(
      409,
      "TIMER_ALREADY_RUNNING",
      "Stop your active timer before starting another one",
    );
  }
  const entry = await createRunningTaskTimeEntry(input);
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { minutes: 0 },
    eventType: "task_timer_started",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  return entry;
}

export async function stopTimer(input: TaskTimeScope & { entryId: string }) {
  await requireTaskUpdatePermission(input);
  const entry = await stopTaskTimeEntry(input);
  if (!entry) {
    throw new AppError(404, "ACTIVE_TIMER_NOT_FOUND", "Active timer not found");
  }
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { minutes: entry.durationMinutes },
    eventType: "task_timer_stopped",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  return entry;
}

export async function addManualTimeEntry(
  input: TaskTimeScope & { input: CreateManualTaskTimeEntryRequest },
) {
  await requireTaskUpdatePermission(input);
  const entry = await createManualTaskTimeEntry({
    ...input,
    description: input.input.description,
    durationMinutes: input.input.durationMinutes,
    startedAt: new Date(input.input.startedAt),
  });
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { minutes: entry.durationMinutes },
    eventType: "task_time_logged",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  return entry;
}

async function requireReadableTask(input: TaskTimeScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  const [project, task] = await Promise.all([
    findProjectInWorkspace(input),
    findTaskInProject(input),
  ]);
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return { membership, task };
}

async function requireTaskUpdatePermission(input: TaskTimeScope) {
  const { membership } = await requireReadableTask(input);
  if (!canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_TIME_UPDATE_FORBIDDEN", "You cannot log time for this task");
  }
}

function toTimeEntry(
  entry: Awaited<ReturnType<typeof listTaskTimeEntries>>[number],
  now: Date,
) {
  return {
    createdAt: entry.createdAt,
    description: entry.description,
    durationMinutes:
      entry.stoppedAt === null
        ? Math.max(1, Math.ceil((now.getTime() - entry.startedAt.getTime()) / 60_000))
        : entry.durationMinutes,
    id: entry.id,
    projectId: entry.projectId,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt,
    taskId: entry.taskId,
    updatedAt: entry.updatedAt,
    user: { displayName: entry.userDisplayName, id: entry.userId },
    userId: entry.userId,
    workspaceId: entry.workspaceId,
  };
}
