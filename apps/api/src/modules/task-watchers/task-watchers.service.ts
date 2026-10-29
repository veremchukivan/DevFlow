import { AppError } from "../../core/errors/app-error.js";
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

export async function unfollowTask(input: TaskWatcherScope) {
  await requireReadableTask(input);
  await deleteTaskWatcher(input);
  return getTaskWatchers(input);
}

async function requireReadableTask(input: TaskWatcherScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
}
