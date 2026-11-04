import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projectKnowledgeEntries, projectKnowledgeLinks } from "../../core/db/schema/project-knowledge.js";

type Scope = { projectId: string; workspaceId: string };

export async function listKnowledgeEntries(input: Scope) {
  const entries = await db.select().from(projectKnowledgeEntries).where(and(eq(projectKnowledgeEntries.workspaceId, input.workspaceId), eq(projectKnowledgeEntries.projectId, input.projectId))).orderBy(desc(projectKnowledgeEntries.updatedAt), asc(projectKnowledgeEntries.title));
  const links = entries.length ? await db.select().from(projectKnowledgeLinks).where(inArray(projectKnowledgeLinks.knowledgeEntryId, entries.map((entry) => entry.id))).orderBy(asc(projectKnowledgeLinks.createdAt)) : [];
  return entries.map((entry) => ({ ...entry, links: links.filter((link) => link.knowledgeEntryId === entry.id) }));
}

export async function findKnowledgeEntry(input: Scope & { knowledgeEntryId: string }) {
  const [entry] = await db.select().from(projectKnowledgeEntries).where(and(eq(projectKnowledgeEntries.id, input.knowledgeEntryId), eq(projectKnowledgeEntries.workspaceId, input.workspaceId), eq(projectKnowledgeEntries.projectId, input.projectId))).limit(1);
  if (!entry) return undefined;
  const links = await db.select().from(projectKnowledgeLinks).where(eq(projectKnowledgeLinks.knowledgeEntryId, entry.id)).orderBy(asc(projectKnowledgeLinks.createdAt));
  return { ...entry, links };
}

export async function createKnowledgeEntry(input: Scope & { createdByUserId: string; updatedByUserId: string; title: string; kind: "adr" | "pattern" | "runbook" | "guideline" | "note"; status: "draft" | "accepted" | "superseded" | "deprecated"; summary?: string | null; content: string; tags: string[] }) {
  const [entry] = await db.insert(projectKnowledgeEntries).values(input).returning();
  return entry;
}

export async function updateKnowledgeEntry(input: { id: string; updatedByUserId: string; title?: string; kind?: "adr" | "pattern" | "runbook" | "guideline" | "note"; status?: "draft" | "accepted" | "superseded" | "deprecated"; summary?: string | null; content?: string; tags?: string[] }) {
  const [entry] = await db.update(projectKnowledgeEntries).set({ ...input, updatedAt: new Date() }).where(eq(projectKnowledgeEntries.id, input.id)).returning();
  return entry;
}

export async function deleteKnowledgeEntry(id: string) { await db.delete(projectKnowledgeEntries).where(eq(projectKnowledgeEntries.id, id)); }

export async function createKnowledgeLink(input: { knowledgeEntryId: string; kind: "task" | "pull_request" | "figma" | "release" | "external"; label: string; url: string; externalId?: string | null }) {
  const [link] = await db.insert(projectKnowledgeLinks).values(input).returning();
  return link;
}

export async function deleteKnowledgeLink(input: { knowledgeEntryId: string; linkId: string }) { await db.delete(projectKnowledgeLinks).where(and(eq(projectKnowledgeLinks.id, input.linkId), eq(projectKnowledgeLinks.knowledgeEntryId, input.knowledgeEntryId))); }
