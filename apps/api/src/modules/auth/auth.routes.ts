import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse
} from "@devflow/shared";
import { Router, type Request } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors/app-error.js";
import { authRateLimiter } from "../../core/http/rate-limiter.js";
import {
  clearSessionCookie,
  setSessionCookie
} from "./auth.cookies.js";
import {
  getCurrentUser,
  login,
  logout,
  register
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, async (req, res) => {
  const input = registerRequestSchema.parse(req.body);
  const result = await register(input, getRequestMeta(req));

  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  res.status(201).json(toAuthResponse(result.user));
});

authRouter.post("/login", authRateLimiter, async (req, res) => {
  const input = loginRequestSchema.parse(req.body);
  const result = await login(input, getRequestMeta(req));

  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  res.json(toAuthResponse(result.user));
});

authRouter.post("/logout", async (req, res) => {
  const token = getSessionToken(req);

  if (token) {
    await logout(token);
  }

  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/me", async (req, res) => {
  const token = getSessionToken(req);

  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  const user = await getCurrentUser(token);

  res.json(toAuthResponse(user));
});

function getSessionToken(req: Request) {
  return req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
}

function getRequestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  };
}

function toAuthResponse(user: {
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  isPlatformAdmin: boolean;
}): AuthResponse {
  return {
    user: {
      createdAt: user.createdAt.toISOString(),
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      isPlatformAdmin: user.isPlatformAdmin
    }
  };
}
