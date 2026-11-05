import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./core/http/error-handler.js";
import {
  csrfProtection,
  getTrustedWebOrigins,
} from "./core/http/csrf-protection.js";
import { apiRateLimiter } from "./core/http/rate-limiter.js";
import { requestId } from "./core/http/request-id.js";
import { requestLogger } from "./core/http/request-logger.js";
import { openApiRouter } from "./core/openapi/openapi.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { projectSprintsRouter } from "./modules/project-sprints/project-sprints.routes.js";
import { projectViewPreferencesRouter } from "./modules/project-view-preferences/project-view-preferences.routes.js";
import { taskActivityRouter } from "./modules/task-activity/task-activity.routes.js";
import { projectActivityRouter } from "./modules/task-activity/project-activity.routes.js";
import { taskAttachmentsRouter } from "./modules/task-attachments/task-attachments.routes.js";
import { taskChecklistsRouter } from "./modules/task-checklists/task-checklists.routes.js";
import { taskCommentsRouter } from "./modules/task-comments/task-comments.routes.js";
import { taskRelationsRouter } from "./modules/task-relations/task-relations.routes.js";
import { taskTimeEntriesRouter } from "./modules/task-time-entries/task-time-entries.routes.js";
import { taskWatchersRouter } from "./modules/task-watchers/task-watchers.routes.js";
import { taskDevelopmentFlowsRouter } from "./modules/task-development-flows/task-development-flows.routes.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";
import {
  publicInvitationsRouter,
  workspaceInvitationsRouter,
} from "./modules/workspace-invitations/workspace-invitations.routes.js";
import { workspaceMembersRouter } from "./modules/workspace-members/workspace-members.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";
import { readinessRouter } from "./modules/health/readiness.routes.js";
import { figmaRouter } from "./modules/figma/figma.routes.js";
import { aiSettingsRouter } from "./modules/ai-settings/ai-settings.routes.js";
import { workspaceAutomationRouter } from "./modules/workspace-automation/workspace-automation.routes.js";
import { workspaceSettingsRouter } from "./modules/workspace-settings/workspace-settings.routes.js";
import { workspaceCallsRouter } from "./modules/workspace-calls/workspace-calls.routes.js";
import {
  gitIntegrationsRouter,
  projectRepositoryRouter,
  taskGitRouter,
} from "./modules/git-integrations/git-integrations.routes.js";
import { projectKnowledgeRouter } from "./modules/project-knowledge/project-knowledge.routes.js";
import { projectPlanningRouter } from "./modules/project-planning/project-planning.routes.js";
import { workspaceAgreementsRouter } from "./modules/workspace-agreements/workspace-agreements.routes.js";
import { workspaceAnalyticsRouter } from "./modules/workspace-analytics/workspace-analytics.routes.js";
import { workspaceSearchRouter } from "./modules/workspace-search/workspace-search.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet());
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/planning",
    projectPlanningRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/planning",
    projectPlanningRouter,
  );
  app.use(
    cors({
      credentials: true,
      origin: getTrustedWebOrigins({
        webOrigin: env.WEB_ORIGIN,
        allowedWebOrigins: env.WEB_ALLOWED_ORIGINS,
      }),
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads/task-attachments", (_req, res) => {
    res.status(404).end();
  });
  app.use(
    "/uploads",
    (_req, res, next) => {
      // Avatars and project icons are displayed by the web app on a different
      // local development origin (for example, port 3001 vs. API port 4000).
      // Helmet defaults this header to same-origin, which makes browsers block
      // otherwise public image resources.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(env.UPLOADS_DIR, {
      fallthrough: false,
      maxAge: "30d",
      immutable: true,
    }),
  );
  app.use(csrfProtection);

  app.get("/", (_req, res) => {
    res.json({
      service: "devflow-api",
      status: "ok",
    });
  });

  app.use("/api", apiRateLimiter);
  app.use("/openapi.json", openApiRouter);

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/ai-settings", aiSettingsRouter);
  app.use("/api/v1/integrations/figma", figmaRouter);
  app.use("/api/v1/integrations/git", gitIntegrationsRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/invitations", publicInvitationsRouter);
  app.use("/api/v1/workspaces", workspacesRouter);
  app.use(
    "/api/v1/workspaces/:workspaceId/invitations",
    workspaceInvitationsRouter,
  );
  app.use("/api/v1/workspaces/:workspaceId/members", workspaceMembersRouter);
  app.use("/api/v1/workspaces/:workspaceId/settings", workspaceSettingsRouter);
  app.use("/api/v1/workspaces/:workspaceId/calls", workspaceCallsRouter);
  app.use(
    "/api/v1/workspaces/:workspaceId/agreements",
    workspaceAgreementsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/analytics",
    workspaceAnalyticsRouter,
  );
  app.use("/api/v1/workspaces/:workspaceId/search", workspaceSearchRouter);
  app.use(
    "/api/v1/workspaces/:workspaceId/automation",
    workspaceAutomationRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/activity",
    projectActivityRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/view-preferences",
    projectViewPreferencesRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/development-flow",
    taskDevelopmentFlowsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/git",
    taskGitRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/activity",
    taskActivityRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments",
    taskCommentsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/checklist",
    taskChecklistsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments",
    taskAttachmentsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/relations",
    taskRelationsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/time-entries",
    taskTimeEntriesRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/watchers",
    taskWatchersRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/sprints",
    projectSprintsRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/knowledge",
    projectKnowledgeRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/repository",
    projectRepositoryRouter,
  );
  app.use(
    "/api/v1/workspaces/:workspaceId/projects/:projectId/tasks",
    tasksRouter,
  );
  app.use("/api/v1/workspaces/:workspaceId/projects", projectsRouter);
  app.use("/healthz", healthRouter);
  app.use("/readyz", readinessRouter);
  app.use(errorHandler);

  return app;
}
