"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, Plus } from "lucide-react";
import Link from "next/link";

import {
  getApiAssetUrl,
  getNotifications,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/shared/lib/api-client";
import type { AuthUser, NotificationListResponse } from "@devflow/shared";

import styles from "./site-header.module.css";

export function SiteHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationListResponse>();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1];

  const refreshNotifications = useCallback(async () => {
    try {
      setNotifications(await getNotifications());
    } catch {
      // A temporary network failure must not disrupt the rest of the header.
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [pathname, refreshNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshNotifications();
      }
    }, 30_000);
    const onFocus = () => void refreshNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function openNotification(
    notification: NotificationListResponse["notifications"][number],
  ) {
    if (!notification.readAt) {
      await markNotificationRead(notification.id).catch(() => undefined);
      setNotifications((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((item) =>
                item.id === notification.id
                  ? { ...item, readAt: new Date().toISOString() }
                  : item,
              ),
              unreadCount: Math.max(0, current.unreadCount - 1),
            }
          : current,
      );
    }
    setIsNotificationsOpen(false);
    router.push(
      `/workspaces/${notification.workspaceId}/projects/${notification.projectId}/tasks/${notification.taskId}`,
    );
  }

  async function signOut() {
    setIsSigningOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  async function markAllRead() {
    if (!notifications?.unreadCount) return;
    setIsMarkingAllRead(true);
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((notification) => ({
                ...notification,
                readAt: notification.readAt ?? new Date().toISOString(),
              })),
              unreadCount: 0,
            }
          : current,
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <div className={styles.mobileBrand}>DevFlow</div>
        <div className={styles.breadcrumb}>
          {pathname === "/profile"
            ? "Profile settings"
            : pathname === "/workspaces"
              ? "Opening workspace"
              : "Project workspace"}
        </div>
        <div className={styles.userMenu}>
          {workspaceId ? (
            <Link
              className={styles.createButton}
              href={`/workspaces/${workspaceId}?newProject=1`}
            >
              <Plus aria-hidden="true" size={18} strokeWidth={2} />
              New project
            </Link>
          ) : null}
          <div className={styles.notifications} ref={notificationsRef}>
            <button
              aria-expanded={isNotificationsOpen}
              aria-label="Notifications"
              className={styles.notificationButton}
              onClick={() => setIsNotificationsOpen((open) => !open)}
              title="Notifications"
              type="button"
            >
              <Bell aria-hidden="true" size={18} strokeWidth={1.8} />
              {notifications?.unreadCount ? (
                <span className={styles.notificationCount}>
                  {notifications.unreadCount > 9
                    ? "9+"
                    : notifications.unreadCount}
                </span>
              ) : null}
            </button>
            {isNotificationsOpen ? (
              <section
                className={styles.notificationPanel}
                aria-label="Notifications"
              >
                <div className={styles.notificationHeading}>
                  <strong>Notifications</strong>
                  {notifications?.unreadCount ? (
                    <div className={styles.notificationActions}>
                      <span>{notifications.unreadCount} new</span>
                      <button
                        disabled={isMarkingAllRead}
                        onClick={() => void markAllRead()}
                        type="button"
                      >
                        {isMarkingAllRead ? "Reading…" : "Read all"}
                      </button>
                    </div>
                  ) : null}
                </div>
                {notifications?.notifications.length ? (
                  <ul>
                    {notifications.notifications.map((notification) => (
                      <li key={notification.id}>
                        <button
                          className={
                            notification.readAt
                              ? undefined
                              : styles.unreadNotification
                          }
                          onClick={() => void openNotification(notification)}
                          type="button"
                        >
                          <strong>
                            {notificationMessage(
                              notification.type,
                              notification.actor?.displayName,
                            )}
                          </strong>
                          <span>
                            {notification.taskKey}: {notification.taskTitle}
                          </span>
                          <time dateTime={notification.createdAt}>
                            {formatRelativeTime(notification.createdAt)}
                          </time>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No notifications yet.</p>
                )}
                <Link
                  className={styles.allNotificationsLink}
                  href="/notifications"
                >
                  View all notifications
                </Link>
              </section>
            ) : null}
          </div>
          <Link
            aria-label="Profile settings"
            className={styles.userAvatar}
            href="/profile"
            title="Profile settings"
          >
            {user.avatarUrl ? (
              <img alt="" src={getApiAssetUrl(user.avatarUrl) ?? undefined} />
            ) : (
              user.displayName.slice(0, 2).toUpperCase()
            )}
          </Link>
          <button
            aria-label="Sign out"
            className={styles.signOut}
            disabled={isSigningOut}
            onClick={signOut}
            title="Sign out"
            type="button"
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}

function notificationMessage(
  type: "task_assigned" | "task_commented" | "task_status_changed",
  actorName: string | undefined,
) {
  const actor = actorName ?? "A workspace member";
  if (type === "task_commented") return `${actor} commented on a task`;
  if (type === "task_status_changed") return `${actor} changed a task status`;
  return `${actor} assigned you a task`;
}

function formatRelativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
