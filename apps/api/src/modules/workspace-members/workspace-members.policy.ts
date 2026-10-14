import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canManageWorkspaceMembers(role: WorkspaceRole): boolean {
  return can(role, "member:manage" satisfies Permission);
}
