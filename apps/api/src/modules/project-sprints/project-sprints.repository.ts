import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { projectSprints } from "../../core/db/schema/project-sprints.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { taskActivityEvents } from "../../core/db/schema/task-activity-events.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

type ProjectScope = { projectId: string; workspaceId: string };

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return membership;
}

export async function findProjectInWorkspace(input: ProjectScope) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.workspaceId, input.workspaceId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return project;
}

export async function listProjectSprints(input: ProjectScope) {
  return db
    .select()
    .from(projectSprints)
    .where(
      and(
        eq(projectSprints.projectId, input.projectId),
        eq(projectSprints.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(desc(projectSprints.status), desc(projectSprints.createdAt));
}

export async function findProjectSprint(
  input: ProjectScope & { sprintId: string },
) {
  const [sprint] = await db
    .select()
    .from(projectSprints)
    .where(
      and(
        eq(projectSprints.id, input.sprintId),
        eq(projectSprints.projectId, input.projectId),
        eq(projectSprints.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return sprint;
}

export async function createProjectSprint(
  input: ProjectScope & {
    createdByUserId: string;
    endDate?: string;
    goal?: string;
    name: string;
    startDate?: string;
    status?: "planning" | "active" | "completed";
  },
) {
  const [sprint] = await db
    .insert(projectSprints)
    .values({
      ...input,
      completedAt: input.status === "completed" ? new Date() : undefined,
    })
    .returning();
  if (!sprint) throw new Error("Failed to create project sprint");
  return sprint;
}

export async function updateProjectSprint(
  input: ProjectScope & {
    sprintId: string;
    endDate?: string | null;
    goal?: string | null;
    name?: string;
    startDate?: string | null;
    status?: "planning" | "active" | "completed";
  },
) {
  const [sprint] = await db
    .update(projectSprints)
    .set({
      ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
      ...(input.goal === undefined ? {} : { goal: input.goal }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      ...(input.status === undefined
        ? {}
        : {
            status: input.status,
            completedAt: input.status === "completed" ? new Date() : null,
          }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectSprints.id, input.sprintId),
        eq(projectSprints.projectId, input.projectId),
        eq(projectSprints.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  return sprint;
}

export async function countTasksInSprint(
  input: ProjectScope & { sprintId: string },
) {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        eq(tasks.sprintId, input.sprintId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
      ),
    );
  return row?.total ?? 0;
}

export async function deleteProjectSprint(
  input: ProjectScope & { sprintId: string },
) {
  const [sprint] = await db
    .delete(projectSprints)
    .where(
      and(
        eq(projectSprints.id, input.sprintId),
        eq(projectSprints.projectId, input.projectId),
        eq(projectSprints.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: projectSprints.id });
  return sprint;
}

export async function listSprintTaskMetrics(
  input: ProjectScope & { sprintId: string },
) {
  return db
    .select({
      id: tasks.id,
      createdAt: tasks.createdAt,
      dueDate: tasks.dueDate,
      statusId: tasks.statusId,
      statusName: projectStatuses.name,
      statusCategory: projectStatuses.category,
    })
    .from(tasks)
    .innerJoin(
      projectStatuses,
      and(
        eq(projectStatuses.id, tasks.statusId),
        eq(projectStatuses.projectId, tasks.projectId),
        eq(projectStatuses.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.sprintId, input.sprintId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
      ),
    );
}

export async function listSprintStatusTransitions(input: ProjectScope & { taskIds: string[] }) {
  if (!input.taskIds.length) return [];
  return db
    .select({ createdAt: taskActivityEvents.createdAt, data: taskActivityEvents.data, taskId: taskActivityEvents.taskId })
    .from(taskActivityEvents)
    .where(and(
      eq(taskActivityEvents.workspaceId, input.workspaceId),
      eq(taskActivityEvents.projectId, input.projectId),
      inArray(taskActivityEvents.taskId, input.taskIds),
      eq(taskActivityEvents.eventType, "task_updated"),
    ))
    .orderBy(asc(taskActivityEvents.createdAt));
}

export async function completeSprintAndCarryOver(
  input: ProjectScope & { sprintId: string; targetSprintId?: string },
) {
  return db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({ sprintId: input.targetSprintId ?? null, updatedAt: new Date() })
      .from(projectStatuses)
      .where(
        and(
          eq(tasks.sprintId, input.sprintId),
          eq(tasks.projectId, input.projectId),
          eq(tasks.workspaceId, input.workspaceId),
          isNull(tasks.deletedAt),
          eq(projectStatuses.id, tasks.statusId),
          sql`${projectStatuses.category} <> 'done'`,
        ),
      );
    const [sprint] = await tx
      .update(projectSprints)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectSprints.id, input.sprintId),
          eq(projectSprints.projectId, input.projectId),
          eq(projectSprints.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    return sprint;
  });
}
