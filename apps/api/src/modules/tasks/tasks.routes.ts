import {
  createTaskRequestSchema,
  listTasksQuerySchema,
  projectTasksParamsSchema,
  taskParamsSchema,
  updateTaskRequestSchema,
  type TaskListResponse,
  type TaskResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask
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
    workspaceId: params.workspaceId
  });

  res.status(201).json(toTaskResponse(task));
});

tasksRouter.get("/", async (req, res) => {
  const params = projectTasksParamsSchema.parse(req.params);
  const filters = listTasksQuerySchema.parse(req.query);
  const tasks = await listTasks({
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId,
    filters
  });

  res.json({
    tasks: tasks.map(toTaskDto)
  } satisfies TaskListResponse);
});

tasksRouter.get("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const task = await getTask({
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toTaskResponse(task));
});

tasksRouter.patch("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  const input = updateTaskRequestSchema.parse(req.body);
  const task = await updateTask({
    input,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toTaskResponse(task));
});

tasksRouter.delete("/:taskId", async (req, res) => {
  const params = taskParamsSchema.parse(req.params);
  await deleteTask({
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toTaskResponse(task: Parameters<typeof toTaskDto>[0]): TaskResponse {
  return {
    task: toTaskDto(task)
  };
}

function toTaskDto(task: {
  assigneeUserId: string | null;
  createdAt: Date;
  description: string | null;
  id: string;
  number: number;
  priority: "low" | "medium" | "high" | "urgent";
  projectId: string;
  projectKey: string;
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
  workspaceId: string;
}) {
  return {
    assigneeUserId: task.assigneeUserId,
    createdAt: task.createdAt.toISOString(),
    description: task.description,
    id: task.id,
    key: `${task.projectKey}-${task.number}`,
    number: task.number,
    priority: task.priority,
    projectId: task.projectId,
    reporterUserId: task.reporterUserId,
    status: {
      category: task.status.category,
      color: task.status.color,
      id: task.status.id,
      name: task.status.name,
      position: task.status.position,
      projectId: task.status.projectId,
      workspaceId: task.status.workspaceId
    },
    statusId: task.statusId,
    title: task.title,
    updatedAt: task.updatedAt.toISOString(),
    workspaceId: task.workspaceId
  };
}
