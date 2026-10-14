import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canManageWorkspaceInvitations(role: WorkspaceRole): boolean {
  return can(role, "invitation:manage" satisfies Permission);
}

