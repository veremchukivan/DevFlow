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

export const workspaceCallRecurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

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
  recurrenceRule: workspaceCallRecurrenceSchema.nullable(),
  reminderMinutes: z.number().int().min(0).max(10_080).nullable(),
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
  recurrenceRule: workspaceCallRecurrenceSchema.nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10_080).nullable().optional(),
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

export const workspaceCalendarItemSchema = z.object({
  endsAt: callDateSchema.nullable(),
  id: z.string(),
  projectId: z.uuid().nullable(),
  startsAt: callDateSchema,
  title: z.string(),
  type: z.enum(["call", "task_due", "sprint", "release"]),
  url: z.string().nullable(),
});
export const workspaceCalendarFeedResponseSchema = z.object({ items: z.array(workspaceCalendarItemSchema) });

export const workspaceCallDecisionSchema = z.object({
  body: z.string(),
  callId: z.uuid(),
  createdAt: callDateSchema,
  createdByUserId: z.uuid().nullable(),
  id: z.uuid(),
  promotedTaskId: z.uuid().nullable(),
  updatedAt: callDateSchema,
  workspaceId: z.uuid(),
});
export const createWorkspaceCallDecisionRequestSchema = z.object({ body: z.string().trim().min(1).max(10_000) });
export const workspaceCallDecisionResponseSchema = z.object({ decision: workspaceCallDecisionSchema });
export const workspaceCallDecisionsResponseSchema = z.object({ decisions: z.array(workspaceCallDecisionSchema) });
export const promoteWorkspaceCallDecisionRequestSchema = z.object({ projectId: z.uuid(), title: z.string().trim().min(1).max(200).optional() });

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
export type WorkspaceCallDecision = z.infer<typeof workspaceCallDecisionSchema>;
export type WorkspaceCallDecisionResponse = z.infer<typeof workspaceCallDecisionResponseSchema>;
export type WorkspaceCallDecisionsResponse = z.infer<typeof workspaceCallDecisionsResponseSchema>;
export type WorkspaceCalendarItem = z.infer<typeof workspaceCalendarItemSchema>;
export type WorkspaceCalendarFeedResponse = z.infer<typeof workspaceCalendarFeedResponseSchema>;
