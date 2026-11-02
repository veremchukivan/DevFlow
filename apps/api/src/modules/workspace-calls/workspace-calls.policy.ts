import { can, type WorkspaceRole } from "@devflow/shared";

export function canCreateWorkspaceCall(role: WorkspaceRole) {
  return can(role, "call:create");
}

export function canManageWorkspaceCall(
  role: WorkspaceRole,
  isCreator: boolean,
) {
  return can(role, "call:update") && (isCreator || can(role, "workspace:update"));
}

export function canRemoveWorkspaceCall(
  role: WorkspaceRole,
  isCreator: boolean,
) {
  return can(role, "call:delete") && (isCreator || can(role, "workspace:update"));
}
