"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  createTaskComment,
  deleteTaskComment,
  getCurrentUser,
  getTask,
  getTaskActivity,
  getTaskComments,
  getWorkspaceMembers,
  updateTask,
  updateTaskComment,
} from "@/lib/api-client";
import type {
  Task,
  TaskActivityEvent,
  TaskComment,
  TaskPriority,
  WorkspaceMember,
} from "@devflow/shared";

import styles from "@/components/ui.module.css";

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskDetail() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>();
  const router = useRouter();
  const [task, setTask] = useState<Task>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [error, setError] = useState<string>();
  const [commentError, setCommentError] = useState<string>();
  const [editError, setEditError] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [isSavingCommentId, setIsSavingCommentId] = useState<string>();

  const loadTaskDetails = useCallback(async () => {
    try {
      const [
        taskResponse,
        membersResponse,
        commentsResponse,
        activityResponse,
        currentUserResponse,
      ] = await Promise.all([
        getTask(params.workspaceId, params.projectId, params.taskId),
        getWorkspaceMembers(params.workspaceId),
        getTaskComments(params.workspaceId, params.projectId, params.taskId),
        getTaskActivity(params.workspaceId, params.projectId, params.taskId),
        getCurrentUser(),
      ]);

      setTask(taskResponse.task);
      setMembers(
        membersResponse.members.filter((member) => member.status === "active"),
      );
      setComments(commentsResponse.comments);
      setActivity(activityResponse.events);
      setCurrentUserId(currentUserResponse.user.id);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "UNAUTHENTICATED"
      ) {
        router.replace("/login");
        return;
      }
      setError("Unable to load this task.");
    }
  }, [params.projectId, params.taskId, params.workspaceId, router]);

  useEffect(() => {
    void loadTaskDetails();
  }, [loadTaskDetails]);

  async function onTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    setEditError(undefined);
    setIsSavingTask(true);
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    const assigneeUserId = String(form.get("assigneeUserId") ?? "");

    try {
      const response = await updateTask(
        params.workspaceId,
        params.projectId,
        params.taskId,
        {
          assigneeUserId: assigneeUserId || null,
          description: description || null,
          priority: form.get("priority") as TaskPriority,
          title: String(form.get("title") ?? ""),
        },
        task.version,
      );
      const activityResponse = await getTaskActivity(
        params.workspaceId,
        params.projectId,
        params.taskId,
      );

      setTask(response.task);
      setActivity(activityResponse.events);
      setIsEditing(false);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "TASK_VERSION_CONFLICT"
      ) {
        await loadTaskDetails();
        setEditError("This task changed elsewhere. Review the latest version.");
        return;
      }

      setEditError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the task.",
      );
    } finally {
      setIsSavingTask(false);
    }
  }

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

  async function onCommentUpdate(
    event: FormEvent<HTMLFormElement>,
    commentId: string,
  ) {
    event.preventDefault();
    setCommentError(undefined);
    setIsSavingCommentId(commentId);
    const body = String(new FormData(event.currentTarget).get("body") ?? "");

    try {
      const response = await updateTaskComment(
        params.workspaceId,
        params.projectId,
        params.taskId,
        commentId,
        { body },
      );
      const activityResponse = await getTaskActivity(
        params.workspaceId,
        params.projectId,
        params.taskId,
      );

      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? response.comment : comment,
        ),
      );
      setActivity(activityResponse.events);
      setEditingCommentId(undefined);
    } catch (caughtError) {
      setCommentError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the comment.",
      );
    } finally {
      setIsSavingCommentId(undefined);
    }
  }

  async function onCommentDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) {
      return;
    }

    setCommentError(undefined);
    setIsSavingCommentId(commentId);

    try {
      await deleteTaskComment(
        params.workspaceId,
        params.projectId,
        params.taskId,
        commentId,
      );
      const activityResponse = await getTaskActivity(
        params.workspaceId,
        params.projectId,
        params.taskId,
      );

      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
      setActivity(activityResponse.events);
    } catch (caughtError) {
      setCommentError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete the comment.",
      );
    } finally {
      setIsSavingCommentId(undefined);
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
          <div className={styles.taskDetailHeading}>
            <p className={styles.eyebrow}>{task.key}</p>
            {!isEditing ? (
              <button
                aria-label="Edit task"
                className={styles.iconButton}
                onClick={() => setIsEditing(true)}
                title="Edit task"
                type="button"
              >
                <Pencil aria-hidden="true" size={17} strokeWidth={1.8} />
              </button>
            ) : null}
          </div>

          {isEditing ? (
            <form className={styles.taskEditForm} onSubmit={onTaskSubmit}>
              <label>
                <span>Title</span>
                <input
                  defaultValue={task.title}
                  maxLength={200}
                  minLength={2}
                  name="title"
                  required
                />
              </label>
              <label className={styles.taskEditDescription}>
                <span>Description</span>
                <textarea
                  defaultValue={task.description ?? ""}
                  maxLength={10000}
                  name="description"
                  rows={5}
                />
              </label>
              <label>
                <span>Priority</span>
                <select defaultValue={task.priority} name="priority">
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignee</span>
                <select
                  defaultValue={task.assigneeUserId ?? ""}
                  name="assigneeUserId"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {editError ? (
                <p className={styles.formError} role="alert">
                  {editError}
                </p>
              ) : null}
              <div className={styles.formActions}>
                <button
                  className={styles.primaryButton}
                  disabled={isSavingTask}
                  type="submit"
                >
                  {isSavingTask ? "Saving" : "Save changes"}
                </button>
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setEditError(undefined);
                    setIsEditing(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
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
            </>
          )}

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
                    <div className={styles.commentHeading}>
                      <strong>
                        {comment.author?.displayName ?? "Former member"}
                      </strong>
                      {comment.authorUserId === currentUserId ? (
                        <div className={styles.commentActions}>
                          <button
                            aria-label="Edit comment"
                            className={styles.commentAction}
                            disabled={isSavingCommentId === comment.id}
                            onClick={() => setEditingCommentId(comment.id)}
                            title="Edit comment"
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                          <button
                            aria-label="Delete comment"
                            className={styles.commentActionDanger}
                            disabled={isSavingCommentId === comment.id}
                            onClick={() => void onCommentDelete(comment.id)}
                            title="Delete comment"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {editingCommentId === comment.id ? (
                      <form
                        className={styles.commentEditForm}
                        onSubmit={(event) =>
                          void onCommentUpdate(event, comment.id)
                        }
                      >
                        <textarea
                          defaultValue={comment.body}
                          maxLength={5000}
                          name="body"
                          required
                          rows={3}
                        />
                        <div className={styles.formActions}>
                          <button
                            className={styles.secondaryButton}
                            disabled={isSavingCommentId === comment.id}
                            type="submit"
                          >
                            {isSavingCommentId === comment.id
                              ? "Saving"
                              : "Save"}
                          </button>
                          <button
                            className={styles.textButton}
                            onClick={() => setEditingCommentId(undefined)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p>{comment.body}</p>
                    )}
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
