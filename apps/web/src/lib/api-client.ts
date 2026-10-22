import {
  authResponseSchema,
  labelListResponseSchema,
  labelResponseSchema,
  createLabelRequestSchema,
  updateLabelRequestSchema,
  createTaskCommentRequestSchema,
  createWorkspaceInvitationRequestSchema,
  changePasswordRequestSchema,
  emailVerificationTokenRequestSchema,
  healthResponseSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  createTaskRequestSchema,
  projectListResponseSchema,
  projectResponseSchema,
  taskListResponseSchema,
  taskActivityEventListResponseSchema,
  taskCommentListResponseSchema,
  taskCommentResponseSchema,
  updateTaskCommentRequestSchema,
  taskResponseSchema,
  workspaceListResponseSchema,
  workspaceInvitationListResponseSchema,
  workspaceInvitationResponseSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberResponseSchema,
  workspaceResponseSchema,
  type AuthResponse,
  type LabelListResponse,
  type LabelResponse,
  type CreateLabelRequest,
  type UpdateLabelRequest,
  type ChangePasswordRequest,
  type HealthResponse,
  type LoginRequest,
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
  type UpdateProjectRequest,
  type CreateTaskRequest,
  type CreateTaskCommentRequest,
  type CreateWorkspaceInvitationRequest,
  type ProjectListResponse,
  type ProjectResponse,
  type TaskListResponse,
  type TaskActivityEventListResponse,
  type TaskCommentListResponse,
  type TaskCommentResponse,
  type UpdateTaskCommentRequest,
  type TaskPriority,
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
      ...(init.body ? { "Content-Type": "application/json" } : {}),
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
      ...(init.body ? { "Content-Type": "application/json" } : {}),
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

export function changePassword(input: ChangePasswordRequest): Promise<void> {
  return requestNoContent("/api/v1/auth/password/change", {
    body: JSON.stringify(changePasswordRequestSchema.parse(input)),
    method: "POST",
  });
}

export function getWorkspaces(): Promise<WorkspaceListResponse> {
  return request(
    "/api/v1/workspaces?limit=100&offset=0",
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

type TaskListFilters = {
  assigneeUserId?: string | "none";
  due?: "overdue" | "today" | "week" | "none";
  labelId?: string;
  priority?: TaskPriority;
  search?: string;
};

export function getTasks(
  workspaceId: string,
  projectId: string,
  filters: TaskListFilters = {},
): Promise<TaskListResponse> {
  const query = new URLSearchParams({
    limit: "100",
    offset: "0",
    sortBy: "number",
    sortOrder: "asc",
  });

  if (filters.priority) {
    query.set("priority", filters.priority);
  }
  if (filters.labelId) query.set("labelId", filters.labelId);
  if (filters.assigneeUserId)
    query.set("assigneeUserId", filters.assigneeUserId);
  if (filters.due) query.set("due", filters.due);

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
): Promise<TaskCommentListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments?limit=100&offset=0`,
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

export function getTaskActivity(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskActivityEventListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/activity?limit=100&offset=0`,
    { method: "GET" },
    taskActivityEventListResponseSchema,
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
