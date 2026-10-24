import {
  addWorkspaceMemberRequestSchema,
  paginationQuerySchema,
  updateWorkspaceMemberRequestSchema,
  transferWorkspaceOwnershipRequestSchema,
  workspaceMemberParamsSchema,
  workspaceMembersParamsSchema,
  type WorkspaceMemberListResponse,
  type WorkspaceMemberResponse
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  addMember,
  leaveWorkspace,
  listMembers,
  removeMember,
  updateMember
  ,transferOwnership
} from "./workspace-members.service.js";

export const workspaceMembersRouter = Router({ mergeParams: true });

workspaceMembersRouter.use(requireAuth);

workspaceMembersRouter.get("/", async (req, res) => {
  const params = workspaceMembersParamsSchema.parse(req.params);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listMembers({
    pagination,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    members: result.members.map(toWorkspaceMemberDto),
    pageInfo: result.pageInfo
  } satisfies WorkspaceMemberListResponse);
});

workspaceMembersRouter.post("/", async (req, res) => {
  const params = workspaceMembersParamsSchema.parse(req.params);
  const input = addWorkspaceMemberRequestSchema.parse(req.body);
  const member = await addMember({
    input,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(201).json(toWorkspaceMemberResponse(member));
});

workspaceMembersRouter.patch("/:userId", async (req, res) => {
  const params = workspaceMemberParamsSchema.parse(req.params);
  const input = updateWorkspaceMemberRequestSchema.parse(req.body);
  const member = await updateMember({
    input,
    targetUserId: params.userId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toWorkspaceMemberResponse(member));
});

workspaceMembersRouter.delete("/:userId", async (req, res) => {
  const params = workspaceMemberParamsSchema.parse(req.params);
  await removeMember({
    targetUserId: params.userId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

workspaceMembersRouter.post("/leave", async (req, res) => {
  const params = workspaceMembersParamsSchema.parse(req.params);
  await leaveWorkspace({
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

workspaceMembersRouter.post("/transfer-ownership", async (req, res) => {
  const params = workspaceMembersParamsSchema.parse(req.params);
  const input = transferWorkspaceOwnershipRequestSchema.parse(req.body);
  await transferOwnership({ targetUserId: input.userId, userId: getAuthenticatedUserId(req), workspaceId: params.workspaceId });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toWorkspaceMemberResponse(
  member: Parameters<typeof toWorkspaceMemberDto>[0]
): WorkspaceMemberResponse {
  return {
    member: toWorkspaceMemberDto(member)
  };
}

function toWorkspaceMemberDto(member: {
  createdAt: Date;
  joinedAt: Date;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "invited" | "suspended";
  updatedAt: Date;
  user: {
    displayName: string;
    email: string;
    id: string;
  };
  userId: string;
  workspaceId: string;
}) {
  return {
    createdAt: member.createdAt.toISOString(),
    joinedAt: member.joinedAt.toISOString(),
    role: member.role,
    status: member.status,
    updatedAt: member.updatedAt.toISOString(),
    user: {
      displayName: member.user.displayName,
      email: member.user.email,
      id: member.user.id
    },
    userId: member.userId,
    workspaceId: member.workspaceId
  };
}
