import { z } from "zod";

import { pageInfoSchema } from "./pagination.js";

export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "viewer"
]);

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/);

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: workspaceSlugSchema.optional()
});

export const updateWorkspaceRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: workspaceSlugSchema.optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one workspace field is required"
  });

export const workspaceParamsSchema = z.object({
  workspaceId: z.uuid()
});

export const workspaceSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.uuid(),
  name: z.string(),
  ownerUserId: z.uuid().nullable(),
  role: workspaceRoleSchema,
  slug: z.string(),
  updatedAt: z.string().datetime()
});

export const workspaceResponseSchema = z.object({
  workspace: workspaceSchema
});

export const workspaceListResponseSchema = z.object({
  pageInfo: pageInfoSchema,
  workspaces: z.array(workspaceSchema)
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;
export type UpdateWorkspaceRequest = z.infer<
  typeof updateWorkspaceRequestSchema
>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
export type WorkspaceListResponse = z.infer<
  typeof workspaceListResponseSchema
>;
