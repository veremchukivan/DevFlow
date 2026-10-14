import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./core/http/error-handler.js";
import { apiRateLimiter } from "./core/http/rate-limiter.js";
import { requestLogger } from "./core/http/request-logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { taskActivityRouter } from "./modules/task-activity/task-activity.routes.js";
import { taskCommentsRouter } from "./modules/task-comments/task-comments.routes.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";
import {
  publicInvitationsRouter,
  workspaceInvitationsRouter
} from "./modules/workspace-invitations/workspace-invitations.routes.js";
import { workspaceMembersRouter } from "./modules/workspace-members/workspace-members.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";
import { readinessRouter } from "./modules/health/readiness.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
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

  app.use("/api", apiRateLimiter);

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/invitations", publicInvitationsRouter);
  app.use("/api/v1/workspaces", workspacesRouter);
  app.use(
    "/api/v1/workspaces/:workspaceId/invitations",
    workspaceInvitationsRouter
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/members",
    workspaceMembersRouter
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/activity",
    taskActivityRouter
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments",
    taskCommentsRouter
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks",
    tasksRouter
  );
  app.use("/api/v1/workspaces/:workspaceId/projects", projectsRouter);
  app.use("/healthz", healthRouter);
  app.use("/readyz", readinessRouter);
  app.use(errorHandler);

  return app;
}

