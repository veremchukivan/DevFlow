import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canCreateProject(role: WorkspaceRole): boolean {
  return can(role, "project:create" satisfies Permission);
}

export function canUpdateProject(role: WorkspaceRole): boolean {
  return can(role, "project:update" satisfies Permission);
}

export function canDeleteProject(role: WorkspaceRole): boolean {
  return can(role, "project:delete" satisfies Permission);
}
