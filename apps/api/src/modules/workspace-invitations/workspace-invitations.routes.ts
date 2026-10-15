import {
  acceptInvitationResponseSchema,
  createWorkspaceInvitationRequestSchema,
  createWorkspaceInvitationResponseSchema,
  invitationTokenParamsSchema,
  paginationQuerySchema,
  publicWorkspaceInvitationResponseSchema,
  workspaceInvitationListResponseSchema,
  workspaceInvitationParamsSchema,
  workspaceInvitationResponseSchema,
  workspaceInvitationsParamsSchema,
  type AcceptInvitationResponse,
  type CreateWorkspaceInvitationResponse,
  type PublicWorkspaceInvitationResponse,
  type WorkspaceInvitationListResponse,
  type WorkspaceInvitationResponse
} from "@devflow/shared";
import { Router } from "express";

import { env } from "../../config/env.js";
import {
  type AuthenticatedRequest,
  requireAuth
} from "../auth/auth.middleware.js";
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  declineInvitation,
  getPublicInvitation,
  listInvitations,
  resendInvitation
} from "./workspace-invitations.service.js";

// ---------------------------------------------------------------------------
// Workspace-scoped Router (/api/v1/workspaces/:workspaceId/invitations)
// ---------------------------------------------------------------------------

export const workspaceInvitationsRouter = Router({ mergeParams: true });

workspaceInvitationsRouter.use(requireAuth);

workspaceInvitationsRouter.post("/", async (req, res) => {
  const params = workspaceInvitationsParamsSchema.parse(req.params);
  const input = createWorkspaceInvitationRequestSchema.parse(req.body);
  const result = await createInvitation({
    input,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(201).json(toInvitationResponse(result));
});

workspaceInvitationsRouter.get("/", async (req, res) => {
  const params = workspaceInvitationsParamsSchema.parse(req.params);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await listInvitations({
    pagination,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json({
    invitations: result.invitations.map(toWorkspaceInvitationDto),
    pageInfo: result.pageInfo
  } satisfies WorkspaceInvitationListResponse);
});

workspaceInvitationsRouter.delete("/:invitationId", async (req, res) => {
  const params = workspaceInvitationParamsSchema.parse(req.params);
  await cancelInvitation({
    invitationId: params.invitationId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.status(204).send();
});

workspaceInvitationsRouter.post("/:invitationId/resend", async (req, res) => {
  const params = workspaceInvitationParamsSchema.parse(req.params);
  const result = await resendInvitation({
    invitationId: params.invitationId,
    userId: getAuthenticatedUserId(req),
    workspaceId: params.workspaceId
  });

  res.json(toInvitationResponse(result));
});

// ---------------------------------------------------------------------------
// Token-scoped Public Router (/api/v1/invitations)
// ---------------------------------------------------------------------------

export const publicInvitationsRouter = Router();

publicInvitationsRouter.get("/:token", async (req, res) => {
  const params = invitationTokenParamsSchema.parse(req.params);
  const invitation = await getPublicInvitation(params.token);

  res.json({
    invitation: {
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
      id: invitation.id,
      inviterDisplayName: invitation.inviterDisplayName,
      isAccepted: invitation.isAccepted,
      isExpired: invitation.isExpired,
      isRejected: invitation.isRejected,
      role: invitation.role,
      workspaceName: invitation.workspaceName,
      workspaceSlug: invitation.workspaceSlug
    }
  } satisfies PublicWorkspaceInvitationResponse);
});

publicInvitationsRouter.post("/:token/accept", requireAuth, async (req, res) => {
  const params = invitationTokenParamsSchema.parse(req.params);
  const user = getAuthenticatedUser(req);
  const result = await acceptInvitation({
    token: params.token,
    userEmail: user.email,
    userId: user.id
  });

  res.json({
    role: result.role,
    workspaceId: result.workspaceId
  } satisfies AcceptInvitationResponse);
});

publicInvitationsRouter.post("/:token/decline", async (req, res) => {
  const params = invitationTokenParamsSchema.parse(req.params);
  const result = await declineInvitation(params.token);

  res.json(result);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function getAuthenticatedUser(req: unknown) {
  return (req as AuthenticatedRequest).auth.user;
}

function toInvitationResponse(result: {
  invitation: Parameters<typeof toWorkspaceInvitationDto>[0];
  token: string;
}): CreateWorkspaceInvitationResponse {
  const response = {
    invitation: toWorkspaceInvitationDto(result.invitation)
  };

  // Production must deliver the raw token through an email provider, not JSON.
  if (!shouldExposeInvitationToken(env.NODE_ENV)) {
    return response;
  }

  return {
    ...response,
    token: result.token
  };
}

export function shouldExposeInvitationToken(nodeEnv: string) {
  return nodeEnv === "development" || nodeEnv === "test";
}

function toWorkspaceInvitationDto(invitation: {
  acceptedAt: Date | null;
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  invitedBy: {
    displayName: string;
    email: string;
    id: string;
  } | null;
  invitedByUserId: string | null;
  rejectedAt: Date | null;
  role: "owner" | "admin" | "member" | "viewer";
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    createdAt: invitation.createdAt.toISOString(),
    email: invitation.email,
    expiresAt: invitation.expiresAt.toISOString(),
    id: invitation.id,
    invitedBy: invitation.invitedBy
      ? {
          displayName: invitation.invitedBy.displayName,
          email: invitation.invitedBy.email,
          id: invitation.invitedBy.id
        }
      : null,
    invitedByUserId: invitation.invitedByUserId,
    rejectedAt: invitation.rejectedAt ? invitation.rejectedAt.toISOString() : null,
    role: invitation.role,
    updatedAt: invitation.updatedAt.toISOString(),
    workspaceId: invitation.workspaceId
  };
}

