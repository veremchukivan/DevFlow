import { z } from "zod";

export const workspaceCallStatusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
]);

export const workspaceCallAttendeeStatusSchema = z.enum([
  "invited",
  "accepted",
  "declined",
]);

const callDateSchema = z.string().datetime({ offset: true });

export const workspaceCallAttendeeSchema = z.object({
  responseStatus: workspaceCallAttendeeStatusSchema,
  user: z.object({
    displayName: z.string(),
    id: z.uuid(),
  }),
  userId: z.uuid(),
});

export const workspaceCallSchema = z.object({
  attendees: z.array(workspaceCallAttendeeSchema),
  createdAt: callDateSchema,
  createdByUserId: z.uuid().nullable(),
  description: z.string().nullable(),
  endsAt: callDateSchema,
  id: z.uuid(),
  location: z.string().nullable(),
  meetingUrl: z.url().nullable(),
  projectId: z.uuid().nullable(),
  startsAt: callDateSchema,
  status: workspaceCallStatusSchema,
  timezone: z.string(),
  title: z.string(),
  updatedAt: callDateSchema,
  workspaceId: z.uuid(),
});

const callFieldsSchema = z.object({
  attendeeUserIds: z.array(z.uuid()).max(100).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  endsAt: callDateSchema.optional(),
  location: z.string().trim().max(300).nullable().optional(),
  meetingUrl: z.url().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  startsAt: callDateSchema.optional(),
  status: workspaceCallStatusSchema.optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(200).optional(),
});

export const createWorkspaceCallRequestSchema = callFieldsSchema
  .extend({
    endsAt: callDateSchema,
    startsAt: callDateSchema,
    title: z.string().trim().min(1).max(200),
  })
  .refine((input) => new Date(input.startsAt) < new Date(input.endsAt), {
    message: "Call end time must be after its start time",
  });

export const updateWorkspaceCallRequestSchema = callFieldsSchema.refine(
  (input) => Object.keys(input).length > 0,
  { message: "At least one call field is required" },
);

export const workspaceCallsParamsSchema = z.object({ workspaceId: z.uuid() });
export const workspaceCallParamsSchema = workspaceCallsParamsSchema.extend({
  callId: z.uuid(),
});
export const workspaceCallAttendanceRequestSchema = z.object({
  responseStatus: workspaceCallAttendeeStatusSchema,
});
export const workspaceCallsQuerySchema = z
  .object({
    from: callDateSchema.optional(),
    status: workspaceCallStatusSchema.optional(),
    to: callDateSchema.optional(),
  })
  .refine(
    (input) => !input.from || !input.to || new Date(input.from) <= new Date(input.to),
    { message: "The calendar range is invalid" },
  );

export const workspaceCallResponseSchema = z.object({ call: workspaceCallSchema });
export const workspaceCallListResponseSchema = z.object({
  calls: z.array(workspaceCallSchema),
});

export type WorkspaceCall = z.infer<typeof workspaceCallSchema>;
export type CreateWorkspaceCallRequest = z.infer<
  typeof createWorkspaceCallRequestSchema
>;
export type UpdateWorkspaceCallRequest = z.infer<
  typeof updateWorkspaceCallRequestSchema
>;
export type WorkspaceCallAttendanceRequest = z.infer<
  typeof workspaceCallAttendanceRequestSchema
>;
export type WorkspaceCallResponse = z.infer<typeof workspaceCallResponseSchema>;
export type WorkspaceCallListResponse = z.infer<
  typeof workspaceCallListResponseSchema
>;
