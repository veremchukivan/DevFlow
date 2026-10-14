import { z } from "zod";

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
  tasks: z.array(taskSchema)
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
