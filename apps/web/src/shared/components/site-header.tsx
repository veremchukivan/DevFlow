"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, Plus } from "lucide-react";
import Link from "next/link";

import {
  getApiAssetUrl,
  getNotifications,
  logout,
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
  const notificationsRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <div className={styles.mobileBrand}>DevFlow</div>
        <div className={styles.breadcrumb}>
          {pathname === "/dashboard"
            ? "Dashboard"
            : pathname === "/workspaces"
              ? "Workspaces"
              : "Project workspace"}
        </div>
        <div className={styles.userMenu}>
          <Link className={styles.createButton} href="/workspaces">
            <Plus aria-hidden="true" size={18} strokeWidth={2} />
            Create
          </Link>
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
                    <span>{notifications.unreadCount} new</span>
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
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No notifications yet.</p>
                )}
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
