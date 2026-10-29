import {
  taskWatcherListResponseSchema,
  taskWatcherParamsSchema,
  type TaskWatcherListResponse,
} from "@devflow/shared";
import { Router } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import { followTask, getTaskWatchers, unfollowTask } from "./task-watchers.service.js";

export const taskWatchersRouter = Router({ mergeParams: true });
taskWatchersRouter.use(requireAuth);

taskWatchersRouter.get("/", async (req, res) => {
  const params = taskWatcherParamsSchema.parse(req.params);
  res.json(toResponse(await getTaskWatchers({ ...params, userId: userId(req) })));
});

taskWatchersRouter.post("/me", async (req, res) => {
  const params = taskWatcherParamsSchema.parse(req.params);
  res.status(201).json(toResponse(await followTask({ ...params, userId: userId(req) })));
});

taskWatchersRouter.delete("/me", async (req, res) => {
  const params = taskWatcherParamsSchema.parse(req.params);
  res.json(toResponse(await unfollowTask({ ...params, userId: userId(req) })));
});

function userId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toResponse(input: Awaited<ReturnType<typeof getTaskWatchers>>): TaskWatcherListResponse {
  return taskWatcherListResponseSchema.parse({
    isWatching: input.isWatching,
    watchers: input.watchers.map((watcher) => ({
      createdAt: watcher.createdAt.toISOString(),
      taskId: watcher.taskId,
      user: { displayName: watcher.userDisplayName, id: watcher.userId },
      userId: watcher.userId,
    })),
  });
}
