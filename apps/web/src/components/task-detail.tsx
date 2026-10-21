"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  createTaskComment,
  getTask,
  getTaskActivity,
  getTaskComments,
} from "@/lib/api-client";
import type { Task, TaskActivityEvent, TaskComment } from "@devflow/shared";

import styles from "@/components/ui.module.css";

export function TaskDetail() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>();
  const router = useRouter();
  const [task, setTask] = useState<Task>();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [error, setError] = useState<string>();
  const [commentError, setCommentError] = useState<string>();
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    void Promise.all([
      getTask(params.workspaceId, params.projectId, params.taskId),
      getTaskComments(params.workspaceId, params.projectId, params.taskId),
      getTaskActivity(params.workspaceId, params.projectId, params.taskId),
    ])
      .then(([taskResponse, commentsResponse, activityResponse]) => {
        setTask(taskResponse.task);
        setComments(commentsResponse.comments);
        setActivity(activityResponse.events);
      })
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

  async function onCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError(undefined);
    setIsSubmittingComment(true);

    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");

    try {
      const response = await createTaskComment(
        params.workspaceId,
        params.projectId,
        params.taskId,
        { body },
      );
      const activityResponse = await getTaskActivity(
        params.workspaceId,
        params.projectId,
        params.taskId,
      );

      setComments((current) => [...current, response.comment]);
      setActivity(activityResponse.events);
      form.reset();
    } catch (caughtError) {
      setCommentError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add the comment.",
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }

  if (!task && !error) {
    return <main className={styles.loading}>Loading task</main>;
  }

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

          <section
            aria-labelledby="comments-title"
            className={styles.taskSection}
          >
            <div className={styles.sectionHeading}>
              <h2 id="comments-title">Comments</h2>
            </div>
            <form className={styles.taskForm} onSubmit={onCommentSubmit}>
              <label className={styles.taskDescriptionField}>
                <span className={styles.srOnly}>New comment</span>
                <textarea
                  maxLength={5000}
                  name="body"
                  placeholder="Add a comment"
                  required
                  rows={4}
                />
              </label>
              {commentError ? (
                <p className={styles.formError} role="alert">
                  {commentError}
                </p>
              ) : null}
              <div className={styles.formActions}>
                <button
                  className={styles.primaryButton}
                  disabled={isSubmittingComment}
                  type="submit"
                >
                  {isSubmittingComment ? "Adding" : "Add comment"}
                </button>
              </div>
            </form>
            {comments.length ? (
              <ol className={styles.commentList}>
                {comments.map((comment) => (
                  <li className={styles.comment} key={comment.id}>
                    <strong>
                      {comment.author?.displayName ?? "Former member"}
                    </strong>
                    <p>{comment.body}</p>
                    <time dateTime={comment.createdAt}>
                      {formatDateTime(comment.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyState}>No comments yet.</p>
            )}
          </section>

          <section
            aria-labelledby="activity-title"
            className={styles.taskSection}
          >
            <div className={styles.sectionHeading}>
              <h2 id="activity-title">Activity</h2>
            </div>
            {activity.length ? (
              <ol className={styles.activityList}>
                {activity.map((event) => (
                  <li key={event.id}>
                    <span>{describeActivity(event)}</span>
                    <time dateTime={event.createdAt}>
                      {formatDateTime(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyState}>No activity yet.</p>
            )}
          </section>
        </section>
      )}
    </main>
  );
}

function describeActivity(event: TaskActivityEvent) {
  const actor = event.actor?.displayName ?? "A former member";

  switch (event.eventType) {
    case "task_created":
      return `${actor} created this task`;
    case "task_updated":
      return `${actor} updated this task`;
    case "task_deleted":
      return `${actor} deleted this task`;
    case "task_comment_created":
      return `${actor} added a comment`;
    case "task_comment_updated":
      return `${actor} updated a comment`;
    case "task_comment_deleted":
      return `${actor} deleted a comment`;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
