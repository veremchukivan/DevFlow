import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  taskAssigned: z.boolean(), taskCommented: z.boolean(), taskDueToday: z.boolean(),
  taskOverdue: z.boolean(), taskStatusChanged: z.boolean(),
});
export const updateNotificationPreferencesRequestSchema = notificationPreferencesSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "At least one preference is required" },
);
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<typeof updateNotificationPreferencesRequestSchema>;
