import { z } from "zod";

export const projectViewPreferenceParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskCardFieldSchema = z.enum([
  "assignee",
  "dueDate",
  "labels",
  "priority",
  "taskKey",
  "taskType",
]);

export const projectViewPreferencesSchema = z.object({
  activityLimit: z.number().int().min(1).max(25),
  boardScrolling: z.enum(["board", "column"]),
  columnSize: z.enum(["fixed", "flexible"]),
  columnWidths: z.record(z.string(), z.number().int().min(240).max(640)),
  hideDoneTasks: z.boolean(),
  visibleTaskFields: z.array(taskCardFieldSchema),
});

export const updateProjectViewPreferencesRequestSchema =
  projectViewPreferencesSchema.partial();

export const projectViewPreferencesResponseSchema = z.object({
  preferences: projectViewPreferencesSchema,
});

export type ProjectViewPreferences = z.infer<
  typeof projectViewPreferencesSchema
>;
export type UpdateProjectViewPreferencesRequest = z.infer<
  typeof updateProjectViewPreferencesRequestSchema
>;
