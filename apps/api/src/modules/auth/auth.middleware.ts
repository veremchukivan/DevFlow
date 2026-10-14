import type { Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { getCurrentUser } from "./auth.service.js";

type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

export type AuthenticatedRequest = Request & {
  auth: {
    user: AuthenticatedUser;
  };
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
    }

    const user = await getCurrentUser(token);
    (req as AuthenticatedRequest).auth = { user };

    next();
  } catch (error) {
    next(error);
  }
};
