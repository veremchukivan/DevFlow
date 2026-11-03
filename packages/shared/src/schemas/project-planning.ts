import { z } from "zod";

import { projectParamsSchema } from "./projects.js";

export const projectReleaseStatusSchema = z.enum(["planned", "in_progress", "released", "cancelled"]);
export const projectPlanningParamsSchema = projectParamsSchema;
export const projectReleaseParamsSchema = projectParamsSchema.extend({ releaseId: z.uuid() });
export const projectPlanningTaskParamsSchema = projectParamsSchema.extend({ taskId: z.uuid() });
export const createProjectReleaseRequestSchema = z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(5_000).nullable().optional(), status: projectReleaseStatusSchema.default("planned"), startDate: z.iso.date().nullable().optional(), releaseDate: z.iso.date().nullable().optional() });
export const updateProjectReleaseRequestSchema = createProjectReleaseRequestSchema.partial().refine((value) => Object.keys(value).length > 0, { message: "At least one release field is required" });
export const updateProjectPlanningTaskRequestSchema = z.object({ epicId: z.uuid().nullable().optional(), releaseId: z.uuid().nullable().optional(), complexityPoints: z.number().int().min(0).max(1_000).nullable().optional() }).refine((value) => Object.keys(value).length > 0, { message: "At least one planning field is required" });
export const projectReleaseSchema = z.object({ id: z.uuid(), workspaceId: z.uuid(), projectId: z.uuid(), name: z.string(), description: z.string().nullable(), status: projectReleaseStatusSchema, startDate: z.iso.date().nullable(), releaseDate: z.iso.date().nullable(), createdByUserId: z.uuid().nullable(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), taskCount: z.number().int().nonnegative(), completedTaskCount: z.number().int().nonnegative() });
export const projectPlanningTaskSchema = z.object({ id: z.uuid(), key: z.string(), title: z.string(), type: z.enum(["epic", "bug", "feature", "story", "task"]), priority: z.enum(["low", "medium", "high", "urgent"]), dueDate: z.iso.date().nullable(), statusCategory: z.enum(["todo", "in_progress", "done"]), sprintId: z.uuid().nullable(), epicId: z.uuid().nullable(), releaseId: z.uuid().nullable(), complexityPoints: z.number().int().nullable(), dependencyCount: z.number().int().nonnegative(), blockedByOpenDependency: z.boolean(), risk: z.enum(["none", "due_soon", "overdue", "blocked"]) });
export const projectPlanningResponseSchema = z.object({ tasks: z.array(projectPlanningTaskSchema), releases: z.array(projectReleaseSchema), generatedAt: z.string().datetime() });
export type ProjectPlanningResponse = z.infer<typeof projectPlanningResponseSchema>;
export type ProjectPlanningTask = z.infer<typeof projectPlanningTaskSchema>;
export type ProjectRelease = z.infer<typeof projectReleaseSchema>;
