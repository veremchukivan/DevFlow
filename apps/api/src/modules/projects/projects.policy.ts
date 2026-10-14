import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canCreateProject(role: WorkspaceRole): boolean {
  return can(role, "project:create" satisfies Permission);
}
