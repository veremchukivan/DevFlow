export function canCreateTaskComment(
  role: "owner" | "admin" | "member" | "viewer"
) {
  return role === "owner" || role === "admin" || role === "member";
}
