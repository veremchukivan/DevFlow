import type { PaginationQuery } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from "./notifications.repository.js";

export async function notifyTaskAssigned(input: {
  actorUserId: string;
  projectId: string;
  recipientUserId: string | null;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  workspaceId: string;
}) {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId)
    return;
  await createNotification({
    ...input,
    recipientUserId: input.recipientUserId,
    type: "task_assigned",
  });
}

export async function notifyTaskCommented(input: {
  actorUserId: string;
  projectId: string;
  recipientUserId: string | null;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  workspaceId: string;
}) {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId)
    return;
  await createNotification({
    ...input,
    recipientUserId: input.recipientUserId,
    type: "task_commented",
  });
}

export async function notifyTaskStatusChanged(input: {
  actorUserId: string;
  projectId: string;
  recipientUserId: string | null;
  statusName: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  workspaceId: string;
}) {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId)
    return;
  await createNotification({
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    recipientUserId: input.recipientUserId,
    taskId: input.taskId,
    taskKey: input.taskKey,
    taskTitle: `${input.taskTitle} · ${input.statusName}`,
    type: "task_status_changed",
    workspaceId: input.workspaceId,
  });
}

export async function getNotifications(input: {
  pagination: PaginationQuery & { unreadOnly?: boolean };
  userId: string;
}) {
  const result = await listNotifications({
    limit: input.pagination.limit,
    offset: input.pagination.offset,
    recipientUserId: input.userId,
    unreadOnly: input.pagination.unreadOnly,
  });
  return {
    notifications: result.rows,
    pageInfo: buildPageInfo({ ...input.pagination, total: result.total }),
    unreadCount: result.unreadCount,
  };
}

export async function readNotification(input: {
  notificationId: string;
  userId: string;
}) {
  if (
    !(await markNotificationRead({
      notificationId: input.notificationId,
      recipientUserId: input.userId,
    }))
  ) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
}
