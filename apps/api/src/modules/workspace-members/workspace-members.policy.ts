export function canManageWorkspaceMembers(
  role: "owner" | "admin" | "member" | "viewer"
) {
  return role === "owner" || role === "admin";
}
