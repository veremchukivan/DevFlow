import {
  createWorkspaceCallRequestSchema,
  updateWorkspaceCallRequestSchema,
  workspaceCallListResponseSchema,
  workspaceCallParamsSchema,
  workspaceCallResponseSchema,
  workspaceCallsParamsSchema,
  workspaceCallsQuerySchema,
  workspaceCallAttendanceRequestSchema,
  createWorkspaceCallDecisionRequestSchema,
  promoteWorkspaceCallDecisionRequestSchema,
  workspaceCallDecisionResponseSchema,
  workspaceCallDecisionsResponseSchema,
  workspaceCalendarFeedResponseSchema,
} from "@devflow/shared";
import { Router } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import {
  createWorkspaceCall,
  createWorkspaceCallDecision,
  deleteWorkspaceCall,
  listWorkspaceCalls,
  getWorkspaceCallDecisions,
  getWorkspaceCalendarFeed,
  promoteWorkspaceCallDecisionToTask,
  respondToWorkspaceCall,
  updateWorkspaceCall,
} from "./workspace-calls.service.js";

export const workspaceCallsRouter = Router({ mergeParams: true });
workspaceCallsRouter.use(requireAuth);

workspaceCallsRouter.get("/", async (req, res) => {
  const params = workspaceCallsParamsSchema.parse(req.params);
  const query = workspaceCallsQuerySchema.parse(req.query);
  const calls = await listWorkspaceCalls({ ...params, ...query, userId: userId(req) });
  res.json({ calls: calls.map(toDto) } satisfies typeof workspaceCallListResponseSchema._output);
});

workspaceCallsRouter.get("/calendar", async (req, res) => {
  const params = workspaceCallsParamsSchema.parse(req.params);
  const query = workspaceCallsQuerySchema.parse(req.query);
  if (!query.from || !query.to) throw new Error("Calendar range is required");
  const items = await getWorkspaceCalendarFeed({ ...params, from: query.from, to: query.to, userId: userId(req) });
  res.json({ items } satisfies typeof workspaceCalendarFeedResponseSchema._output);
});

workspaceCallsRouter.post("/", async (req, res) => {
  const params = workspaceCallsParamsSchema.parse(req.params);
  const call = await createWorkspaceCall({
    ...params,
    input: createWorkspaceCallRequestSchema.parse(req.body),
    userId: userId(req),
  });
  res.status(201).json({ call: toDto(call) } satisfies typeof workspaceCallResponseSchema._output);
});

workspaceCallsRouter.patch("/:callId", async (req, res) => {
  const params = workspaceCallParamsSchema.parse(req.params);
  const call = await updateWorkspaceCall({
    ...params,
    input: updateWorkspaceCallRequestSchema.parse(req.body),
    userId: userId(req),
  });
  res.json({ call: toDto(call) } satisfies typeof workspaceCallResponseSchema._output);
});

workspaceCallsRouter.patch("/:callId/attendance", async (req, res) => {
  const params = workspaceCallParamsSchema.parse(req.params);
  const { responseStatus } = workspaceCallAttendanceRequestSchema.parse(req.body);
  const call = await respondToWorkspaceCall({ ...params, responseStatus, userId: userId(req) });
  res.json({ call: toDto(call) } satisfies typeof workspaceCallResponseSchema._output);
});

workspaceCallsRouter.get("/:callId/decisions", async (req, res) => {
  const params = workspaceCallParamsSchema.parse(req.params);
  const decisions = await getWorkspaceCallDecisions({ ...params, userId: userId(req) });
  res.json({ decisions: decisions.map(toDecisionDto) } satisfies typeof workspaceCallDecisionsResponseSchema._output);
});

workspaceCallsRouter.post("/:callId/decisions", async (req, res) => {
  const params = workspaceCallParamsSchema.parse(req.params);
  const input = createWorkspaceCallDecisionRequestSchema.parse(req.body);
  const decision = await createWorkspaceCallDecision({ ...params, ...input, userId: userId(req) });
  res.status(201).json({ decision: toDecisionDto(decision) } satisfies typeof workspaceCallDecisionResponseSchema._output);
});

workspaceCallsRouter.post("/:callId/decisions/:decisionId/create-task", async (req, res) => {
  const params = workspaceCallParamsSchema.extend({ decisionId: workspaceCallParamsSchema.shape.callId }).parse(req.params);
  const input = promoteWorkspaceCallDecisionRequestSchema.parse(req.body);
  const result = await promoteWorkspaceCallDecisionToTask({ ...params, ...input, userId: userId(req) });
  res.json({ decision: toDecisionDto(result.decision), taskId: result.taskId });
});

workspaceCallsRouter.delete("/:callId", async (req, res) => {
  const params = workspaceCallParamsSchema.parse(req.params);
  await deleteWorkspaceCall({ ...params, userId: userId(req) });
  res.status(204).send();
});

function userId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toDto(call: {
  attendees: Array<{
    responseStatus: "invited" | "accepted" | "declined";
    user: { displayName: string; id: string };
    userId: string;
  }>;
  createdAt: Date;
  createdByUserId: string | null;
  description: string | null;
  endsAt: Date;
  id: string;
  location: string | null;
  meetingUrl: string | null;
  recurrenceRule: "daily" | "weekly" | "monthly" | null;
  reminderMinutes: number | null;
  projectId: string | null;
  startsAt: Date;
  status: "scheduled" | "completed" | "cancelled";
  timezone: string;
  title: string;
  updatedAt: Date;
  workspaceId: string;
}) {
  return {
    ...call,
    createdAt: call.createdAt.toISOString(),
    endsAt: call.endsAt.toISOString(),
    startsAt: call.startsAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };
}

function toDecisionDto(decision: { body: string; callId: string; createdAt: Date; createdByUserId: string | null; id: string; promotedTaskId: string | null; updatedAt: Date; workspaceId: string }) {
  return { ...decision, createdAt: decision.createdAt.toISOString(), updatedAt: decision.updatedAt.toISOString() };
}
