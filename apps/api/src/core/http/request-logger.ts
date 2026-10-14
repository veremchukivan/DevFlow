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
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie"
          ],
          remove: true
        }
      });

