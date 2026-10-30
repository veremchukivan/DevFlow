import type {
  CreateTaskRequest,
  ListTasksQuery,
  UpdateTaskRequest,
} from "@devflow/shared";

import { db } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  extractEmbeddedAttachmentReferences,
  sanitizeOptionalRichText,
} from "../../core/rich-text/sanitize.js";
import { buildPageInfo } from "../../core/pagination.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import {
  notifyTaskAssigned,
  notifyTaskWatchers,
} from "../notifications/notifications.service.js";
import { listTaskWatcherUserIds } from "../task-watchers/task-watchers.repository.js";
import { canCreateTask, canDeleteTask, canUpdateTask } from "./tasks.policy.js";
import { findProjectSprint } from "../project-sprints/project-sprints.repository.js";
import {
  createTaskWithNextNumber,
  createTaskFigmaLinkInDb,
  deleteTaskFigmaLinkInDb,
  findActiveWorkspaceMember,
  findActiveWorkspaceMembership,
  findDefaultProjectStatus,
  findProjectInWorkspace,
  findProjectStatusInProject,
  findTaskInProject,
  listTasksForProject,
  listTaskFigmaLinks,
  softDeleteTaskInProject,
  restoreTaskInProject,
  repositionTaskInProject,
  updateTaskInProject,
} from "./tasks.repository.js";
import { findTaskAttachment } from "../task-attachments/task-attachments.repository.js";
import { runWorkspaceAutomationForTaskTransition } from "../workspace-automation/workspace-automation.engine.js";
import { getWorkspaceSettings } from "../workspace-settings/workspace-settings.repository.js";

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
  const workspaceSettings = await getWorkspaceSettings(input.workspaceId);
  const assigneeUserId =
    input.input.assigneeUserId ?? workspaceSettings.defaultAssigneeUserId ?? undefined;
  const status = await resolveTaskStatus({
    projectId: input.projectId,
    statusId: input.input.statusId,
    workspaceId: input.workspaceId,
  });

  if (assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: assigneeUserId,
      workspaceId: input.workspaceId,
    });
  }
  if (input.input.sprintId) {
    await requireProjectSprint({
      projectId: input.projectId,
      sprintId: input.input.sprintId,
      workspaceId: input.workspaceId,
    });
  }
  if (input.input.parentTaskId) {
    await requireParentTask({
      parentTaskId: input.input.parentTaskId,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
    });
  }
  await requireWorkspaceTaskType({
    type: input.input.type ?? "task",
    workspaceId: input.workspaceId,
  });

  // createTaskWithNextNumber uses SELECT FOR UPDATE on the project row, which
  // serialises concurrent task creation for the same project and makes a
  // unique-violation on (workspace_id, project_id, number) impossible.
  // No retry loop is needed.
  const task = await createTaskWithNextNumber({
    activity: {
      actorUserId: input.userId,
      projectKey: project.key,
    },
    assigneeUserId,
    description: input.input.description
      ? (sanitizeOptionalRichText(input.input.description) ?? undefined)
      : undefined,
    dueDate: input.input.dueDate,
    estimateMinutes: input.input.estimateMinutes,
    parentTaskId: input.input.parentTaskId,
    priority: input.input.priority,
    projectId: input.projectId,
    reporterUserId: input.userId,
    statusId: status.id,
    sprintId: input.input.sprintId,
    title: input.input.title,
    type: input.input.type,
    workspaceId: input.workspaceId,
  });

  const createdTask = {
    ...task,
    projectKey: project.key,
    status,
  };
  await notifyTaskAssigned({
    actorUserId: input.userId,
    projectId: input.projectId,
    recipientUserId: createdTask.assigneeUserId,
    taskId: createdTask.id,
    taskKey: `${project.key}-${createdTask.number}`,
    taskTitle: createdTask.title,
    workspaceId: input.workspaceId,
  });
  return createdTask;
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

  return {
    pageInfo: buildPageInfo({
      limit: input.filters.limit,
      offset: input.filters.offset,
      total: result.total,
    }),
    tasks: result.tasks,
  };
}

export async function getTaskFigmaLinks(input: {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);
  await requireProject(input);
  await requireTask(input);
  return listTaskFigmaLinks(input);
}

export async function addTaskFigmaLink(input: {
  input: { name: string; url: string };
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);
  if (!canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_UPDATE_FORBIDDEN", "You cannot update tasks in this workspace");
  }
  await requireProject(input);
  await requireTask(input);
  const link = await createTaskFigmaLinkInDb({
    ...input.input,
    createdByUserId: input.userId,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  if (!link) throw new Error("Failed to create task Figma link");
  return link;
}

export async function removeTaskFigmaLink(input: {
  linkId: string;
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);
  if (!canUpdateTask(membership.role)) {
    throw new AppError(403, "TASK_UPDATE_FORBIDDEN", "You cannot update tasks in this workspace");
  }
  await requireProject(input);
  await requireTask(input);
  const deleted = await deleteTaskFigmaLinkInDb(input);
  if (!deleted) {
    throw new AppError(404, "TASK_FIGMA_LINK_NOT_FOUND", "Task Figma link not found");
  }
}

export async function repositionTask(input: {
  beforeTaskId?: string | null;
  projectId: string;
  statusId: string;
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
  const task = await requireTask(input);
  const status = await resolveTaskStatus(input);
  const repositioned = await repositionTaskInProject(input);
  if (!repositioned) {
    throw new AppError(
      400,
      "TASK_POSITION_INVALID",
      "The reference task must belong to the target status",
    );
  }

  if (task.statusId !== input.statusId) {
    await recordTaskActivity({
      actorUserId: input.userId,
      data: {
        fields: ["statusId"],
        statusName: status.name,
        taskKey: `${task.projectKey}-${task.number}`,
        title: task.title,
      },
      eventType: "task_updated",
      projectId: input.projectId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
    });
  }
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

  if (input.input.type !== undefined) {
    await requireWorkspaceTaskType({
      type: input.input.type,
      workspaceId: input.workspaceId,
    });
  }

  if (input.input.assigneeUserId) {
    await requireAssignableWorkspaceMember({
      userId: input.input.assigneeUserId,
      workspaceId: input.workspaceId,
    });
  }
  if (input.input.sprintId)
    await requireProjectSprint({ ...input, sprintId: input.input.sprintId });
  if (input.input.parentTaskId !== undefined) {
    if (input.input.parentTaskId === input.taskId) {
      throw new AppError(
        400,
        "TASK_PARENT_INVALID",
        "A task cannot be its own parent",
      );
    }
    if (input.input.parentTaskId) {
      await requireParentTask({
        parentTaskId: input.input.parentTaskId,
        projectId: input.projectId,
        workspaceId: input.workspaceId,
      });
    }
  }

  const description = sanitizeOptionalRichText(input.input.description);
  if (description)
    await requireValidDescriptionAttachments({ ...input, description });

  const result = await db.transaction(async (tx) => {
    const updatedTask = await updateTaskInProject(
      {
        assigneeUserId: input.input.assigneeUserId,
        description,
        dueDate: input.input.dueDate,
        estimateMinutes: input.input.estimateMinutes,
        parentTaskId: input.input.parentTaskId,
        priority: input.input.priority,
        projectId: input.projectId,
        statusId: input.input.statusId,
        sprintId: input.input.sprintId,
        taskId: input.taskId,
        title: input.input.title,
        type: input.input.type,
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
          ...(input.input.statusId !== undefined &&
          input.input.statusId !== existingTask.statusId
            ? { statusName: updatedTaskWithRelations.status.name }
            : {}),
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
  if (
    input.input.assigneeUserId !== undefined &&
    input.input.assigneeUserId !== existingTask.assigneeUserId
  ) {
    await notifyTaskAssigned({
      actorUserId: input.userId,
      projectId: input.projectId,
      recipientUserId: result.assigneeUserId,
      taskId: result.id,
      taskKey: `${existingTask.projectKey}-${result.number}`,
      taskTitle: result.title,
      workspaceId: input.workspaceId,
    });
  }
  if (
    input.input.statusId !== undefined &&
    input.input.statusId !== existingTask.statusId &&
    input.input.assigneeUserId === undefined
  ) {
    const watcherUserIds = await listTaskWatcherUserIds(input);
    await notifyTaskWatchers({
      actorUserId: input.userId,
      projectId: input.projectId,
      recipientUserIds: [result.assigneeUserId, ...watcherUserIds],
      statusName: result.status.name,
      taskId: result.id,
      taskKey: `${existingTask.projectKey}-${result.number}`,
      taskTitle: result.title,
      type: "task_status_changed",
      workspaceId: input.workspaceId,
    });
  }
  if (
    input.input.statusId !== undefined &&
    input.input.statusId !== existingTask.statusId
  ) {
    // Automation must never make a successful user update look like a failed
    // request. Individual flow failures are persisted in the flow audit log.
    const settings = await getWorkspaceSettings(input.workspaceId);
    if (settings.features.automation !== false) {
      try {
        await runWorkspaceAutomationForTaskTransition({
          actorUserId: input.userId,
          projectId: input.projectId,
          taskId: result.id,
          workspaceId: input.workspaceId,
        });
      } catch {
        // The task update is already durable. A transient automation issue must
        // not turn a successful task change into a client-visible failure.
      }
    }
  }
  return result;
}

async function requireValidDescriptionAttachments(input: {
  description: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  for (const reference of extractEmbeddedAttachmentReferences(
    input.description,
  )) {
    const attachment = await findTaskAttachment({
      attachmentId: reference.attachmentId,
      projectId: input.projectId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
    });
    const matchesMediaType =
      (reference.kind === "img" && attachment?.mimeType.startsWith("image/")) ||
      (reference.kind === "video" && attachment?.mimeType.startsWith("video/"));

    if (!attachment || attachment.commentId || !matchesMediaType) {
      throw new AppError(
        400,
        "DESCRIPTION_ATTACHMENT_INVALID",
        "Description media must be an image or video attached to this task",
      );
    }
  }
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

async function requireWorkspaceTaskType(input: {
  type: "bug" | "feature" | "story" | "task";
  workspaceId: string;
}) {
  const settings = await getWorkspaceSettings(input.workspaceId);
  if (!settings.enabledTaskTypes.includes(input.type)) {
    throw new AppError(
      400,
      "TASK_TYPE_DISABLED",
      "This work type is disabled in the workspace settings",
    );
  }
}

async function requireProjectSprint(input: {
  projectId: string;
  sprintId: string;
  workspaceId: string;
}) {
  if (!(await findProjectSprint(input))) {
    throw new AppError(
      400,
      "TASK_SPRINT_INVALID",
      "Sprint must belong to this project",
    );
  }
}

async function requireParentTask(input: {
  parentTaskId: string;
  projectId: string;
  workspaceId: string;
}) {
  const parentTask = await findTaskInProject({
    projectId: input.projectId,
    taskId: input.parentTaskId,
    workspaceId: input.workspaceId,
  });

  if (!parentTask) {
    throw new AppError(
      400,
      "TASK_PARENT_INVALID",
      "Parent task must belong to this project",
    );
  }

  if (parentTask.parentTaskId) {
    throw new AppError(
      400,
      "TASK_PARENT_NESTING_NOT_SUPPORTED",
      "A subtask cannot have its own subtasks",
    );
  }
}

function updatedTaskFields(input: UpdateTaskRequest) {
  return Object.keys(input).sort();
}
