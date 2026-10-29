import type { PaginationQuery } from "@devflow/shared";

import { AppError } from "../../core/errors/app-error.js";
import { buildPageInfo } from "../../core/pagination.js";
import {
  createNotification,
  findDeadlineNotificationCandidates,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getNotificationPreferences as getNotificationPreferencesFromDb,
  updateNotificationPreferences as updateNotificationPreferencesInDb,
} from "./notifications.repository.js";

const preferenceByType = {
  task_assigned: "taskAssigned", task_commented: "taskCommented", task_due_today: "taskDueToday", task_overdue: "taskOverdue", task_status_changed: "taskStatusChanged",
} as const;

async function createPreferredNotification(input: Parameters<typeof createNotification>[0]) {
  if (input.type === "workspace_invited") return createNotification(input);
  const preferences = await getNotificationPreferencesFromDb(input.recipientUserId);
  if (!preferences[preferenceByType[input.type]]) return;
  return createNotification(input);
}

export async function getNotificationPreferences(userId: string) { return getNotificationPreferencesFromDb(userId); }
export async function updateNotificationPreferences(input: { userId: string; taskAssigned?: boolean; taskCommented?: boolean; taskDueToday?: boolean; taskOverdue?: boolean; taskStatusChanged?: boolean }) { return updateNotificationPreferencesInDb(input); }

export async function notifyWorkspaceInvited(input: { actorUserId: string; invitationId: string; recipientUserId: string | null; workspaceId: string }) {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId) return;
  const recipientUserId = input.recipientUserId;
  await createNotification({ actorUserId: input.actorUserId, invitationId: input.invitationId, recipientUserId, type: "workspace_invited", taskTitle: "You were invited to a workspace", workspaceId: input.workspaceId });
}

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
  await createPreferredNotification({
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
  await createPreferredNotification({
    ...input,
    recipientUserId: input.recipientUserId,
    type: "task_commented",
  });
}

export async function notifyTaskWatchers(input: {
  actorUserId: string;
  projectId: string;
  recipientUserIds: Array<string | null>;
  statusName?: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  type: "task_commented" | "task_status_changed";
  workspaceId: string;
}) {
  const recipients = [...new Set(input.recipientUserIds.filter((id): id is string => Boolean(id)))].filter(
    (recipientUserId) => recipientUserId !== input.actorUserId,
  );
  await Promise.all(
    recipients.map((recipientUserId) =>
      createPreferredNotification({
        actorUserId: input.actorUserId,
        projectId: input.projectId,
        recipientUserId,
        taskId: input.taskId,
        taskKey: input.taskKey,
        taskTitle:
          input.type === "task_status_changed" && input.statusName
            ? `${input.taskTitle} · ${input.statusName}`
            : input.taskTitle,
        type: input.type,
        workspaceId: input.workspaceId,
      }),
    ),
  );
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
  await createPreferredNotification({
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

export async function sendDeadlineNotifications(
  today = new Date().toISOString().slice(0, 10),
) {
  const candidates = await findDeadlineNotificationCandidates();
  let sent = 0;

  for (const task of candidates) {
    if (!task.assigneeUserId || !task.dueDate || task.dueDate > today) continue;

    const type = task.dueDate === today ? "task_due_today" : "task_overdue";
    const notification = await createPreferredNotification({
      actorUserId: null,
      dedupeKey: `deadline:${type}:${task.dueDate}:${task.taskId}`,
      projectId: task.projectId,
      recipientUserId: task.assigneeUserId,
      taskId: task.taskId,
      taskKey: `${task.projectKey}-${task.taskNumber}`,
      taskTitle: task.taskTitle,
      type,
      workspaceId: task.workspaceId,
    });
    if (notification) sent += 1;
  }

  return sent;
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

export async function readAllNotifications(input: { userId: string }) {
  await markAllNotificationsRead({ recipientUserId: input.userId });
}
