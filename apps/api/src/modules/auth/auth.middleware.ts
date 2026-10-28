import type { Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { getCurrentUser, getCurrentUserByApiToken } from "./auth.service.js";

type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

export type AuthenticatedRequest = Request & {
  auth: {
    user: AuthenticatedUser;
  };
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.get("authorization")?.match(/^Bearer (df_[A-Za-z0-9_-]+)$/)?.[1];
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!token && !bearer) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
    }

    const user = bearer ? await getCurrentUserByApiToken(bearer) : await getCurrentUser(token!);
    (req as AuthenticatedRequest).auth = { user };

    next();
  } catch (error) {
    next(error);
  }
};
