import { z } from "zod";

import { projectParamsSchema } from "./projects.js";

export const knowledgeKindSchema = z.enum(["adr", "pattern", "runbook", "guideline", "note"]);
export const knowledgeStatusSchema = z.enum(["draft", "accepted", "superseded", "deprecated"]);
export const knowledgeLinkKindSchema = z.enum(["task", "pull_request", "figma", "release", "external"]);

const titleSchema = z.string().trim().min(2).max(240);
const contentSchema = z.string().trim().max(100_000);
const tagsSchema = z.array(z.string().trim().min(1).max(48)).max(24).transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))]);

export const projectKnowledgeParamsSchema = projectParamsSchema;
export const projectKnowledgeEntryParamsSchema = projectParamsSchema.extend({ knowledgeEntryId: z.uuid() });
export const projectKnowledgeLinkParamsSchema = projectKnowledgeEntryParamsSchema.extend({ linkId: z.uuid() });

export const createProjectKnowledgeEntryRequestSchema = z.object({
  content: contentSchema.default(""),
  kind: knowledgeKindSchema.default("note"),
  status: knowledgeStatusSchema.default("draft"),
  summary: z.string().trim().max(600).nullable().optional(),
  tags: tagsSchema.default([]),
  title: titleSchema,
});

export const updateProjectKnowledgeEntryRequestSchema = createProjectKnowledgeEntryRequestSchema.partial().refine((input) => Object.keys(input).length > 0, { message: "At least one knowledge field is required" });

export const createProjectKnowledgeLinkRequestSchema = z.object({
  externalId: z.string().trim().max(255).nullable().optional(),
  kind: knowledgeLinkKindSchema,
  label: z.string().trim().min(1).max(240),
  url: z.url().max(2048),
});

export const projectKnowledgeLinkSchema = z.object({
  createdAt: z.string().datetime(), externalId: z.string().nullable(), id: z.uuid(), kind: knowledgeLinkKindSchema,
  knowledgeEntryId: z.uuid(), label: z.string(), updatedAt: z.string().datetime(), url: z.url(),
});

export const projectKnowledgeEntrySchema = z.object({
  content: z.string(), createdAt: z.string().datetime(), createdByUserId: z.uuid().nullable(), id: z.uuid(), kind: knowledgeKindSchema,
  links: z.array(projectKnowledgeLinkSchema), projectId: z.uuid(), status: knowledgeStatusSchema, summary: z.string().nullable(),
  tags: z.array(z.string()), title: z.string(), updatedAt: z.string().datetime(), updatedByUserId: z.uuid().nullable(), workspaceId: z.uuid(),
});

export const projectKnowledgeListResponseSchema = z.object({ entries: z.array(projectKnowledgeEntrySchema) });
export const projectKnowledgeEntryResponseSchema = z.object({ entry: projectKnowledgeEntrySchema });
export const projectKnowledgeContextResponseSchema = z.object({ entries: z.array(projectKnowledgeEntrySchema), generatedAt: z.string().datetime() });

export type CreateProjectKnowledgeEntryRequest = z.infer<typeof createProjectKnowledgeEntryRequestSchema>;
export type UpdateProjectKnowledgeEntryRequest = z.infer<typeof updateProjectKnowledgeEntryRequestSchema>;
export type ProjectKnowledgeEntry = z.infer<typeof projectKnowledgeEntrySchema>;
export type ProjectKnowledgeLink = z.infer<typeof projectKnowledgeLinkSchema>;
