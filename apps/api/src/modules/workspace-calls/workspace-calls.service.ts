import type {
  CreateWorkspaceCallRequest,
  UpdateWorkspaceCallRequest,
} from "@devflow/shared";

import { db } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  canCreateWorkspaceCall,
  canManageWorkspaceCall,
  canRemoveWorkspaceCall,
} from "./workspace-calls.policy.js";
import {
  createCall,
  findActiveWorkspaceMemberIds,
  findActiveWorkspaceMembership,
  findCall,
  findProjectInWorkspace,
  listCalls,
  removeCall,
  updateAttendeeResponse,
  updateCall,
} from "./workspace-calls.repository.js";

type CallScope = { userId: string; workspaceId: string };

export async function listWorkspaceCalls(
  input: CallScope & {
    from?: string;
    status?: "scheduled" | "completed" | "cancelled";
    to?: string;
  },
) {
  await requireWorkspaceMembership(input);
  return listCalls({
    from: input.from ? new Date(input.from) : undefined,
    status: input.status,
    to: input.to ? new Date(input.to) : undefined,
    workspaceId: input.workspaceId,
  });
}

export async function createWorkspaceCall(
  input: CallScope & { input: CreateWorkspaceCallRequest },
) {
  const membership = await requireWorkspaceMembership(input);
  if (!canCreateWorkspaceCall(membership.role)) {
    throw new AppError(403, "CALL_CREATE_FORBIDDEN", "You cannot schedule calls in this workspace");
  }
  await validateProject(input.workspaceId, input.input.projectId);
  const attendeeUserIds = await validateAttendees({
    attendeeUserIds: input.input.attendeeUserIds,
    creatorUserId: input.userId,
    workspaceId: input.workspaceId,
  });
  const callId = await db.transaction((tx) =>
    createCall(
      {
        ...input.input,
        attendeeUserIds,
        createdByUserId: input.userId,
        endsAt: new Date(input.input.endsAt),
        startsAt: new Date(input.input.startsAt),
        workspaceId: input.workspaceId,
      },
      tx,
    ),
  );
  return requireCall({ callId, workspaceId: input.workspaceId });
}

export async function updateWorkspaceCall(
  input: CallScope & { callId: string; input: UpdateWorkspaceCallRequest },
) {
  const membership = await requireWorkspaceMembership(input);
  const existing = await requireCall(input);
  if (!canManageWorkspaceCall(membership.role, existing.createdByUserId === input.userId)) {
    throw new AppError(403, "CALL_UPDATE_FORBIDDEN", "You cannot update this call");
  }

  await validateProject(input.workspaceId, input.input.projectId);
  const startsAt = input.input.startsAt ? new Date(input.input.startsAt) : existing.startsAt;
  const endsAt = input.input.endsAt ? new Date(input.input.endsAt) : existing.endsAt;
  validateDates(startsAt, endsAt);
  const attendeeUserIds = input.input.attendeeUserIds === undefined
    ? undefined
    : await validateAttendees({
        attendeeUserIds: input.input.attendeeUserIds,
        creatorUserId: existing.createdByUserId ?? input.userId,
        workspaceId: input.workspaceId,
      });

  await db.transaction(async (tx) => {
    const updated = await updateCall(
      {
        ...input.input,
        attendeeUserIds,
        callId: input.callId,
        endsAt: input.input.endsAt ? new Date(input.input.endsAt) : undefined,
        startsAt: input.input.startsAt ? new Date(input.input.startsAt) : undefined,
        workspaceId: input.workspaceId,
      },
      tx,
    );
    if (!updated) throw new AppError(404, "CALL_NOT_FOUND", "Call not found");
  });
  return requireCall(input);
}

export async function deleteWorkspaceCall(input: CallScope & { callId: string }) {
  const membership = await requireWorkspaceMembership(input);
  const call = await requireCall(input);
  if (!canRemoveWorkspaceCall(membership.role, call.createdByUserId === input.userId)) {
    throw new AppError(403, "CALL_DELETE_FORBIDDEN", "You cannot delete this call");
  }
  if (!(await removeCall(input))) {
    throw new AppError(404, "CALL_NOT_FOUND", "Call not found");
  }
}

export async function respondToWorkspaceCall(input: CallScope & {
  callId: string;
  responseStatus: "invited" | "accepted" | "declined";
}) {
  await requireWorkspaceMembership(input);
  await requireCall(input);
  if (!(await updateAttendeeResponse(input))) {
    throw new AppError(403, "CALL_ATTENDEE_REQUIRED", "You are not invited to this call");
  }
  return requireCall(input);
}

async function requireWorkspaceMembership(input: CallScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  return membership;
}

async function requireCall(input: { callId: string; workspaceId: string }) {
  const call = await findCall(input);
  if (!call) throw new AppError(404, "CALL_NOT_FOUND", "Call not found");
  return call;
}

async function validateProject(workspaceId: string, projectId?: string | null) {
  if (!projectId) return;
  if (!(await findProjectInWorkspace({ projectId, workspaceId }))) {
    throw new AppError(400, "CALL_PROJECT_INVALID", "Choose a project in this workspace");
  }
}

async function validateAttendees(input: {
  attendeeUserIds?: string[];
  creatorUserId: string;
  workspaceId: string;
}) {
  const attendeeUserIds = [...new Set([...(input.attendeeUserIds ?? []), input.creatorUserId])];
  const activeMembers = await findActiveWorkspaceMemberIds({
    userIds: attendeeUserIds,
    workspaceId: input.workspaceId,
  });
  if (activeMembers.length !== attendeeUserIds.length) {
    throw new AppError(400, "CALL_ATTENDEES_INVALID", "Every attendee must be an active workspace member");
  }
  return attendeeUserIds;
}

function validateDates(startsAt: Date, endsAt: Date) {
  if (startsAt >= endsAt) {
    throw new AppError(400, "CALL_DATES_INVALID", "Call end time must be after its start time");
  }
}
