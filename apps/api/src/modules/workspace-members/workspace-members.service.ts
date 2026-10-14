import type {
  AddWorkspaceMemberRequest,
  PaginationQuery,
  UpdateWorkspaceMemberRequest
} from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import { canManageWorkspaceMembers } from "./workspace-members.policy.js";
import {
  createWorkspaceMember,
  deleteWorkspaceMember,
  findActiveWorkspaceMembership,
  findUserByEmailNormalized,
  findWorkspaceMember,
  listWorkspaceMembers,
  updateWorkspaceMember
} from "./workspace-members.repository.js";

export async function listMembers(input: {
  pagination: PaginationQuery;
  userId: string;
  workspaceId: string;
}) {
  await requireWorkspaceMembership(input);

  const result = await listWorkspaceMembers({
    pagination: input.pagination,
    workspaceId: input.workspaceId
  });

  return {
    members: result.members,
    pageInfo: buildPageInfo({
      ...input.pagination,
      total: result.total
    })
  };
}

export async function addMember(input: {
  input: AddWorkspaceMemberRequest;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceMembers(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_MEMBER_ADD_FORBIDDEN",
      "You cannot add members to this workspace"
    );
  }

  if (membership.role === "admin" && input.input.role === "admin") {
    throw new AppError(
      403,
      "WORKSPACE_ADMIN_ADD_FORBIDDEN",
      "Only workspace owners can add admins"
    );
  }

  const targetUser = await findUserByEmailNormalized(
    normalizeEmail(input.input.email)
  );

  if (!targetUser) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const existingMember = await findWorkspaceMember({
    userId: targetUser.id,
    workspaceId: input.workspaceId
  });

  if (existingMember) {
    if (existingMember.status === "invited") {
      throw new AppError(
        409,
        "WORKSPACE_MEMBER_INVITATION_PENDING",
        "A pending invitation already exists for this user"
      );
    }

    if (existingMember.status === "suspended") {
      throw new AppError(
        409,
        "WORKSPACE_MEMBER_SUSPENDED",
        "This user is currently suspended in this workspace"
      );
    }

    throw new AppError(
      409,
      "WORKSPACE_MEMBER_ALREADY_EXISTS",
      "User is already a member of this workspace"
    );
  }

  const member = await createWorkspaceMember({
    role: input.input.role,
    userId: targetUser.id,
    workspaceId: input.workspaceId
  });

  if (!member) {
    throw new Error("Failed to load workspace member");
  }

  return member;
}

export async function updateMember(input: {
  input: UpdateWorkspaceMemberRequest;
  targetUserId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceMembers(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_MEMBER_UPDATE_FORBIDDEN",
      "You cannot update members in this workspace"
    );
  }

  if (input.targetUserId === input.userId) {
    throw new AppError(
      400,
      "WORKSPACE_MEMBER_SELF_UPDATE_FORBIDDEN",
      "You cannot update your own workspace membership"
    );
  }

  const targetMember = await requireWorkspaceMember({
    userId: input.targetUserId,
    workspaceId: input.workspaceId
  });

  if (targetMember.role === "owner") {
    throw new AppError(
      400,
      "WORKSPACE_OWNER_UPDATE_FORBIDDEN",
      "Workspace owners cannot be updated through this endpoint"
    );
  }

  if (membership.role === "admin" && targetMember.role === "admin") {
    throw new AppError(
      403,
      "WORKSPACE_ADMIN_MANAGEMENT_FORBIDDEN",
      "Only workspace owners can modify admins"
    );
  }

  if (membership.role === "admin" && input.input.role === "admin") {
    throw new AppError(
      403,
      "WORKSPACE_ADMIN_PROMOTION_FORBIDDEN",
      "Only workspace owners can promote members to admin"
    );
  }

  const member = await updateWorkspaceMember({
    role: input.input.role,
    status: input.input.status,
    userId: input.targetUserId,
    workspaceId: input.workspaceId
  });

  if (!member) {
    throw new AppError(
      404,
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member not found"
    );
  }

  return member;
}

export async function removeMember(input: {
  targetUserId: string;
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (!canManageWorkspaceMembers(membership.role)) {
    throw new AppError(
      403,
      "WORKSPACE_MEMBER_REMOVE_FORBIDDEN",
      "You cannot remove members from this workspace"
    );
  }

  if (input.targetUserId === input.userId) {
    throw new AppError(
      400,
      "WORKSPACE_MEMBER_SELF_REMOVE_FORBIDDEN",
      "You cannot remove your own workspace membership"
    );
  }

  const targetMember = await requireWorkspaceMember({
    userId: input.targetUserId,
    workspaceId: input.workspaceId
  });

  if (targetMember.role === "owner") {
    throw new AppError(
      400,
      "WORKSPACE_OWNER_REMOVE_FORBIDDEN",
      "Workspace owners cannot be removed through this endpoint"
    );
  }

  if (membership.role === "admin" && targetMember.role === "admin") {
    throw new AppError(
      403,
      "WORKSPACE_ADMIN_MANAGEMENT_FORBIDDEN",
      "Only workspace owners can remove admins"
    );
  }

  const deletedMember = await deleteWorkspaceMember({
    userId: input.targetUserId,
    workspaceId: input.workspaceId
  });

  if (!deletedMember) {
    throw new AppError(
      404,
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member not found"
    );
  }
}

export async function leaveWorkspace(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await requireWorkspaceMembership(input);

  if (membership.role === "owner") {
    throw new AppError(
      400,
      "WORKSPACE_OWNER_LEAVE_FORBIDDEN",
      "Workspace owners cannot leave the workspace without transferring ownership"
    );
  }

  const deletedMember = await deleteWorkspaceMember(input);

  if (!deletedMember) {
    throw new AppError(
      404,
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member not found"
    );
  }
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

async function requireWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const member = await findWorkspaceMember(input);

  if (!member) {
    throw new AppError(
      404,
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member not found"
    );
  }

  return member;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
