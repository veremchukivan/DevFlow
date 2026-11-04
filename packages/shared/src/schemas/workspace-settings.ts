import { z } from "zod";

export const workspaceSettingsParamsSchema = z.object({ workspaceId: z.uuid() });
export const workspaceSettingsFilterParamsSchema = workspaceSettingsParamsSchema.extend({ filterId: z.uuid() });
export const workspaceTaskTypeSchema = z.enum(["epic", "bug", "feature", "story", "task"]);
export const workspaceCustomFieldSchema = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(80), options: z.array(z.string().trim().min(1).max(80)).max(50).default([]), type: z.enum(["number", "select", "text"]) });
export const workspaceFeaturesSchema = z.object({ attachments: z.boolean(), automation: z.boolean(), sprints: z.boolean() });
export const workspaceSettingsSchema = z.object({ customFields: z.array(workspaceCustomFieldSchema), defaultAssigneeUserId: z.uuid().nullable(), enabledTaskTypes: z.array(workspaceTaskTypeSchema).min(1), features: workspaceFeaturesSchema });
export const updateWorkspaceSettingsRequestSchema = workspaceSettingsSchema.partial().refine((input) => Object.keys(input).length > 0, { message: "At least one setting is required" });
export const workspaceSettingsResponseSchema = z.object({ settings: workspaceSettingsSchema });
export const createWorkspaceSavedFilterRequestSchema = z.object({ criteria: z.record(z.string(), z.unknown()), name: z.string().trim().min(1).max(100) });
export const workspaceSavedFilterSchema = z.object({ createdAt: z.string().datetime(), criteria: z.record(z.string(), z.unknown()), id: z.uuid(), name: z.string(), updatedAt: z.string().datetime() });
export const workspaceSavedFiltersResponseSchema = z.object({ filters: z.array(workspaceSavedFilterSchema) });
export const workspaceSavedFilterResponseSchema = z.object({ filter: workspaceSavedFilterSchema });
export type UpdateWorkspaceSettingsRequest = z.infer<typeof updateWorkspaceSettingsRequestSchema>;
