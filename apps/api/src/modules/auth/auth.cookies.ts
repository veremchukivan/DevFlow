import type { Response } from "express";

import { env } from "../../config/env.js";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production"
};

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date
) {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
}
