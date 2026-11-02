import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import { type DbExecutor, db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import {
  workspaceCallAttendees,
  workspaceCalls,
} from "../../core/db/schema/workspace-calls.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

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

export async function findProjectInWorkspace(input: {
  projectId: string;
  workspaceId: string;
}) {
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

export async function listCalls(input: {
  from?: Date;
  status?: "scheduled" | "completed" | "cancelled";
  to?: Date;
  workspaceId: string;
}) {
  const conditions = [eq(workspaceCalls.workspaceId, input.workspaceId)];
  if (input.from) conditions.push(gte(workspaceCalls.startsAt, input.from));
  if (input.to) conditions.push(lte(workspaceCalls.startsAt, input.to));
  if (input.status) conditions.push(eq(workspaceCalls.status, input.status));

  const calls = await callSelect()
    .where(and(...conditions))
    .orderBy(asc(workspaceCalls.startsAt), asc(workspaceCalls.id));
  return hydrateCalls(calls);
}

export async function findCall(input: { callId: string; workspaceId: string }) {
  const [call] = await callSelect()
    .where(
      and(
        eq(workspaceCalls.id, input.callId),
        eq(workspaceCalls.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!call) return undefined;
  return (await hydrateCalls([call]))[0];
}

export async function createCall(
  input: {
    attendeeUserIds: string[];
    createdByUserId: string;
    description?: string | null;
    endsAt: Date;
    location?: string | null;
    meetingUrl?: string | null;
    projectId?: string | null;
    startsAt: Date;
    status?: "scheduled" | "completed" | "cancelled";
    timezone?: string;
    title: string;
    workspaceId: string;
  },
  executor: DbExecutor = db,
) {
  const [call] = await executor
    .insert(workspaceCalls)
    .values({
      createdByUserId: input.createdByUserId,
      description: input.description ?? null,
      endsAt: input.endsAt,
      location: input.location ?? null,
      meetingUrl: input.meetingUrl ?? null,
      projectId: input.projectId ?? null,
      startsAt: input.startsAt,
      status: input.status ?? "scheduled",
      timezone: input.timezone ?? "UTC",
      title: input.title,
      workspaceId: input.workspaceId,
    })
    .returning({ id: workspaceCalls.id });
  if (!call) throw new Error("Failed to create workspace call");

  await replaceCallAttendees(
    {
      attendeeUserIds: input.attendeeUserIds,
      callId: call.id,
      workspaceId: input.workspaceId,
    },
    executor,
  );
  return call.id;
}

export async function updateCall(
  input: {
    attendeeUserIds?: string[];
    callId: string;
    description?: string | null;
    endsAt?: Date;
    location?: string | null;
    meetingUrl?: string | null;
    projectId?: string | null;
    startsAt?: Date;
    status?: "scheduled" | "completed" | "cancelled";
    timezone?: string;
    title?: string;
    workspaceId: string;
  },
  executor: DbExecutor = db,
) {
  const [call] = await executor
    .update(workspaceCalls)
    .set({
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.meetingUrl !== undefined ? { meetingUrl: input.meetingUrl } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.title ? { title: input.title } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceCalls.id, input.callId),
        eq(workspaceCalls.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: workspaceCalls.id });
  if (!call) return undefined;

  if (input.attendeeUserIds !== undefined) {
    await replaceCallAttendees(
      {
        attendeeUserIds: input.attendeeUserIds,
        callId: input.callId,
        workspaceId: input.workspaceId,
      },
      executor,
    );
  }
  return call.id;
}

export async function removeCall(input: { callId: string; workspaceId: string }) {
  const [call] = await db
    .delete(workspaceCalls)
    .where(
      and(
        eq(workspaceCalls.id, input.callId),
        eq(workspaceCalls.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: workspaceCalls.id });
  return call;
}

export async function updateAttendeeResponse(input: {
  callId: string;
  responseStatus: "invited" | "accepted" | "declined";
  userId: string;
  workspaceId: string;
}) {
  const [attendee] = await db
    .update(workspaceCallAttendees)
    .set({ responseStatus: input.responseStatus, updatedAt: new Date() })
    .where(
      and(
        eq(workspaceCallAttendees.callId, input.callId),
        eq(workspaceCallAttendees.workspaceId, input.workspaceId),
        eq(workspaceCallAttendees.userId, input.userId),
      ),
    )
    .returning({ callId: workspaceCallAttendees.callId });
  return attendee;
}

export async function findActiveWorkspaceMemberIds(input: {
  userIds: string[];
  workspaceId: string;
}) {
  if (!input.userIds.length) return [];
  return db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        inArray(workspaceMembers.userId, input.userIds),
      ),
    );
}

async function replaceCallAttendees(
  input: { attendeeUserIds: string[]; callId: string; workspaceId: string },
  executor: DbExecutor,
) {
  await executor
    .delete(workspaceCallAttendees)
    .where(
      and(
        eq(workspaceCallAttendees.callId, input.callId),
        eq(workspaceCallAttendees.workspaceId, input.workspaceId),
      ),
    );
  if (!input.attendeeUserIds.length) return;
  await executor.insert(workspaceCallAttendees).values(
    input.attendeeUserIds.map((userId) => ({
      callId: input.callId,
      userId,
      workspaceId: input.workspaceId,
    })),
  );
}

function callSelect() {
  return db.select({
    createdAt: workspaceCalls.createdAt,
    createdByUserId: workspaceCalls.createdByUserId,
    description: workspaceCalls.description,
    endsAt: workspaceCalls.endsAt,
    id: workspaceCalls.id,
    location: workspaceCalls.location,
    meetingUrl: workspaceCalls.meetingUrl,
    projectId: workspaceCalls.projectId,
    startsAt: workspaceCalls.startsAt,
    status: workspaceCalls.status,
    timezone: workspaceCalls.timezone,
    title: workspaceCalls.title,
    updatedAt: workspaceCalls.updatedAt,
    workspaceId: workspaceCalls.workspaceId,
  }).from(workspaceCalls);
}

async function hydrateCalls<T extends { id: string; workspaceId: string }>(
  calls: T[],
) {
  if (!calls.length) return [] as Array<T & { attendees: Awaited<ReturnType<typeof listAttendees>> }>;
  const attendees = await listAttendees({
    callIds: calls.map((call) => call.id),
    workspaceId: calls[0]!.workspaceId,
  });
  const byCallId = new Map<string, typeof attendees>();
  for (const attendee of attendees) {
    const current = byCallId.get(attendee.callId) ?? [];
    current.push(attendee);
    byCallId.set(attendee.callId, current);
  }
  return calls.map((call) => ({ ...call, attendees: byCallId.get(call.id) ?? [] }));
}

async function listAttendees(input: { callIds: string[]; workspaceId: string }) {
  if (!input.callIds.length) return [] as Array<{
    callId: string;
    responseStatus: "invited" | "accepted" | "declined";
    user: { displayName: string; id: string };
    userId: string;
  }>;
  return db
    .select({
      callId: workspaceCallAttendees.callId,
      responseStatus: workspaceCallAttendees.responseStatus,
      user: { displayName: users.displayName, id: users.id },
      userId: workspaceCallAttendees.userId,
    })
    .from(workspaceCallAttendees)
    .innerJoin(users, eq(users.id, workspaceCallAttendees.userId))
    .where(
      and(
        eq(workspaceCallAttendees.workspaceId, input.workspaceId),
        inArray(workspaceCallAttendees.callId, input.callIds),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.displayName), asc(users.id));
}
