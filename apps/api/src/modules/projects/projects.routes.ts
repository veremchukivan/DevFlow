import {
  createProjectRequestSchema,
  createProjectStatusRequestSchema,
  paginationQuerySchema,
  projectParamsSchema,
  projectStatusParamsSchema,
  reorderProjectStatusesRequestSchema,
  updateProjectRequestSchema,
  updateProjectStatusRequestSchema,
  workspaceProjectsParamsSchema,
  type ProjectListResponse,
  type ProjectResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  createProject,
  createProjectStatus,
  deleteProjectStatus,
  deleteProject,
  getProject,
  listProjects,
  reorderProjectStatuses,
  updateProject,
  updateProjectStatus
} from "./projects.service.js";

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.use(requireAuth);

projectsRouter.post("/", async (req, res) => {
  const params = workspaceProjectsParamsSchema.parse(req.params);
  const input = createProjectRequestSchema.parse(req.body);
  const project = await createProject({
    input,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(201).json(toProjectResponse(project));
});

projectsRouter.get("/", async (req, res) => {
  const params = workspaceProjectsParamsSchema.parse(req.params);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listProjects({
    pagination,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    pageInfo: result.pageInfo,
    projects: result.projects.map(toProjectSummaryDto)
  } satisfies ProjectListResponse);
});

projectsRouter.get("/:projectId", async (req, res) => {
  const params = projectParamsSchema.parse(req.params);
  const project = await getProject({
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toProjectResponse(project));
});

projectsRouter.patch("/:projectId", async (req, res) => {
  const params = projectParamsSchema.parse(req.params);
  const input = updateProjectRequestSchema.parse(req.body);
  const project = await updateProject({
    input,
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toProjectResponse(project));
});

projectsRouter.delete("/:projectId", async (req, res) => {
  const params = projectParamsSchema.parse(req.params);
  await deleteProject({
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

projectsRouter.post("/:projectId/statuses", async (req, res) => {
  const params = projectParamsSchema.parse(req.params);
  const project = await createProjectStatus({
    input: createProjectStatusRequestSchema.parse(req.body),
    projectId: params.projectId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });
  res.status(201).json(toProjectResponse(project));
});

projectsRouter.put("/:projectId/statuses/order", async (req, res) => {
  const params = projectParamsSchema.parse(req.params);
  const input = reorderProjectStatusesRequestSchema.parse(req.body);
  const project = await reorderProjectStatuses({
    ...params,
    ...input,
    userId: getAuthenticatedUserId(req)
  });

  res.json(toProjectResponse(project));
});

projectsRouter.patch("/:projectId/statuses/:statusId", async (req, res) => {
  const params = projectStatusParamsSchema.parse(req.params);
  const project = await updateProjectStatus({
    input: updateProjectStatusRequestSchema.parse(req.body),
    ...params,
    userId: getAuthenticatedUserId(req)
  });
  res.json(toProjectResponse(project));
});

projectsRouter.delete("/:projectId/statuses/:statusId", async (req, res) => {
  const params = projectStatusParamsSchema.parse(req.params);
  await deleteProjectStatus({ ...params, userId: getAuthenticatedUserId(req) });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toProjectResponse(
  project: Parameters<typeof toProjectDto>[0]
): ProjectResponse {
  return {
    project: toProjectDto(project)
  };
}

function toProjectSummaryDto(project: {
  createdAt: Date;
  description: string | null;
  id: string;
  key: string;
  name: string;
  ownerUserId: string | null;
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    createdAt: project.createdAt.toISOString(),
    description: project.description,
    id: project.id,
    key: project.key,
    name: project.name,
    ownerUserId: project.ownerUserId,
    updatedAt: project.updatedAt.toISOString(),
    workspaceId: project.workspaceId
  };
}

function toProjectDto(project: Parameters<typeof toProjectSummaryDto>[0] & {
  statuses: Array<{
    category: "todo" | "in_progress" | "done";
    color: string;
    id: string;
    isDefault: boolean;
    name: string;
    position: number;
    projectId: string;
    workspaceId: string;
  }>;
}) {
  return {
    ...toProjectSummaryDto(project),
    statuses: project.statuses.map((status) => ({
      category: status.category,
      color: status.color,
      id: status.id,
      isDefault: status.isDefault,
      name: status.name,
      position: status.position,
      projectId: status.projectId,
      workspaceId: status.workspaceId
    }))
  };
}
