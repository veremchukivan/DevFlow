import type { Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { getCurrentUser, getCurrentUserByApiToken } from "./auth.service.js";

type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

export type AuthenticatedRequest = Request & {
  auth: {
    user: AuthenticatedUser;
    apiTokenScopes?: string[];
  };
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.get("authorization")?.match(/^Bearer (df_[A-Za-z0-9_-]+)$/)?.[1];
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!token && !bearer) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
    }

    const apiToken = bearer ? await getCurrentUserByApiToken(bearer) : undefined;
    if (apiToken && !hasMethodScope(apiToken.scopes, req.method)) {
      throw new AppError(
        403,
        "API_TOKEN_SCOPE_DENIED",
        "API token does not have permission for this request",
      );
    }
    const user = apiToken?.user ?? await getCurrentUser(token!);
    (req as AuthenticatedRequest).auth = { user, ...(apiToken ? { apiTokenScopes: apiToken.scopes } : {}) };

    next();
  } catch (error) {
    next(error);
  }
};

function hasMethodScope(scopes: string[], method: string) {
  if (scopes.includes("api:access")) return true;

  const requiredScope = ["GET", "HEAD", "OPTIONS"].includes(method)
    ? "api:read"
    : "api:write";
  return scopes.includes(requiredScope);
}

export function requireApiScope(scope: string): RequestHandler {
  return (req, _res, next) => {
    const scopes = (req as AuthenticatedRequest).auth?.apiTokenScopes;
    if (scopes && !scopes.includes(scope)) {
      next(new AppError(403, "API_TOKEN_SCOPE_DENIED", "API token does not have the required scope"));
      return;
    }
    next();
  };
}
