import {
  authResponseSchema,
  healthResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  createWorkspaceRequestSchema,
  createProjectRequestSchema,
  createTaskRequestSchema,
  projectListResponseSchema,
  projectResponseSchema,
  taskListResponseSchema,
  taskResponseSchema,
  workspaceListResponseSchema,
  workspaceResponseSchema,
  type AuthResponse,
  type HealthResponse,
  type LoginRequest,
  type RegisterRequest,
  type CreateWorkspaceRequest,
  type WorkspaceListResponse,
  type WorkspaceResponse,
  type CreateProjectRequest,
  type CreateTaskRequest,
  type ProjectListResponse,
  type ProjectResponse,
  type TaskListResponse,
  type TaskPriority,
  type TaskResponse,
  type UpdateTaskRequest,
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

type TaskListFilters = {
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

  if (filters.search) {
    query.set("search", filters.search);
  }

  return request(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?${query.toString()}`,
    { method: "GET" },
    taskListResponseSchema,
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
