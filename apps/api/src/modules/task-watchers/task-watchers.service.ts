import { AppError } from "../../core/errors/app-error.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import {
  createTaskWatcher,
  deleteTaskWatcher,
  findActiveWorkspaceMembership,
  findTaskInProject,
  listTaskWatchers,
} from "./task-watchers.repository.js";

type TaskWatcherScope = {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
};

export async function getTaskWatchers(input: TaskWatcherScope) {
  await requireReadableTask(input);
  const watchers = await listTaskWatchers(input);
  return {
    isWatching: watchers.some((watcher) => watcher.userId === input.userId),
    watchers,
  };
}

export async function followTask(input: TaskWatcherScope) {
  await requireReadableTask(input);
  await createTaskWatcher(input);
  return getTaskWatchers(input);
}

export async function addTaskWatcher(
  input: TaskWatcherScope & { targetUserId: string },
) {
  const membership = await requireReadableTask(input);
  if (!canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_WATCHER_MANAGE_FORBIDDEN", "You cannot manage task watchers");
  }
  const targetMembership = await findActiveWorkspaceMembership({
    userId: input.targetUserId,
    workspaceId: input.workspaceId,
  });
  if (!targetMembership) {
    throw new AppError(400, "TASK_WATCHER_INVALID", "Watcher must be an active workspace member");
  }
  await createTaskWatcher({ ...input, userId: input.targetUserId });
  return getTaskWatchers(input);
}

export async function unfollowTask(input: TaskWatcherScope) {
  await requireReadableTask(input);
  await deleteTaskWatcher(input);
  return getTaskWatchers(input);
}

export async function removeTaskWatcher(
  input: TaskWatcherScope & { targetUserId: string },
) {
  const membership = await requireReadableTask(input);
  if (input.targetUserId !== input.userId && !canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_WATCHER_MANAGE_FORBIDDEN", "You cannot manage task watchers");
  }
  await deleteTaskWatcher({ ...input, userId: input.targetUserId });
  return getTaskWatchers(input);
}

async function requireReadableTask(input: TaskWatcherScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return membership;
}
