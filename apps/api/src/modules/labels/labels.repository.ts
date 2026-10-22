import { and, asc, eq } from "drizzle-orm";
import { db } from "../../core/db/client.js";
import { labels } from "../../core/db/schema/labels.js";

export const listLabels = (workspaceId: string) =>
  db
    .select()
    .from(labels)
    .where(eq(labels.workspaceId, workspaceId))
    .orderBy(asc(labels.name));
export async function findLabel(workspaceId: string, labelId: string) {
  const [label] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)))
    .limit(1);
  return label;
}
export async function createLabel(input: {
  workspaceId: string;
  name: string;
  color: string;
}) {
  const [label] = await db.insert(labels).values(input).returning();
  if (!label) throw new Error("Failed to create label");
  return label;
}
export async function updateLabel(input: {
  workspaceId: string;
  labelId: string;
  name?: string;
  color?: string;
}) {
  const [label] = await db
    .update(labels)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(labels.workspaceId, input.workspaceId),
        eq(labels.id, input.labelId),
      ),
    )
    .returning();
  return label ?? null;
}
export const deleteLabel = (workspaceId: string, labelId: string) =>
  db
    .delete(labels)
    .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, labelId)));
