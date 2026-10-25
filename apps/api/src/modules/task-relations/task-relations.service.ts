import type { CreateTaskRelationRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import {
  createTaskRelation,
  deleteTaskRelation,
  findActiveWorkspaceMembership,
  findExistingRelation,
  findTaskInProject,
  findTaskInWorkspace,
  listTaskRelations,
} from "./task-relations.repository.js";

type TaskRelationScope = {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
};

export async function listRelations(input: TaskRelationScope) {
  await requireTaskReadAccess(input);
  return listTaskRelations(input);
}

export async function addRelation(
  input: TaskRelationScope & { input: CreateTaskRelationRequest },
) {
  await requireTaskUpdateAccess(input);
  if (input.input.targetTaskId === input.taskId) {
    throw new AppError(
      400,
      "TASK_RELATION_SELF_REFERENCE",
      "A task cannot be related to itself",
    );
  }

  const target = await findTaskInWorkspace({
    taskId: input.input.targetTaskId,
    workspaceId: input.workspaceId,
  });
  if (!target) {
    throw new AppError(
      400,
      "TASK_RELATION_TARGET_INVALID",
      "Related task must belong to this workspace",
    );
  }

  const existing = await findExistingRelation({
    relationType: input.input.relationType,
    sourceTaskId: input.taskId,
    targetTaskId: target.id,
    workspaceId: input.workspaceId,
  });
  if (existing) {
    throw new AppError(
      409,
      "TASK_RELATION_EXISTS",
      "This task relation already exists",
    );
  }

  const relation = await createTaskRelation({
    createdByUserId: input.userId,
    relationType: input.input.relationType,
    sourceProjectId: input.projectId,
    sourceTaskId: input.taskId,
    targetProjectId: target.projectId,
    targetTaskId: target.id,
    workspaceId: input.workspaceId,
  });
  await recordTaskActivity({
    actorUserId: input.userId,
    data: {
      relationType: input.input.relationType,
      targetTaskId: target.id,
      targetTaskKey: `${target.projectKey}-${target.number}`,
      targetTaskTitle: target.title,
    },
    eventType: "task_relation_added",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  return relation;
}

export async function removeRelation(
  input: TaskRelationScope & { relationId: string },
) {
  await requireTaskUpdateAccess(input);
  const relation = await deleteTaskRelation(input);
  if (!relation) {
    throw new AppError(
      404,
      "TASK_RELATION_NOT_FOUND",
      "Task relation not found",
    );
  }
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { relationId: relation.id },
    eventType: "task_relation_removed",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
}

async function requireTaskReadAccess(input: TaskRelationScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
}

async function requireTaskUpdateAccess(input: TaskRelationScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (!canUpdateTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_RELATION_UPDATE_FORBIDDEN",
      "You cannot update task relations in this workspace",
    );
  }
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
}
