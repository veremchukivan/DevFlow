import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import {
  workspaceAutomationRules,
  workspaceAutomationRuns,
} from "../../core/db/schema/workspace-automation-rules.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";

export const DEFAULT_AUTOMATION_RULES = [
  {
    ruleType: "children_completed_close_parent",
    configuration: {},
  },
  {
    ruleType: "task_transition_assign",
    configuration: { onlyWhenUnassigned: true },
  },
  {
    ruleType: "parent_completed_close_children",
    configuration: {},
  },
] as const;

export async function ensureWorkspaceAutomationRules(input: {
  createdByUserId: string;
  workspaceId: string;
}) {
  await db
    .insert(workspaceAutomationRules)
    .values(
      DEFAULT_AUTOMATION_RULES.map((rule) => ({
        ...rule,
        createdByUserId: input.createdByUserId,
        workspaceId: input.workspaceId,
      })),
    )
    .onConflictDoNothing({
      target: [
        workspaceAutomationRules.workspaceId,
        workspaceAutomationRules.ruleType,
      ],
    });
}

export async function listWorkspaceAutomationRules(workspaceId: string) {
  return db
    .select()
    .from(workspaceAutomationRules)
    .where(eq(workspaceAutomationRules.workspaceId, workspaceId))
    .orderBy(workspaceAutomationRules.createdAt);
}

export async function listEnabledWorkspaceAutomationRules(workspaceId: string) {
  return db
    .select()
    .from(workspaceAutomationRules)
    .where(
      and(
        eq(workspaceAutomationRules.workspaceId, workspaceId),
        eq(workspaceAutomationRules.enabled, true),
      ),
    );
}

export async function createWorkspaceAutomationRun(input: {
  actorUserId: string;
  data?: Record<string, unknown>;
  outcome: "succeeded" | "skipped" | "failed";
  ruleId: string;
  summary: string;
  triggerTaskId: string;
  workspaceId: string;
}) {
  await db.insert(workspaceAutomationRuns).values({
    ...input,
    data: input.data ?? {},
  });
}

export async function findAutomationTask(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      id: tasks.id,
      parentTaskId: tasks.parentTaskId,
      projectId: tasks.projectId,
      statusCategory: projectStatuses.category,
      statusId: tasks.statusId,
      title: tasks.title,
      workspaceId: tasks.workspaceId,
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
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);
  return task;
}

export async function listAutomationChildTasks(input: {
  parentTaskId: string;
  projectId: string;
  workspaceId: string;
}) {
  return db
    .select({
      id: tasks.id,
      statusCategory: projectStatuses.category,
      statusId: tasks.statusId,
      title: tasks.title,
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
        eq(tasks.parentTaskId, input.parentTaskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
      ),
    );
}

export async function findProjectDoneStatus(input: {
  projectId: string;
  workspaceId: string;
}) {
  const [status] = await db
    .select({ id: projectStatuses.id })
    .from(projectStatuses)
    .where(
      and(
        eq(projectStatuses.projectId, input.projectId),
        eq(projectStatuses.workspaceId, input.workspaceId),
        eq(projectStatuses.category, "done"),
      ),
    )
    .orderBy(projectStatuses.position)
    .limit(1);
  return status;
}

export async function updateAutomationTask(input: {
  assigneeUserId?: string;
  statusId?: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .update(tasks)
    .set({
      ...(input.assigneeUserId !== undefined
        ? { assigneeUserId: input.assigneeUserId }
        : {}),
      ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
      updatedAt: new Date(),
      version: sql`${tasks.version} + 1`,
    })
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
      ),
    )
    .returning({ id: tasks.id });
  return task;
}

export async function isActiveWorkspaceMember(input: {
  userId: string;
  workspaceId: string;
}) {
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(member);
}

export async function updateWorkspaceAutomationRule(input: {
  configuration?: Record<string, unknown>;
  enabled?: boolean;
  ruleId: string;
  workspaceId: string;
}) {
  const [rule] = await db
    .update(workspaceAutomationRules)
    .set({
      ...(input.configuration !== undefined
        ? { configuration: input.configuration }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAutomationRules.id, input.ruleId),
        eq(workspaceAutomationRules.workspaceId, input.workspaceId),
      ),
    )
    .returning();

  return rule;
}

export async function listWorkspaceAutomationRuns(input: {
  limit: number;
  workspaceId: string;
}) {
  return db
    .select()
    .from(workspaceAutomationRuns)
    .where(eq(workspaceAutomationRuns.workspaceId, input.workspaceId))
    .orderBy(desc(workspaceAutomationRuns.createdAt))
    .limit(input.limit);
}

export async function getWorkspaceAutomationUsage(input: {
  since: Date;
  workspaceId: string;
}) {
  const [rules, runs] = await Promise.all([
    db
      .select({
        enabled: workspaceAutomationRules.enabled,
        total: count(),
      })
      .from(workspaceAutomationRules)
      .where(eq(workspaceAutomationRules.workspaceId, input.workspaceId))
      .groupBy(workspaceAutomationRules.enabled),
    db
      .select({
        outcome: workspaceAutomationRuns.outcome,
        total: count(),
      })
      .from(workspaceAutomationRuns)
      .where(
        and(
          eq(workspaceAutomationRuns.workspaceId, input.workspaceId),
          gte(workspaceAutomationRuns.createdAt, input.since),
        ),
      )
      .groupBy(workspaceAutomationRuns.outcome),
  ]);

  const totalRules = rules.reduce((sum, row) => sum + row.total, 0);
  const enabledRules = rules
    .filter((row) => row.enabled)
    .reduce((sum, row) => sum + row.total, 0);
  const totalRuns = runs.reduce((sum, row) => sum + row.total, 0);
  const successfulRuns = runs
    .filter((row) => row.outcome === "succeeded")
    .reduce((sum, row) => sum + row.total, 0);
  const failedRuns = runs
    .filter((row) => row.outcome === "failed")
    .reduce((sum, row) => sum + row.total, 0);

  return { enabledRules, failedRuns, successfulRuns, totalRules, totalRuns };
}
