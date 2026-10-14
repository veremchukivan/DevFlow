import { z } from "zod";

import { pageInfoSchema } from "./pagination.js";
import { workspaceRoleSchema } from "./workspaces.js";

export const workspaceMemberAssignableRoleSchema = z.enum([
  "admin",
  "member",
  "viewer"
]);

export const workspaceMemberStatusSchema = z.enum([
  "active",
  "invited",
  "suspended"
]);

export const workspaceMemberManageableStatusSchema = z.enum([
  "active",
  "suspended"
]);

export const addWorkspaceMemberRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  role: workspaceMemberAssignableRoleSchema.default("member")
});

export const updateWorkspaceMemberRequestSchema = z
  .object({
    role: workspaceMemberAssignableRoleSchema.optional(),
    status: workspaceMemberManageableStatusSchema.optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one member field is required"
  });

export const workspaceMembersParamsSchema = z.object({
  workspaceId: z.uuid()
});

export const workspaceMemberParamsSchema = workspaceMembersParamsSchema.extend({
  userId: z.uuid()
});

export const workspaceMemberUserSchema = z.object({
  displayName: z.string(),
  email: z.string().email(),
  id: z.uuid()
});

export const workspaceMemberSchema = z.object({
  createdAt: z.string().datetime(),
  joinedAt: z.string().datetime(),
  role: workspaceRoleSchema,
  status: workspaceMemberStatusSchema,
  updatedAt: z.string().datetime(),
  user: workspaceMemberUserSchema,
  userId: z.uuid(),
  workspaceId: z.uuid()
});

export const workspaceMemberResponseSchema = z.object({
  member: workspaceMemberSchema
});

export const workspaceMemberListResponseSchema = z.object({
  members: z.array(workspaceMemberSchema),
  pageInfo: pageInfoSchema
});

export type WorkspaceMemberAssignableRole = z.infer<
  typeof workspaceMemberAssignableRoleSchema
>;
export type WorkspaceMemberStatus = z.infer<typeof workspaceMemberStatusSchema>;
export type AddWorkspaceMemberRequest = z.infer<
  typeof addWorkspaceMemberRequestSchema
>;
export type UpdateWorkspaceMemberRequest = z.infer<
  typeof updateWorkspaceMemberRequestSchema
>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceMemberResponse = z.infer<
  typeof workspaceMemberResponseSchema
>;
export type WorkspaceMemberListResponse = z.infer<
  typeof workspaceMemberListResponseSchema
>;
