import {
  emailVerificationTokenRequestSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
  type AuthResponse
} from "@devflow/shared";
import { Router, type Request } from "express";

import { env } from "../../config/env.js";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail
} from "../../core/email/mailer.js";
import { AppError } from "../../core/errors/app-error.js";
import { authRateLimiter } from "../../core/http/rate-limiter.js";
import {
  type AuthenticatedRequest,
  requireAuth
} from "./auth.middleware.js";
import {
  clearSessionCookie,
  setSessionCookie
} from "./auth.cookies.js";
import {
  getCurrentUser,
  issueEmailVerificationToken,
  login,
  logout,
  requestPasswordReset,
  register,
  resetPassword,
  verifyEmail
} from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, async (req, res) => {
  const input = registerRequestSchema.parse(req.body);
  const result = await register(input, getRequestMeta(req));

  setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
  await deliverEmailVerification(result.user, result.emailVerificationToken);
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

authRouter.post(
  "/email-verification/resend",
  requireAuth,
  authRateLimiter,
  async (req, res) => {
    const user = getAuthenticatedUser(req);
    const token = await issueEmailVerificationToken(user);

    await deliverEmailVerification(user, token);
    res.status(204).send();
  }
);

authRouter.post(
  "/email-verification/confirm",
  authRateLimiter,
  async (req, res) => {
    const input = emailVerificationTokenRequestSchema.parse(req.body);
    await verifyEmail(input.token);

    res.status(204).send();
  }
);

authRouter.post(
  "/password-reset/request",
  authRateLimiter,
  async (req, res) => {
    const input = passwordResetRequestSchema.parse(req.body);
    const result = await requestPasswordReset(input.email);

    if (result) {
      await deliverPasswordReset(result.user, result.token);
    }

    res.status(204).send();
  }
);

authRouter.post(
  "/password-reset/confirm",
  authRateLimiter,
  async (req, res) => {
    const input = passwordResetConfirmRequestSchema.parse(req.body);
    await resetPassword(input);

    res.status(204).send();
  }
);

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

function getAuthenticatedUser(req: unknown) {
  return (req as AuthenticatedRequest).auth.user;
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
  emailVerifiedAt: Date | null;
  id: string;
  isPlatformAdmin: boolean;
}): AuthResponse {
  return {
    user: {
      createdAt: user.createdAt.toISOString(),
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      isEmailVerified: Boolean(user.emailVerifiedAt),
      isPlatformAdmin: user.isPlatformAdmin
    }
  };
}

async function deliverEmailVerification(
  user: {
    displayName: string;
    email: string;
    id: string;
  },
  token: string | null | undefined
) {
  if (!token) {
    return;
  }

  try {
    await sendEmailVerificationEmail({
      displayName: user.displayName,
      email: user.email,
      token
    });
  } catch (error) {
    console.error("Email verification delivery failed", {
      error,
      userId: user.id
    });
    throw new AppError(
      502,
      "EMAIL_VERIFICATION_DELIVERY_FAILED",
      "The account was created, but the verification email could not be delivered. Resend it after resolving the email configuration."
    );
  }
}

async function deliverPasswordReset(
  user: {
    displayName: string;
    email: string;
    id: string;
  },
  token: string
) {
  try {
    await sendPasswordResetEmail({
      displayName: user.displayName,
      email: user.email,
      token
    });
  } catch (error) {
    console.error("Password reset delivery failed", {
      error,
      userId: user.id
    });
  }
}
