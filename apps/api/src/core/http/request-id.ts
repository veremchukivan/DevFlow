import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.get("x-request-id");
  const value =
    incomingRequestId && requestIdPattern.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  res.locals.requestId = value;
  res.setHeader("x-request-id", value);
  next();
};
