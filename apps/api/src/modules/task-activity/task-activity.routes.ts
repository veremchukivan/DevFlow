import {
  paginationQuerySchema,
  taskActivityParamsSchema,
  type TaskActivityEventListResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import { listTaskActivity } from "./task-activity.service.js";

export const taskActivityRouter = Router({ mergeParams: true });

taskActivityRouter.use(requireAuth);

taskActivityRouter.get("/", async (req, res) => {
  const params = taskActivityParamsSchema.parse(req.params);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listTaskActivity({
    pagination,
    projectId: params.projectId,
    taskId: params.taskId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    events: result.events.map(toTaskActivityEventDto),
    pageInfo: result.pageInfo
  } satisfies TaskActivityEventListResponse);
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toTaskActivityEventDto(event: {
  actorDisplayName: string | null;
  actorId: string | null;
  actorUserId: string | null;
  createdAt: Date;
  data: Record<string, unknown>;
  eventType:
    | "task_created"
    | "task_updated"
    | "task_deleted"
    | "task_comment_created"
    | "task_comment_updated"
    | "task_comment_deleted";
  id: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  return {
    actor:
      event.actorId && event.actorDisplayName
        ? {
            displayName: event.actorDisplayName,
            id: event.actorId
          }
        : null,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
    data: event.data,
    eventType: event.eventType,
    id: event.id,
    projectId: event.projectId,
    taskId: event.taskId,
    workspaceId: event.workspaceId
  };
}
