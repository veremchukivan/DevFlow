"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getNotifications,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/shared/lib/api-client";
import type {
  NotificationListResponse,
  NotificationPreferences,
} from "@devflow/shared";

import styles from "./notification-center.module.css";

export function NotificationCenter() {
  const router = useRouter();
  const [data, setData] = useState<NotificationListResponse>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>();

  useEffect(() => {
    setLoading(true);
    void getNotifications({ limit: 100, unreadOnly })
      .then(setData)
      .finally(() => setLoading(false));
  }, [unreadOnly]);

  useEffect(() => {
    void getNotificationPreferences().then(setPreferences);
  }, []);

  async function togglePreference(key: keyof NotificationPreferences) {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    try {
      setPreferences(await updateNotificationPreferences({ [key]: next[key] }));
    } catch {
      setPreferences(preferences);
    }
  }

  async function open(item: NotificationListResponse["notifications"][number]) {
    if (!item.readAt) await markNotificationRead(item.id);
    router.push(
      `/workspaces/${item.workspaceId}/projects/${item.projectId}/tasks/${item.taskId}`,
    );
  }

  async function readAll() {
    await markAllNotificationsRead();
    setData(
      (current) =>
        current && {
          ...current,
          unreadCount: 0,
          notifications: current.notifications.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
        },
    );
  }

  return (
    <main className={styles.page}>
      <header>
        <div>
          <p>Inbox</p>
          <h1>Notifications</h1>
        </div>
        {data?.unreadCount ? (
          <button onClick={() => void readAll()} type="button">
            <CheckCheck size={17} />
            Read all
          </button>
        ) : null}
      </header>
      <div className={styles.filters}>
        <button
          className={!unreadOnly ? styles.active : undefined}
          onClick={() => setUnreadOnly(false)}
          type="button"
        >
          All
        </button>
        <button
          className={unreadOnly ? styles.active : undefined}
          onClick={() => setUnreadOnly(true)}
          type="button"
        >
          Unread
        </button>
      </div>
      {preferences ? (
        <section
          className={styles.preferences}
          aria-labelledby="notification-preferences-title"
        >
          <h2 id="notification-preferences-title">Notification preferences</h2>
          <p>Choose which in-app alerts you receive.</p>
          {(
            [
              ["taskAssigned", "Task assignments"],
              ["taskCommented", "Comments"],
              ["taskStatusChanged", "Status changes"],
              ["taskDueToday", "Due today"],
              ["taskOverdue", "Overdue tasks"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                checked={preferences[key]}
                onChange={() => void togglePreference(key)}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </section>
      ) : null}
      {loading ? (
        <p className={styles.empty}>Loading notifications…</p>
      ) : data?.notifications.length ? (
        <ul>
          {data.notifications.map((item) => (
            <li key={item.id}>
              <button
                className={!item.readAt ? styles.unread : undefined}
                onClick={() => void open(item)}
                type="button"
              >
                <Bell size={17} />
                <span>
                  <strong>{message(item.type, item.actor?.displayName)}</strong>
                  <em>
                    {item.taskKey}: {item.taskTitle}
                  </em>
                  <time>{relativeTime(item.createdAt)}</time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          No {unreadOnly ? "unread " : ""}notifications yet.
        </p>
      )}
    </main>
  );
}

function message(
  type:
    | "task_assigned"
    | "task_commented"
    | "task_due_today"
    | "task_overdue"
    | "task_status_changed",
  actor?: string,
) {
  const name = actor ?? "A workspace member";
  return type === "task_commented"
    ? `${name} commented on a task`
    : type === "task_status_changed"
      ? `${name} changed a task status`
      : type === "task_due_today"
        ? "Task is due today"
        : type === "task_overdue"
          ? "Task is overdue"
          : `${name} assigned you a task`;
}
function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes} min ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} h ago`
        : `${Math.floor(minutes / 1440)} d ago`;
}
