import { z } from "zod";

export const gitProviderSchema = z.enum(["github", "gitlab"]);
export const gitLinkTypeSchema = z.enum(["branch", "commit", "pull_request", "pipeline", "deployment"]);
export const gitConnectionSchema = z.object({ id: z.uuid(), provider: gitProviderSchema, username: z.string(), avatarUrl: z.url().nullable(), connectedAt: z.string().datetime(), scopes: z.array(z.string()) });
export const gitConnectionsResponseSchema = z.object({ configured: z.object({ github: z.boolean(), gitlab: z.boolean() }), connections: z.array(gitConnectionSchema) });
export const projectRepositorySchema = z.object({ id: z.uuid(), connectionId: z.uuid(), provider: gitProviderSchema, fullName: z.string(), webUrl: z.url(), defaultBranch: z.string(), isPrivate: z.boolean(), lastSyncedAt: z.string().datetime().nullable() });
export const projectRepositoryResponseSchema = z.object({ repository: projectRepositorySchema.nullable() });
export const taskGitLinkSchema = z.object({ id: z.uuid(), provider: gitProviderSchema, type: gitLinkTypeSchema, externalId: z.string(), label: z.string(), url: z.url(), status: z.string().nullable(), metadata: z.record(z.string(), z.unknown()), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
export const taskGitLinksResponseSchema = z.object({ links: z.array(taskGitLinkSchema) });
export const taskGitLinkResponseSchema = z.object({ link: taskGitLinkSchema });
export type GitConnection = z.infer<typeof gitConnectionSchema>;
export type GitConnectionsResponse = z.infer<typeof gitConnectionsResponseSchema>;
export type ProjectRepository = z.infer<typeof projectRepositorySchema>;
export type TaskGitLink = z.infer<typeof taskGitLinkSchema>;
