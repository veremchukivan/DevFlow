import {
  createTaskRequestSchema,
  listTasksQuerySchema,
  projectTasksParamsSchema,
  taskParamsSchema,
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
  deleteTask,
  getTask,
  listTasks,
  updateTask,
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

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
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
  createdAt: Date;
  description: string | null;
  dueDate: string | null;
  id: string;
  number: number;
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
  title: string;
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
    key: `${task.projectKey}-${task.number}`,
    number: task.number,
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
    title: task.title,
    updatedAt: task.updatedAt.toISOString(),
    version: task.version,
    workspaceId: task.workspaceId,
  };
}

function toTaskEtag(version: number) {
  return `"${version}"`;
}
