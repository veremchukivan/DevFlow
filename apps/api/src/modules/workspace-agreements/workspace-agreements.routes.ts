import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Router } from "express";
import {
  createWorkspaceAgreementRequestSchema,
  agreementConfirmationRequestSchema,
  updateWorkspaceAgreementRequestSchema,
  workspaceAgreementListResponseSchema,
  workspaceAgreementParamsSchema,
  workspaceAgreementResponseSchema,
} from "@devflow/shared";

import { db } from "../../core/db/client.js";
import {
  workspaceAgreements,
  workspaceAgreementHistory,
  workspaceAgreementParticipants,
  workspaceAgreementTasks,
} from "../../core/db/schema/workspace-agreements.js";
import { users } from "../../core/db/schema/users.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  type AuthenticatedRequest,
  requireAuth,
} from "../auth/auth.middleware.js";
import { findWorkspaceForUser } from "../workspaces/workspaces.repository.js";
import { canUpdateWorkspace } from "../workspaces/workspaces.policy.js";

export const workspaceAgreementsRouter = Router({ mergeParams: true });
workspaceAgreementsRouter.use(requireAuth);

workspaceAgreementsRouter.get("/", async (req, res) => {
  const workspaceId = workspaceAgreementParamsSchema
    .pick({ workspaceId: true })
    .parse(req.params).workspaceId;
  await member(workspaceId, userId(req));
  const rows = await db
    .select()
    .from(workspaceAgreements)
    .where(eq(workspaceAgreements.workspaceId, workspaceId))
    .orderBy(
      asc(workspaceAgreements.dueDate),
      asc(workspaceAgreements.createdAt),
    );
  res.json({
    agreements: await Promise.all(rows.map(dto)),
  } satisfies typeof workspaceAgreementListResponseSchema._output);
});
workspaceAgreementsRouter.post("/", async (req, res) => {
  const workspaceId = workspaceAgreementParamsSchema
    .pick({ workspaceId: true })
    .parse(req.params).workspaceId;
  const membership = await member(workspaceId, userId(req));
  if (!canUpdateWorkspace(membership.role))
    throw new AppError(
      403,
      "AGREEMENT_CREATE_FORBIDDEN",
      "You cannot create agreements in this workspace",
    );
  const input = createWorkspaceAgreementRequestSchema.parse(req.body);
  const participants = [
    ...new Set([
      ...(input.participantUserIds ?? []),
      input.ownerUserId ?? userId(req),
    ]),
  ];
  await assertWorkspaceReferences(
    workspaceId,
    participants,
    input.taskIds ?? [],
    input.sourceType === "task" ? input.sourceId : undefined,
  );
  const [agreement] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(workspaceAgreements)
      .values({
        createdByUserId: userId(req),
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        ownerUserId: input.ownerUserId ?? userId(req),
        sourceId: input.sourceId ?? null,
        sourceType: input.sourceType ?? "manual",
        title: input.title,
        workspaceId,
      })
      .returning();
    if (!created) throw new Error("Agreement was not created");
    if (participants.length)
      await tx
        .insert(workspaceAgreementParticipants)
        .values(
          participants.map((participantUserId) => ({
            agreementId: created.id,
            userId: participantUserId,
            workspaceId,
          })),
        );
    if (input.taskIds?.length)
      await tx
        .insert(workspaceAgreementTasks)
        .values(
          input.taskIds.map((taskId) => ({
            agreementId: created.id,
            taskId,
            workspaceId,
          })),
        )
        .onConflictDoNothing();
    await tx
      .insert(workspaceAgreementHistory)
      .values({
        actorUserId: userId(req),
        agreementId: created.id,
        data: { status: created.status },
        eventType: "created",
        workspaceId,
      });
    return [created];
  });
  res
    .status(201)
    .json({
      agreement: await dto(agreement!),
    } satisfies typeof workspaceAgreementResponseSchema._output);
});
workspaceAgreementsRouter.patch("/:agreementId", async (req, res) => {
  const params = workspaceAgreementParamsSchema.parse(req.params);
  const membership = await member(params.workspaceId, userId(req));
  if (!canUpdateWorkspace(membership.role))
    throw new AppError(
      403,
      "AGREEMENT_UPDATE_FORBIDDEN",
      "You cannot update agreements in this workspace",
    );
  const input = updateWorkspaceAgreementRequestSchema.parse(req.body);
  const [agreement] = await db
    .update(workspaceAgreements)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(workspaceAgreements.id, params.agreementId),
        eq(workspaceAgreements.workspaceId, params.workspaceId),
      ),
    )
    .returning();
  if (!agreement)
    throw new AppError(404, "AGREEMENT_NOT_FOUND", "Agreement not found");
  await db
    .insert(workspaceAgreementHistory)
    .values({
      actorUserId: userId(req),
      agreementId: agreement.id,
      data: input,
      eventType: input.status ? "status_changed" : "updated",
      workspaceId: params.workspaceId,
    });
  res.json({
    agreement: await dto(agreement),
  } satisfies typeof workspaceAgreementResponseSchema._output);
});
workspaceAgreementsRouter.post(
  "/:agreementId/confirmation",
  async (req, res) => {
    const params = workspaceAgreementParamsSchema.parse(req.params);
    await member(params.workspaceId, userId(req));
    const { confirmation } = agreementConfirmationRequestSchema.parse(req.body);
    const [participant] = await db
      .update(workspaceAgreementParticipants)
      .set({
        confirmation,
        confirmedAt: confirmation === "confirmed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceAgreementParticipants.agreementId, params.agreementId),
          eq(workspaceAgreementParticipants.userId, userId(req)),
          eq(workspaceAgreementParticipants.workspaceId, params.workspaceId),
        ),
      )
      .returning();
    if (!participant)
      throw new AppError(
        403,
        "AGREEMENT_PARTICIPANT_REQUIRED",
        "You are not a participant in this agreement",
      );
    await db
      .insert(workspaceAgreementHistory)
      .values({
        actorUserId: userId(req),
        agreementId: params.agreementId,
        data: { confirmation },
        eventType: "participant_confirmation",
        workspaceId: params.workspaceId,
      });
    const participants = await db
      .select({ confirmation: workspaceAgreementParticipants.confirmation })
      .from(workspaceAgreementParticipants)
      .where(
        eq(workspaceAgreementParticipants.agreementId, params.agreementId),
      );
    const allConfirmed =
      participants.length > 0 &&
      participants.every((item) => item.confirmation === "confirmed");
    if (allConfirmed) {
      await db
        .update(workspaceAgreements)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(
          and(
            eq(workspaceAgreements.id, params.agreementId),
            eq(workspaceAgreements.status, "pending_confirmation"),
          ),
        );
      await db
        .insert(workspaceAgreementHistory)
        .values({
          actorUserId: userId(req),
          agreementId: params.agreementId,
          data: {},
          eventType: "accepted_after_confirmations",
          workspaceId: params.workspaceId,
        });
    }
    const [agreement] = await db
      .select()
      .from(workspaceAgreements)
      .where(
        and(
          eq(workspaceAgreements.id, params.agreementId),
          eq(workspaceAgreements.workspaceId, params.workspaceId),
        ),
      )
      .limit(1);
    res.json({
      agreement: await dto(agreement!),
    } satisfies typeof workspaceAgreementResponseSchema._output);
  },
);

async function member(workspaceId: string, currentUserId: string) {
  const membership = await findWorkspaceForUser({
    workspaceId,
    userId: currentUserId,
  });
  if (!membership)
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  return membership;
}
async function assertWorkspaceReferences(
  workspaceId: string,
  participantIds: string[],
  taskIds: string[],
  sourceTaskId?: string | null,
) {
  const requiredTaskIds = [
    ...new Set([...taskIds, ...(sourceTaskId ? [sourceTaskId] : [])]),
  ];
  const [members, scopedTasks] = await Promise.all([
    participantIds.length
      ? db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.status, "active"),
              inArray(workspaceMembers.userId, participantIds),
            ),
          )
      : [],
    requiredTaskIds.length
      ? db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.workspaceId, workspaceId),
              isNull(tasks.deletedAt),
              inArray(tasks.id, requiredTaskIds),
            ),
          )
      : [],
  ]);
  if (members.length !== participantIds.length)
    throw new AppError(
      400,
      "AGREEMENT_PARTICIPANT_INVALID",
      "Every agreement participant must be an active workspace member",
    );
  if (scopedTasks.length !== requiredTaskIds.length)
    throw new AppError(
      400,
      "AGREEMENT_TASK_INVALID",
      "Every linked task must belong to this workspace",
    );
}
async function dto(agreement: typeof workspaceAgreements.$inferSelect) {
  const [participants, taskRows, history] = await Promise.all([
    db
      .select({
        confirmation: workspaceAgreementParticipants.confirmation,
        confirmedAt: workspaceAgreementParticipants.confirmedAt,
        userId: users.id,
        displayName: users.displayName,
      })
      .from(workspaceAgreementParticipants)
      .innerJoin(users, eq(users.id, workspaceAgreementParticipants.userId))
      .where(eq(workspaceAgreementParticipants.agreementId, agreement.id)),
    db
      .select({ id: tasks.id })
      .from(workspaceAgreementTasks)
      .innerJoin(tasks, eq(tasks.id, workspaceAgreementTasks.taskId))
      .where(
        and(
          eq(workspaceAgreementTasks.agreementId, agreement.id),
          isNull(tasks.deletedAt),
        ),
      ),
    db
      .select()
      .from(workspaceAgreementHistory)
      .where(eq(workspaceAgreementHistory.agreementId, agreement.id))
      .orderBy(asc(workspaceAgreementHistory.createdAt)),
  ]);
  return {
    ...agreement,
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
    participants: participants.map((p) => ({
      ...p,
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
    })),
    taskIds: taskRows.map((task) => task.id),
    history: history.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
function userId(req: unknown) {
  return (req as AuthenticatedRequest).auth.user.id;
}
