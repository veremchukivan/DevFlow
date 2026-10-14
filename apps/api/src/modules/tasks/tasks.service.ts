import type { CreateTaskRequest, UpdateTaskRequest } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { canCreateTask, canUpdateTask } from "./tasks.policy.js";
import {
  createTaskWithNextNumber,
  findActiveWorkspaceMember,
  findActiveWorkspaceMembership,
  findDefaultProjectStatus,
  findProjectInWorkspace,
  findProjectStatusInProject,
  findTaskInProject,
  listTasksForProject,
  updateTaskInProject
} from "./tasks.repository.js";

const maxTaskNumberAttempts = 3;

export async function createTask(input: {
  input: CreateTaskRequest;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canCreateTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_CREATE_FORBIDDEN",
      "You cannot create tasks in this workspace"
    );
  }

  const project = await requireProject(input);
  const status = await resolveTaskStatus({
    projectId: input.projectId,
    statusId: input.input.statusId,
    workspaceId: input.workspaceId
  });

  if (input.input.assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: input.input.assigneeUserId,
      workspaceId: input.workspaceId
    });
  }

  for (let attempt = 0; attempt < maxTaskNumberAttempts; attempt += 1) {
    try {
      const task = await createTaskWithNextNumber({
        assigneeUserId: input.input.assigneeUserId,
        description: input.input.description,
        priority: input.input.priority,
        projectId: input.projectId,
        reporterUserId: input.userId,
        statusId: status.id,
        title: input.input.title,
        workspaceId: input.workspaceId
      });

      return {
        ...task,
        projectKey: project.key,
        status
      };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === maxTaskNumberAttempts - 1) {
        throw error;
      }
    }
  }

  throw new AppError(
    409,
    "TASK_NUMBER_CONFLICT",
    "Could not reserve the next task number"
  );
}

export async function listTasks(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireProject(input);

  return listTasksForProject(input);
}

export async function getTask(input: {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireProject(input);

  const task = await findTaskInProject(input);

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return task;
}

export async function updateTask(input: {
  input: UpdateTaskRequest;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canUpdateTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_UPDATE_FORBIDDEN",
      "You cannot update tasks in this workspace"
    );
  }

  await requireProject(input);
  await requireTask(input);

  if (input.input.statusId) {
    await resolveTaskStatus({
      projectId: input.projectId,
      statusId: input.input.statusId,
      workspaceId: input.workspaceId
    });
  }

  if (input.input.assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: input.input.assigneeUserId,
      workspaceId: input.workspaceId
    });
  }

  await updateTaskInProject({
    assigneeUserId: input.input.assigneeUserId,
    description: input.input.description,
    priority: input.input.priority,
    projectId: input.projectId,
    statusId: input.input.statusId,
    taskId: input.taskId,
    title: input.input.title,
    workspaceId: input.workspaceId
  });

  const updatedTask = await findTaskInProject(input);

  if (!updatedTask) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return updatedTask;
}

async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await findActiveWorkspaceMembership(input);

  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  return membership;
}

async function requireProject(input: {
  projectId: string;
  workspaceId: string;
}) {
  const project = await findProjectInWorkspace(input);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  return project;
}

async function requireTask(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const task = await findTaskInProject(input);

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return task;
}

async function resolveTaskStatus(input: {
  projectId: string;
  statusId?: string;
  workspaceId: string;
}) {
  if (input.statusId) {
    const status = await findProjectStatusInProject({
      projectId: input.projectId,
      statusId: input.statusId,
      workspaceId: input.workspaceId
    });

    if (!status) {
      throw new AppError(
        400,
        "TASK_STATUS_INVALID",
        "Task status must belong to this project"
      );
    }

    return status;
  }

  const status = await findDefaultProjectStatus(input);

  if (!status) {
    throw new AppError(
      409,
      "TASK_STATUS_REQUIRED",
      "Project does not have a default task status"
    );
  }

  return status;
}

async function requireAssignableWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const member = await findActiveWorkspaceMember(input);

  if (!member) {
    throw new AppError(
      400,
      "TASK_ASSIGNEE_INVALID",
      "Assignee must be an active workspace member"
    );
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
