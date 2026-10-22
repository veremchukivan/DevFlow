import { z } from "zod";

import { pageInfoSchema, paginationQuerySchema } from "./pagination.js";
import { projectStatusCategorySchema } from "./projects.js";

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const taskDueDateSchema = z.iso.date();

export const createTaskRequestSchema = z.object({
  assigneeUserId: z.uuid().optional(),
  description: z.string().trim().max(10000).optional(),
  dueDate: taskDueDateSchema.optional(),
  priority: taskPrioritySchema.optional(),
  statusId: z.uuid().optional(),
  title: z.string().trim().min(2).max(200),
});

export const updateTaskRequestSchema = z
  .object({
    assigneeUserId: z.uuid().nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    dueDate: taskDueDateSchema.nullable().optional(),
    priority: taskPrioritySchema.optional(),
    statusId: z.uuid().optional(),
    title: z.string().trim().min(2).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field is required",
  });

export const projectTasksParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskParamsSchema = projectTasksParamsSchema.extend({
  taskId: z.uuid(),
});

// ---------------------------------------------------------------------------
// List query filters
// ---------------------------------------------------------------------------

export const taskSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "priority",
  "number",
]);

export const taskSortOrderSchema = z.enum(["asc", "desc"]);

export const listTasksQuerySchema = paginationQuerySchema.extend({
  archived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  assigneeUserId: z.union([z.uuid(), z.literal("none")]).optional(),
  labelId: z.uuid().optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: taskSortFieldSchema.default("createdAt"),
  sortOrder: taskSortOrderSchema.default("desc"),
  statusId: z.uuid().optional(),
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
  workspaceId: z.uuid(),
});

export const taskUserSchema = z.object({
  displayName: z.string(),
  email: z.string().email(),
  id: z.uuid(),
});
export const taskLabelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
});

export const taskSchema = z.object({
  assignee: taskUserSchema.nullable().optional(),
  assigneeUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  description: z.string().nullable(),
  dueDate: taskDueDateSchema.nullable(),
  id: z.uuid(),
  labels: z.array(taskLabelSchema).default([]),
  key: z.string(),
  number: z.number(),
  priority: taskPrioritySchema,
  projectId: z.uuid(),
  reporter: taskUserSchema.nullable().optional(),
  reporterUserId: z.uuid().nullable(),
  status: taskStatusSchema,
  statusId: z.uuid(),
  title: z.string(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
  workspaceId: z.uuid(),
});

export const taskResponseSchema = z.object({
  task: taskSchema,
});

export const taskListResponseSchema = z.object({
  pageInfo: pageInfoSchema,
  tasks: z.array(taskSchema),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskUser = z.infer<typeof taskUserSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
