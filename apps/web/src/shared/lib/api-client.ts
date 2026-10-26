import {
  authResponseSchema,
  accountSessionListResponseSchema,
  acceptInvitationResponseSchema,
  labelListResponseSchema,
  labelResponseSchema,
  createLabelRequestSchema,
  updateLabelRequestSchema,
  createTaskCommentRequestSchema,
  createTaskChecklistItemRequestSchema,
  createTaskRelationRequestSchema,
  createWorkspaceInvitationRequestSchema,
  changePasswordRequestSchema,
  emailVerificationTokenRequestSchema,
  healthResponseSchema,
  loginRequestSchema,
  notificationListResponseSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  createProjectRequestSchema,
  createProjectSprintRequestSchema,
  createProjectStatusRequestSchema,
  reorderProjectStatusesRequestSchema,
  updateProjectRequestSchema,
  updateProjectSprintRequestSchema,
  updateProjectStatusRequestSchema,
  createTaskRequestSchema,
  projectListResponseSchema,
  projectSprintListResponseSchema,
  projectSprintResponseSchema,
  publicWorkspaceInvitationResponseSchema,
  projectResponseSchema,
  projectViewPreferencesResponseSchema,
  taskListResponseSchema,
  taskActivityEventListResponseSchema,
  taskAttachmentListResponseSchema,
  taskAttachmentResponseSchema,
  taskCommentListResponseSchema,
  taskCommentResponseSchema,
  taskChecklistListResponseSchema,
  taskChecklistResponseSchema,
  taskRelationListResponseSchema,
  updateTaskCommentRequestSchema,
  updateTaskChecklistItemRequestSchema,
  taskResponseSchema,
  workspaceListResponseSchema,
  workspaceInvitationListResponseSchema,
  workspaceInvitationResponseSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberResponseSchema,
  workspaceResponseSchema,
  type AuthResponse,
  type AccountSessionListResponse,
  type AcceptInvitationResponse,
  type LabelListResponse,
  type LabelResponse,
  type CreateLabelRequest,
  type UpdateLabelRequest,
  type ChangePasswordRequest,
  type HealthResponse,
  type LoginRequest,
  type NotificationListResponse,
  type RegisterRequest,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
  type WorkspaceListResponse,
  type WorkspaceInvitationListResponse,
  type WorkspaceInvitationResponse,
  type WorkspaceMemberListResponse,
  type WorkspaceMemberResponse,
  type WorkspaceResponse,
  type CreateProjectRequest,
  type CreateProjectSprintRequest,
  type CreateProjectStatusRequest,
  type ReorderProjectStatusesRequest,
  type UpdateProjectRequest,
  type UpdateProjectSprintRequest,
  type UpdateProjectStatusRequest,
  type CreateTaskRequest,
  type CreateTaskCommentRequest,
  type CreateTaskChecklistItemRequest,
  type CreateTaskRelationRequest,
  type CreateWorkspaceInvitationRequest,
  type ProjectListResponse,
  type ProjectSprintListResponse,
  type ProjectSprintResponse,
  type PublicWorkspaceInvitationResponse,
  type ProjectResponse,
  type ProjectViewPreferences,
  type UpdateProjectViewPreferencesRequest,
  type TaskListResponse,
  type TaskActivityEventListResponse,
  type TaskAttachmentListResponse,
  type TaskAttachmentResponse,
  type TaskCommentListResponse,
  type TaskCommentResponse,
  type TaskChecklistListResponse,
  type TaskChecklistResponse,
  type TaskRelationListResponse,
  type UpdateTaskCommentRequest,
  type UpdateTaskChecklistItemRequest,
  type TaskPriority,
  type TaskSortField,
  type TaskSortOrder,
  type TaskResponse,
  type UpdateTaskRequest,
  type UpdateProfileRequest,
  type UpdateWorkspaceMemberRequest,
} from "@devflow/shared";
import { z } from "zod";

const configuredApiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

function getApiUrl() {
  if (typeof window === "undefined") {
    return configuredApiUrl;
  }

  const apiUrl = new URL(configuredApiUrl);
  const isLocalApi = ["localhost", "127.0.0.1"].includes(apiUrl.hostname);
  const isLocalPage = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );

  if (isLocalApi && isLocalPage) {
    apiUrl.hostname = window.location.hostname;
  }

  return apiUrl.origin;
}

export function getApiAssetUrl(path: string | null) {
  return path ? new URL(path, `${getApiUrl()}/`).toString() : null;
}

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const parsed = apiErrorSchema.safeParse(payload);

    if (parsed.success) {
      throw new ApiClientError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.requestId,
      );
    }

    throw new ApiClientError(
      `Request failed with status ${response.status}`,
      "REQUEST_FAILED",
      response.headers.get("x-request-id") ?? undefined,
    );
  }

  return schema.parse(await response.json());
}

async function requestNoContent(
  path: string,
  init: RequestInit,
): Promise<void> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiClientError(
      parsed.success
        ? parsed.data.error.message
        : `Request failed with status ${response.status}`,
      parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
      parsed.success
        ? parsed.data.error.requestId
        : (response.headers.get("x-request-id") ?? undefined),
    );
  }
}

export function register(input: RegisterRequest): Promise<AuthResponse> {
  return request(
    "/api/v1/auth/register",
    {
      body: JSON.stringify(registerRequestSchema.parse(input)),
      method: "POST",
    },
    authResponseSchema,
  );
}

export function login(input: LoginRequest): Promise<AuthResponse> {
  return request(
    "/api/v1/auth/login",
    {
      body: JSON.stringify(loginRequestSchema.parse(input)),
      method: "POST",
    },
    authResponseSchema,
  );
}

export function requestPasswordReset(
  input: z.infer<typeof passwordResetRequestSchema>,
): Promise<void> {
  return requestNoContent("/api/v1/auth/password-reset/request", {
    body: JSON.stringify(passwordResetRequestSchema.parse(input)),
    method: "POST",
  });
}

export function resetPassword(
  input: z.infer<typeof passwordResetConfirmRequestSchema>,
): Promise<void> {
  return requestNoContent("/api/v1/auth/password-reset/confirm", {
    body: JSON.stringify(passwordResetConfirmRequestSchema.parse(input)),
    method: "POST",
  });
}

export function verifyEmail(
  input: z.infer<typeof emailVerificationTokenRequestSchema>,
): Promise<void> {
  return requestNoContent("/api/v1/auth/email-verification/confirm", {
    body: JSON.stringify(emailVerificationTokenRequestSchema.parse(input)),
    method: "POST",
  });
}

export function resendEmailVerification(): Promise<void> {
  return requestNoContent("/api/v1/auth/email-verification/resend", {
    method: "POST",
  });
}

export async function logout(): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/v1/auth/logout`, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiClientError("Unable to sign out", "LOGOUT_FAILED");
  }
}

export function getCurrentUser(): Promise<AuthResponse> {
  return request("/api/v1/auth/me", { method: "GET" }, authResponseSchema);
}

export function getAccountDataExportUrl() {
  return getApiAssetUrl("/api/v1/auth/data-export");
}

export function getAccountSessions(): Promise<AccountSessionListResponse> {
  return request(
    "/api/v1/auth/sessions",
    { method: "GET" },
    accountSessionListResponseSchema,
  );
}

export function revokeAccountSession(sessionId: string): Promise<void> {
  return requestNoContent(`/api/v1/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function revokeOtherAccountSessions(): Promise<void> {
  return requestNoContent("/api/v1/auth/sessions/revoke-others", {
    method: "POST",
  });
}

export function getNotifications(
  pagination: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<NotificationListResponse> {
  const query = new URLSearchParams({
    limit: String(pagination.limit ?? 12),
    offset: String(pagination.offset ?? 0),
  });
  if (pagination.unreadOnly !== undefined) {
    query.set("unreadOnly", String(pagination.unreadOnly));
  }
  return request(
    `/api/v1/notifications?${query}`,
    { method: "GET" },
    notificationListResponseSchema,
  );
}

export function markNotificationRead(notificationId: string): Promise<void> {
  return requestNoContent(`/api/v1/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return requestNoContent("/api/v1/notifications/read-all", {
    method: "POST",
  });
}

export function updateProfile(
  input: UpdateProfileRequest,
): Promise<AuthResponse> {
  return request(
    "/api/v1/auth/profile",
    {
      body: JSON.stringify(updateProfileRequestSchema.parse(input)),
      method: "PATCH",
    },
    authResponseSchema,
  );
}

export function uploadProfileAvatar(file: File): Promise<AuthResponse> {
  const form = new FormData();
  form.set("image", file);
  return request(
    "/api/v1/auth/profile/avatar",
    { body: form, method: "PUT" },
    authResponseSchema,
  );
}

export function deleteProfileAvatar(): Promise<AuthResponse> {
  return request(
    "/api/v1/auth/profile/avatar",
    { method: "DELETE" },
    authResponseSchema,
  );
}

export function changePassword(input: ChangePasswordRequest): Promise<void> {
  return requestNoContent("/api/v1/auth/password/change", {
    body: JSON.stringify(changePasswordRequestSchema.parse(input)),
    method: "POST",
  });
}

export function getWorkspaces(
  pagination: { limit?: number; offset?: number } = {},
): Promise<WorkspaceListResponse> {
  return request(
    `/api/v1/workspaces?limit=${pagination.limit ?? 25}&offset=${pagination.offset ?? 0}`,
    { method: "GET" },
    workspaceListResponseSchema,
  );
}

export function createWorkspace(
  input: CreateWorkspaceRequest,
): Promise<WorkspaceResponse> {
  return request(
    "/api/v1/workspaces",
    {
      body: JSON.stringify(createWorkspaceRequestSchema.parse(input)),
      method: "POST",
    },
    workspaceResponseSchema,
  );
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}`,
    { method: "GET" },
    workspaceResponseSchema,
  );
}

export function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceRequest,
): Promise<WorkspaceResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}`,
    {
      body: JSON.stringify(updateWorkspaceRequestSchema.parse(input)),
      method: "PATCH",
    },
    workspaceResponseSchema,
  );
}

export function deleteWorkspace(workspaceId: string): Promise<void> {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}`, {
    method: "DELETE",
  });
}

export function getWorkspaceLabels(
  workspaceId: string,
): Promise<LabelListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/labels`,
    { method: "GET" },
    labelListResponseSchema,
  );
}

export function createWorkspaceLabel(
  workspaceId: string,
  input: CreateLabelRequest,
): Promise<LabelResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/labels`,
    {
      body: JSON.stringify(createLabelRequestSchema.parse(input)),
      method: "POST",
    },
    labelResponseSchema,
  );
}

export function deleteWorkspaceLabel(
  workspaceId: string,
  labelId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/labels/${labelId}`,
    { method: "DELETE" },
  );
}

export function updateWorkspaceLabel(
  workspaceId: string,
  labelId: string,
  input: UpdateLabelRequest,
): Promise<LabelResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/labels/${labelId}`,
    {
      body: JSON.stringify(updateLabelRequestSchema.parse(input)),
      method: "PATCH",
    },
    labelResponseSchema,
  );
}

export function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/members?limit=100&offset=0`,
    { method: "GET" },
    workspaceMemberListResponseSchema,
  );
}

export function updateWorkspaceMember(
  workspaceId: string,
  userId: string,
  input: UpdateWorkspaceMemberRequest,
): Promise<WorkspaceMemberResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { body: JSON.stringify(input), method: "PATCH" },
    workspaceMemberResponseSchema,
  );
}

export function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    { method: "DELETE" },
  );
}

export function leaveWorkspace(workspaceId: string): Promise<void> {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}/members/leave`, {
    method: "POST",
  });
}
export function transferWorkspaceOwnership(
  workspaceId: string,
  userId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/members/transfer-ownership`,
    { body: JSON.stringify({ userId }), method: "POST" },
  );
}

export function getWorkspaceInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitationListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/invitations?limit=100&offset=0`,
    { method: "GET" },
    workspaceInvitationListResponseSchema,
  );
}

export function createWorkspaceInvitation(
  workspaceId: string,
  input: CreateWorkspaceInvitationRequest,
): Promise<WorkspaceInvitationResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/invitations`,
    {
      body: JSON.stringify(createWorkspaceInvitationRequestSchema.parse(input)),
      method: "POST",
    },
    workspaceInvitationResponseSchema,
  );
}

export function cancelWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
    { method: "DELETE" },
  );
}

export function resendWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<WorkspaceInvitationResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
    { method: "POST" },
    workspaceInvitationResponseSchema,
  );
}

export function getPublicWorkspaceInvitation(
  token: string,
): Promise<PublicWorkspaceInvitationResponse> {
  return request(
    `/api/v1/invitations/${encodeURIComponent(token)}`,
    { method: "GET" },
    publicWorkspaceInvitationResponseSchema,
  );
}

export function acceptWorkspaceInvitation(
  token: string,
): Promise<AcceptInvitationResponse> {
  return request(
    `/api/v1/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" },
    acceptInvitationResponseSchema,
  );
}

export function declineWorkspaceInvitation(token: string): Promise<void> {
  return requestNoContent(
    `/api/v1/invitations/${encodeURIComponent(token)}/decline`,
    { method: "POST" },
  );
}

export function getProjects(workspaceId: string): Promise<ProjectListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects?limit=100&offset=0`,
    { method: "GET" },
    projectListResponseSchema,
  );
}

export function createProject(
  workspaceId: string,
  input: CreateProjectRequest,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects`,
    {
      body: JSON.stringify(createProjectRequestSchema.parse(input)),
      method: "POST",
    },
    projectResponseSchema,
  );
}

export function getProject(
  workspaceId: string,
  projectId: string,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
    { method: "GET" },
    projectResponseSchema,
  );
}

export function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectRequest,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
    {
      body: JSON.stringify(updateProjectRequestSchema.parse(input)),
      method: "PATCH",
    },
    projectResponseSchema,
  );
}

export function deleteProject(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
    { method: "DELETE" },
  );
}

export function uploadProjectIcon(
  workspaceId: string,
  projectId: string,
  file: File,
): Promise<ProjectResponse> {
  const form = new FormData();
  form.set("image", file);
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/icon`,
    { body: form, method: "PUT" },
    projectResponseSchema,
  );
}

export function deleteProjectIcon(
  workspaceId: string,
  projectId: string,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/icon`,
    { method: "DELETE" },
    projectResponseSchema,
  );
}

export function getProjectSprints(
  workspaceId: string,
  projectId: string,
): Promise<ProjectSprintListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints`,
    { method: "GET" },
    projectSprintListResponseSchema,
  );
}

export function createProjectSprint(
  workspaceId: string,
  projectId: string,
  input: CreateProjectSprintRequest,
): Promise<ProjectSprintResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints`,
    {
      body: JSON.stringify(createProjectSprintRequestSchema.parse(input)),
      method: "POST",
    },
    projectSprintResponseSchema,
  );
}

export function updateProjectSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  input: UpdateProjectSprintRequest,
): Promise<ProjectSprintResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}`,
    {
      body: JSON.stringify(updateProjectSprintRequestSchema.parse(input)),
      method: "PATCH",
    },
    projectSprintResponseSchema,
  );
}

export function deleteProjectSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}`,
    { method: "DELETE" },
  );
}

export function createProjectStatus(
  workspaceId: string,
  projectId: string,
  input: CreateProjectStatusRequest,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses`,
    {
      body: JSON.stringify(createProjectStatusRequestSchema.parse(input)),
      method: "POST",
    },
    projectResponseSchema,
  );
}

export function updateProjectStatus(
  workspaceId: string,
  projectId: string,
  statusId: string,
  input: UpdateProjectStatusRequest,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses/${statusId}`,
    {
      body: JSON.stringify(updateProjectStatusRequestSchema.parse(input)),
      method: "PATCH",
    },
    projectResponseSchema,
  );
}

export function reorderProjectStatuses(
  workspaceId: string,
  projectId: string,
  input: ReorderProjectStatusesRequest,
): Promise<ProjectResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses/order`,
    {
      body: JSON.stringify(reorderProjectStatusesRequestSchema.parse(input)),
      method: "PUT",
    },
    projectResponseSchema,
  );
}

export function deleteProjectStatus(
  workspaceId: string,
  projectId: string,
  statusId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses/${statusId}`,
    { method: "DELETE" },
  );
}

type TaskListFilters = {
  archived?: boolean;
  assigneeUserId?: string | "none";
  due?: "overdue" | "today" | "week" | "none";
  labelId?: string;
  limit?: number;
  offset?: number;
  priority?: TaskPriority;
  search?: string;
  sprintId?: string | "backlog";
  sortBy?: TaskSortField;
  sortOrder?: TaskSortOrder;
};

export function getTasks(
  workspaceId: string,
  projectId: string,
  filters: TaskListFilters = {},
): Promise<TaskListResponse> {
  const query = new URLSearchParams({
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
    sortBy: filters.sortBy ?? "number",
    sortOrder: filters.sortOrder ?? "asc",
  });

  if (filters.priority) {
    query.set("priority", filters.priority);
  }
  if (filters.labelId) query.set("labelId", filters.labelId);
  if (filters.assigneeUserId)
    query.set("assigneeUserId", filters.assigneeUserId);
  if (filters.due) query.set("due", filters.due);
  if (filters.archived) query.set("archived", "true");
  if (filters.sprintId) query.set("sprintId", filters.sprintId);

  if (filters.search) {
    query.set("search", filters.search);
  }

  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?${query.toString()}`,
    { method: "GET" },
    taskListResponseSchema,
  );
}

export function getTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
    { method: "GET" },
    taskResponseSchema,
  );
}

export function getTaskLabels(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<LabelListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/labels`,
    { method: "GET" },
    labelListResponseSchema,
  );
}

export function replaceTaskLabels(
  workspaceId: string,
  projectId: string,
  taskId: string,
  labelIds: string[],
): Promise<LabelListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/labels`,
    { body: JSON.stringify({ labelIds }), method: "PUT" },
    labelListResponseSchema,
  );
}

export function getTaskComments(
  workspaceId: string,
  projectId: string,
  taskId: string,
  pagination: { limit?: number; offset?: number } = {},
): Promise<TaskCommentListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments?limit=${pagination.limit ?? 25}&offset=${pagination.offset ?? 0}`,
    { method: "GET" },
    taskCommentListResponseSchema,
  );
}

export function createTaskComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateTaskCommentRequest,
): Promise<TaskCommentResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`,
    {
      body: JSON.stringify(createTaskCommentRequestSchema.parse(input)),
      method: "POST",
    },
    taskCommentResponseSchema,
  );
}

export function updateTaskComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  input: UpdateTaskCommentRequest,
): Promise<TaskCommentResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    {
      body: JSON.stringify(updateTaskCommentRequestSchema.parse(input)),
      method: "PATCH",
    },
    taskCommentResponseSchema,
  );
}

export function deleteTaskComment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    { method: "DELETE" },
  );
}

export function getTaskChecklist(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskChecklistListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/checklist`,
    { method: "GET" },
    taskChecklistListResponseSchema,
  );
}

export function createTaskChecklistItem(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateTaskChecklistItemRequest,
): Promise<TaskChecklistResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/checklist`,
    {
      body: JSON.stringify(createTaskChecklistItemRequestSchema.parse(input)),
      method: "POST",
    },
    taskChecklistResponseSchema,
  );
}

export function updateTaskChecklistItem(
  workspaceId: string,
  projectId: string,
  taskId: string,
  itemId: string,
  input: UpdateTaskChecklistItemRequest,
): Promise<TaskChecklistResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`,
    {
      body: JSON.stringify(updateTaskChecklistItemRequestSchema.parse(input)),
      method: "PATCH",
    },
    taskChecklistResponseSchema,
  );
}

export function deleteTaskChecklistItem(
  workspaceId: string,
  projectId: string,
  taskId: string,
  itemId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`,
    { method: "DELETE" },
  );
}

export function getTaskActivity(
  workspaceId: string,
  projectId: string,
  taskId: string,
  pagination: { limit?: number; offset?: number } = {},
): Promise<TaskActivityEventListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/activity?limit=${pagination.limit ?? 25}&offset=${pagination.offset ?? 0}`,
    { method: "GET" },
    taskActivityEventListResponseSchema,
  );
}

export function getProjectActivity(
  workspaceId: string,
  projectId: string,
  pagination: { limit?: number; offset?: number } = {},
): Promise<TaskActivityEventListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/activity?limit=${pagination.limit ?? 12}&offset=${pagination.offset ?? 0}`,
    { method: "GET" },
    taskActivityEventListResponseSchema,
  );
}

export function getProjectViewPreferences(
  workspaceId: string,
  projectId: string,
): Promise<{ preferences: ProjectViewPreferences }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/view-preferences`,
    { method: "GET" },
    projectViewPreferencesResponseSchema,
  );
}

export function updateProjectViewPreferences(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectViewPreferencesRequest,
): Promise<{ preferences: ProjectViewPreferences }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/view-preferences`,
    { body: JSON.stringify(input), method: "PATCH" },
    projectViewPreferencesResponseSchema,
  );
}

export function getTaskAttachments(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskAttachmentListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments`,
    { method: "GET" },
    taskAttachmentListResponseSchema,
  );
}

export function uploadTaskAttachment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  file: File,
): Promise<TaskAttachmentResponse> {
  const form = new FormData();
  form.set("file", file);
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments`,
    { body: form, method: "POST" },
    taskAttachmentResponseSchema,
  );
}

export function deleteTaskAttachment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
    { method: "DELETE" },
  );
}

export function getTaskRelations(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskRelationListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/relations`,
    { method: "GET" },
    taskRelationListResponseSchema,
  );
}

export function createTaskRelation(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateTaskRelationRequest,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/relations`,
    {
      body: JSON.stringify(createTaskRelationRequestSchema.parse(input)),
      method: "POST",
    },
  );
}

export function deleteTaskRelation(
  workspaceId: string,
  projectId: string,
  taskId: string,
  relationId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/relations/${relationId}`,
    { method: "DELETE" },
  );
}

export function getTaskAttachmentDownloadUrl(
  workspaceId: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
) {
  return getApiAssetUrl(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download`,
  );
}

export function getTaskAttachmentPreviewUrl(
  workspaceId: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
) {
  return getApiAssetUrl(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/preview`,
  );
}

export function createTask(
  workspaceId: string,
  projectId: string,
  input: CreateTaskRequest,
): Promise<TaskResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    {
      body: JSON.stringify(createTaskRequestSchema.parse(input)),
      method: "POST",
    },
    taskResponseSchema,
  );
}

export function updateTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskRequest,
  version: number,
): Promise<TaskResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
    {
      body: JSON.stringify(input),
      headers: { "If-Match": `"${version}"` },
      method: "PATCH",
    },
    taskResponseSchema,
  );
}

export function deleteTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  version: number,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
    {
      headers: { "If-Match": `"${version}"` },
      method: "DELETE",
    },
  );
}

export function restoreTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  version: number,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/restore`,
    { headers: { "If-Match": `"${version}"` }, method: "POST" },
  );
}

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getApiUrl()}/healthz`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiClientError(
      `API health request failed with ${response.status}`,
      "HEALTH_REQUEST_FAILED",
    );
  }

  return healthResponseSchema.parse(await response.json());
}
