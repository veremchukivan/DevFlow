export function canCreateTask(role: "owner" | "admin" | "member" | "viewer") {
  return role === "owner" || role === "admin" || role === "member";
}
