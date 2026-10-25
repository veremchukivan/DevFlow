import {
  createTaskRelationRequestSchema,
  taskRelationListResponseSchema,
  taskRelationParamsSchema,
  taskRelationsParamsSchema,
} from "@devflow/shared";
import { Router } from "express";

import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import {
  addRelation,
  listRelations,
  removeRelation,
} from "./task-relations.service.js";

export const taskRelationsRouter = Router({ mergeParams: true });

taskRelationsRouter.use(requireAuth);

taskRelationsRouter.get("/", async (req, res) => {
  const params = taskRelationsParamsSchema.parse(req.params);
  const relations = await listRelations({
    ...params,
    userId: getAuthenticatedUserId(req),
  });
  res.json({
    relations: relations.map((relation) => ({
      ...relation,
      createdAt: relation.createdAt.toISOString(),
    })),
  } satisfies typeof taskRelationListResponseSchema._output);
});

taskRelationsRouter.post("/", async (req, res) => {
  const params = taskRelationsParamsSchema.parse(req.params);
  await addRelation({
    ...params,
    input: createTaskRelationRequestSchema.parse(req.body),
    userId: getAuthenticatedUserId(req),
  });
  res.status(201).send();
});

taskRelationsRouter.delete("/:relationId", async (req, res) => {
  const params = taskRelationParamsSchema.parse(req.params);
  await removeRelation({ ...params, userId: getAuthenticatedUserId(req) });
  res.status(204).send();
});

function getAuthenticatedUserId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}
