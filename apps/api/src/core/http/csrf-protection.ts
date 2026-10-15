import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const result = validateCsrfOrigin({
    nodeEnv: env.NODE_ENV,
    origin: req.get("origin"),
    webOrigin: env.WEB_ORIGIN
  });

  if (result === "valid") {
    next();
    return;
  }

  next(
    new AppError(
      403,
      result === "missing" ? "CSRF_ORIGIN_REQUIRED" : "CSRF_ORIGIN_INVALID",
      result === "missing"
        ? "A request origin is required"
        : "The request origin is not allowed"
    )
  );
};

export function validateCsrfOrigin({
  nodeEnv,
  origin,
  webOrigin
}: {
  nodeEnv: "development" | "test" | "production";
  origin: string | undefined;
  webOrigin: string;
}) {
  if (!origin) {
    return nodeEnv === "production" ? "missing" : "valid";
  }

  return origin === webOrigin ? "valid" : "invalid";
}
