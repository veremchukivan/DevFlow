import {
  createLabelRequestSchema,
  labelParamsSchema,
  labelResponseSchema,
  updateLabelRequestSchema,
  workspaceLabelsParamsSchema,
  type LabelListResponse,
} from "@devflow/shared";
import { Router } from "express";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  createWorkspaceLabel,
  listWorkspaceLabels,
  removeWorkspaceLabel,
  updateWorkspaceLabel,
} from "./labels.service.js";
export const labelsRouter = Router({ mergeParams: true });
labelsRouter.use(requireAuth);
const userId = (req: unknown) => (req as AuthenticatedRequest).auth.user.id;
const dto = (label: {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: label.id,
  workspaceId: label.workspaceId,
  name: label.name,
  color: label.color,
  createdAt: label.createdAt.toISOString(),
  updatedAt: label.updatedAt.toISOString(),
});
labelsRouter.get("/", async (req, res) => {
  const { workspaceId } = workspaceLabelsParamsSchema.parse(req.params);
  const labels = await listWorkspaceLabels(userId(req), workspaceId);
  res.json({ labels: labels.map(dto) } satisfies LabelListResponse);
});
labelsRouter.post("/", async (req, res) => {
  const { workspaceId } = workspaceLabelsParamsSchema.parse(req.params);
  const label = await createWorkspaceLabel({
    userId: userId(req),
    workspaceId,
    data: createLabelRequestSchema.parse(req.body),
  });
  res.status(201).json({ label: dto(label) });
});
labelsRouter.patch("/:labelId", async (req, res) => {
  const params = labelParamsSchema.parse(req.params);
  const label = await updateWorkspaceLabel({
    userId: userId(req),
    ...params,
    data: updateLabelRequestSchema.parse(req.body),
  });
  res.json({ label: dto(label) });
});
labelsRouter.delete("/:labelId", async (req, res) => {
  const params = labelParamsSchema.parse(req.params);
  await removeWorkspaceLabel({ userId: userId(req), ...params });
  res.status(204).send();
});
