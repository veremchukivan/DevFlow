import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./core/http/error-handler.js";
import { requestLogger } from "./core/http/request-logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { readinessRouter } from "./modules/health/readiness.routes.js";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: env.WEB_ORIGIN
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      service: "devflow-api",
      status: "ok"
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/healthz", healthRouter);
  app.use("/readyz", readinessRouter);
  app.use(errorHandler);

  return app;
}

