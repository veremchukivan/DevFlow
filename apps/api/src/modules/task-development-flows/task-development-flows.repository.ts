import { and, desc, eq } from "drizzle-orm";

import { type DbExecutor, db } from "../../core/db/client.js";
import {
  taskDevelopmentFlows,
  taskDevelopmentFlowSessions,
} from "../../core/db/schema/task-development-flows.js";
import { users } from "../../core/db/schema/users.js";

export async function findTaskDevelopmentFlow(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}, executor: DbExecutor = db) {
  const [flow] = await executor
    .select()
    .from(taskDevelopmentFlows)
    .where(
      and(
        eq(taskDevelopmentFlows.workspaceId, input.workspaceId),
        eq(taskDevelopmentFlows.projectId, input.projectId),
        eq(taskDevelopmentFlows.taskId, input.taskId),
      ),
    )
    .limit(1);
  return flow;
}

export async function createTaskDevelopmentFlowInDb(input: {
  acceptanceCriteria: string[];
  projectId: string;
  taskId: string;
  workspaceId: string;
}, executor: DbExecutor = db) {
  const [flow] = await executor
    .insert(taskDevelopmentFlows)
    .values(input)
    .onConflictDoNothing({ target: taskDevelopmentFlows.taskId })
    .returning();
  return flow;
}

export async function updateTaskDevelopmentFlowInDb(input: {
  acceptanceCriteria?: string[];
  branchName?: string | null;
  ciStatus?: "not_configured" | "pending" | "passing" | "failing";
  id: string;
  implementationPlan?: string | null;
  planApprovedAt?: Date | null;
  planApprovedByUserId?: string | null;
  pullRequestUrl?: string | null;
  reviewApprovedAt?: Date | null;
  reviewApprovedByUserId?: string | null;
  state?: "idea" | "planning" | "approval" | "ready" | "in_progress" | "review" | "done";
  summary?: string | null;
  testInstructions?: string | null;
}, executor: DbExecutor = db) {
  const [flow] = await executor
    .update(taskDevelopmentFlows)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(taskDevelopmentFlows.id, input.id))
    .returning();
  return flow;
}

export async function listTaskDevelopmentFlowSessions(
  developmentFlowId: string,
  executor: DbExecutor = db,
) {
  return executor
    .select({
      agentName: taskDevelopmentFlowSessions.agentName,
      client: taskDevelopmentFlowSessions.client,
      createdAt: taskDevelopmentFlowSessions.createdAt,
      developmentFlowId: taskDevelopmentFlowSessions.developmentFlowId,
      endedAt: taskDevelopmentFlowSessions.endedAt,
      id: taskDevelopmentFlowSessions.id,
      startedAt: taskDevelopmentFlowSessions.startedAt,
      startedByUserId: taskDevelopmentFlowSessions.startedByUserId,
      status: taskDevelopmentFlowSessions.status,
      summary: taskDevelopmentFlowSessions.summary,
      updatedAt: taskDevelopmentFlowSessions.updatedAt,
      startedBy: {
        displayName: users.displayName,
        email: users.email,
        id: users.id,
      },
    })
    .from(taskDevelopmentFlowSessions)
    .innerJoin(users, eq(users.id, taskDevelopmentFlowSessions.startedByUserId))
    .where(eq(taskDevelopmentFlowSessions.developmentFlowId, developmentFlowId))
    .orderBy(desc(taskDevelopmentFlowSessions.startedAt));
}

export async function createTaskDevelopmentFlowSessionInDb(input: {
  agentName?: string;
  client: string;
  developmentFlowId: string;
  startedByUserId: string;
}, executor: DbExecutor = db) {
  const [session] = await executor
    .insert(taskDevelopmentFlowSessions)
    .values(input)
    .returning();
  return session;
}

export async function findTaskDevelopmentFlowSession(input: {
  developmentFlowId: string;
  sessionId: string;
}, executor: DbExecutor = db) {
  const [session] = await executor
    .select()
    .from(taskDevelopmentFlowSessions)
    .where(
      and(
        eq(taskDevelopmentFlowSessions.id, input.sessionId),
        eq(taskDevelopmentFlowSessions.developmentFlowId, input.developmentFlowId),
      ),
    )
    .limit(1);
  return session;
}

export async function updateTaskDevelopmentFlowSessionInDb(input: {
  endedAt?: Date | null;
  id: string;
  status?: "active" | "paused" | "completed" | "failed";
  summary?: string | null;
}, executor: DbExecutor = db) {
  const [session] = await executor
    .update(taskDevelopmentFlowSessions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(taskDevelopmentFlowSessions.id, input.id))
    .returning();
  return session;
}
