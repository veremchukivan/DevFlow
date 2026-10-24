import { z } from "zod";

export const projectSprintStatusSchema = z.enum([
  "planning",
  "active",
  "completed",
]);

export const projectSprintSchema = z.object({
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  createdByUserId: z.uuid().nullable(),
  endDate: z.iso.date().nullable(),
  goal: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
  projectId: z.uuid(),
  startDate: z.iso.date().nullable(),
  status: projectSprintStatusSchema,
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid(),
});

export const createProjectSprintRequestSchema = z
  .object({
    endDate: z.iso.date().optional(),
    goal: z.string().trim().max(2000).optional(),
    name: z.string().trim().min(1).max(120),
    startDate: z.iso.date().optional(),
    status: projectSprintStatusSchema.optional(),
  })
  .refine(
    (input) =>
      !input.startDate || !input.endDate || input.startDate <= input.endDate,
    {
      message: "Sprint start date must be before its end date",
    },
  );

export const updateProjectSprintRequestSchema = z
  .object({
    endDate: z.iso.date().nullable().optional(),
    goal: z.string().trim().max(2000).nullable().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    startDate: z.iso.date().nullable().optional(),
    status: projectSprintStatusSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one sprint field is required",
  });

export const projectSprintsParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid(),
});

export const projectSprintParamsSchema = projectSprintsParamsSchema.extend({
  sprintId: z.uuid(),
});

export const projectSprintResponseSchema = z.object({
  sprint: projectSprintSchema,
});
export const projectSprintListResponseSchema = z.object({
  sprints: z.array(projectSprintSchema),
});

export type CreateProjectSprintRequest = z.infer<
  typeof createProjectSprintRequestSchema
>;
export type UpdateProjectSprintRequest = z.infer<
  typeof updateProjectSprintRequestSchema
>;
export type ProjectSprint = z.infer<typeof projectSprintSchema>;
export type ProjectSprintResponse = z.infer<typeof projectSprintResponseSchema>;
export type ProjectSprintListResponse = z.infer<
  typeof projectSprintListResponseSchema
>;
