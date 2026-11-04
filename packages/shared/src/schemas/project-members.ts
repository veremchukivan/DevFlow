import { z } from "zod";

export const projectMemberRoleSchema = z.enum(["lead", "member", "viewer"]);

export const projectMemberParamsSchema = z.object({
  projectId: z.uuid(),
  userId: z.uuid(),
  workspaceId: z.uuid(),
});

export const projectMembersParamsSchema = projectMemberParamsSchema.omit({
  userId: true,
});

export const createProjectMemberRequestSchema = z.object({
  role: projectMemberRoleSchema.default("member"),
  userId: z.uuid(),
});

export const updateProjectMemberRequestSchema = z.object({
  role: projectMemberRoleSchema,
});

export const projectMemberSchema = z.object({
  completedTaskCount: z.number().int().nonnegative(),
  joinedAt: z.string().datetime(),
  openTaskCount: z.number().int().nonnegative(),
  role: projectMemberRoleSchema,
  user: z.object({
    displayName: z.string(),
    email: z.string().email(),
    id: z.uuid(),
  }),
  userId: z.uuid(),
});

export const projectMemberListResponseSchema = z.object({
  members: z.array(projectMemberSchema),
});

export const projectMemberResponseSchema = z.object({
  member: projectMemberSchema,
});

export type CreateProjectMemberRequest = z.infer<
  typeof createProjectMemberRequestSchema
>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;
export type UpdateProjectMemberRequest = z.infer<
  typeof updateProjectMemberRequestSchema
>;
