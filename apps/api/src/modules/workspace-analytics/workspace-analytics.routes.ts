import {
  workspaceAnalyticsParamsSchema,
  workspaceAnalyticsQuerySchema,
  workspaceAnalyticsResponseSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import { getWorkspaceAnalytics } from "./workspace-analytics.service.js";

export const workspaceAnalyticsRouter = Router({ mergeParams: true });
workspaceAnalyticsRouter.use(requireAuth);
workspaceAnalyticsRouter.get("/", async (req, res) => {
  const params = workspaceAnalyticsParamsSchema.parse(req.params);
  const query = workspaceAnalyticsQuerySchema.parse(req.query);
  res.json(
    workspaceAnalyticsResponseSchema.parse(
      await getWorkspaceAnalytics({
        ...params,
        query,
        userId: (req as AuthenticatedRequest).auth.user.id,
      }),
    ),
  );
});
