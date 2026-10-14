import {
  createWorkspaceRequestSchema,
  paginationQuerySchema,
  workspaceParamsSchema,
  type WorkspaceListResponse,
  type WorkspaceResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces
} from "./workspaces.service.js";
import { leaveWorkspace } from "../workspace-members/workspace-members.service.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.post("/", async (req, res) => {
  const input = createWorkspaceRequestSchema.parse(req.body);
  const workspace = await createWorkspace(getAuthenticatedUserId(req), input);

  res.status(201).json(toWorkspaceResponse(workspace));
});

workspacesRouter.get("/", async (req, res) => {
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listWorkspaces({
    pagination,
    userId: getAuthenticatedUserId(req)
  });

  res.json({
    pageInfo: result.pageInfo,
    workspaces: result.workspaces.map(toWorkspaceDto)
  } satisfies WorkspaceListResponse);
});

workspacesRouter.get("/:workspaceId", async (req, res) => {
  const params = workspaceParamsSchema.parse(req.params);
  const workspace = await getWorkspace(
    getAuthenticatedUserId(req),
    params.workspaceId
  );

  res.json(toWorkspaceResponse(workspace));
});

workspacesRouter.post("/:workspaceId/leave", async (req, res) => {
  const params = workspaceParamsSchema.parse(req.params);
  await leaveWorkspace({
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toWorkspaceResponse(
  workspace: Parameters<typeof toWorkspaceDto>[0]
): WorkspaceResponse {
  return {
    workspace: toWorkspaceDto(workspace)
  };
}

function toWorkspaceDto(workspace: {
  createdAt: Date;
  id: string;
  name: string;
  ownerUserId: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  slug: string;
  updatedAt: Date;
}) {
  return {
    createdAt: workspace.createdAt.toISOString(),
    id: workspace.id,
    name: workspace.name,
    ownerUserId: workspace.ownerUserId,
    role: workspace.role,
    slug: workspace.slug,
    updatedAt: workspace.updatedAt.toISOString()
  };
}
