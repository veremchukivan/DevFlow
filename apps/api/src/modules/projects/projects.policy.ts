import type { WorkspaceRole } from "@devflow/shared";

export function canCreateProject(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}
