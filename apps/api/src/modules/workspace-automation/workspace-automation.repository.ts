import { and, count, desc, eq, gte } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import {
  workspaceAutomationRules,
  workspaceAutomationRuns,
} from "../../core/db/schema/workspace-automation-rules.js";

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
