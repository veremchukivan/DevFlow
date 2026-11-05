import {
  workspaceSearchParamsSchema,
  workspaceSearchQuerySchema,
  workspaceSearchResponseSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import { searchWorkspace } from "./workspace-search.service.js";

export const workspaceSearchRouter = Router({ mergeParams: true });
workspaceSearchRouter.use(requireAuth);
workspaceSearchRouter.get("/", async (req, res) => {
  const params = workspaceSearchParamsSchema.parse(req.params);
  const query = workspaceSearchQuerySchema.parse(req.query);
  res.json(
    workspaceSearchResponseSchema.parse({
      results: await searchWorkspace({
        ...params,
        query: query.query,
        userId: (req as AuthenticatedRequest).auth.user.id,
      }),
    }),
  );
});
