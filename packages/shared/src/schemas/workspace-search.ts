import { z } from "zod";

export const workspaceSearchParamsSchema = z.object({ workspaceId: z.uuid() });
export const workspaceSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
});
export const workspaceSearchResultSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "task",
    "project",
    "call",
    "agreement",
    "comment",
    "knowledge",
  ]),
  projectId: z.uuid().nullable(),
  subtitle: z.string(),
  title: z.string(),
  url: z.string(),
});
export const workspaceSearchResponseSchema = z.object({
  results: z.array(workspaceSearchResultSchema),
});
export type WorkspaceSearchResponse = z.infer<
  typeof workspaceSearchResponseSchema
>;
