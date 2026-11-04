import {
  createTaskChecklistItemRequestSchema,
  taskChecklistItemParamsSchema,
  taskChecklistParamsSchema,
  updateTaskChecklistItemRequestSchema,
  type TaskChecklistListResponse,
  type TaskChecklistResponse,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  createChecklistItem,
  listChecklistItems,
  removeChecklistItem,
  updateChecklistItem,
} from "./task-checklists.service.js";

export const taskChecklistsRouter = Router({ mergeParams: true });

taskChecklistsRouter.use(requireAuth);

taskChecklistsRouter.get("/", async (req, res) => {
  const params = taskChecklistParamsSchema.parse(req.params);
  const result = await listChecklistItems({
    ...params,
    userId: getAuthenticatedUserId(req),
  });
  res.json({
    items: result.items.map(toTaskChecklistItemDto),
    progress: result.progress,
  } satisfies TaskChecklistListResponse);
});

taskChecklistsRouter.post("/", async (req, res) => {
  const params = taskChecklistParamsSchema.parse(req.params);
  const input = createTaskChecklistItemRequestSchema.parse(req.body);
  const item = await createChecklistItem({
    ...params,
    input,
    userId: getAuthenticatedUserId(req),
  });
  res.status(201).json(toTaskChecklistResponse(item));
});

taskChecklistsRouter.patch("/:itemId", async (req, res) => {
  const params = taskChecklistItemParamsSchema.parse(req.params);
  const input = updateTaskChecklistItemRequestSchema.parse(req.body);
  const item = await updateChecklistItem({
    ...params,
    input,
    userId: getAuthenticatedUserId(req),
  });
  res.json(toTaskChecklistResponse(item));
});

taskChecklistsRouter.delete("/:itemId", async (req, res) => {
  const params = taskChecklistItemParamsSchema.parse(req.params);
  await removeChecklistItem({ ...params, userId: getAuthenticatedUserId(req) });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toTaskChecklistResponse(
  item: Parameters<typeof toTaskChecklistItemDto>[0],
): TaskChecklistResponse {
  return { item: toTaskChecklistItemDto(item) };
}

function toTaskChecklistItemDto(item: {
  content: string;
  createdAt: Date;
  id: string;
  isCompleted: boolean;
  position: number;
  projectId: string;
  taskId: string;
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    content: item.content,
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    isCompleted: item.isCompleted,
    position: item.position,
    projectId: item.projectId,
    taskId: item.taskId,
    updatedAt: item.updatedAt.toISOString(),
    workspaceId: item.workspaceId,
  };
}
