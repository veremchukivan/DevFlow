"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, Plus, Search, X } from "lucide-react";
import Link from "next/link";

import {
  getApiAssetUrl,
  getNotifications,
  getProjects,
  getTasks,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/shared/lib/api-client";
import type {
  AuthUser,
  NotificationListResponse,
  ProjectSummary,
  Task,
} from "@devflow/shared";

import styles from "./site-header.module.css";

type SearchResult = { project: ProjectSummary; task: Task };

export function SiteHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationListResponse>();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (!workspaceId) return;
        event.preventDefault();
        setIsSearchOpen(true);
      }
      if (event.key === "Escape") setIsSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workspaceId]);

  useEffect(() => {
    if (!isSearchOpen) return;
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || !workspaceId || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      void getProjects(workspaceId)
        .then(async ({ projects }) => {
          const results = await Promise.all(
            projects.map(async (project) => {
              const response = await getTasks(workspaceId, project.id, {
                limit: 8,
                search: searchQuery.trim(),
              });
              return response.tasks.map((task) => ({ project, task }));
            }),
          );
          if (active) setSearchResults(results.flat().slice(0, 20));
        })
        .catch(() => {
          if (active) setSearchResults([]);
        })
        .finally(() => {
          if (active) setIsSearching(false);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, searchQuery, workspaceId]);

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

  function openSearchResult(result: SearchResult) {
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(
      `/workspaces/${result.project.workspaceId}/projects/${result.project.id}/tasks/${result.task.id}`,
    );
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
            <button
              className={styles.searchButton}
              onClick={() => setIsSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" size={17} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>
          ) : null}
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
      {isSearchOpen ? (
        <div
          className={styles.searchOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsSearchOpen(false);
          }}
          role="presentation"
        >
          <section
            aria-label="Search workspace tasks"
            className={styles.searchDialog}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.searchInputWrap}>
              <Search aria-hidden="true" size={19} />
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks in this workspace…"
                ref={searchInputRef}
                value={searchQuery}
              />
              <button
                aria-label="Close search"
                onClick={() => setIsSearchOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className={styles.searchResults}>
              {searchQuery.trim().length < 2 ? (
                <p>Enter at least two characters to search tasks.</p>
              ) : isSearching ? (
                <p>Searching…</p>
              ) : searchResults.length ? (
                <ul>
                  {searchResults.map(({ project, task }) => (
                    <li key={task.id}>
                      <button
                        onClick={() => openSearchResult({ project, task })}
                        type="button"
                      >
                        <span>{project.name}</span>
                        <strong>
                          {task.key}: {task.title}
                        </strong>
                        <em>{task.status.name}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No tasks found.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </header>
  );
}

function notificationMessage(
  type:
    | "task_assigned"
    | "task_commented"
    | "task_due_today"
    | "task_overdue"
    | "task_status_changed",
  actorName: string | undefined,
) {
  const actor = actorName ?? "A workspace member";
  if (type === "task_commented") return `${actor} commented on a task`;
  if (type === "task_status_changed") return `${actor} changed a task status`;
  if (type === "task_due_today") return "Task is due today";
  if (type === "task_overdue") return "Task is overdue";
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
