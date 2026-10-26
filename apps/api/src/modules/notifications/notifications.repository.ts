import { and, count, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../core/db/client.js";
import { notifications } from "../../core/db/schema/notifications.js";
import { users } from "../../core/db/schema/users.js";

const actorUsers = alias(users, "notification_actor_users");

export async function createNotification(input: {
  actorUserId: string;
  projectId: string;
  recipientUserId: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  type: "task_assigned" | "task_commented" | "task_status_changed";
  workspaceId: string;
}) {
  await db.insert(notifications).values(input);
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
