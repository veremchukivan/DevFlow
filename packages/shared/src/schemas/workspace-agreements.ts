import { z } from "zod";

export const workspaceAgreementStatusSchema = z.enum([
  "draft",
  "pending_confirmation",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);
export const workspaceAgreementSourceSchema = z.enum([
  "manual",
  "call",
  "task",
]);
export const workspaceAgreementConfirmationSchema = z.enum([
  "pending",
  "confirmed",
  "declined",
]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().datetime({ offset: true });

export const workspaceAgreementSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: workspaceAgreementStatusSchema,
  sourceType: workspaceAgreementSourceSchema,
  sourceId: z.uuid().nullable(),
  ownerUserId: z.uuid().nullable(),
  dueDate: dateSchema.nullable(),
  createdByUserId: z.uuid().nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  participants: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      confirmation: workspaceAgreementConfirmationSchema,
      confirmedAt: dateTimeSchema.nullable(),
    }),
  ),
  taskIds: z.array(z.uuid()),
  history: z.array(
    z.object({
      id: z.uuid(),
      eventType: z.string(),
      actorUserId: z.uuid().nullable(),
      data: z.record(z.string(), z.unknown()),
      createdAt: dateTimeSchema,
    }),
  ),
});
export const createWorkspaceAgreementRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  sourceType: workspaceAgreementSourceSchema.optional(),
  sourceId: z.uuid().nullable().optional(),
  participantUserIds: z.array(z.uuid()).max(100).optional(),
  taskIds: z.array(z.uuid()).max(100).optional(),
});
export const updateWorkspaceAgreementRequestSchema = z
  .object({
    description: z.string().trim().max(10_000).nullable().optional(),
    dueDate: dateSchema.nullable().optional(),
    ownerUserId: z.uuid().nullable().optional(),
    sourceId: z.uuid().nullable().optional(),
    sourceType: workspaceAgreementSourceSchema.optional(),
    status: workspaceAgreementStatusSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0);
export const workspaceAgreementParamsSchema = z.object({
  workspaceId: z.uuid(),
  agreementId: z.uuid(),
});
export const workspaceAgreementResponseSchema = z.object({
  agreement: workspaceAgreementSchema,
});
export const workspaceAgreementListResponseSchema = z.object({
  agreements: z.array(workspaceAgreementSchema),
});
export const agreementConfirmationRequestSchema = z.object({
  confirmation: z.enum(["confirmed", "declined"]),
});
export type WorkspaceAgreement = z.infer<typeof workspaceAgreementSchema>;
export type WorkspaceAgreementResponse = z.infer<
  typeof workspaceAgreementResponseSchema
>;
export type WorkspaceAgreementListResponse = z.infer<
  typeof workspaceAgreementListResponseSchema
>;
export type CreateWorkspaceAgreementRequest = z.infer<
  typeof createWorkspaceAgreementRequestSchema
>;
export type UpdateWorkspaceAgreementRequest = z.infer<
  typeof updateWorkspaceAgreementRequestSchema
>;
