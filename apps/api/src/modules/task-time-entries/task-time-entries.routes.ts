import {
  createManualTaskTimeEntryRequestSchema,
  taskTimeEntryIdParamsSchema,
  taskTimeEntryParamsSchema,
  type TaskTimeEntryListResponse,
  type TaskTimeEntryResponse,
} from "@devflow/shared";
import { Router } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import { addManualTimeEntry, listTimeEntries, startTimer, stopTimer } from "./task-time-entries.service.js";

export const taskTimeEntriesRouter = Router({ mergeParams: true });
taskTimeEntriesRouter.use(requireAuth);

taskTimeEntriesRouter.get("/", async (req, res) => {
  const params = taskTimeEntryParamsSchema.parse(req.params);
  const result = await listTimeEntries({ ...params, userId: getUserId(req) });
  res.json({
    entries: result.entries.map(toTimeEntryDto),
    summary: {
      ...result.summary,
      activeEntry: result.summary.activeEntry
        ? toTimeEntryDto(result.summary.activeEntry)
        : null,
    },
  } satisfies TaskTimeEntryListResponse);
});

taskTimeEntriesRouter.post("/start", async (req, res) => {
  const params = taskTimeEntryParamsSchema.parse(req.params);
  const entry = await startTimer({ ...params, userId: getUserId(req) });
  res.status(201).json(toResponse(entry));
});

taskTimeEntriesRouter.post("/", async (req, res) => {
  const params = taskTimeEntryParamsSchema.parse(req.params);
  const entry = await addManualTimeEntry({
    ...params,
    input: createManualTaskTimeEntryRequestSchema.parse(req.body),
    userId: getUserId(req),
  });
  res.status(201).json(toResponse(entry));
});

taskTimeEntriesRouter.post("/:entryId/stop", async (req, res) => {
  const params = taskTimeEntryIdParamsSchema.parse(req.params);
  const entry = await stopTimer({ ...params, userId: getUserId(req) });
  res.json(toResponse(entry));
});

function getUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}

function toResponse(entry: Parameters<typeof toTimeEntryDto>[0]): TaskTimeEntryResponse {
  return { entry: toTimeEntryDto(entry) };
}

function toTimeEntryDto(entry: {
  createdAt: Date;
  description: string | null;
  durationMinutes: number;
  id: string;
  projectId: string;
  startedAt: Date;
  stoppedAt: Date | null;
  taskId: string;
  updatedAt: Date;
  userId: string;
  workspaceId: string;
  user?: { displayName: string; id: string };
}) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    startedAt: entry.startedAt.toISOString(),
    stoppedAt: entry.stoppedAt?.toISOString() ?? null,
    updatedAt: entry.updatedAt.toISOString(),
    user: entry.user ?? { displayName: "You", id: entry.userId },
  };
}
