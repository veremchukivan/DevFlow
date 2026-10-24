import type {
  CreateTaskChecklistItemRequest,
  UpdateTaskChecklistItemRequest,
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import {
  createTaskChecklistItem,
  deleteTaskChecklistItem,
  findActiveWorkspaceMembership,
  findTaskChecklistItemById,
  findTaskInProject,
  listTaskChecklistItems,
  updateTaskChecklistItem,
} from "./task-checklists.repository.js";

type TaskChecklistScope = {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
};

export async function listChecklistItems(input: TaskChecklistScope) {
  await requireWorkspaceMembership(input);
  await requireTask(input);
  return withProgress(await listTaskChecklistItems(input));
}

export async function createChecklistItem(
  input: TaskChecklistScope & { input: CreateTaskChecklistItemRequest },
) {
  await requireTaskUpdatePermission(input);
  return createTaskChecklistItem({ ...input, content: input.input.content });
}

export async function updateChecklistItem(
  input: TaskChecklistScope & {
    input: UpdateTaskChecklistItemRequest;
    itemId: string;
  },
) {
  await requireTaskUpdatePermission(input);
  await requireChecklistItem(input);
  const item = await updateTaskChecklistItem({ ...input, ...input.input });
  if (!item)
    throw new AppError(
      404,
      "TASK_CHECKLIST_ITEM_NOT_FOUND",
      "Checklist item not found",
    );
  return item;
}

export async function removeChecklistItem(
  input: TaskChecklistScope & { itemId: string },
) {
  await requireTaskUpdatePermission(input);
  await requireChecklistItem(input);
  const item = await deleteTaskChecklistItem(input);
  if (!item)
    throw new AppError(
      404,
      "TASK_CHECKLIST_ITEM_NOT_FOUND",
      "Checklist item not found",
    );
}

function withProgress(
  items: Awaited<ReturnType<typeof listTaskChecklistItems>>,
) {
  return {
    items,
    progress: {
      completed: items.filter((item) => item.isCompleted).length,
      total: items.length,
    },
  };
}

async function requireTaskUpdatePermission(input: TaskChecklistScope) {
  const membership = await requireWorkspaceMembership(input);
  if (!canUpdateTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_CHECKLIST_UPDATE_FORBIDDEN",
      "You cannot update task checklists in this workspace",
    );
  }
  await requireTask(input);
}

async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership)
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  return membership;
}

async function requireTask(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return task;
}

async function requireChecklistItem(input: {
  itemId: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const item = await findTaskChecklistItemById(input);
  if (!item)
    throw new AppError(
      404,
      "TASK_CHECKLIST_ITEM_NOT_FOUND",
      "Checklist item not found",
    );
  return item;
}
