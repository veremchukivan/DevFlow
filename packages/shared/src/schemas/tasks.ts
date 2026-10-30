import { z } from "zod";

import { pageInfoSchema, paginationQuerySchema } from "./pagination.js";
import { projectStatusCategorySchema } from "./projects.js";

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const taskTypeSchema = z.enum(["bug", "feature", "story", "task"]);
export const taskDueDateSchema = z.iso.date();
export const taskCustomFieldsSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string().max(2_000), z.number(), z.null()]),
);

export const createTaskRequestSchema = z.object({
  assigneeUserId: z.uuid().optional(),
  description: z.string().trim().max(10000).optional(),
  customFields: taskCustomFieldsSchema.optional(),
  dueDate: taskDueDateSchema.optional(),
  estimateMinutes: z.number().int().min(0).max(1_000_000).optional(),
  parentTaskId: z.uuid().optional(),
  priority: taskPrioritySchema.optional(),
  statusId: z.uuid().optional(),
  sprintId: z.uuid().optional(),
  type: taskTypeSchema.optional(),
  title: z.string().trim().min(2).max(200),
});

export const updateTaskRequestSchema = z
  .object({
    assigneeUserId: z.uuid().nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    customFields: taskCustomFieldsSchema.optional(),
    dueDate: taskDueDateSchema.nullable().optional(),
    estimateMinutes: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable()
      .optional(),
    parentTaskId: z.uuid().nullable().optional(),
    priority: taskPrioritySchema.optional(),
    statusId: z.uuid().optional(),
    sprintId: z.uuid().nullable().optional(),
    type: taskTypeSchema.optional(),
    title: z.string().trim().min(2).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field is required",
  });

export const repositionTaskRequestSchema = z.object({
  beforeTaskId: z.uuid().nullable().optional(),
  statusId: z.uuid(),
});

export const projectTasksParamsSchema = z.object({
  projectId: z.uuid(),
  workspaceId: z.uuid(),
});

export const taskParamsSchema = projectTasksParamsSchema.extend({
  taskId: z.uuid(),
});

export const taskFigmaLinkParamsSchema = taskParamsSchema.extend({
  linkId: z.uuid(),
});

export const createTaskFigmaLinkRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z
    .url()
    .refine(
      (value) =>
        /^https?:\/\/(?:[a-z0-9-]+\.)*figma\.com(?:[/:?#]|$)/i.test(value),
      { message: "Figma link must point to figma.com" },
    ),
});

export const taskFigmaLinkSchema = z.object({
  createdAt: z.string().datetime(),
  createdByUserId: z.uuid().nullable(),
  id: z.uuid(),
  name: z.string(),
  projectId: z.uuid(),
  taskId: z.uuid(),
  updatedAt: z.string().datetime(),
  url: z.url(),
  workspaceId: z.uuid(),
});

export const taskFigmaLinkListResponseSchema = z.object({
  links: z.array(taskFigmaLinkSchema),
});

export const taskFigmaLinkResponseSchema = z.object({
  link: taskFigmaLinkSchema,
});

// ---------------------------------------------------------------------------
// List query filters
// ---------------------------------------------------------------------------

export const taskSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "priority",
  "number",
  "position",
]);

export const taskSortOrderSchema = z.enum(["asc", "desc"]);
export const taskDueFilterSchema = z.enum(["overdue", "today", "week", "none"]);

export const listTasksQuerySchema = paginationQuerySchema.extend({
  archived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  assigneeUserId: z.union([z.uuid(), z.literal("none")]).optional(),
  due: taskDueFilterSchema.optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: taskSortFieldSchema.default("position"),
  sortOrder: taskSortOrderSchema.default("asc"),
  statusId: z.uuid().optional(),
  sprintId: z.union([z.uuid(), z.literal("backlog")]).optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskSortField = z.infer<typeof taskSortFieldSchema>;
export type TaskSortOrder = z.infer<typeof taskSortOrderSchema>;
export type CreateTaskFigmaLinkRequest = z.infer<
  typeof createTaskFigmaLinkRequestSchema
>;
export type TaskFigmaLink = z.infer<typeof taskFigmaLinkSchema>;

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
export const taskMetricsSchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  checklistCompletedCount: z.number().int().nonnegative(),
  checklistTotalCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
});

export const taskSchema = z.object({
  assignee: taskUserSchema.nullable().optional(),
  assigneeUserId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  customFields: taskCustomFieldsSchema,
  description: z.string().nullable(),
  dueDate: taskDueDateSchema.nullable(),
  estimateMinutes: z.number().int().nonnegative().nullable(),
  id: z.uuid(),
  metrics: taskMetricsSchema,
  key: z.string(),
  number: z.number(),
  parentTaskId: z.uuid().nullable(),
  priority: taskPrioritySchema,
  position: z.number().int().positive(),
  projectId: z.uuid(),
  reporter: taskUserSchema.nullable().optional(),
  reporterUserId: z.uuid().nullable(),
  status: taskStatusSchema,
  statusId: z.uuid(),
  sprintId: z.uuid().nullable(),
  title: z.string(),
  type: taskTypeSchema,
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
export type RepositionTaskRequest = z.infer<typeof repositionTaskRequestSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskUser = z.infer<typeof taskUserSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
