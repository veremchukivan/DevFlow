import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canCreateTask(role: WorkspaceRole): boolean {
  return can(role, "task:create" satisfies Permission);
}

export function canUpdateTask(role: WorkspaceRole): boolean {
  return can(role, "task:update" satisfies Permission);
}

export function canDeleteTask(role: WorkspaceRole): boolean {
  return can(role, "task:delete" satisfies Permission);
}
