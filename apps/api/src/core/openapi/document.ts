import {
  acceptInvitationResponseSchema,
  addWorkspaceMemberRequestSchema,
  authResponseSchema,
  changePasswordRequestSchema,
  createProjectRequestSchema,
  createProjectStatusRequestSchema,
  createTaskCommentRequestSchema,
  createTaskRequestSchema,
  createWorkspaceInvitationRequestSchema,
  createWorkspaceRequestSchema,
  emailVerificationTokenRequestSchema,
  healthResponseSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  projectListResponseSchema,
  projectResponseSchema,
  publicWorkspaceInvitationResponseSchema,
  registerRequestSchema,
  taskCommentListResponseSchema,
  taskCommentResponseSchema,
  taskListResponseSchema,
  taskResponseSchema,
  updateProfileRequestSchema,
  taskActivityEventListResponseSchema,
  updateProjectRequestSchema,
  updateProjectStatusRequestSchema,
  updateTaskCommentRequestSchema,
  updateTaskRequestSchema,
  updateWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
  workspaceInvitationListResponseSchema,
  workspaceInvitationResponseSchema,
  workspaceListResponseSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberResponseSchema,
  workspaceResponseSchema,
} from "@devflow/shared";
import { z } from "zod";

const schemas = {
  AcceptInvitationResponse: acceptInvitationResponseSchema,
  AddWorkspaceMemberRequest: addWorkspaceMemberRequestSchema,
  AuthResponse: authResponseSchema,
  ChangePasswordRequest: changePasswordRequestSchema,
  CreateProjectRequest: createProjectRequestSchema,
  CreateProjectStatusRequest: createProjectStatusRequestSchema,
  CreateTaskCommentRequest: createTaskCommentRequestSchema,
  CreateTaskRequest: createTaskRequestSchema,
  CreateWorkspaceInvitationRequest: createWorkspaceInvitationRequestSchema,
  CreateWorkspaceRequest: createWorkspaceRequestSchema,
  EmailVerificationTokenRequest: emailVerificationTokenRequestSchema,
  HealthResponse: healthResponseSchema,
  LoginRequest: loginRequestSchema,
  PasswordResetConfirmRequest: passwordResetConfirmRequestSchema,
  PasswordResetRequest: passwordResetRequestSchema,
  ProjectListResponse: projectListResponseSchema,
  ProjectResponse: projectResponseSchema,
  PublicWorkspaceInvitationResponse: publicWorkspaceInvitationResponseSchema,
  RegisterRequest: registerRequestSchema,
  TaskActivityEventListResponse: taskActivityEventListResponseSchema,
  TaskCommentListResponse: taskCommentListResponseSchema,
  TaskCommentResponse: taskCommentResponseSchema,
  TaskListResponse: taskListResponseSchema,
  TaskResponse: taskResponseSchema,
  UpdateProjectRequest: updateProjectRequestSchema,
  UpdateProjectStatusRequest: updateProjectStatusRequestSchema,
  UpdateProfileRequest: updateProfileRequestSchema,
  UpdateTaskCommentRequest: updateTaskCommentRequestSchema,
  UpdateTaskRequest: updateTaskRequestSchema,
  UpdateWorkspaceMemberRequest: updateWorkspaceMemberRequestSchema,
  UpdateWorkspaceRequest: updateWorkspaceRequestSchema,
  WorkspaceInvitationListResponse: workspaceInvitationListResponseSchema,
  WorkspaceInvitationResponse: workspaceInvitationResponseSchema,
  WorkspaceListResponse: workspaceListResponseSchema,
  WorkspaceMemberListResponse: workspaceMemberListResponseSchema,
  WorkspaceMemberResponse: workspaceMemberResponseSchema,
  WorkspaceResponse: workspaceResponseSchema,
};

type SchemaName = keyof typeof schemas;
type DocumentSchemaName = SchemaName | "ErrorResponse" | "ReadinessResponse";

const json = (schema: DocumentSchemaName) => ({
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const response = (
  description: string,
  schema?: DocumentSchemaName,
  headers = {},
) => ({
  description,
  headers: {
    "X-Request-Id": { $ref: "#/components/headers/RequestId" },
    ...headers,
  },
  ...(schema ? json(schema) : {}),
});

const errorResponse = (description: string) => ({
  description,
  headers: {
    "X-Request-Id": { $ref: "#/components/headers/RequestId" },
  },
  ...json("ErrorResponse"),
});

const requestBody = (schema: SchemaName) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const uuidPath = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
});

const tokenPath = {
  name: "token",
  in: "path",
  required: true,
  schema: { type: "string", minLength: 1 },
};

const pagination = [
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
  {
    name: "offset",
    in: "query",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];

const authenticated = [{ sessionCookie: [] }];
const commonErrors = {
  "400": errorResponse("Invalid request"),
  "401": errorResponse("Authentication is required"),
  "403": errorResponse("Permission denied"),
  "404": errorResponse("Resource not found"),
  "429": errorResponse("Rate limit exceeded"),
  "500": errorResponse("Unexpected server error"),
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "DevFlow API",
    version: "1.0.0",
    description:
      "Cookie-authenticated API for DevFlow workspaces, projects, and tasks.",
  },
  servers: [{ url: "http://localhost:4000", description: "Local development" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Workspaces" },
    { name: "Members" },
    { name: "Invitations" },
    { name: "Projects" },
    { name: "Tasks" },
    { name: "Comments" },
    { name: "Activity" },
  ],
  paths: {
    "/healthz": {
      get: {
        tags: ["Health"],
        operationId: "health",
        responses: { "200": response("API is running", "HealthResponse") },
      },
    },
    "/readyz": {
      get: {
        tags: ["Health"],
        operationId: "readiness",
        responses: {
          "200": response("Dependencies are ready", "ReadinessResponse"),
          "503": response(
            "A required dependency is unavailable",
            "ReadinessResponse",
          ),
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        operationId: "register",
        requestBody: requestBody("RegisterRequest"),
        responses: {
          "201": response("Account created", "AuthResponse"),
          "400": errorResponse("Invalid request"),
          "409": errorResponse("Email already registered"),
          "429": errorResponse("Rate limit exceeded"),
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        operationId: "login",
        requestBody: requestBody("LoginRequest"),
        responses: {
          "200": response("Session created", "AuthResponse"),
          "401": errorResponse("Invalid credentials"),
          "429": errorResponse("Rate limit exceeded"),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        operationId: "logout",
        responses: { "204": response("Session cleared") },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        operationId: "currentUser",
        security: authenticated,
        responses: {
          "200": response("Current user", "AuthResponse"),
          "401": errorResponse("Authentication is required"),
        },
      },
    },
    "/api/v1/auth/profile": {
      patch: {
        tags: ["Auth"],
        operationId: "updateProfile",
        security: authenticated,
        requestBody: requestBody("UpdateProfileRequest"),
        responses: {
          "200": response("Profile updated", "AuthResponse"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/auth/password/change": {
      post: {
        tags: ["Auth"],
        operationId: "changePassword",
        security: authenticated,
        requestBody: requestBody("ChangePasswordRequest"),
        responses: {
          "204": response("Password changed and sessions cleared"),
          ...commonErrors,
          "400": errorResponse("Current password is incorrect"),
        },
      },
    },
    "/api/v1/auth/email-verification/resend": {
      post: {
        tags: ["Auth"],
        operationId: "resendEmailVerification",
        security: authenticated,
        responses: { "204": response("Email sent"), ...commonErrors },
      },
    },
    "/api/v1/auth/email-verification/confirm": {
      post: {
        tags: ["Auth"],
        operationId: "confirmEmailVerification",
        requestBody: requestBody("EmailVerificationTokenRequest"),
        responses: {
          "204": response("Email verified"),
          "400": errorResponse("Invalid token"),
          "429": errorResponse("Rate limit exceeded"),
        },
      },
    },
    "/api/v1/auth/password-reset/request": {
      post: {
        tags: ["Auth"],
        operationId: "requestPasswordReset",
        requestBody: requestBody("PasswordResetRequest"),
        responses: {
          "204": response("Request accepted"),
          "400": errorResponse("Invalid request"),
          "429": errorResponse("Rate limit exceeded"),
        },
      },
    },
    "/api/v1/auth/password-reset/confirm": {
      post: {
        tags: ["Auth"],
        operationId: "confirmPasswordReset",
        requestBody: requestBody("PasswordResetConfirmRequest"),
        responses: {
          "204": response("Password reset"),
          "400": errorResponse("Invalid token or password"),
          "429": errorResponse("Rate limit exceeded"),
        },
      },
    },
    "/api/v1/workspaces": {
      post: {
        tags: ["Workspaces"],
        operationId: "createWorkspace",
        security: authenticated,
        requestBody: requestBody("CreateWorkspaceRequest"),
        responses: {
          "201": response("Workspace created", "WorkspaceResponse"),
          ...commonErrors,
        },
      },
      get: {
        tags: ["Workspaces"],
        operationId: "listWorkspaces",
        security: authenticated,
        parameters: pagination,
        responses: {
          "200": response("Workspace page", "WorkspaceListResponse"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}": {
      get: {
        tags: ["Workspaces"],
        operationId: "getWorkspace",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        responses: {
          "200": response("Workspace", "WorkspaceResponse"),
          ...commonErrors,
        },
      },
      patch: {
        tags: ["Workspaces"],
        operationId: "updateWorkspace",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        requestBody: requestBody("UpdateWorkspaceRequest"),
        responses: {
          "200": response("Workspace updated", "WorkspaceResponse"),
          ...commonErrors,
        },
      },
      delete: {
        tags: ["Workspaces"],
        operationId: "deleteWorkspace",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        responses: { "204": response("Workspace deleted"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/leave": {
      post: {
        tags: ["Workspaces"],
        operationId: "leaveWorkspace",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        responses: { "204": response("Workspace left"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/members": {
      get: {
        tags: ["Members"],
        operationId: "listWorkspaceMembers",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), ...pagination],
        responses: {
          "200": response("Member page", "WorkspaceMemberListResponse"),
          ...commonErrors,
        },
      },
      post: {
        tags: ["Members"],
        operationId: "addWorkspaceMember",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        requestBody: requestBody("AddWorkspaceMemberRequest"),
        responses: {
          "201": response("Member added", "WorkspaceMemberResponse"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/members/{userId}": {
      patch: {
        tags: ["Members"],
        operationId: "updateWorkspaceMember",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("userId")],
        requestBody: requestBody("UpdateWorkspaceMemberRequest"),
        responses: {
          "200": response("Member updated", "WorkspaceMemberResponse"),
          ...commonErrors,
        },
      },
      delete: {
        tags: ["Members"],
        operationId: "removeWorkspaceMember",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("userId")],
        responses: { "204": response("Member removed"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/members/leave": {
      post: {
        tags: ["Members"],
        operationId: "leaveWorkspaceMembers",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        responses: { "204": response("Workspace left"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/invitations": {
      get: {
        tags: ["Invitations"],
        operationId: "listInvitations",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), ...pagination],
        responses: {
          "200": response("Invitation page", "WorkspaceInvitationListResponse"),
          ...commonErrors,
        },
      },
      post: {
        tags: ["Invitations"],
        operationId: "createInvitation",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        requestBody: requestBody("CreateWorkspaceInvitationRequest"),
        responses: {
          "201": response("Invitation created", "WorkspaceInvitationResponse"),
          "502": errorResponse("Invitation delivery failed"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/invitations/{invitationId}": {
      delete: {
        tags: ["Invitations"],
        operationId: "cancelInvitation",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("invitationId")],
        responses: { "204": response("Invitation cancelled"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/invitations/{invitationId}/resend": {
      post: {
        tags: ["Invitations"],
        operationId: "resendInvitation",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("invitationId")],
        responses: {
          "204": response("Invitation resent"),
          "502": errorResponse("Invitation delivery failed"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/invitations/{token}": {
      get: {
        tags: ["Invitations"],
        operationId: "getPublicInvitation",
        parameters: [tokenPath],
        responses: {
          "200": response("Invitation", "PublicWorkspaceInvitationResponse"),
          "404": errorResponse("Invitation not found"),
        },
      },
    },
    "/api/v1/invitations/{token}/accept": {
      post: {
        tags: ["Invitations"],
        operationId: "acceptInvitation",
        security: authenticated,
        parameters: [tokenPath],
        responses: {
          "200": response("Invitation accepted", "AcceptInvitationResponse"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/invitations/{token}/decline": {
      post: {
        tags: ["Invitations"],
        operationId: "declineInvitation",
        parameters: [tokenPath],
        responses: {
          "200": response("Invitation declined"),
          "404": errorResponse("Invitation not found"),
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects": {
      get: {
        tags: ["Projects"],
        operationId: "listProjects",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), ...pagination],
        responses: {
          "200": response("Project page", "ProjectListResponse"),
          ...commonErrors,
        },
      },
      post: {
        tags: ["Projects"],
        operationId: "createProject",
        security: authenticated,
        parameters: [uuidPath("workspaceId")],
        requestBody: requestBody("CreateProjectRequest"),
        responses: {
          "201": response("Project created", "ProjectResponse"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}": {
      get: {
        tags: ["Projects"],
        operationId: "getProject",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId")],
        responses: {
          "200": response("Project", "ProjectResponse"),
          ...commonErrors,
        },
      },
      patch: {
        tags: ["Projects"],
        operationId: "updateProject",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId")],
        requestBody: requestBody("UpdateProjectRequest"),
        responses: {
          "200": response("Project updated", "ProjectResponse"),
          ...commonErrors,
        },
      },
      delete: {
        tags: ["Projects"],
        operationId: "deleteProject",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId")],
        responses: { "204": response("Project deleted"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/statuses": {
      post: {
        tags: ["Projects"], operationId: "createProjectStatus", security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId")],
        requestBody: requestBody("CreateProjectStatusRequest"),
        responses: { "201": response("Status created", "ProjectResponse"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/statuses/{statusId}": {
      patch: {
        tags: ["Projects"], operationId: "updateProjectStatus", security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId"), uuidPath("statusId")],
        requestBody: requestBody("UpdateProjectStatusRequest"),
        responses: { "200": response("Status updated", "ProjectResponse"), ...commonErrors },
      },
      delete: {
        tags: ["Projects"], operationId: "deleteProjectStatus", security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId"), uuidPath("statusId")],
        responses: { "204": response("Status deleted"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks": {
      get: {
        tags: ["Tasks"],
        operationId: "listTasks",
        security: authenticated,
        parameters: [
          uuidPath("workspaceId"),
          uuidPath("projectId"),
          ...pagination,
          {
            name: "statusId",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "priority",
            in: "query",
            schema: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
            },
          },
          {
            name: "assigneeUserId",
            in: "query",
            schema: {
              oneOf: [{ type: "string", format: "uuid" }, { const: "none" }],
            },
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string", minLength: 1, maxLength: 200 },
          },
          { name: "archived", in: "query", schema: { type: "boolean" } },
          {
            name: "sortBy",
            in: "query",
            schema: {
              type: "string",
              enum: ["createdAt", "updatedAt", "priority", "number"],
              default: "createdAt",
            },
          },
          {
            name: "sortOrder",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        ],
        responses: {
          "200": response("Task page", "TaskListResponse"),
          ...commonErrors,
        },
      },
      post: {
        tags: ["Tasks"],
        operationId: "createTask",
        security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId")],
        requestBody: requestBody("CreateTaskRequest"),
        responses: {
          "201": response("Task created", "TaskResponse", {
            ETag: { $ref: "#/components/headers/TaskEtag" },
          }),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}": {
      get: {
        tags: ["Tasks"],
        operationId: "getTask",
        security: authenticated,
        parameters: [
          uuidPath("workspaceId"),
          uuidPath("projectId"),
          uuidPath("taskId"),
        ],
        responses: {
          "200": response("Task", "TaskResponse", {
            ETag: { $ref: "#/components/headers/TaskEtag" },
          }),
          ...commonErrors,
        },
      },
      patch: {
        tags: ["Tasks"],
        operationId: "updateTask",
        security: authenticated,
        parameters: [
          uuidPath("workspaceId"),
          uuidPath("projectId"),
          uuidPath("taskId"),
          {
            name: "If-Match",
            in: "header",
            required: true,
            schema: { type: "string", pattern: '^"[1-9]\\d*"$' },
          },
        ],
        requestBody: requestBody("UpdateTaskRequest"),
        responses: {
          "200": response("Task updated", "TaskResponse", {
            ETag: { $ref: "#/components/headers/TaskEtag" },
          }),
          "409": errorResponse("Task version conflict"),
          "428": errorResponse("Task version is required"),
          ...commonErrors,
        },
      },
      delete: {
        tags: ["Tasks"],
        operationId: "archiveTask",
        security: authenticated,
        parameters: [
          uuidPath("workspaceId"),
          uuidPath("projectId"),
          uuidPath("taskId"),
          {
            name: "If-Match",
            in: "header",
            required: true,
            schema: { type: "string", pattern: '^"[1-9]\\d*"$' },
          },
        ],
        responses: {
          "204": response("Task archived"),
          "409": errorResponse("Task version conflict"),
          "428": errorResponse("Task version is required"),
          ...commonErrors,
        },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/restore": {
      post: {
        tags: ["Tasks"], operationId: "restoreTask", security: authenticated,
        parameters: [uuidPath("workspaceId"), uuidPath("projectId"), uuidPath("taskId"), { name: "If-Match", in: "header", required: true, schema: { type: "string", pattern: '^"[1-9]\\d*"$' } }],
        responses: { "204": response("Task restored"), "409": errorResponse("Task version conflict"), "428": errorResponse("Task version is required"), ...commonErrors },
      },
    },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments":
      {
        get: {
          tags: ["Comments"],
          operationId: "listTaskComments",
          security: authenticated,
          parameters: [
            uuidPath("workspaceId"),
            uuidPath("projectId"),
            uuidPath("taskId"),
            ...pagination,
          ],
          responses: {
            "200": response("Comment page", "TaskCommentListResponse"),
            ...commonErrors,
          },
        },
        post: {
          tags: ["Comments"],
          operationId: "createTaskComment",
          security: authenticated,
          parameters: [
            uuidPath("workspaceId"),
            uuidPath("projectId"),
            uuidPath("taskId"),
          ],
          requestBody: requestBody("CreateTaskCommentRequest"),
          responses: {
            "201": response("Comment created", "TaskCommentResponse"),
            ...commonErrors,
          },
        },
      },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}":
      {
        patch: {
          tags: ["Comments"],
          operationId: "updateTaskComment",
          security: authenticated,
          parameters: [
            uuidPath("workspaceId"),
            uuidPath("projectId"),
            uuidPath("taskId"),
            uuidPath("commentId"),
          ],
          requestBody: requestBody("UpdateTaskCommentRequest"),
          responses: {
            "200": response("Comment updated", "TaskCommentResponse"),
            ...commonErrors,
          },
        },
        delete: {
          tags: ["Comments"],
          operationId: "deleteTaskComment",
          security: authenticated,
          parameters: [
            uuidPath("workspaceId"),
            uuidPath("projectId"),
            uuidPath("taskId"),
            uuidPath("commentId"),
          ],
          responses: { "204": response("Comment deleted"), ...commonErrors },
        },
      },
    "/api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/activity":
      {
        get: {
          tags: ["Activity"],
          operationId: "listTaskActivity",
          security: authenticated,
          parameters: [
            uuidPath("workspaceId"),
            uuidPath("projectId"),
            uuidPath("taskId"),
            ...pagination,
          ],
          responses: {
            "200": response("Activity page", "TaskActivityEventListResponse"),
            ...commonErrors,
          },
        },
      },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "devflow_session",
        description: "HttpOnly session cookie set by register or login.",
      },
    },
    headers: {
      RequestId: {
        description: "Request correlation ID",
        schema: { type: "string" },
      },
      TaskEtag: {
        description: "Current task version, required by task updates",
        schema: { type: "string", example: '"1"' },
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              issues: { type: "array", items: {} },
            },
          },
        },
      },
      ReadinessResponse: {
        type: "object",
        required: ["checks", "status", "timestamp"],
        properties: {
          checks: {
            type: "object",
            required: ["database", "redis"],
            properties: {
              database: { type: "string", enum: ["ok", "error"] },
              redis: {
                type: "string",
                enum: ["ok", "error", "not_configured", "unknown"],
              },
            },
          },
          status: { type: "string", enum: ["ok", "error"] },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ...Object.fromEntries(
        Object.entries(schemas).map(([name, schema]) => [
          name,
          z.toJSONSchema(schema, {
            target: "draft-2020-12",
            unrepresentable: "any",
          }),
        ]),
      ),
    },
  },
};
