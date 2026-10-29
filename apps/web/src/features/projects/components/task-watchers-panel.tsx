"use client";

import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  addTaskWatcher,
  ApiClientError,
  followTask,
  getCurrentUser,
  getTaskWatchers,
  getWorkspaceMembers,
  removeTaskWatcher,
  unfollowTask,
} from "@/shared/lib/api-client";
import type {
  Task,
  TaskWatcher,
  WorkspaceMember,
  WorkspaceRole,
} from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "./task-watchers-panel.module.css";

export function TaskWatchersPanel({
  role,
  task,
  workspaceId,
}: {
  role: WorkspaceRole | undefined;
  task: Task;
  workspaceId: string;
}) {
  const [watchers, setWatchers] = useState<TaskWatcher[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const canUpdateTask = role ? can(role, "task:update") : false;

  const loadWatchers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [watchersResponse, membersResponse, userResponse] =
        await Promise.all([
          getTaskWatchers(workspaceId, task.projectId, task.id),
          getWorkspaceMembers(workspaceId),
          getCurrentUser(),
        ]);
      setWatchers(watchersResponse.watchers);
      setIsWatching(watchersResponse.isWatching);
      setMembers(membersResponse.members);
      setCurrentUserId(userResponse.user.id);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to load watchers."));
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.projectId, workspaceId]);

  useEffect(() => {
    void loadWatchers();
  }, [loadWatchers]);

  function applyResponse(response: {
    isWatching: boolean;
    watchers: TaskWatcher[];
  }) {
    setIsWatching(response.isWatching);
    setWatchers(response.watchers);
  }

  async function onToggle() {
    setIsSaving(true);
    try {
      applyResponse(
        isWatching
          ? await unfollowTask(workspaceId, task.projectId, task.id)
          : await followTask(workspaceId, task.projectId, task.id),
      );
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update task watchers."));
    } finally {
      setIsSaving(false);
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = String(
      new FormData(event.currentTarget).get("userId") ?? "",
    );
    if (!userId) return;
    setIsSaving(true);
    try {
      applyResponse(
        await addTaskWatcher(workspaceId, task.projectId, task.id, userId),
      );
      event.currentTarget.reset();
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to add the watcher."));
    } finally {
      setIsSaving(false);
    }
  }

  async function onRemove(userId: string) {
    setIsSaving(true);
    try {
      applyResponse(
        await removeTaskWatcher(workspaceId, task.projectId, task.id, userId),
      );
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to remove the watcher."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        <span>{watchers.length} following</span>
        <button
          disabled={isSaving || isLoading}
          onClick={() => void onToggle()}
          type="button"
        >
          {isWatching ? (
            <EyeOff aria-hidden="true" size={15} />
          ) : (
            <Eye aria-hidden="true" size={15} />
          )}
          {isWatching ? "Stop watching" : "Watch task"}
        </button>
      </div>
      <p className={styles.hint}>
        Followers receive notifications for comments and status updates.
      </p>
      {canUpdateTask ? (
        <form
          className={styles.addForm}
          onSubmit={(event) => void onAdd(event)}
        >
          <select defaultValue="" name="userId">
            <option value="">Add participant…</option>
            {members
              .filter(
                (member) =>
                  !watchers.some((watcher) => watcher.userId === member.userId),
              )
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName}
                </option>
              ))}
          </select>
          <button disabled={isSaving || isLoading} type="submit">
            Add
          </button>
        </form>
      ) : null}
      {isLoading ? <p className={styles.hint}>Loading watchers…</p> : null}
      {!isLoading && watchers.length ? (
        <ul className={styles.list}>
          {watchers.map((watcher) => (
            <li key={watcher.userId}>
              <span>{initials(watcher.user.displayName)}</span>
              <strong>{watcher.user.displayName}</strong>
              {canUpdateTask && watcher.userId !== currentUserId ? (
                <button
                  aria-label={`Remove ${watcher.user.displayName}`}
                  disabled={isSaving}
                  onClick={() => void onRemove(watcher.userId)}
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}
