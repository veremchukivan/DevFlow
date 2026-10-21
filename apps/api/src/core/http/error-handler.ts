import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: error.issues,
        requestId
      }
    });
    return;
  }

  reqLogger(error, requestId);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
      requestId
    }
  });
};

function reqLogger(error: unknown, requestId: string | undefined) {
  if (requestId) {
    console.error({ error, requestId });
    return;
  }

  console.error(error);
}

