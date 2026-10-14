import { z } from "zod";

import { pageInfoSchema, paginationQuerySchema } from "./pagination.js";
import { projectStatusCategorySchema } from "./projects.js";

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskRequestSchema = z.object({
  assigneeUserId: z.uuid().optional(),
  description: z.string().trim().max(10000).optional(),
  priority: taskPrioritySchema.optional(),
  statusId: z.uuid().optional(),
  title: z.string().trim().min(2).max(200)
});

export const updateTaskRequestSchema = z
  .object({
    assigneeUserId: z.uuid().nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    priority: taskPrioritySchema.optional(),
    statusId: z.uuid().optional(),
    title: z.string().trim().min(2).max(200).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field is required"
  });

export const projectTasksParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid()
});

export const taskParamsSchema = projectTasksParamsSchema.extend({
  taskId: z.uuid()
});

// ---------------------------------------------------------------------------
// List query filters
// ---------------------------------------------------------------------------

export const taskSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "priority",
  "number"
]);

export const taskSortOrderSchema = z.enum(["asc", "desc"]);

export const listTasksQuerySchema = paginationQuerySchema.extend({
  archived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  assigneeUserId: z.union([z.uuid(), z.literal("none")]).optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: taskSortFieldSchema.default("createdAt"),
  sortOrder: taskSortOrderSchema.default("desc"),
  statusId: z.uuid().optional()
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskSortField = z.infer<typeof taskSortFieldSchema>;
export type TaskSortOrder = z.infer<typeof taskSortOrderSchema>;

export const taskStatusSchema = z.object({
  category: projectStatusCategorySchema,
  color: z.string(),
  id: z.uuid(),
  name: z.string(),
  position: z.number(),
  projectId: z.uuid(),
  workspaceId: z.uuid()
});

export const taskSchema = z.object({
  assigneeUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  description: z.string().nullable(),
  id: z.uuid(),
  key: z.string(),
  number: z.number(),
  priority: taskPrioritySchema,
  projectId: z.uuid(),
  reporterUserId: z.uuid().nullable(),
  status: taskStatusSchema,
  statusId: z.uuid(),
  title: z.string(),
  updatedAt: z.string().datetime(),
  workspaceId: z.uuid()
});

export const taskResponseSchema = z.object({
  task: taskSchema
});

export const taskListResponseSchema = z.object({
  pageInfo: pageInfoSchema,
  tasks: z.array(taskSchema)
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
