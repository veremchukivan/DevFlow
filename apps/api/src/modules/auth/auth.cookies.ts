import type { Response } from "express";

import { env } from "../../config/env.js";

const isSecure =
  env.COOKIE_SECURE !== undefined
    ? env.COOKIE_SECURE
    : env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: env.SESSION_COOKIE_SAME_SITE,
  secure: isSecure
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
