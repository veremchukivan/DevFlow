import {
  projectViewPreferenceParamsSchema,
  projectViewPreferencesResponseSchema,
  updateProjectViewPreferencesRequestSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  getProjectViewPreferences,
  updateProjectViewPreferences,
} from "./project-view-preferences.service.js";

export const projectViewPreferencesRouter = Router({ mergeParams: true });
projectViewPreferencesRouter.use(requireAuth);

projectViewPreferencesRouter.get("/", async (req, res) => {
  const params = projectViewPreferenceParamsSchema.parse(req.params);
  const preferences = await getProjectViewPreferences({
    ...params,
    userId: (req as AuthenticatedRequest).auth.user.id,
  });
  res.json({
    preferences,
  } satisfies typeof projectViewPreferencesResponseSchema._output);
});

projectViewPreferencesRouter.patch("/", async (req, res) => {
  const params = projectViewPreferenceParamsSchema.parse(req.params);
  const preferences = await updateProjectViewPreferences({
    ...params,
    input: updateProjectViewPreferencesRequestSchema.parse(req.body),
    userId: (req as AuthenticatedRequest).auth.user.id,
  });
  res.json({
    preferences,
  } satisfies typeof projectViewPreferencesResponseSchema._output);
});
