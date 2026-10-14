import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canUpdateWorkspace(role: WorkspaceRole): boolean {
  return can(role, "workspace:update" satisfies Permission);
}

export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return can(role, "workspace:delete" satisfies Permission);
}

