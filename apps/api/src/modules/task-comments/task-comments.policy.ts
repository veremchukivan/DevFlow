export function canCreateTaskComment(
  role: "owner" | "admin" | "member" | "viewer"
) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canDeleteTaskComment(
  role: "owner" | "admin" | "member" | "viewer",
  isAuthor: boolean
) {
  return isAuthor || role === "owner" || role === "admin";
}

export function canUpdateTaskComment(
  role: "owner" | "admin" | "member" | "viewer",
  isAuthor: boolean
) {
  return isAuthor || role === "owner" || role === "admin";
}
