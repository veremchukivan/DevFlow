import {
  createTaskRequestSchema,
  createTaskFigmaLinkRequestSchema,
  listTasksQuerySchema,
  repositionTaskRequestSchema,
  projectTasksParamsSchema,
  taskParamsSchema,
  taskFigmaLinkParamsSchema,
  updateTaskRequestSchema,
  type TaskListResponse,
  type TaskResponse,
} from "@devflow/shared";
import { Router } from "express";

import { AppError } from "../../core/errors/app-error.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  createTask,
  addTaskFigmaLink,
  deleteTask,
  restoreTask,
  getTask,
  getTaskFigmaLinks,
  listTasks,
  repositionTask,
  updateTask,
  removeTaskFigmaLink,
} from "./tasks.service.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(requireAuth);

tasksRouter.post("/", async (req, res) => {
  const params = projectTasksParamsSchema.parse(req.params);
  const input = createTaskRequestSchema.parse(req.body);
  const task = await createTask({
    input,
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
  });

  res.set("ETag", toTaskEtag(task.version));
  res.status(201).json(toTaskResponse(task));
});

tasksRouter.get("/", async (req, res) => {
  const params = projectTasksParamsSchema.parse(req.params);
  const filters = listTasksQuerySchema.parse(req.query);
  const result = await listTasks({
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
    filters,
  });

  res.json({
    pageInfo: result.pageInfo,
    tasks: result.tasks.map(toTaskDto),
  } satisfies TaskListResponse);
});

tasksRouter.get("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const task = await getTask({
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
  });

  res.set("ETag", toTaskEtag(task.version));
  res.json(toTaskResponse(task));
});

tasksRouter.get("/:taskId/figma-links", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const links = await getTaskFigmaLinks({ ...params, userId: getAuthenticatedUserId(req) });
  res.json({ links: links.map(toTaskFigmaLinkDto) });
});

tasksRouter.post("/:taskId/figma-links", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const link = await addTaskFigmaLink({
    ...params,
    input: createTaskFigmaLinkRequestSchema.parse(req.body),
    userId: getAuthenticatedUserId(req),
  });
  res.status(201).json({ link: toTaskFigmaLinkDto(link) });
});

tasksRouter.delete("/:taskId/figma-links/:linkId", async (req, res) => {
  const params = taskFigmaLinkParamsSchema.parse(req.params);
  await removeTaskFigmaLink({ ...params, userId: getAuthenticatedUserId(req) });
  res.status(204).send();
});

tasksRouter.patch("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const input = updateTaskRequestSchema.parse(req.body);
  const task = await updateTask({
    expectedVersion: getExpectedTaskVersion(req),
    input,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
  });

  res.set("ETag", toTaskEtag(task.version));
  res.json(toTaskResponse(task));
});

tasksRouter.put("/:taskId/position", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  await repositionTask({
    ...params,
    ...repositionTaskRequestSchema.parse(req.body),
    userId: getAuthenticatedUserId(req),
  });
  res.status(204).send();
});

tasksRouter.delete("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  await deleteTask({
    expectedVersion: getExpectedTaskVersion(req),
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
  });

  res.status(204).send();
});

tasksRouter.post("/:taskId/restore", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  await restoreTask({
    ...params,
    expectedVersion: getExpectedTaskVersion(req),
    userId: getAuthenticatedUserId(req),
  });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toTaskFigmaLinkDto(link: {
  createdAt: Date;
  createdByUserId: string | null;
  id: string;
  name: string;
  projectId: string;
  taskId: string;
  updatedAt: Date;
  url: string;
  workspaceId: string;
}) {
  return {
    ...link,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

function getExpectedTaskVersion(req: {
  get(name: string): string | undefined;
}) {
  const ifMatch = req.get("if-match");

  if (!ifMatch) {
    throw new AppError(
      428,
      "TASK_VERSION_REQUIRED",
      "The If-Match header with the current task ETag is required",
    );
  }

  const match = /^"([1-9]\d*)"$/.exec(ifMatch);
  const version = match?.[1] ? Number(match[1]) : Number.NaN;

  if (!Number.isSafeInteger(version)) {
    throw new AppError(
      400,
      "INVALID_TASK_VERSION",
      'If-Match must use a task ETag, for example: "1"',
    );
  }

  return version;
}

function toTaskResponse(task: Parameters<typeof toTaskDto>[0]): TaskResponse {
  return {
    task: toTaskDto(task),
  };
}

function toTaskDto(task: {
  assigneeDisplayName?: string | null;
  assigneeEmail?: string | null;
  assigneeId?: string | null;
  assigneeUserId: string | null;
  attachmentCount: number;
  checklistCompletedCount: number;
  checklistTotalCount: number;
  commentCount: number;
  createdAt: Date;
  description: string | null;
  dueDate: string | null;
  id: string;
  number: number;
  position: number;
  parentTaskId: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  projectId: string;
  projectKey: string;
  reporterDisplayName?: string | null;
  reporterEmail?: string | null;
  reporterId?: string | null;
  reporterUserId: string | null;
  status: {
    category: "todo" | "in_progress" | "done";
    color: string;
    id: string;
    name: string;
    position: number;
    projectId: string;
    workspaceId: string;
  };
  statusId: string;
  sprintId: string | null;
  title: string;
  type: "bug" | "feature" | "story" | "task";
  updatedAt: Date;
  version: number;
  workspaceId: string;
}) {
  return {
    assignee:
      task.assigneeId && task.assigneeDisplayName && task.assigneeEmail
        ? {
            displayName: task.assigneeDisplayName,
            email: task.assigneeEmail,
            id: task.assigneeId,
          }
        : null,
    assigneeUserId: task.assigneeUserId,
    createdAt: task.createdAt.toISOString(),
    description: task.description,
    dueDate: task.dueDate,
    id: task.id,
    metrics: {
      attachmentCount: task.attachmentCount,
      checklistCompletedCount: task.checklistCompletedCount,
      checklistTotalCount: task.checklistTotalCount,
      commentCount: task.commentCount,
    },
    key: `${task.projectKey}-${task.number}`,
    number: task.number,
    position: task.position,
    parentTaskId: task.parentTaskId,
    priority: task.priority,
    projectId: task.projectId,
    reporter:
      task.reporterId && task.reporterDisplayName && task.reporterEmail
        ? {
            displayName: task.reporterDisplayName,
            email: task.reporterEmail,
            id: task.reporterId,
          }
        : null,
    reporterUserId: task.reporterUserId,
    status: {
      category: task.status.category,
      color: task.status.color,
      id: task.status.id,
      name: task.status.name,
      position: task.status.position,
      projectId: task.status.projectId,
      workspaceId: task.status.workspaceId,
    },
    statusId: task.statusId,
    sprintId: task.sprintId,
    title: task.title,
    type: task.type,
    updatedAt: task.updatedAt.toISOString(),
    version: task.version,
    workspaceId: task.workspaceId,
  };
}

function toTaskEtag(version: number) {
  return `"${version}"`;
}
