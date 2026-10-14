import { z } from "zod";

import { workspaceMemberAssignableRoleSchema } from "./workspace-members.js";
import { workspaceRoleSchema } from "./workspaces.js";

// ---------------------------------------------------------------------------
// Request & Params Schemas
// ---------------------------------------------------------------------------

export const createWorkspaceInvitationRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  role: workspaceMemberAssignableRoleSchema.default("member")
});

export const workspaceInvitationsParamsSchema = z.object({
  workspaceId: z.uuid()
});

export const workspaceInvitationParamsSchema = workspaceInvitationsParamsSchema.extend({
  invitationId: z.uuid()
});

export const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1)
});

// ---------------------------------------------------------------------------
// DTO Schemas
// ---------------------------------------------------------------------------

export const invitationInviterSchema = z.object({
  displayName: z.string(),
  email: z.string().email(),
  id: z.uuid()
});

export const workspaceInvitationSchema = z.object({
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  email: z.string().email(),
  expiresAt: z.string().datetime(),
  id: z.uuid(),
  invitedBy: invitationInviterSchema.nullable(),
  invitedByUserId: z.uuid().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  role: workspaceRoleSchema,
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid()
});

export const publicWorkspaceInvitationSchema = z.object({
  email: z.string().email(),
  expiresAt: z.string().datetime(),
  id: z.uuid(),
  inviterDisplayName: z.string().nullable(),
  isAccepted: z.boolean(),
  isExpired: z.boolean(),
  isRejected: z.boolean(),
  role: workspaceRoleSchema,
  workspaceName: z.string(),
  workspaceSlug: z.string()
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const createWorkspaceInvitationResponseSchema = z.object({
  invitation: workspaceInvitationSchema,
  token: z.string()
});

export const workspaceInvitationResponseSchema = z.object({
  invitation: workspaceInvitationSchema
});

export const workspaceInvitationListResponseSchema = z.object({
  invitations: z.array(workspaceInvitationSchema)
});

export const publicWorkspaceInvitationResponseSchema = z.object({
  invitation: publicWorkspaceInvitationSchema
});

export const acceptInvitationResponseSchema = z.object({
  role: workspaceRoleSchema,
  workspaceId: z.uuid()
});

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export type CreateWorkspaceInvitationRequest = z.infer<
  typeof createWorkspaceInvitationRequestSchema
>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type PublicWorkspaceInvitation = z.infer<
  typeof publicWorkspaceInvitationSchema
>;
export type CreateWorkspaceInvitationResponse = z.infer<
  typeof createWorkspaceInvitationResponseSchema
>;
export type WorkspaceInvitationResponse = z.infer<
  typeof workspaceInvitationResponseSchema
>;
export type WorkspaceInvitationListResponse = z.infer<
  typeof workspaceInvitationListResponseSchema
>;
export type PublicWorkspaceInvitationResponse = z.infer<
  typeof publicWorkspaceInvitationResponseSchema
>;
export type AcceptInvitationResponse = z.infer<
  typeof acceptInvitationResponseSchema
>;

