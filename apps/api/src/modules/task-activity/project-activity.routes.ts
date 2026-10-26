import {
  paginationQuerySchema,
  projectActivityParamsSchema,
  type TaskActivityEventListResponse,
} from "@devflow/shared";
import { Router } from "express";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import { listProjectActivity } from "./task-activity.service.js";

export const projectActivityRouter = Router({ mergeParams: true });
projectActivityRouter.use(requireAuth);
projectActivityRouter.get("/", async (req, res) => {
  const params = projectActivityParamsSchema.parse(req.params);
  const result = await listProjectActivity({
    pagination: paginationQuerySchema.parse(req.query),
    projectId: params.projectId,
    userId: (req as AuthenticatedRequest).auth.user.id,
    workspaceId: params.workspaceId,
  });
  res.json({
    events: result.events.map((event) => ({
      ...event,
      actor:
        event.actorId && event.actorDisplayName
          ? { id: event.actorId, displayName: event.actorDisplayName }
          : null,
      createdAt: event.createdAt.toISOString(),
    })),
    pageInfo: result.pageInfo,
  } satisfies TaskActivityEventListResponse);
});
