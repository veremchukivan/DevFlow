import {
  createProjectSprintRequestSchema,
  projectSprintParamsSchema,
  projectSprintsParamsSchema,
  updateProjectSprintRequestSchema,
  type ProjectSprintListResponse,
  type ProjectSprintResponse,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  createSprint,
  listSprints,
  removeSprint,
  updateSprint,
} from "./project-sprints.service.js";

export const projectSprintsRouter = Router({ mergeParams: true });
projectSprintsRouter.use(requireAuth);

projectSprintsRouter.get("/", async (req, res) => {
  const params = projectSprintsParamsSchema.parse(req.params);
  const sprints = await listSprints({ ...params, userId: userId(req) });
  res.json({
    sprints: sprints.map(toSprintDto),
  } satisfies ProjectSprintListResponse);
});
projectSprintsRouter.post("/", async (req, res) => {
  const params = projectSprintsParamsSchema.parse(req.params);
  const sprint = await createSprint({
    ...params,
    input: createProjectSprintRequestSchema.parse(req.body),
    userId: userId(req),
  });
  res
    .status(201)
    .json({ sprint: toSprintDto(sprint) } satisfies ProjectSprintResponse);
});
projectSprintsRouter.patch("/:sprintId", async (req, res) => {
  const params = projectSprintParamsSchema.parse(req.params);
  const sprint = await updateSprint({
    ...params,
    input: updateProjectSprintRequestSchema.parse(req.body),
    userId: userId(req),
  });
  res.json({ sprint: toSprintDto(sprint) } satisfies ProjectSprintResponse);
});
projectSprintsRouter.delete("/:sprintId", async (req, res) => {
  const params = projectSprintParamsSchema.parse(req.params);
  await removeSprint({ ...params, userId: userId(req) });
  res.status(204).send();
});
function userId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}
function toSprintDto(sprint: {
  completedAt: Date | null;
  createdAt: Date;
  createdByUserId: string | null;
  endDate: string | null;
  goal: string | null;
  id: string;
  name: string;
  projectId: string;
  startDate: string | null;
  status: "planning" | "active" | "completed";
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    ...sprint,
    completedAt: sprint.completedAt?.toISOString() ?? null,
    createdAt: sprint.createdAt.toISOString(),
    updatedAt: sprint.updatedAt.toISOString(),
  };
}
