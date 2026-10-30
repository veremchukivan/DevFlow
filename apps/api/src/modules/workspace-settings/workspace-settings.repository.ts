import { and, desc, eq } from "drizzle-orm";
import { db } from "../../core/db/client.js";
import { workspaceSavedFilters, workspaceSettings } from "../../core/db/schema/workspace-settings.js";

type WorkspaceSettingsValues = {
  customFields: Array<{ id: string; name: string; type: "number" | "select" | "text" }>;
  defaultAssigneeUserId: string | null;
  enabledTaskTypes: Array<"bug" | "feature" | "story" | "task">;
  features: { attachments: boolean; automation: boolean; sprints: boolean };
};
const defaults: WorkspaceSettingsValues = { customFields: [], defaultAssigneeUserId: null, enabledTaskTypes: ["task", "bug", "feature", "story"], features: { attachments: true, automation: true, sprints: true } };
export async function getWorkspaceSettings(workspaceId: string) { await db.insert(workspaceSettings).values({ workspaceId, ...defaults }).onConflictDoNothing({ target: workspaceSettings.workspaceId }); const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)); return settings!; }
export async function saveWorkspaceSettings(input: { workspaceId: string } & Partial<WorkspaceSettingsValues>) { await getWorkspaceSettings(input.workspaceId); const [settings] = await db.update(workspaceSettings).set({ ...input, updatedAt: new Date() }).where(eq(workspaceSettings.workspaceId, input.workspaceId)).returning(); return settings!; }
export async function listSavedFilters(input: { userId: string; workspaceId: string }) { return db.select().from(workspaceSavedFilters).where(and(eq(workspaceSavedFilters.workspaceId, input.workspaceId), eq(workspaceSavedFilters.userId, input.userId))).orderBy(desc(workspaceSavedFilters.updatedAt)); }
export async function createSavedFilter(input: { criteria: Record<string, unknown>; name: string; userId: string; workspaceId: string }) { const [filter] = await db.insert(workspaceSavedFilters).values(input).returning(); return filter!; }
export async function deleteSavedFilter(input: { filterId: string; userId: string; workspaceId: string }) { const [filter] = await db.delete(workspaceSavedFilters).where(and(eq(workspaceSavedFilters.id, input.filterId), eq(workspaceSavedFilters.workspaceId, input.workspaceId), eq(workspaceSavedFilters.userId, input.userId))).returning({ id: workspaceSavedFilters.id }); return filter; }
