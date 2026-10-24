import type {
  CreateTaskRequest,
  ListTasksQuery,
  UpdateTaskRequest,
} from "@devflow/shared";

import { db } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import { canCreateTask, canDeleteTask, canUpdateTask } from "./tasks.policy.js";
import {
  createTaskWithNextNumber,
  findActiveWorkspaceMember,
  findActiveWorkspaceMembership,
  findDefaultProjectStatus,
  findProjectInWorkspace,
  findProjectStatusInProject,
  findTaskInProject,
  listTasksForProject,
  listLabelsForTaskIds,
  softDeleteTaskInProject,
  restoreTaskInProject,
  updateTaskInProject,
} from "./tasks.repository.js";

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
      "You cannot create tasks in this workspace",
    );
  }

  const project = await requireProject(input);
  const status = await resolveTaskStatus({
    projectId: input.projectId,
    statusId: input.input.statusId,
    workspaceId: input.workspaceId,
  });

  if (input.input.assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: input.input.assigneeUserId,
      workspaceId: input.workspaceId,
    });
  }

  // createTaskWithNextNumber uses SELECT FOR UPDATE on the project row, which
  // serialises concurrent task creation for the same project and makes a
  // unique-violation on (workspace_id, project_id, number) impossible.
  // No retry loop is needed.
  const task = await createTaskWithNextNumber({
    activity: {
      actorUserId: input.userId,
      projectKey: project.key,
    },
    assigneeUserId: input.input.assigneeUserId,
    description: input.input.description,
    dueDate: input.input.dueDate,
    priority: input.input.priority,
    projectId: input.projectId,
    reporterUserId: input.userId,
    statusId: status.id,
    title: input.input.title,
    workspaceId: input.workspaceId,
  });

  return {
    ...task,
    projectKey: project.key,
    status,
  };
}

export async function listTasks(input: {
  filters: ListTasksQuery;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireProject(input);

  const result = await listTasksForProject({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    filters: input.filters,
  });

  const labelRows = await listLabelsForTaskIds(
    result.tasks.map((task) => task.id),
  );
  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labelRows) {
    labelsByTask.set(label.taskId, [
      ...(labelsByTask.get(label.taskId) ?? []),
      { id: label.id, name: label.name, color: label.color },
    ]);
  }

  return {
    pageInfo: buildPageInfo({
      limit: input.filters.limit,
      offset: input.filters.offset,
      total: result.total,
    }),
    tasks: result.tasks.map((task) => ({
      ...task,
      labels: labelsByTask.get(task.id) ?? [],
    })),
  };
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
  expectedVersion: number;
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
      "You cannot update tasks in this workspace",
    );
  }

  await requireProject(input);
  const existingTask = await requireTask(input);

  if (input.input.statusId) {
    await resolveTaskStatus({
      projectId: input.projectId,
      statusId: input.input.statusId,
      workspaceId: input.workspaceId,
    });
  }

  if (input.input.assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: input.input.assigneeUserId,
      workspaceId: input.workspaceId,
    });
  }

  return db.transaction(async (tx) => {
    const updatedTask = await updateTaskInProject(
      {
        assigneeUserId: input.input.assigneeUserId,
        description: input.input.description,
        dueDate: input.input.dueDate,
        priority: input.input.priority,
        projectId: input.projectId,
        statusId: input.input.statusId,
        taskId: input.taskId,
        title: input.input.title,
        version: input.expectedVersion,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    if (!updatedTask) {
      throw taskVersionConflictError();
    }

    const updatedTaskWithRelations = await findTaskInProject(input, tx);

    if (!updatedTaskWithRelations) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        data: {
          fields: updatedTaskFields(input.input),
          taskKey: `${existingTask.projectKey}-${existingTask.number}`,
          title: updatedTaskWithRelations.title,
        },
        eventType: "task_updated",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    return updatedTaskWithRelations;
  });
}

export async function deleteTask(input: {
  expectedVersion: number;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canDeleteTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_DELETE_FORBIDDEN",
      "You cannot delete tasks in this workspace",
    );
  }

  await requireProject(input);
  const task = await requireTask(input);

  return db.transaction(async (tx) => {
    const deletedTask = await softDeleteTaskInProject(
      {
        ...input,
        version: input.expectedVersion,
      },
      tx,
    );

    if (!deletedTask) {
      throw taskVersionConflictError();
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        data: {
          taskKey: `${task.projectKey}-${task.number}`,
          title: task.title,
        },
        eventType: "task_deleted",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );
  });
}

export async function restoreTask(input: {
  expectedVersion: number;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canDeleteTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_RESTORE_FORBIDDEN",
      "You cannot restore tasks in this workspace",
    );
  }

  await requireProject(input);

  return db.transaction(async (tx) => {
    const restored = await restoreTaskInProject(
      { ...input, version: input.expectedVersion },
      tx,
    );

    if (!restored) {
      throw taskVersionConflictError();
    }

    await recordTaskActivity(
      {
        actorUserId: input.userId,
        eventType: "task_restored",
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
      tx,
    );

    return restored;
  });
}

function taskVersionConflictError() {
  return new AppError(
    409,
    "TASK_VERSION_CONFLICT",
    "This task was changed by another user. Refresh it and try again.",
  );
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
      workspaceId: input.workspaceId,
    });

    if (!status) {
      throw new AppError(
        400,
        "TASK_STATUS_INVALID",
        "Task status must belong to this project",
      );
    }

    return status;
  }

  const status = await findDefaultProjectStatus(input);

  if (!status) {
    throw new AppError(
      409,
      "TASK_STATUS_REQUIRED",
      "Project does not have a default task status",
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
      "Assignee must be an active workspace member",
    );
  }
}

function updatedTaskFields(input: UpdateTaskRequest) {
  return Object.keys(input).sort();
}
