"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import {
  ApiClientError,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/shared/lib/api-client";
import type { NotificationPreferences } from "@devflow/shared";

import styles from "./workspace-settings-pages.module.css";

const preferences = [
  ["taskAssigned", "Task assignments", "When a task is assigned to you"],
  ["taskCommented", "Comments", "When someone comments on a task you follow"],
  ["taskStatusChanged", "Status changes", "When a watched task changes status"],
  ["taskDueToday", "Due today", "On the day a task assigned to you is due"],
  ["taskOverdue", "Overdue tasks", "When an assigned task passes its due date"],
  [
    "agreementOverdue",
    "Overdue agreements",
    "When an agreement you own or confirm is overdue",
  ],
] as const;

export function WorkspaceSettingsNotifications() {
  const [settings, setSettings] = useState<NotificationPreferences>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void getNotificationPreferences()
      .then(setSettings)
      .catch(() => setError("Unable to load notification preferences."));
  }, []);

  async function toggle(key: keyof NotificationPreferences) {
    if (!settings) return;
    const before = settings;
    const next = { ...before, [key]: !before[key] };
    setSettings(next);
    setError(undefined);
    try {
      setSettings(await updateNotificationPreferences({ [key]: next[key] }));
    } catch (caughtError) {
      setSettings(before);
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to save notification preference.",
      );
    }
  }

  return (
    <>
      <header className={styles.header}>
        <p>Workspace settings / Notifications</p>
        <h1>Notifications</h1>
        <span>
          Choose which workspace activity creates an in-app notification for
          you.
        </span>
      </header>
      <section className={styles.preferenceCard}>
        <div className={styles.preferenceHeading}>
          <BellRing size={23} />
          <div>
            <h2>Your notification preferences</h2>
            <p>
              These are personal settings: each workspace member chooses their
              own alerts.
            </p>
          </div>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        {settings ? (
          <div className={styles.preferenceList}>
            {preferences.map(([key, label, description]) => (
              <label key={key}>
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <input
                  checked={settings[key]}
                  onChange={() => void toggle(key)}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>Loading preferences…</p>
        )}
      </section>
    </>
  );
}
