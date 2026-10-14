export function canCreateTask(role: "owner" | "admin" | "member" | "viewer") {
  return role === "owner" || role === "admin" || role === "member";
}

export function canDeleteTask(role: "owner" | "admin" | "member" | "viewer") {
  return role === "owner" || role === "admin" || role === "member";
}

export function canUpdateTask(role: "owner" | "admin" | "member" | "viewer") {
  return role === "owner" || role === "admin" || role === "member";
}
