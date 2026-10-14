import { createHash, randomBytes } from "node:crypto";
import type {
  CreateWorkspaceInvitationRequest,
  PaginationQuery
} from "@devflow/shared";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import { canManageWorkspaceInvitations } from "./workspace-invitations.policy.js";
import {
  acceptInvitationTx,
  createWorkspaceInvitation,
  declineInvitationTx,
  deleteWorkspaceInvitation,
  findActiveMemberByEmail,
  findActiveWorkspaceMembership,
  findInvitationById,
  findInvitationByTokenHash,
  findPendingInvitationByEmail,
  findUserByEmailNormalized,
  listPendingInvitationsForWorkspace,
  removeInvitedMemberIfPresent,
  updateInvitationToken,
  upsertInvitedMember
} from "./workspace-invitations.repository.js";

const tokenBytes = 32;

export async function createInvitation(input: {
  input: CreateWorkspaceInvitationRequest;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceInvitations(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_INVITATION_FORBIDDEN",
      "You cannot invite members to this workspace"
    );
  }

  const emailNormalized = normalizeEmail(input.input.email);

  const activeMember = await findActiveMemberByEmail({
    emailNormalized,
    workspaceId: input.workspaceId
  });

  if (activeMember) {
    throw new AppError(
      409,
      "WORKSPACE_MEMBER_ALREADY_EXISTS",
      "A user with this email is already an active member of this workspace"
    );
  }

  const existingPending = await findPendingInvitationByEmail({
    emailNormalized,
    workspaceId: input.workspaceId
  });

  if (existingPending) {
    throw new AppError(
      409,
      "WORKSPACE_INVITATION_ALREADY_EXISTS",
      "A pending invitation already exists for this email address"
    );
  }

  const targetUser = await findUserByEmailNormalized(emailNormalized);
  if (targetUser) {
    await upsertInvitedMember({
      role: input.input.role,
      userId: targetUser.id,
      workspaceId: input.workspaceId
    });
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiresAt();

  const invitation = await createWorkspaceInvitation({
    email: input.input.email,
    emailNormalized,
    expiresAt,
    invitedByUserId: input.userId,
    role: input.input.role,
    tokenHash,
    workspaceId: input.workspaceId
  });

  if (!invitation) {
    throw new Error("Failed to load created workspace invitation");
  }

  return {
    invitation,
    token
  };
}

export async function listInvitations(input: {
  pagination: PaginationQuery;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceInvitations(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_INVITATION_FORBIDDEN",
      "You cannot view invitations for this workspace"
    );
  }

  const result = await listPendingInvitationsForWorkspace({
    pagination: input.pagination,
    workspaceId: input.workspaceId
  });

  return {
    invitations: result.invitations,
    pageInfo: buildPageInfo({
      ...input.pagination,
      total: result.total
    })
  };
}

export async function cancelInvitation(input: {
  invitationId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceInvitations(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_INVITATION_FORBIDDEN",
      "You cannot cancel invitations for this workspace"
    );
  }

  const invitation = await findInvitationById(input);

  if (!invitation) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Workspace invitation not found"
    );
  }

  await deleteWorkspaceInvitation(input);

  const targetUser = await findUserByEmailNormalized(
    invitation.emailNormalized
  );
  if (targetUser) {
    await removeInvitedMemberIfPresent({
      userId: targetUser.id,
      workspaceId: input.workspaceId
    });
  }
}

export async function resendInvitation(input: {
  invitationId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceInvitations(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_INVITATION_FORBIDDEN",
      "You cannot resend invitations for this workspace"
    );
  }

  const invitation = await findInvitationById(input);

  if (!invitation) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Workspace invitation not found"
    );
  }

  if (invitation.acceptedAt) {
    throw new AppError(
      409,
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED",
      "This invitation has already been accepted"
    );
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiresAt();

  const updated = await updateInvitationToken({
    expiresAt,
    invitationId: input.invitationId,
    tokenHash,
    workspaceId: input.workspaceId
  });

  if (!updated) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Workspace invitation not found"
    );
  }

  return {
    invitation: updated,
    token
  };
}

export async function getPublicInvitation(token: string) {
  const tokenHash = hashInvitationToken(token);
  const row = await findInvitationByTokenHash(tokenHash);

  if (!row) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Invitation not found"
    );
  }

  const now = new Date();
  const isExpired = row.expiresAt <= now;
  const isAccepted = Boolean(row.acceptedAt);
  const isRejected = Boolean(row.rejectedAt);

  return {
    email: row.email,
    expiresAt: row.expiresAt,
    id: row.id,
    inviterDisplayName: row.invitedBy?.displayName ?? null,
    isAccepted,
    isExpired,
    isRejected,
    role: row.role,
    workspaceName: row.workspace.name,
    workspaceSlug: row.workspace.slug
  };
}

export async function acceptInvitation(input: {
  token: string;
  userEmail: string;
  userId: string;
}) {
  const tokenHash = hashInvitationToken(input.token);
  const row = await findInvitationByTokenHash(tokenHash);

  if (!row) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Invitation not found"
    );
  }

  if (row.acceptedAt) {
    throw new AppError(
      409,
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED",
      "This invitation has already been accepted"
    );
  }

  if (row.rejectedAt) {
    throw new AppError(
      400,
      "WORKSPACE_INVITATION_DECLINED",
      "This invitation has been declined"
    );
  }

  if (row.expiresAt <= new Date()) {
    throw new AppError(
      400,
      "WORKSPACE_INVITATION_EXPIRED",
      "This invitation has expired"
    );
  }

  if (normalizeEmail(input.userEmail) !== row.emailNormalized) {
    throw new AppError(
      403,
      "INVITATION_EMAIL_MISMATCH",
      "This invitation was issued to another email address"
    );
  }

  await acceptInvitationTx({
    invitationId: row.id,
    role: row.role,
    userId: input.userId,
    workspaceId: row.workspaceId
  });

  return {
    role: row.role,
    workspaceId: row.workspaceId
  };
}

export async function declineInvitation(token: string) {
  const tokenHash = hashInvitationToken(token);
  const row = await findInvitationByTokenHash(tokenHash);

  if (!row) {
    throw new AppError(
      404,
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Invitation not found"
    );
  }

  if (row.acceptedAt) {
    throw new AppError(
      409,
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED",
      "This invitation has already been accepted"
    );
  }

  if (row.rejectedAt) {
    throw new AppError(
      400,
      "WORKSPACE_INVITATION_ALREADY_DECLINED",
      "This invitation has already been declined"
    );
  }

  if (row.expiresAt <= new Date()) {
    throw new AppError(
      400,
      "WORKSPACE_INVITATION_EXPIRED",
      "This invitation has expired"
    );
  }

  const targetUser = await findUserByEmailNormalized(row.emailNormalized);

  await declineInvitationTx({
    invitationId: row.id,
    userId: targetUser?.id,
    workspaceId: row.workspaceId
  });

  return {
    status: "declined"
  };
}

async function requireWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await findActiveWorkspaceMembership(input);

  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }

  return membership;
}

function generateInvitationToken() {
  return randomBytes(tokenBytes).toString("base64url");
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getInvitationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.INVITATION_TTL_DAYS);
  return expiresAt;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

