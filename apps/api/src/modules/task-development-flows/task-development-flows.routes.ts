import {
  createTaskDevelopmentFlowRequestSchema,
  createTaskDevelopmentFlowSessionRequestSchema,
  rejectTaskDevelopmentFlowRequestSchema,
  taskDevelopmentFlowParamsSchema,
  taskDevelopmentFlowSessionParamsSchema,
  taskDevelopmentFlowDetailsResponseSchema,
  taskDevelopmentFlowResponseSchema,
  taskDevelopmentFlowSessionResponseSchema,
  transitionTaskDevelopmentFlowRequestSchema,
  updateTaskDevelopmentFlowRequestSchema,
  updateTaskDevelopmentFlowSessionRequestSchema,
} from "@devflow/shared";
import { Router } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import {
  approveTaskDevelopmentPlan,
  approveTaskDevelopmentReview,
  createTaskDevelopmentFlow,
  createTaskDevelopmentFlowSession,
  getTaskDevelopmentFlow,
  rejectTaskDevelopmentPlan,
  rejectTaskDevelopmentReview,
  transitionTaskDevelopmentFlow,
  updateTaskDevelopmentFlow,
  updateTaskDevelopmentFlowSession,
} from "./task-development-flows.service.js";

export const taskDevelopmentFlowsRouter = Router({ mergeParams: true });
taskDevelopmentFlowsRouter.use(requireAuth);

taskDevelopmentFlowsRouter.get("/", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const result = await getTaskDevelopmentFlow({ ...params, userId: userId(req) });
  res.json(taskDevelopmentFlowDetailsResponseSchema.parse({
    flow: result.flow ? toFlowDto(result.flow) : null,
    sessions: result.sessions.map(toSessionDto),
  }));
});

taskDevelopmentFlowsRouter.post("/", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const flow = await createTaskDevelopmentFlow({ ...params, input: createTaskDevelopmentFlowRequestSchema.parse(req.body), userId: userId(req) });
  res.status(201).json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.patch("/", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const flow = await updateTaskDevelopmentFlow({ ...params, input: updateTaskDevelopmentFlowRequestSchema.parse(req.body), userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/transition", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const { state } = transitionTaskDevelopmentFlowRequestSchema.parse(req.body);
  const flow = await transitionTaskDevelopmentFlow({ ...params, state, userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/approve-plan", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const flow = await approveTaskDevelopmentPlan({ ...params, userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/reject-plan", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const { comment } = rejectTaskDevelopmentFlowRequestSchema.parse(req.body);
  const flow = await rejectTaskDevelopmentPlan({ ...params, comment, userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/approve-review", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const flow = await approveTaskDevelopmentReview({ ...params, userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/reject-review", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const { comment } = rejectTaskDevelopmentFlowRequestSchema.parse(req.body);
  const flow = await rejectTaskDevelopmentReview({ ...params, comment, userId: userId(req) });
  res.json(taskDevelopmentFlowResponseSchema.parse({ flow: toFlowDto(flow) }));
});

taskDevelopmentFlowsRouter.post("/sessions", async (req, res) => {
  const params = taskDevelopmentFlowParamsSchema.parse(req.params);
  const session = await createTaskDevelopmentFlowSession({ ...params, ...createTaskDevelopmentFlowSessionRequestSchema.parse(req.body), userId: userId(req) });
  const details = await getTaskDevelopmentFlow({ ...params, userId: userId(req) });
  const hydrated = details.sessions.find((item) => item.id === session.id);
  res.status(201).json(taskDevelopmentFlowSessionResponseSchema.parse({ session: toSessionDto(hydrated ?? { ...session, startedBy: { displayName: "Unknown", email: "unknown@example.com", id: session.startedByUserId } }) }));
});

taskDevelopmentFlowsRouter.patch("/sessions/:sessionId", async (req, res) => {
  const params = taskDevelopmentFlowSessionParamsSchema.parse(req.params);
  const session = await updateTaskDevelopmentFlowSession({ ...params, ...updateTaskDevelopmentFlowSessionRequestSchema.parse(req.body), userId: userId(req) });
  const details = await getTaskDevelopmentFlow({ ...params, userId: userId(req) });
  const hydrated = details.sessions.find((item) => item.id === session.id);
  if (!hydrated) throw new Error("Failed to load agent session");
  res.json(taskDevelopmentFlowSessionResponseSchema.parse({ session: toSessionDto(hydrated) }));
});

function userId(req: unknown) { return (req as AuthenticatedRequest).auth.user.id; }
function toFlowDto(flow: any) { return { ...flow, createdAt: flow.createdAt.toISOString(), updatedAt: flow.updatedAt.toISOString(), planApprovedAt: flow.planApprovedAt?.toISOString() ?? null, reviewApprovedAt: flow.reviewApprovedAt?.toISOString() ?? null }; }
function toSessionDto(session: any) { return { ...session, agentName: session.agentName ?? null, summary: session.summary ?? null, endedAt: session.endedAt?.toISOString() ?? null, createdAt: session.createdAt.toISOString(), startedAt: session.startedAt.toISOString(), updatedAt: session.updatedAt.toISOString() }; }
