import { can, type Permission } from "@devflow/shared";
import type { WorkspaceRole } from "@devflow/shared";

export function canCreateTaskComment(role: WorkspaceRole): boolean {
  return can(role, "comment:create" satisfies Permission);
}

/**
 * A comment can be updated by its author regardless of workspace role,
 * or by any owner/admin.
 */
export function canUpdateTaskComment(
  role: WorkspaceRole,
  isAuthor: boolean
): boolean {
  return isAuthor || can(role, "comment:update" satisfies Permission);
}

/**
 * A comment can be deleted by its author regardless of workspace role,
 * or by any owner/admin.
 */
export function canDeleteTaskComment(
  role: WorkspaceRole,
  isAuthor: boolean
): boolean {
  return isAuthor || can(role, "comment:delete" satisfies Permission);
}
