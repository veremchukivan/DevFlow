import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { taskTimeEntries } from "../../core/db/schema/task-time-entries.js";
import { users } from "../../core/db/schema/users.js";

type TaskScope = {
  projectId: string;
  taskId: string;
  workspaceId: string;
};

export async function listTaskTimeEntries(input: TaskScope) {
  return db
    .select({
      createdAt: taskTimeEntries.createdAt,
      description: taskTimeEntries.description,
      durationMinutes: taskTimeEntries.durationMinutes,
      id: taskTimeEntries.id,
      projectId: taskTimeEntries.projectId,
      startedAt: taskTimeEntries.startedAt,
      stoppedAt: taskTimeEntries.stoppedAt,
      taskId: taskTimeEntries.taskId,
      updatedAt: taskTimeEntries.updatedAt,
      userDisplayName: users.displayName,
      userId: taskTimeEntries.userId,
      workspaceId: taskTimeEntries.workspaceId,
    })
    .from(taskTimeEntries)
    .innerJoin(users, eq(users.id, taskTimeEntries.userId))
    .where(timeEntryConditions(input))
    .orderBy(desc(taskTimeEntries.startedAt), desc(taskTimeEntries.id));
}

export async function findActiveTimeEntryForUser(input: {
  userId: string;
  workspaceId: string;
}) {
  const [entry] = await db
    .select()
    .from(taskTimeEntries)
    .where(
      and(
        eq(taskTimeEntries.workspaceId, input.workspaceId),
        eq(taskTimeEntries.userId, input.userId),
        isNull(taskTimeEntries.stoppedAt),
      ),
    )
    .limit(1);
  return entry;
}

export async function createRunningTaskTimeEntry(input: TaskScope & { userId: string }) {
  const [entry] = await db
    .insert(taskTimeEntries)
    .values({ ...input, startedAt: new Date() })
    .returning();
  if (!entry) throw new Error("Failed to start task timer");
  return entry;
}

export async function createManualTaskTimeEntry(
  input: TaskScope & {
    description?: string;
    durationMinutes: number;
    startedAt: Date;
    userId: string;
  },
) {
  const [entry] = await db
    .insert(taskTimeEntries)
    .values({
      ...input,
      stoppedAt: new Date(input.startedAt.getTime() + input.durationMinutes * 60_000),
    })
    .returning();
  if (!entry) throw new Error("Failed to create task time entry");
  return entry;
}

export async function stopTaskTimeEntry(input: TaskScope & { entryId: string; userId: string }) {
  const [entry] = await db
    .select()
    .from(taskTimeEntries)
    .where(
      and(
        timeEntryConditions(input),
        eq(taskTimeEntries.id, input.entryId),
        eq(taskTimeEntries.userId, input.userId),
        isNull(taskTimeEntries.stoppedAt),
      ),
    )
    .limit(1);
  if (!entry) return undefined;

  const stoppedAt = new Date();
  const durationMinutes = Math.max(
    1,
    Math.ceil((stoppedAt.getTime() - entry.startedAt.getTime()) / 60_000),
  );
  const [stopped] = await db
    .update(taskTimeEntries)
    .set({ durationMinutes, stoppedAt, updatedAt: stoppedAt })
    .where(eq(taskTimeEntries.id, entry.id))
    .returning();
  return stopped;
}

function timeEntryConditions(input: TaskScope) {
  return and(
    eq(taskTimeEntries.workspaceId, input.workspaceId),
    eq(taskTimeEntries.projectId, input.projectId),
    eq(taskTimeEntries.taskId, input.taskId),
  );
}
