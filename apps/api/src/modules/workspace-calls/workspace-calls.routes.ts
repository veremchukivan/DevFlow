import {
  createWorkspaceCallRequestSchema,
  updateWorkspaceCallRequestSchema,
  workspaceCallListResponseSchema,
  workspaceCallParamsSchema,
  workspaceCallResponseSchema,
  workspaceCallsParamsSchema,
  workspaceCallsQuerySchema,
  workspaceCallAttendanceRequestSchema,
} from "@devflow/shared";
import { Router } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import {
  createWorkspaceCall,
  deleteWorkspaceCall,
  listWorkspaceCalls,
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
