"use client";

import { Clock3, Play, Square } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  createManualTaskTimeEntry,
  getTaskTimeEntries,
  startTaskTimer,
  stopTaskTimer,
} from "@/shared/lib/api-client";
import type { Task, TaskTimeEntry, WorkspaceRole } from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "./task-time-tracking-panel.module.css";

type TimeSummary = {
  activeEntry: TaskTimeEntry | null;
  estimateMinutes: number | null;
  loggedMinutes: number;
  remainingMinutes: number | null;
};

export function TaskTimeTrackingPanel({
  role,
  task,
  workspaceId,
}: {
  role: WorkspaceRole | undefined;
  task: Task;
  workspaceId: string;
}) {
  const [entries, setEntries] = useState<TaskTimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeSummary>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const canUpdateTask = role ? can(role, "task:update") : false;

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getTaskTimeEntries(
        workspaceId,
        task.projectId,
        task.id,
      );
      setEntries(response.entries);
      setSummary(response.summary);
      setError(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to load time entries."));
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.projectId, workspaceId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function onTimerToggle() {
    setIsSaving(true);
    try {
      if (summary?.activeEntry) {
        await stopTaskTimer(
          workspaceId,
          task.projectId,
          task.id,
          summary.activeEntry.id,
        );
      } else {
        await startTaskTimer(workspaceId, task.projectId, task.id);
      }
      await loadEntries();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update the timer."));
    } finally {
      setIsSaving(false);
    }
  }

  async function onLogTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const durationMinutes = Number(form.get("durationMinutes"));
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return;

    setIsSaving(true);
    try {
      await createManualTaskTimeEntry(workspaceId, task.projectId, task.id, {
        description: String(form.get("description") ?? "").trim() || undefined,
        durationMinutes,
        startedAt: new Date().toISOString(),
      });
      event.currentTarget.reset();
      await loadEntries();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to log time."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <span>Planned</span>
          <strong>
            {summary?.estimateMinutes == null
              ? "—"
              : formatDuration(summary.estimateMinutes)}
          </strong>
        </div>
        <div>
          <span>Logged</span>
          <strong>{formatDuration(summary?.loggedMinutes ?? 0)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>
            {summary?.remainingMinutes == null
              ? "—"
              : formatDuration(summary.remainingMinutes)}
          </strong>
        </div>
      </div>
      {canUpdateTask ? (
        <button
          className={styles.timer}
          disabled={isLoading || isSaving}
          onClick={() => void onTimerToggle()}
          type="button"
        >
          {summary?.activeEntry ? (
            <Square aria-hidden="true" size={15} />
          ) : (
            <Play aria-hidden="true" size={15} />
          )}
          {summary?.activeEntry ? "Stop timer" : "Start timer"}
        </button>
      ) : null}
      {summary?.activeEntry ? (
        <p className={styles.active}>
          <Clock3 aria-hidden="true" size={14} /> Timer is running for you.
        </p>
      ) : null}
      {canUpdateTask ? (
        <form
          className={styles.form}
          onSubmit={(event) => void onLogTime(event)}
        >
          <input
            aria-label="Minutes"
            defaultValue={30}
            min={1}
            name="durationMinutes"
            required
            type="number"
          />
          <input
            aria-label="Work note"
            maxLength={1000}
            name="description"
            placeholder="What did you work on?"
          />
          <button disabled={isSaving} type="submit">
            Log
          </button>
        </form>
      ) : null}
      {isLoading ? <p className={styles.hint}>Loading time entries…</p> : null}
      {entries.length ? (
        <ul className={styles.entries}>
          {entries.slice(0, 3).map((entry) => (
            <li key={entry.id}>
              <span>{entry.user.displayName}</span>
              <span>{entry.description || "Time entry"}</span>
              <strong>{formatDuration(entry.durationMinutes)}</strong>
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}
