import {
  authResponseSchema,
  healthResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type HealthResponse,
  type LoginRequest,
  type RegisterRequest,
} from "@devflow/shared";
import { z } from "zod";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

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
  const response = await fetch(`${apiUrl}${path}`, {
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
  const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
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

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/healthz`, { cache: "no-store" });

  if (!response.ok) {
    throw new ApiClientError(
      `API health request failed with ${response.status}`,
      "HEALTH_REQUEST_FAILED",
    );
  }

  return healthResponseSchema.parse(await response.json());
}
