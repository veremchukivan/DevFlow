import { and, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskRelations } from "../../core/db/schema/task-relations.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

const sourceTasks = alias(tasks, "task_relation_source_tasks");
const targetTasks = alias(tasks, "task_relation_target_tasks");
const sourceProjects = alias(projects, "task_relation_source_projects");
const targetProjects = alias(projects, "task_relation_target_projects");

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

export async function findTaskInProject(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return task;
}

export async function findTaskInWorkspace(input: {
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return task;
}

export async function findExistingRelation(input: {
  relationType: "blocks" | "relates_to" | "duplicates";
  sourceTaskId: string;
  targetTaskId: string;
  workspaceId: string;
}) {
  const symmetric = input.relationType !== "blocks";
  const [relation] = await db
    .select({ id: taskRelations.id })
    .from(taskRelations)
    .where(
      and(
        eq(taskRelations.workspaceId, input.workspaceId),
        eq(taskRelations.relationType, input.relationType),
        symmetric
          ? or(
              and(
                eq(taskRelations.sourceTaskId, input.sourceTaskId),
                eq(taskRelations.targetTaskId, input.targetTaskId),
              ),
              and(
                eq(taskRelations.sourceTaskId, input.targetTaskId),
                eq(taskRelations.targetTaskId, input.sourceTaskId),
              ),
            )
          : and(
              eq(taskRelations.sourceTaskId, input.sourceTaskId),
              eq(taskRelations.targetTaskId, input.targetTaskId),
            ),
      ),
    )
    .limit(1);
  return relation;
}

export async function createTaskRelation(input: {
  createdByUserId: string;
  relationType: "blocks" | "relates_to" | "duplicates";
  sourceProjectId: string;
  sourceTaskId: string;
  targetProjectId: string;
  targetTaskId: string;
  workspaceId: string;
}) {
  const [relation] = await db.insert(taskRelations).values(input).returning();
  if (!relation) throw new Error("Failed to create task relation");
  return relation;
}

export async function listTaskRelations(input: {
  taskId: string;
  workspaceId: string;
}) {
  const rows = await db
    .select({
      createdAt: taskRelations.createdAt,
      id: taskRelations.id,
      relationType: taskRelations.relationType,
      sourceProjectId: taskRelations.sourceProjectId,
      sourceTaskId: taskRelations.sourceTaskId,
      sourceTaskKey: sourceTasks.number,
      sourceProjectKey: sourceProjects.key,
      sourceTitle: sourceTasks.title,
      targetProjectId: taskRelations.targetProjectId,
      targetTaskId: taskRelations.targetTaskId,
      targetTaskKey: targetTasks.number,
      targetProjectKey: targetProjects.key,
      targetTitle: targetTasks.title,
    })
    .from(taskRelations)
    .innerJoin(sourceTasks, eq(sourceTasks.id, taskRelations.sourceTaskId))
    .innerJoin(targetTasks, eq(targetTasks.id, taskRelations.targetTaskId))
    .innerJoin(
      sourceProjects,
      eq(sourceProjects.id, taskRelations.sourceProjectId),
    )
    .innerJoin(
      targetProjects,
      eq(targetProjects.id, taskRelations.targetProjectId),
    )
    .where(
      and(
        eq(taskRelations.workspaceId, input.workspaceId),
        or(
          eq(taskRelations.sourceTaskId, input.taskId),
          eq(taskRelations.targetTaskId, input.taskId),
        ),
        isNull(sourceTasks.deletedAt),
        isNull(targetTasks.deletedAt),
      ),
    )
    .orderBy(taskRelations.createdAt);

  return rows.map((row) => {
    const isSource = row.sourceTaskId === input.taskId;
    const relationType:
      "blocks" | "is_blocked_by" | "relates_to" | "duplicates" =
      !isSource && row.relationType === "blocks"
        ? "is_blocked_by"
        : (row.relationType as "blocks" | "relates_to" | "duplicates");
    return {
      createdAt: row.createdAt,
      id: row.id,
      relationType,
      task: isSource
        ? {
            id: row.targetTaskId,
            key: `${row.targetProjectKey}-${row.targetTaskKey}`,
            projectId: row.targetProjectId,
            title: row.targetTitle,
          }
        : {
            id: row.sourceTaskId,
            key: `${row.sourceProjectKey}-${row.sourceTaskKey}`,
            projectId: row.sourceProjectId,
            title: row.sourceTitle,
          },
    };
  });
}

export async function deleteTaskRelation(input: {
  relationId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [relation] = await db
    .delete(taskRelations)
    .where(
      and(
        eq(taskRelations.id, input.relationId),
        eq(taskRelations.workspaceId, input.workspaceId),
        or(
          eq(taskRelations.sourceTaskId, input.taskId),
          eq(taskRelations.targetTaskId, input.taskId),
        ),
      ),
    )
    .returning();
  return relation;
}
