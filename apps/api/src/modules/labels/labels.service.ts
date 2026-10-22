import type { CreateLabelRequest, UpdateLabelRequest } from "@devflow/shared";
import { AppError } from "../../core/errors/app-error.js";
import { canCreateTask } from "../tasks/tasks.policy.js";
import { findActiveWorkspaceMembership } from "../tasks/tasks.repository.js";
import * as repository from "./labels.repository.js";

async function membership(userId: string, workspaceId: string) {
  const result = await findActiveWorkspaceMembership({ userId, workspaceId });
  if (!result)
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  return result;
}
async function canManage(userId: string, workspaceId: string) {
  const member = await membership(userId, workspaceId);
  if (!canCreateTask(member.role))
    throw new AppError(
      403,
      "LABEL_MANAGE_FORBIDDEN",
      "You cannot manage labels in this workspace",
    );
}
export async function listWorkspaceLabels(userId: string, workspaceId: string) {
  await membership(userId, workspaceId);
  return repository.listLabels(workspaceId);
}
export async function createWorkspaceLabel(input: {
  userId: string;
  workspaceId: string;
  data: CreateLabelRequest;
}) {
  await canManage(input.userId, input.workspaceId);
  try {
    return await repository.createLabel({
      workspaceId: input.workspaceId,
      ...input.data,
    });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppError(
        409,
        "LABEL_NAME_TAKEN",
        "A label with this name already exists",
      );
    throw error;
  }
}
export async function updateWorkspaceLabel(input: {
  userId: string;
  workspaceId: string;
  labelId: string;
  data: UpdateLabelRequest;
}) {
  await canManage(input.userId, input.workspaceId);
  try {
    const label = await repository.updateLabel({
      workspaceId: input.workspaceId,
      labelId: input.labelId,
      ...input.data,
    });
    if (!label) throw new AppError(404, "LABEL_NOT_FOUND", "Label not found");
    return label;
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppError(
        409,
        "LABEL_NAME_TAKEN",
        "A label with this name already exists",
      );
    throw error;
  }
}
export async function removeWorkspaceLabel(input: {
  userId: string;
  workspaceId: string;
  labelId: string;
}) {
  await canManage(input.userId, input.workspaceId);
  const label = await repository.findLabel(input.workspaceId, input.labelId);
  if (!label) throw new AppError(404, "LABEL_NOT_FOUND", "Label not found");
  await repository.deleteLabel(input.workspaceId, input.labelId);
}

function isUniqueViolation(error: unknown) {
  if (hasCode(error, "23505")) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    hasCode(error.cause, "23505")
  );
}

function hasCode(value: unknown, code: string) {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    value.code === code
  );
}
