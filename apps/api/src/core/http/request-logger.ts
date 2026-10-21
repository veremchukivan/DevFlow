import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";

import { env } from "../../config/env.js";

const noopRequestLogger: RequestHandler = (_req, _res, next) => {
  next();
};

export const requestLogger: RequestHandler =
  env.NODE_ENV === "test"
    ? noopRequestLogger
    : pinoHttp({
        customProps: (_req, res) => ({
          requestId: res.locals.requestId
        }),
        serializers: {
          req: serializeRequest
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie"
          ],
          remove: true
        }
      });

export function redactSensitiveRequestUrl(url: string) {
  return url.replace(
    /\/api\/v1\/invitations\/[^/?#]+/g,
    "/api/v1/invitations/[REDACTED]"
  );
}

function serializeRequest(req: IncomingMessage) {
  return {
    method: req.method,
    url: req.url ? redactSensitiveRequestUrl(req.url) : undefined
  };
}

