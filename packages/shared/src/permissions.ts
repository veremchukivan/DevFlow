import type { WorkspaceRole } from "./schemas/workspaces.js";

// ---------------------------------------------------------------------------
// Permission identifiers
// ---------------------------------------------------------------------------

export type Permission =
  // Projects
  | "project:create"
  // Tasks
  | "task:create"
  | "task:update"
  | "task:delete"
  // Comments
  | "comment:create"
  | "comment:update"
  | "comment:delete"
  // Members and Invitations
  | "member:manage"
  | "invitation:manage";

// ---------------------------------------------------------------------------
// Role → permission matrix (single source of truth for RBAC)
//
// Role hierarchy: owner > admin > member > viewer
//
// Viewers can only read — no write permissions are granted to viewer.
// Members can create/update tasks and comments, but cannot delete tasks.
// Admins can do everything members can, plus delete tasks and manage members.
// Owners have the same permissions as admins (owner-specific actions are
// handled separately, e.g. transferring ownership).
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<Permission, readonly WorkspaceRole[]> = {
  // Only owner/admin can create projects (viewer and member are read-only here)
  "project:create": ["owner", "admin"],

  // Tasks: member can create and update, but only owner/admin can delete
  "task:create": ["owner", "admin", "member"],
  "task:update": ["owner", "admin", "member"],
  "task:delete": ["owner", "admin"],

  // Comments: member can create; update/delete also allowed for resource owner
  // (isAuthor check is handled in the individual policy module)
  "comment:create": ["owner", "admin", "member"],
  "comment:update": ["owner", "admin"],
  "comment:delete": ["owner", "admin"],

  // Workspace member and invitation management (invite, cancel invite, update role/status, remove)
  "member:manage": ["owner", "admin"],
  "invitation:manage": ["owner", "admin"],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the given workspace role has the requested permission.
 *
 * For resource-level checks (e.g. "author can edit their own comment") use
 * this function together with an `isAuthor` flag inside the policy module.
 *
 * @example
 * can("member", "task:create")  // → true
 * can("viewer", "task:delete")  // → false
 * can("admin",  "task:delete")  // → true
 */
export function can(role: WorkspaceRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[permission] as WorkspaceRole[]).includes(role);
}

