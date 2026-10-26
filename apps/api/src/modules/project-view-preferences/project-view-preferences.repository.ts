import type { ProjectViewPreferences } from "@devflow/shared";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projectViewPreferences } from "../../core/db/schema/project-view-preferences.js";
import { projects } from "../../core/db/schema/projects.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

export async function findAccessibleProject(input: {
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, projects.workspaceId),
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.status, "active"),
      ),
    )
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.workspaceId, input.workspaceId),
        isNull(projects.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return project;
}

export async function findProjectViewPreferences(input: {
  projectId: string;
  userId: string;
}) {
  const [preferences] = await db
    .select()
    .from(projectViewPreferences)
    .where(
      and(
        eq(projectViewPreferences.projectId, input.projectId),
        eq(projectViewPreferences.userId, input.userId),
      ),
    )
    .limit(1);
  return preferences;
}

export async function saveProjectViewPreferences(input: {
  preferences: ProjectViewPreferences;
  projectId: string;
  userId: string;
  workspaceId: string;
}) {
  const [preferences] = await db
    .insert(projectViewPreferences)
    .values({
      ...input.preferences,
      projectId: input.projectId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectViewPreferences.userId, projectViewPreferences.projectId],
      set: { ...input.preferences, updatedAt: new Date() },
    })
    .returning();
  return preferences;
}
