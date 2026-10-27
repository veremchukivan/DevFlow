import { and, count, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../core/db/client.js";
import { notifications } from "../../core/db/schema/notifications.js";
import { notificationPreferences } from "../../core/db/schema/notification-preferences.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { projects } from "../../core/db/schema/projects.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";

const actorUsers = alias(users, "notification_actor_users");

export async function getNotificationPreferences(userId: string) {
  await db.insert(notificationPreferences).values({ userId }).onConflictDoNothing();
  const [preferences] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  return preferences!;
}

export async function updateNotificationPreferences(input: { userId: string; taskAssigned?: boolean; taskCommented?: boolean; taskDueToday?: boolean; taskOverdue?: boolean; taskStatusChanged?: boolean }) {
  await db.insert(notificationPreferences).values({ userId: input.userId }).onConflictDoNothing();
  const [preferences] = await db.update(notificationPreferences).set({ ...input, updatedAt: new Date() }).where(eq(notificationPreferences.userId, input.userId)).returning();
  return preferences!;
}

export async function createNotification(input: {
  actorUserId: string | null;
  dedupeKey?: string;
  projectId?: string;
  recipientUserId: string;
  taskId?: string;
  invitationId?: string;
  taskKey?: string;
  taskTitle?: string;
  type:
    | "task_assigned"
    | "task_commented"
    | "task_due_today"
    | "task_overdue"
    | "task_status_changed" | "workspace_invited";
  workspaceId: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values(input)
    .onConflictDoNothing({
      target: [notifications.recipientUserId, notifications.dedupeKey],
    })
    .returning({ id: notifications.id });
  return notification;
}

export async function findDeadlineNotificationCandidates() {
  return db
    .select({
      assigneeUserId: tasks.assigneeUserId,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
      projectKey: projects.key,
      taskId: tasks.id,
      taskNumber: tasks.number,
      taskTitle: tasks.title,
      workspaceId: tasks.workspaceId,
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId),
      ),
    )
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
        isNotNull(tasks.assigneeUserId),
        isNotNull(tasks.dueDate),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
        ne(projectStatuses.category, "done"),
      ),
    );
}

export async function listNotifications(input: {
  limit: number;
  offset: number;
  recipientUserId: string;
  unreadOnly?: boolean;
}) {
  const conditions = [eq(notifications.recipientUserId, input.recipientUserId)];
  if (input.unreadOnly) conditions.push(isNull(notifications.readAt));
  const where = and(...conditions);
  const [totalRow, unreadRow, rows] = await Promise.all([
    db.select({ total: count() }).from(notifications).where(where),
    db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, input.recipientUserId),
          isNull(notifications.readAt),
        ),
      ),
    db
      .select({
        actor: { displayName: actorUsers.displayName, id: actorUsers.id },
        actorUserId: notifications.actorUserId,
        createdAt: notifications.createdAt,
        id: notifications.id,
        invitationId: notifications.invitationId,
        projectId: notifications.projectId,
        readAt: notifications.readAt,
        taskId: notifications.taskId,
        taskKey: notifications.taskKey,
        taskTitle: notifications.taskTitle,
        type: notifications.type,
        workspaceId: notifications.workspaceId,
      })
      .from(notifications)
      .leftJoin(actorUsers, eq(actorUsers.id, notifications.actorUserId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit)
      .offset(input.offset),
  ]);
  return {
    rows,
    total: totalRow[0]?.total ?? 0,
    unreadCount: unreadRow[0]?.total ?? 0,
  };
}

export async function markNotificationRead(input: {
  notificationId: string;
  recipientUserId: string;
}) {
  const [notification] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, input.notificationId),
        eq(notifications.recipientUserId, input.recipientUserId),
      ),
    )
    .returning({ id: notifications.id });
  return notification;
}

export async function markAllNotificationsRead(input: {
  recipientUserId: string;
}) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, input.recipientUserId),
        isNull(notifications.readAt),
      ),
    );
}
