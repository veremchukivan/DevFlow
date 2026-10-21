"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiClientError, getTask } from "@/lib/api-client";
import type { Task } from "@devflow/shared";
import styles from "@/components/ui.module.css";

export function TaskDetail() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>();
  const router = useRouter();
  const [task, setTask] = useState<Task>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getTask(params.workspaceId, params.projectId, params.taskId)
      .then((response) => setTask(response.task))
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        setError("Unable to load this task.");
      });
  }, [params.projectId, params.taskId, params.workspaceId, router]);

  if (!task && !error)
    return <main className={styles.loading}>Loading task</main>;

  return (
    <main className={styles.workspaceHome}>
      <Link
        className={styles.backLink}
        href={`/workspaces/${params.workspaceId}/projects/${params.projectId}`}
      >
        Back to project
      </Link>
      {error || !task ? (
        <p className={styles.formError}>{error ?? "Task not found."}</p>
      ) : (
        <section className={styles.taskDetail}>
          <p className={styles.eyebrow}>{task.key}</p>
          <h1>{task.title}</h1>
          <p className={styles.authSubtitle}>
            {task.description ?? "No description yet."}
          </p>
          <dl className={styles.taskFacts}>
            <div>
              <dt>Status</dt>
              <dd>{task.status.name}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{task.priority}</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{task.assignee?.displayName ?? "Unassigned"}</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
