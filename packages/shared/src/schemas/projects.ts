import { z } from "zod";

import { pageInfoSchema } from "./pagination.js";

export const projectKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[A-Za-z][A-Za-z0-9]*$/)
  .transform((value) => value.toUpperCase());

export const createProjectRequestSchema = z.object({
  description: z.string().trim().max(2000).optional(),
  key: projectKeySchema.optional(),
  name: z.string().trim().min(2).max(160)
});

export const projectParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid()
});

export const workspaceProjectsParamsSchema = z.object({
  workspaceId: z.uuid()
});

export const projectStatusCategorySchema = z.enum([
  "todo",
  "in_progress",
  "done"
]);

export const projectStatusSchema = z.object({
  category: projectStatusCategorySchema,
  color: z.string(),
  id: z.uuid(),
  isDefault: z.boolean(),
  name: z.string(),
  position: z.number(),
  projectId: z.uuid(),
  workspaceId: z.uuid()
});

export const projectSchema = z.object({
  createdAt: z.string().datetime(),
  description: z.string().nullable(),
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  ownerUserId: z.uuid().nullable(),
  statuses: z.array(projectStatusSchema),
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid()
});

export const projectSummarySchema = projectSchema.omit({
  statuses: true
});

export const projectResponseSchema = z.object({
  project: projectSchema
});

export const projectListResponseSchema = z.object({
  pageInfo: pageInfoSchema,
  projects: z.array(projectSummarySchema)
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
