import {
  aiSettingsSchema,
  authResponseSchema,
  accountSessionListResponseSchema,
  acceptInvitationResponseSchema,
  createTaskCommentRequestSchema,
  createTaskChecklistItemRequestSchema,
  createTaskRelationRequestSchema,
  createWorkspaceInvitationRequestSchema,
  changePasswordRequestSchema,
  changeEmailRequestSchema,
  deleteAccountRequestSchema,
  emailVerificationTokenRequestSchema,
  healthResponseSchema,
  figmaFilePreviewResponseSchema,
  gitConnectionsResponseSchema,
  projectRepositoryResponseSchema,
  taskGitLinkResponseSchema,
  taskGitLinksResponseSchema,
  loginRequestSchema,
  notificationListResponseSchema,
  notificationPreferencesSchema,
  updateNotificationPreferencesRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  createProjectRequestSchema,
  createProjectSprintRequestSchema,
  completeProjectSprintRequestSchema,
  createProjectStatusRequestSchema,
  reorderProjectStatusesRequestSchema,
  updateProjectRequestSchema,
  updateProjectSprintRequestSchema,
  updateProjectStatusRequestSchema,
  createTaskRequestSchema,
  createTaskDevelopmentFlowRequestSchema,
  createTaskDevelopmentFlowSessionRequestSchema,
  repositionTaskRequestSchema,
  projectListResponseSchema,
  projectFigmaLinkListResponseSchema,
  projectFigmaLinkResponseSchema,
  projectKnowledgeContextResponseSchema,
  projectKnowledgeEntryResponseSchema,
  projectKnowledgeListResponseSchema,
  projectPlanningResponseSchema,
  projectReleaseSchema,
  projectMemberListResponseSchema,
  projectMemberResponseSchema,
  projectSprintListResponseSchema,
  projectSprintAnalyticsSchema,
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
  taskFigmaLinkListResponseSchema,
  taskFigmaLinkResponseSchema,
  taskTimeEntryListResponseSchema,
  taskTimeEntryResponseSchema,
  createManualTaskTimeEntryRequestSchema,
  taskWatcherListResponseSchema,
  taskRelationListResponseSchema,
  updateTaskCommentRequestSchema,
  updateTaskChecklistItemRequestSchema,
  updateAiSettingsRequestSchema,
  taskResponseSchema,
  taskDevelopmentFlowDetailsResponseSchema,
  taskDevelopmentFlowResponseSchema,
  taskDevelopmentFlowSessionResponseSchema,
  transitionTaskDevelopmentFlowRequestSchema,
  updateTaskDevelopmentFlowRequestSchema,
  updateTaskDevelopmentFlowSessionRequestSchema,
  rejectTaskDevelopmentFlowRequestSchema,
  workspaceListResponseSchema,
  workspaceInvitationListResponseSchema,
  workspaceInvitationResponseSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberResponseSchema,
  workspaceResponseSchema,
  workspaceAutomationRuleResponseSchema,
  createWorkspaceAutomationRuleRequestSchema,
  workspaceAutomationRulesResponseSchema,
  workspaceAutomationRunsResponseSchema,
  workspaceAutomationTemplatesResponseSchema,
  workspaceAutomationUsageResponseSchema,
  workspaceSettingsResponseSchema,
  workspaceSavedFiltersResponseSchema,
  workspaceSavedFilterResponseSchema,
  createWorkspaceSavedFilterRequestSchema,
  createWorkspaceCallRequestSchema,
  updateWorkspaceCallRequestSchema,
  workspaceCallAttendanceRequestSchema,
  workspaceCallListResponseSchema,
  workspaceCallResponseSchema,
  createWorkspaceCallDecisionRequestSchema,
  promoteWorkspaceCallDecisionRequestSchema,
  workspaceCallDecisionResponseSchema,
  workspaceCallDecisionsResponseSchema,
  workspaceCalendarFeedResponseSchema,
  type AuthResponse,
  type AiSettings,
  type AccountSessionListResponse,
  type AcceptInvitationResponse,
  type ChangePasswordRequest,
  type ChangeEmailRequest,
  createApiTokenRequestSchema, apiTokenListResponseSchema, createApiTokenResponseSchema,
  type DeleteAccountRequest,
  type HealthResponse,
  type FigmaFilePreview,
  type GitConnectionsResponse,
  type ProjectRepository,
  type TaskGitLink,
  type LoginRequest,
  type NotificationListResponse,
  type NotificationPreferences,
  type UpdateNotificationPreferencesRequest,
  type UpdateAiSettingsRequest,
  type RegisterRequest,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
  type WorkspaceListResponse,
  type WorkspaceInvitationListResponse,
  type WorkspaceInvitationResponse,
  type WorkspaceMemberListResponse,
  type WorkspaceMemberResponse,
  type WorkspaceCallDecisionResponse,
  type WorkspaceCallDecisionsResponse,
  type WorkspaceCalendarFeedResponse,
  type WorkspaceResponse,
  type CreateProjectRequest,
  type CreateProjectSprintRequest,
  type CompleteProjectSprintRequest,
  type CreateProjectStatusRequest,
  type ReorderProjectStatusesRequest,
  type UpdateProjectRequest,
  type UpdateProjectSprintRequest,
  type UpdateProjectStatusRequest,
  type CreateTaskRequest,
  type RepositionTaskRequest,
  type CreateTaskCommentRequest,
  type CreateTaskChecklistItemRequest,
  type CreateTaskRelationRequest,
  type CreateWorkspaceInvitationRequest,
  type ProjectListResponse,
  type ProjectFigmaLink,
  type CreateProjectMemberRequest,
  type ProjectMember,
  type UpdateProjectMemberRequest,
  type ProjectSprintListResponse,
  type ProjectSprintAnalytics,
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
  type TaskFigmaLink,
  type CreateManualTaskTimeEntryRequest,
  type TaskTimeEntryListResponse,
  type TaskTimeEntryResponse,
  type TaskWatcherListResponse,
  type TaskRelationListResponse,
  type UpdateTaskCommentRequest,
  type UpdateTaskChecklistItemRequest,
  type TaskPriority,
  type TaskSortField,
  type TaskSortOrder,
  type TaskResponse,
  type UpdateTaskRequest,
  type CreateTaskDevelopmentFlowRequest,
  type TaskDevelopmentFlowDetailsResponse,
  type TaskDevelopmentFlowResponse,
  type TaskDevelopmentFlowSessionResponse,
  type UpdateTaskDevelopmentFlowRequest,
  type UpdateProfileRequest,
  type UpdateWorkspaceMemberRequest,
  type UpdateWorkspaceAutomationRuleRequest,
  type CreateWorkspaceAutomationRuleRequest,
  type WorkspaceAutomationRulesResponse,
  type WorkspaceAutomationRunsResponse,
  type UpdateWorkspaceSettingsRequest,
  type CreateWorkspaceCallRequest,
  type UpdateWorkspaceCallRequest,
  type WorkspaceCallAttendanceRequest,
  type WorkspaceCallListResponse,
  type WorkspaceCallResponse,
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

export function getAiSettings(): Promise<AiSettings> {
  return request("/api/v1/ai-settings", { method: "GET" }, aiSettingsSchema);
}

export function updateAiSettings(
  input: UpdateAiSettingsRequest,
): Promise<AiSettings> {
  return request(
    "/api/v1/ai-settings",
    {
      body: JSON.stringify(updateAiSettingsRequestSchema.parse(input)),
      method: "PUT",
    },
    aiSettingsSchema,
  );
}

export function deleteAiSettings(): Promise<void> {
  return requestNoContent("/api/v1/ai-settings", { method: "DELETE" });
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

export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return request(
    "/api/v1/notifications/preferences",
    { method: "GET" },
    notificationPreferencesSchema,
  );
}
export function updateNotificationPreferences(
  input: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  return request(
    "/api/v1/notifications/preferences",
    {
      body: JSON.stringify(
        updateNotificationPreferencesRequestSchema.parse(input),
      ),
      method: "PATCH",
    },
    notificationPreferencesSchema,
  );
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

export function requestEmailChange(input: ChangeEmailRequest): Promise<void> {
  return requestNoContent("/api/v1/auth/email/change", {
    body: JSON.stringify(changeEmailRequestSchema.parse(input)),
    method: "POST",
  });
}

export function getApiTokens() { return request("/api/v1/auth/api-tokens", { method: "GET" }, apiTokenListResponseSchema); }
export function createApiToken(input: unknown) { return request("/api/v1/auth/api-tokens", { body: JSON.stringify(createApiTokenRequestSchema.parse(input)), method: "POST" }, createApiTokenResponseSchema); }
export function revokeApiToken(tokenId: string): Promise<void> { return requestNoContent(`/api/v1/auth/api-tokens/${tokenId}`, { method: "DELETE" }); }
const figmaConnectionSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  connection: z
    .object({
      connectedAt: z.string().datetime(),
      expiresAt: z.string().datetime(),
    })
    .nullable(),
});

export function getFigmaConnection() {
  return request(
    "/api/v1/integrations/figma/connection",
    { method: "GET" },
    figmaConnectionSchema,
  );
}

export function disconnectFigma(): Promise<void> {
  return requestNoContent("/api/v1/integrations/figma/connection", {
    method: "DELETE",
  });
}

export function getFigmaFilePreview(
  url: string,
): Promise<{ preview: FigmaFilePreview }> {
  return request(
    `/api/v1/integrations/figma/preview?${new URLSearchParams({ url })}`,
    { method: "GET" },
    figmaFilePreviewResponseSchema,
  );
}

export function deleteAccount(input: DeleteAccountRequest): Promise<void> {
  return requestNoContent("/api/v1/auth/account", {
    body: JSON.stringify(deleteAccountRequestSchema.parse(input)),
    method: "DELETE",
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

export function uploadWorkspaceIcon(
  workspaceId: string,
  file: File,
): Promise<WorkspaceResponse> {
  const form = new FormData();
  form.set("image", file);
  return request(
    `/api/v1/workspaces/${workspaceId}/icon`,
    { body: form, method: "PUT" },
    workspaceResponseSchema,
  );
}

export function deleteWorkspaceIcon(
  workspaceId: string,
): Promise<WorkspaceResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/icon`,
    { method: "DELETE" },
    workspaceResponseSchema,
  );
}

export function deleteWorkspace(workspaceId: string): Promise<void> {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}`, {
    method: "DELETE",
  });
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

export function getWorkspaceInvitationById(
  invitationId: string,
): Promise<PublicWorkspaceInvitationResponse> {
  return request(
    `/api/v1/invitations/id/${invitationId}`,
    { method: "GET" },
    publicWorkspaceInvitationResponseSchema,
  );
}

export function acceptWorkspaceInvitationById(
  invitationId: string,
): Promise<AcceptInvitationResponse> {
  return request(
    `/api/v1/invitations/id/${invitationId}/accept`,
    { method: "POST" },
    acceptInvitationResponseSchema,
  );
}

export function declineWorkspaceInvitationById(
  invitationId: string,
): Promise<void> {
  return requestNoContent(`/api/v1/invitations/id/${invitationId}/decline`, {
    method: "POST",
  });
}

export function getProjects(workspaceId: string): Promise<ProjectListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects?limit=100&offset=0`,
    { method: "GET" },
    projectListResponseSchema,
  );
}

export function getWorkspaceCalls(
  workspaceId: string,
  query?: { from?: string; status?: "scheduled" | "completed" | "cancelled"; to?: string },
): Promise<WorkspaceCallListResponse> {
  const params = new URLSearchParams();
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  if (query?.status) params.set("status", query.status);
  const suffix = params.size ? `?${params.toString()}` : "";
  return request(
    `/api/v1/workspaces/${workspaceId}/calls${suffix}`,
    { method: "GET" },
    workspaceCallListResponseSchema,
  );
}

export function getWorkspaceCalendarFeed(workspaceId: string, query: { from: string; to: string }): Promise<WorkspaceCalendarFeedResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  return request(`/api/v1/workspaces/${workspaceId}/calls/calendar?${params.toString()}`, { method: "GET" }, workspaceCalendarFeedResponseSchema);
}

export function createWorkspaceCall(
  workspaceId: string,
  input: CreateWorkspaceCallRequest,
): Promise<WorkspaceCallResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/calls`,
    { body: JSON.stringify(createWorkspaceCallRequestSchema.parse(input)), method: "POST" },
    workspaceCallResponseSchema,
  );
}

export function updateWorkspaceCall(
  workspaceId: string,
  callId: string,
  input: UpdateWorkspaceCallRequest,
): Promise<WorkspaceCallResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/calls/${callId}`,
    { body: JSON.stringify(updateWorkspaceCallRequestSchema.parse(input)), method: "PATCH" },
    workspaceCallResponseSchema,
  );
}

export function deleteWorkspaceCall(workspaceId: string, callId: string): Promise<void> {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}/calls/${callId}`, {
    method: "DELETE",
  });
}

export function respondToWorkspaceCall(
  workspaceId: string,
  callId: string,
  input: WorkspaceCallAttendanceRequest,
): Promise<WorkspaceCallResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/calls/${callId}/attendance`,
    { body: JSON.stringify(workspaceCallAttendanceRequestSchema.parse(input)), method: "PATCH" },
    workspaceCallResponseSchema,
  );
}

export function getWorkspaceCallDecisions(workspaceId: string, callId: string): Promise<WorkspaceCallDecisionsResponse> {
  return request(`/api/v1/workspaces/${workspaceId}/calls/${callId}/decisions`, { method: "GET" }, workspaceCallDecisionsResponseSchema);
}

export function createWorkspaceCallDecision(workspaceId: string, callId: string, input: { body: string }): Promise<WorkspaceCallDecisionResponse> {
  return request(`/api/v1/workspaces/${workspaceId}/calls/${callId}/decisions`, { body: JSON.stringify(createWorkspaceCallDecisionRequestSchema.parse(input)), method: "POST" }, workspaceCallDecisionResponseSchema);
}

export function createTaskFromWorkspaceCallDecision(workspaceId: string, callId: string, decisionId: string, input: { projectId: string; title?: string }): Promise<WorkspaceCallDecisionResponse & { taskId: string }> {
  return request(`/api/v1/workspaces/${workspaceId}/calls/${callId}/decisions/${decisionId}/create-task`, { body: JSON.stringify(promoteWorkspaceCallDecisionRequestSchema.parse(input)), method: "POST" }, workspaceCallDecisionResponseSchema.extend({ taskId: z.string().uuid() }));
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

export function getProjectFigmaLinks(
  workspaceId: string,
  projectId: string,
): Promise<{ links: ProjectFigmaLink[] }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/figma-links`,
    { method: "GET" },
    projectFigmaLinkListResponseSchema,
  );
}

export function createProjectFigmaLink(
  workspaceId: string,
  projectId: string,
  input: { name: string; url: string },
): Promise<{ link: ProjectFigmaLink }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/figma-links`,
    { body: JSON.stringify(input), method: "POST" },
    projectFigmaLinkResponseSchema,
  );
}

export function deleteProjectFigmaLink(
  workspaceId: string,
  projectId: string,
  linkId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/figma-links/${linkId}`,
    { method: "DELETE" },
  );
}

export function getTaskFigmaLinks(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<{ links: TaskFigmaLink[] }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/figma-links`,
    { method: "GET" },
    taskFigmaLinkListResponseSchema,
  );
}

export function createTaskFigmaLink(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: { name: string; url: string },
): Promise<{ link: TaskFigmaLink }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/figma-links`,
    { body: JSON.stringify(input), method: "POST" },
    taskFigmaLinkResponseSchema,
  );
}

export function deleteTaskFigmaLink(
  workspaceId: string,
  projectId: string,
  taskId: string,
  linkId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/figma-links/${linkId}`,
    { method: "DELETE" },
  );
}

export function getProjectMembers(
  workspaceId: string,
  projectId: string,
): Promise<{ members: ProjectMember[] }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/members`,
    { method: "GET" },
    projectMemberListResponseSchema,
  );
}

export function addProjectMember(
  workspaceId: string,
  projectId: string,
  input: CreateProjectMemberRequest,
): Promise<{ member: ProjectMember }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/members`,
    { body: JSON.stringify(input), method: "POST" },
    projectMemberResponseSchema,
  );
}

export function updateProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string,
  input: UpdateProjectMemberRequest,
): Promise<{ member: ProjectMember }> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/members/${userId}`,
    { body: JSON.stringify(input), method: "PATCH" },
    projectMemberResponseSchema,
  );
}

export function removeProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/members/${userId}`,
    { method: "DELETE" },
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

export function getProjectSprintAnalytics(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<ProjectSprintAnalytics> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/analytics`,
    { method: "GET" },
    projectSprintAnalyticsSchema,
  );
}

export function completeProjectSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  input: CompleteProjectSprintRequest,
): Promise<ProjectSprintResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/complete`,
    {
      body: JSON.stringify(completeProjectSprintRequestSchema.parse(input)),
      method: "POST",
    },
    projectSprintResponseSchema,
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
  customFieldId?: string;
  customFieldValue?: string;
  due?: "overdue" | "today" | "week" | "none";
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
  if (filters.assigneeUserId)
    query.set("assigneeUserId", filters.assigneeUserId);
  if (filters.customFieldId && filters.customFieldValue) {
    query.set("customFieldId", filters.customFieldId);
    query.set("customFieldValue", filters.customFieldValue);
  }
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

export function getGitConnections(): Promise<GitConnectionsResponse> {
  return request("/api/v1/integrations/git/connections", { method: "GET" }, gitConnectionsResponseSchema);
}

export function disconnectGitConnection(connectionId: string): Promise<void> {
  return requestNoContent(`/api/v1/integrations/git/connections/${connectionId}`, { method: "DELETE" });
}

export function startGitConnection(provider: "github" | "gitlab") {
  if (typeof window === "undefined") return;
  window.location.assign(`${getApiUrl()}/api/v1/integrations/git/${provider}/connect`);
}

export function getProjectRepository(workspaceId: string, projectId: string): Promise<{ repository: ProjectRepository | null }> {
  return request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/repository`, { method: "GET" }, projectRepositoryResponseSchema);
}

export function connectProjectRepository(workspaceId: string, projectId: string, input: { connectionId: string; fullName: string }): Promise<{ repository: ProjectRepository }> {
  return request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/repository`, { body: JSON.stringify(input), method: "PUT" }, projectRepositoryResponseSchema.transform((value) => ({ repository: value.repository! })));
}

export function removeProjectRepository(workspaceId: string, projectId: string): Promise<void> {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/repository`, { method: "DELETE" });
}

export function getProjectReleaseNotes(workspaceId: string, projectId: string): Promise<{ generatedAt: string; markdown: string; mergedChanges: number }> {
  return request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/repository/release-notes`, { method: "GET" }, z.object({ generatedAt: z.string().datetime(), markdown: z.string(), mergedChanges: z.number().int().nonnegative() }));
}

const projectKnowledgePath = (workspaceId: string, projectId: string) => `/api/v1/workspaces/${workspaceId}/projects/${projectId}/knowledge`;

export function getProjectKnowledge(workspaceId: string, projectId: string): Promise<{ entries: import("@devflow/shared").ProjectKnowledgeEntry[] }> {
  return request(projectKnowledgePath(workspaceId, projectId), { method: "GET" }, (awaitedProjectKnowledgeSchemas()).list);
}

export function getProjectKnowledgeContext(workspaceId: string, projectId: string): Promise<{ entries: import("@devflow/shared").ProjectKnowledgeEntry[]; generatedAt: string }> {
  return request(`${projectKnowledgePath(workspaceId, projectId)}/context`, { method: "GET" }, (awaitedProjectKnowledgeSchemas()).context);
}

export function createProjectKnowledgeEntry(workspaceId: string, projectId: string, input: import("@devflow/shared").CreateProjectKnowledgeEntryRequest): Promise<{ entry: import("@devflow/shared").ProjectKnowledgeEntry }> {
  return request(projectKnowledgePath(workspaceId, projectId), { body: JSON.stringify(input), method: "POST" }, (awaitedProjectKnowledgeSchemas()).entry);
}

export function updateProjectKnowledgeEntry(workspaceId: string, projectId: string, entryId: string, input: Partial<import("@devflow/shared").CreateProjectKnowledgeEntryRequest>): Promise<{ entry: import("@devflow/shared").ProjectKnowledgeEntry }> {
  return request(`${projectKnowledgePath(workspaceId, projectId)}/${entryId}`, { body: JSON.stringify(input), method: "PATCH" }, (awaitedProjectKnowledgeSchemas()).entry);
}

export function deleteProjectKnowledgeEntry(workspaceId: string, projectId: string, entryId: string): Promise<void> {
  return requestNoContent(`${projectKnowledgePath(workspaceId, projectId)}/${entryId}`, { method: "DELETE" });
}

export function addProjectKnowledgeLink(workspaceId: string, projectId: string, entryId: string, input: { kind: "task" | "pull_request" | "figma" | "release" | "external"; label: string; url: string; externalId?: string | null }): Promise<{ entry: import("@devflow/shared").ProjectKnowledgeEntry }> {
  return request(`${projectKnowledgePath(workspaceId, projectId)}/${entryId}/links`, { body: JSON.stringify(input), method: "POST" }, (awaitedProjectKnowledgeSchemas()).entry);
}

const projectPlanningPath = (workspaceId: string, projectId: string) => `/api/v1/workspaces/${workspaceId}/projects/${projectId}/planning`;
export function getProjectPlanning(workspaceId: string, projectId: string): Promise<import("@devflow/shared").ProjectPlanningResponse> { return request(projectPlanningPath(workspaceId, projectId), { method: "GET" }, projectPlanningResponseSchema); }
export function createProjectRelease(workspaceId: string, projectId: string, input: { name: string; description?: string | null; startDate?: string | null; releaseDate?: string | null }): Promise<{ release: import("@devflow/shared").ProjectRelease }> { return request(`${projectPlanningPath(workspaceId, projectId)}/releases`, { body: JSON.stringify(input), method: "POST" }, z.object({ release: projectReleaseSchema })); }
export function updateProjectPlanningTask(workspaceId: string, projectId: string, taskId: string, input: { epicId?: string | null; releaseId?: string | null; complexityPoints?: number | null }): Promise<{ task: import("@devflow/shared").ProjectPlanningTask }> { return request(`${projectPlanningPath(workspaceId, projectId)}/tasks/${taskId}`, { body: JSON.stringify(input), method: "PATCH" }, z.object({ task: projectPlanningResponseSchema.shape.tasks.element })); }

function awaitedProjectKnowledgeSchemas() {
  return { context: projectKnowledgeContextResponseSchema, entry: projectKnowledgeEntryResponseSchema, list: projectKnowledgeListResponseSchema };
}

const taskGitPath = (workspaceId: string, projectId: string, taskId: string) => `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/git`;

export function getTaskGitLinks(workspaceId: string, projectId: string, taskId: string): Promise<{ links: TaskGitLink[] }> {
  return request(taskGitPath(workspaceId, projectId, taskId), { method: "GET" }, taskGitLinksResponseSchema);
}

export function createTaskGitBranch(workspaceId: string, projectId: string, taskId: string, input: { name: string; baseBranch?: string }): Promise<{ link: TaskGitLink }> {
  return request(`${taskGitPath(workspaceId, projectId, taskId)}/branch`, { body: JSON.stringify(input), method: "POST" }, taskGitLinkResponseSchema);
}

export function createTaskPullRequest(workspaceId: string, projectId: string, taskId: string, input: { baseBranch?: string; body?: string; title?: string }): Promise<{ link: TaskGitLink }> {
  return request(`${taskGitPath(workspaceId, projectId, taskId)}/pull-request`, { body: JSON.stringify(input), method: "POST" }, taskGitLinkResponseSchema);
}

export function syncTaskGitLinks(workspaceId: string, projectId: string, taskId: string): Promise<{ links: TaskGitLink[]; ciStatus: "not_configured" | "pending" | "passing" | "failing"; synchronizedAt: string }> {
  return request(`${taskGitPath(workspaceId, projectId, taskId)}/sync`, { method: "POST" }, z.object({ links: z.array(taskGitLinkResponseSchema.shape.link), ciStatus: z.enum(["not_configured", "pending", "passing", "failing"]), synchronizedAt: z.string().datetime() }));
}

const developmentFlowPath = (
  workspaceId: string,
  projectId: string,
  taskId: string,
) => `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/development-flow`;

export function getTaskDevelopmentFlow(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskDevelopmentFlowDetailsResponse> {
  return request(
    developmentFlowPath(workspaceId, projectId, taskId),
    { method: "GET" },
    taskDevelopmentFlowDetailsResponseSchema,
  );
}

export function createTaskDevelopmentFlow(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateTaskDevelopmentFlowRequest,
): Promise<TaskDevelopmentFlowResponse> {
  return request(
    developmentFlowPath(workspaceId, projectId, taskId),
    { body: JSON.stringify(createTaskDevelopmentFlowRequestSchema.parse(input)), method: "POST" },
    taskDevelopmentFlowResponseSchema,
  );
}

export function updateTaskDevelopmentFlow(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskDevelopmentFlowRequest,
): Promise<TaskDevelopmentFlowResponse> {
  return request(
    developmentFlowPath(workspaceId, projectId, taskId),
    { body: JSON.stringify(updateTaskDevelopmentFlowRequestSchema.parse(input)), method: "PATCH" },
    taskDevelopmentFlowResponseSchema,
  );
}

export function transitionTaskDevelopmentFlow(
  workspaceId: string,
  projectId: string,
  taskId: string,
  state: "idea" | "planning" | "approval" | "ready" | "in_progress" | "review" | "done",
): Promise<TaskDevelopmentFlowResponse> {
  return request(
    `${developmentFlowPath(workspaceId, projectId, taskId)}/transition`,
    { body: JSON.stringify(transitionTaskDevelopmentFlowRequestSchema.parse({ state })), method: "POST" },
    taskDevelopmentFlowResponseSchema,
  );
}

function actOnTaskDevelopmentFlow(
  workspaceId: string,
  projectId: string,
  taskId: string,
  action: "approve-plan" | "approve-review" | "reject-plan" | "reject-review",
  comment?: string,
): Promise<TaskDevelopmentFlowResponse> {
  return request(
    `${developmentFlowPath(workspaceId, projectId, taskId)}/${action}`,
    {
      body: comment ? JSON.stringify(rejectTaskDevelopmentFlowRequestSchema.parse({ comment })) : undefined,
      method: "POST",
    },
    taskDevelopmentFlowResponseSchema,
  );
}

export const approveTaskDevelopmentPlan = (workspaceId: string, projectId: string, taskId: string) => actOnTaskDevelopmentFlow(workspaceId, projectId, taskId, "approve-plan");
export const rejectTaskDevelopmentPlan = (workspaceId: string, projectId: string, taskId: string, comment: string) => actOnTaskDevelopmentFlow(workspaceId, projectId, taskId, "reject-plan", comment);
export const approveTaskDevelopmentReview = (workspaceId: string, projectId: string, taskId: string) => actOnTaskDevelopmentFlow(workspaceId, projectId, taskId, "approve-review");
export const rejectTaskDevelopmentReview = (workspaceId: string, projectId: string, taskId: string, comment: string) => actOnTaskDevelopmentFlow(workspaceId, projectId, taskId, "reject-review", comment);

export function createTaskDevelopmentFlowSession(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: { agentName?: string; client: string },
): Promise<TaskDevelopmentFlowSessionResponse> {
  return request(
    `${developmentFlowPath(workspaceId, projectId, taskId)}/sessions`,
    { body: JSON.stringify(createTaskDevelopmentFlowSessionRequestSchema.parse(input)), method: "POST" },
    taskDevelopmentFlowSessionResponseSchema,
  );
}

export function updateTaskDevelopmentFlowSession(
  workspaceId: string,
  projectId: string,
  taskId: string,
  sessionId: string,
  input: { status?: "active" | "paused" | "completed" | "failed"; summary?: string | null },
): Promise<TaskDevelopmentFlowSessionResponse> {
  return request(
    `${developmentFlowPath(workspaceId, projectId, taskId)}/sessions/${sessionId}`,
    { body: JSON.stringify(updateTaskDevelopmentFlowSessionRequestSchema.parse(input)), method: "PATCH" },
    taskDevelopmentFlowSessionResponseSchema,
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

export function getTaskTimeEntries(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskTimeEntryListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries`,
    { method: "GET" },
    taskTimeEntryListResponseSchema,
  );
}

export function startTaskTimer(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskTimeEntryResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries/start`,
    { method: "POST" },
    taskTimeEntryResponseSchema,
  );
}

export function stopTaskTimer(
  workspaceId: string,
  projectId: string,
  taskId: string,
  entryId: string,
): Promise<TaskTimeEntryResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries/${entryId}/stop`,
    { method: "POST" },
    taskTimeEntryResponseSchema,
  );
}

export function createManualTaskTimeEntry(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateManualTaskTimeEntryRequest,
): Promise<TaskTimeEntryResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/time-entries`,
    {
      body: JSON.stringify(createManualTaskTimeEntryRequestSchema.parse(input)),
      method: "POST",
    },
    taskTimeEntryResponseSchema,
  );
}

export function getTaskWatchers(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskWatcherListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/watchers`,
    { method: "GET" },
    taskWatcherListResponseSchema,
  );
}

export function followTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskWatcherListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/watchers/me`,
    { method: "POST" },
    taskWatcherListResponseSchema,
  );
}

export function addTaskWatcher(
  workspaceId: string,
  projectId: string,
  taskId: string,
  userId: string,
): Promise<TaskWatcherListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/watchers`,
    { body: JSON.stringify({ userId }), method: "POST" },
    taskWatcherListResponseSchema,
  );
}

export function unfollowTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<TaskWatcherListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/watchers/me`,
    { method: "DELETE" },
    taskWatcherListResponseSchema,
  );
}

export function removeTaskWatcher(
  workspaceId: string,
  projectId: string,
  taskId: string,
  userId: string,
): Promise<TaskWatcherListResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/watchers/${userId}`,
    { method: "DELETE" },
    taskWatcherListResponseSchema,
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

export function uploadTaskCommentAttachment(
  workspaceId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  file: File,
): Promise<TaskAttachmentResponse> {
  const form = new FormData();
  form.set("file", file);
  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}/attachments`,
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

export function repositionTask(
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: RepositionTaskRequest,
): Promise<void> {
  return requestNoContent(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/position`,
    {
      body: JSON.stringify(repositionTaskRequestSchema.parse(input)),
      method: "PUT",
    },
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

export function getWorkspaceAutomationRules(
  workspaceId: string,
): Promise<WorkspaceAutomationRulesResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/automation/rules`,
    { method: "GET" },
    workspaceAutomationRulesResponseSchema,
  );
}

export function getWorkspaceSettings(workspaceId: string) { return request(`/api/v1/workspaces/${workspaceId}/settings`, { method: "GET" }, workspaceSettingsResponseSchema); }
export function updateWorkspaceSettings(workspaceId: string, input: UpdateWorkspaceSettingsRequest) { return request(`/api/v1/workspaces/${workspaceId}/settings`, { body: JSON.stringify(input), method: "PATCH" }, workspaceSettingsResponseSchema); }
export function getWorkspaceSavedFilters(workspaceId: string) { return request(`/api/v1/workspaces/${workspaceId}/settings/filters`, { method: "GET" }, workspaceSavedFiltersResponseSchema); }
export function createWorkspaceSavedFilter(workspaceId: string, input: unknown) { return request(`/api/v1/workspaces/${workspaceId}/settings/filters`, { body: JSON.stringify(createWorkspaceSavedFilterRequestSchema.parse(input)), method: "POST" }, workspaceSavedFilterResponseSchema); }
export function deleteWorkspaceSavedFilter(workspaceId: string, filterId: string) { return requestNoContent(`/api/v1/workspaces/${workspaceId}/settings/filters/${filterId}`, { method: "DELETE" }); }

export function updateWorkspaceAutomationRule(
  workspaceId: string,
  ruleId: string,
  input: UpdateWorkspaceAutomationRuleRequest,
) {
  return request(
    `/api/v1/workspaces/${workspaceId}/automation/rules/${ruleId}`,
    { body: JSON.stringify(input), method: "PATCH" },
    workspaceAutomationRuleResponseSchema,
  );
}

export function createWorkspaceAutomationRule(workspaceId: string, input: CreateWorkspaceAutomationRuleRequest) {
  return request(`/api/v1/workspaces/${workspaceId}/automation/rules`, { body: JSON.stringify(createWorkspaceAutomationRuleRequestSchema.parse(input)), method: "POST" }, workspaceAutomationRuleResponseSchema);
}

export function deleteWorkspaceAutomationRule(workspaceId: string, ruleId: string) {
  return requestNoContent(`/api/v1/workspaces/${workspaceId}/automation/rules/${ruleId}`, { method: "DELETE" });
}

export function retryWorkspaceAutomationRun(workspaceId: string, ruleId: string, runId: string) {
  return request(`/api/v1/workspaces/${workspaceId}/automation/rules/${ruleId}/runs/${runId}/retry`, { method: "POST" }, z.object({ ok: z.literal(true) }));
}

export function getWorkspaceAutomationRuns(
  workspaceId: string,
): Promise<WorkspaceAutomationRunsResponse> {
  return request(
    `/api/v1/workspaces/${workspaceId}/automation/runs`,
    { method: "GET" },
    workspaceAutomationRunsResponseSchema,
  );
}

export function getWorkspaceAutomationTemplates(workspaceId: string) {
  return request(
    `/api/v1/workspaces/${workspaceId}/automation/templates`,
    { method: "GET" },
    workspaceAutomationTemplatesResponseSchema,
  );
}

export function getWorkspaceAutomationUsage(workspaceId: string) {
  return request(
    `/api/v1/workspaces/${workspaceId}/automation/usage`,
    { method: "GET" },
    workspaceAutomationUsageResponseSchema,
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
