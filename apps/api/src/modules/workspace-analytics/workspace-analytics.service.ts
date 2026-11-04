import type { WorkspaceAnalyticsQuery } from "@devflow/shared";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { AppError } from "../../core/errors/app-error.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { taskActivityEvents } from "../../core/db/schema/task-activity-events.js";
import {
  taskDevelopmentFlowSessions,
  taskDevelopmentFlows,
} from "../../core/db/schema/task-development-flows.js";
import { taskGitLinks } from "../../core/db/schema/git-integrations.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { findWorkspaceForUser } from "../workspaces/workspaces.repository.js";

export async function getWorkspaceAnalytics(input: {
  query: WorkspaceAnalyticsQuery;
  userId: string;
  workspaceId: string;
}) {
  if (
    !(await findWorkspaceForUser({
      userId: input.userId,
      workspaceId: input.workspaceId,
    }))
  )
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = periodStart(input.query.period, now);
  const conditions = [
    eq(tasks.workspaceId, input.workspaceId),
    isNull(tasks.deletedAt),
  ];
  if (input.query.projectId && input.query.projectId !== "all")
    conditions.push(eq(tasks.projectId, input.query.projectId));
  if (input.query.assigneeUserId === "unassigned")
    conditions.push(isNull(tasks.assigneeUserId));
  else if (input.query.assigneeUserId && input.query.assigneeUserId !== "all")
    conditions.push(eq(tasks.assigneeUserId, input.query.assigneeUserId));
  if (input.query.sprintId === "backlog")
    conditions.push(isNull(tasks.sprintId));
  else if (input.query.sprintId && input.query.sprintId !== "all")
    conditions.push(eq(tasks.sprintId, input.query.sprintId));
  if (start) conditions.push(gte(tasks.updatedAt, start));
  const taskRows = await db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      createdAt: tasks.createdAt,
      id: tasks.id,
      dueDate: tasks.dueDate,
      statusCategory: projectStatuses.category,
      statusColor: projectStatuses.color,
      statusName: projectStatuses.name,
    })
    .from(tasks)
    .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
    .where(and(...conditions));
  const taskIds = taskRows.map((task) => task.id);
  const [members, events, gitLinks, sessions] = await Promise.all([
    db
      .select({ userId: users.id, userName: users.displayName })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.status, "active"),
        ),
      ),
    taskIds.length
      ? db
          .select({
            createdAt: taskActivityEvents.createdAt,
            data: taskActivityEvents.data,
            taskId: taskActivityEvents.taskId,
          })
          .from(taskActivityEvents)
          .where(
            and(
              eq(taskActivityEvents.workspaceId, input.workspaceId),
              inArray(taskActivityEvents.taskId, taskIds),
            ),
          )
      : [],
    taskIds.length
      ? db
          .select({
            status: taskGitLinks.status,
            taskId: taskGitLinks.taskId,
            type: taskGitLinks.type,
          })
          .from(taskGitLinks)
          .where(
            and(
              eq(taskGitLinks.workspaceId, input.workspaceId),
              inArray(taskGitLinks.taskId, taskIds),
            ),
          )
      : [],
    db
      .select({ status: taskDevelopmentFlowSessions.status })
      .from(taskDevelopmentFlowSessions)
      .innerJoin(
        taskDevelopmentFlows,
        eq(
          taskDevelopmentFlows.id,
          taskDevelopmentFlowSessions.developmentFlowId,
        ),
      )
      .where(eq(taskDevelopmentFlows.workspaceId, input.workspaceId)),
  ]);
  const completed = taskRows.filter((task) => task.statusCategory === "done");
  const open = taskRows.filter((task) => task.statusCategory !== "done");
  const statusDistribution = [
    ...new Map(
      taskRows.map((task) => [
        `${task.statusName}:${task.statusColor}`,
        {
          color: task.statusColor,
          count: taskRows.filter((row) => row.statusName === task.statusName)
            .length,
          name: task.statusName,
        },
      ]),
    ).values(),
  ];
  const taskById = new Map(taskRows.map((task) => [task.id, task]));
  const transitions = events.filter(
    (event) =>
      (event.data as Record<string, unknown>).toStatusCategory === "done",
  );
  const measures = transitions.flatMap((event) => {
    const task = taskById.get(event.taskId);
    if (!task) return [];
    const started = events
      .filter(
        (item) =>
          item.taskId === event.taskId && item.createdAt <= event.createdAt,
      )
      .find(
        (item) =>
          (item.data as Record<string, unknown>).toStatusCategory ===
          "in_progress",
      );
    return [
      {
        cycle:
          (event.createdAt.getTime() -
            (started?.createdAt ?? task.createdAt).getTime()) /
          3_600_000,
        lead:
          (event.createdAt.getTime() - task.createdAt.getTime()) / 3_600_000,
      },
    ];
  });
  return {
    ai: {
      activeSessions: sessions.filter((item) => item.status === "active")
        .length,
      completedSessions: sessions.filter((item) => item.status === "completed")
        .length,
      failedSessions: sessions.filter((item) => item.status === "failed")
        .length,
    },
    cycle: {
      averageCycleHours: average(measures.map((item) => item.cycle)),
      averageLeadHours: average(measures.map((item) => item.lead)),
      completedWithMeasurements: measures.length,
    },
    git: {
      linkedTasks: new Set(gitLinks.map((item) => item.taskId)).size,
      pipelinesFailing: gitLinks.filter(
        (item) => item.type === "pipeline" && item.status === "failing",
      ).length,
      pullRequests: gitLinks.filter((item) => item.type === "pull_request")
        .length,
    },
    statusDistribution,
    summary: {
      completed: completed.length,
      completionRate: taskRows.length
        ? Math.round((completed.length / taskRows.length) * 100)
        : 0,
      open: open.length,
      overdue: open.filter((task) => task.dueDate && task.dueDate < today)
        .length,
      total: taskRows.length,
      unassigned: open.filter((task) => !task.assigneeUserId).length,
    },
    velocity: velocity(transitions, now),
    workload: members.map((member) => ({
      completed: completed.filter(
        (task) => task.assigneeUserId === member.userId,
      ).length,
      open: open.filter((task) => task.assigneeUserId === member.userId).length,
      ...member,
    })),
  };
}
function periodStart(period: WorkspaceAnalyticsQuery["period"], now: Date) {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 86_400_000);
}
function average(values: number[]) {
  return values.length
    ? Math.round(
        (values.reduce((total, value) => total + value, 0) / values.length) *
          10,
      ) / 10
    : null;
}
function velocity(
  events: Array<{
    createdAt: Date;
    data: Record<string, unknown>;
    taskId: string;
  }>,
  now: Date,
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      completed: events.filter(
        (event) => event.createdAt.toISOString().slice(0, 10) === date,
      ).length,
      date,
    };
  });
}
