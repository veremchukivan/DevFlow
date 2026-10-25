"use client";

import {
  Check,
  ClipboardList,
  Download,
  MessageSquare,
  Pencil,
  Paperclip,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ApiClientError,
  createTaskChecklistItem,
  createTaskComment,
  deleteTaskAttachment,
  deleteTaskChecklistItem,
  deleteTaskComment,
  getCurrentUser,
  getTaskActivity,
  getTaskAttachments,
  getTaskAttachmentDownloadUrl,
  getTaskChecklist,
  getTaskComments,
  updateTaskChecklistItem,
  updateTaskComment,
  uploadTaskAttachment,
} from "@/shared/lib/api-client";
import type {
  Task,
  TaskActivityEvent,
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  WorkspaceRole,
} from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "./task-work-panel.module.css";

type ActivityTab = "comments" | "history";

export function TaskWorkPanel({
  role,
  task,
  workspaceId,
}: {
  role: WorkspaceRole | undefined;
  task: Task;
  workspaceId: string;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("comments");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingChecklistItem, setIsSubmittingChecklistItem] =
    useState(false);
  const [isSavingItemId, setIsSavingItemId] = useState<string>();
  const [isSavingCommentId, setIsSavingCommentId] = useState<string>();
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isDeletingAttachmentId, setIsDeletingAttachmentId] =
    useState<string>();
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [error, setError] = useState<string>();
  const canUpdateTask = role ? can(role, "task:update") : false;
  const canCreateComments = role ? can(role, "comment:create") : false;
  const completedItems = checklistItems.filter(
    (item) => item.isCompleted,
  ).length;

  const loadWork = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [
        commentsResponse,
        checklistResponse,
        activityResponse,
        attachmentsResponse,
        userResponse,
      ] = await Promise.all([
        getTaskComments(workspaceId, task.projectId, task.id, { limit: 25 }),
        getTaskChecklist(workspaceId, task.projectId, task.id),
        getTaskActivity(workspaceId, task.projectId, task.id, { limit: 25 }),
        getTaskAttachments(workspaceId, task.projectId, task.id),
        getCurrentUser(),
      ]);
      setComments(commentsResponse.comments);
      setChecklistItems(checklistResponse.items);
      setActivity(activityResponse.events);
      setAttachments(attachmentsResponse.attachments);
      setCurrentUserId(userResponse.user.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to load task activity.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.projectId, workspaceId]);

  useEffect(() => {
    void loadWork();
  }, [loadWork]);

  async function refreshActivity() {
    const response = await getTaskActivity(
      workspaceId,
      task.projectId,
      task.id,
      {
        limit: 25,
      },
    );
    setActivity(response.events);
  }

  async function onChecklistSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    setError(undefined);
    setIsSubmittingChecklistItem(true);

    try {
      await createTaskChecklistItem(workspaceId, task.projectId, task.id, {
        content,
      });
      await refreshChecklist();
      form.reset();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to add checklist item."));
    } finally {
      setIsSubmittingChecklistItem(false);
    }
  }

  async function refreshChecklist() {
    const response = await getTaskChecklist(
      workspaceId,
      task.projectId,
      task.id,
    );
    setChecklistItems(response.items);
  }

  async function refreshAttachments() {
    const response = await getTaskAttachments(
      workspaceId,
      task.projectId,
      task.id,
    );
    setAttachments(response.attachments);
  }

  async function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setError(undefined);
    setIsUploadingAttachment(true);
    try {
      await uploadTaskAttachment(workspaceId, task.projectId, task.id, file);
      await refreshAttachments();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to upload attachment."));
    } finally {
      event.currentTarget.value = "";
      setIsUploadingAttachment(false);
    }
  }

  async function onAttachmentDelete(attachmentId: string) {
    setError(undefined);
    setIsDeletingAttachmentId(attachmentId);
    try {
      await deleteTaskAttachment(
        workspaceId,
        task.projectId,
        task.id,
        attachmentId,
      );
      await refreshAttachments();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete attachment."));
    } finally {
      setIsDeletingAttachmentId(undefined);
    }
  }

  async function onChecklistCompletionChange(item: TaskChecklistItem) {
    setError(undefined);
    setIsSavingItemId(item.id);
    try {
      await updateTaskChecklistItem(
        workspaceId,
        task.projectId,
        task.id,
        item.id,
        {
          isCompleted: !item.isCompleted,
        },
      );
      await refreshChecklist();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update checklist item."));
    } finally {
      setIsSavingItemId(undefined);
    }
  }

  async function onChecklistDelete(itemId: string) {
    setError(undefined);
    setIsSavingItemId(itemId);
    try {
      await deleteTaskChecklistItem(
        workspaceId,
        task.projectId,
        task.id,
        itemId,
      );
      await refreshChecklist();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete checklist item."));
    } finally {
      setIsSavingItemId(undefined);
    }
  }

  async function onCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    setError(undefined);
    setIsSubmittingComment(true);
    try {
      await createTaskComment(workspaceId, task.projectId, task.id, { body });
      await Promise.all([refreshComments(), refreshActivity()]);
      form.reset();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to add comment."));
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function refreshComments() {
    const response = await getTaskComments(
      workspaceId,
      task.projectId,
      task.id,
      {
        limit: 25,
      },
    );
    setComments(response.comments);
  }

  async function onCommentUpdate(
    event: FormEvent<HTMLFormElement>,
    commentId: string,
  ) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get("body") ?? "");
    setError(undefined);
    setIsSavingCommentId(commentId);
    try {
      await updateTaskComment(workspaceId, task.projectId, task.id, commentId, {
        body,
      });
      await Promise.all([refreshComments(), refreshActivity()]);
      setEditingCommentId(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update comment."));
    } finally {
      setIsSavingCommentId(undefined);
    }
  }

  async function onCommentDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;

    setError(undefined);
    setIsSavingCommentId(commentId);
    try {
      await deleteTaskComment(workspaceId, task.projectId, task.id, commentId);
      await Promise.all([refreshComments(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete comment."));
    } finally {
      setIsSavingCommentId(undefined);
    }
  }

  return (
    <section className={styles.panel} aria-label="Task work">
      <section
        className={styles.checklistSection}
        aria-labelledby="checklist-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="checklist-title">Checklist</h3>
            <p>
              {completedItems}/{checklistItems.length} complete
            </p>
          </div>
          <ClipboardList aria-hidden="true" size={18} />
        </div>
        {canUpdateTask ? (
          <form
            className={styles.inlineForm}
            onSubmit={(event) => void onChecklistSubmit(event)}
          >
            <label className={styles.srOnly} htmlFor="checklist-content">
              New checklist item
            </label>
            <input
              id="checklist-content"
              maxLength={500}
              name="content"
              placeholder="Add a checklist item"
              required
            />
            <button disabled={isSubmittingChecklistItem} type="submit">
              {isSubmittingChecklistItem ? "Adding" : "Add"}
            </button>
          </form>
        ) : null}
        {isLoading ? <p className={styles.empty}>Loading checklist…</p> : null}
        {!isLoading && checklistItems.length === 0 ? (
          <p className={styles.empty}>No checklist items yet.</p>
        ) : null}
        {checklistItems.length ? (
          <ol className={styles.checklist}>
            {checklistItems.map((item) => (
              <li key={item.id}>
                <label
                  className={item.isCompleted ? styles.completed : undefined}
                >
                  <input
                    checked={item.isCompleted}
                    disabled={!canUpdateTask || isSavingItemId === item.id}
                    onChange={() => void onChecklistCompletionChange(item)}
                    type="checkbox"
                  />
                  <span>{item.content}</span>
                </label>
                {canUpdateTask ? (
                  <button
                    aria-label={`Delete checklist item: ${item.content}`}
                    className={styles.deleteButton}
                    disabled={isSavingItemId === item.id}
                    onClick={() => void onChecklistDelete(item.id)}
                    title="Delete checklist item"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section
        className={styles.attachmentsSection}
        aria-labelledby="attachments-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="attachments-title">Attachments</h3>
            <p>PDF, PNG, JPEG, or WebP up to 10 MB</p>
          </div>
          <Paperclip aria-hidden="true" size={18} />
        </div>
        {canUpdateTask ? (
          <label className={styles.uploadButton}>
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={isUploadingAttachment}
              onChange={(event) => void onAttachmentChange(event)}
              type="file"
            />
            {isUploadingAttachment ? "Uploading" : "Upload file"}
          </label>
        ) : null}
        {isLoading ? (
          <p className={styles.empty}>Loading attachments…</p>
        ) : null}
        {!isLoading && attachments.length === 0 ? (
          <p className={styles.empty}>No attachments yet.</p>
        ) : null}
        {attachments.length ? (
          <ul className={styles.attachmentList}>
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <div>
                  <strong>{attachment.originalFilename}</strong>
                  <span>
                    {formatFileSize(attachment.sizeBytes)} ·{" "}
                    {attachment.uploadedBy?.displayName ?? "Former member"}
                  </span>
                </div>
                <div className={styles.attachmentActions}>
                  <a
                    aria-label={`Download ${attachment.originalFilename}`}
                    href={
                      getTaskAttachmentDownloadUrl(
                        workspaceId,
                        task.projectId,
                        task.id,
                        attachment.id,
                      ) ?? undefined
                    }
                    title="Download attachment"
                  >
                    <Download aria-hidden="true" size={16} />
                  </a>
                  {canUpdateTask ? (
                    <button
                      aria-label={`Delete ${attachment.originalFilename}`}
                      className={styles.deleteButton}
                      disabled={isDeletingAttachmentId === attachment.id}
                      onClick={() => void onAttachmentDelete(attachment.id)}
                      title="Delete attachment"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className={styles.activitySection}
        aria-labelledby="activity-title"
      >
        <div className={styles.tabs} role="tablist" aria-label="Task activity">
          <button
            aria-selected={activeTab === "comments"}
            className={activeTab === "comments" ? styles.activeTab : undefined}
            onClick={() => setActiveTab("comments")}
            role="tab"
            type="button"
          >
            <MessageSquare aria-hidden="true" size={16} /> Comments (
            {comments.length})
          </button>
          <button
            aria-selected={activeTab === "history"}
            className={activeTab === "history" ? styles.activeTab : undefined}
            onClick={() => setActiveTab("history")}
            role="tab"
            type="button"
          >
            <ClipboardList aria-hidden="true" size={16} /> History
          </button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {activeTab === "comments" ? (
          <div role="tabpanel">
            {canCreateComments ? (
              <form
                className={styles.commentForm}
                onSubmit={(event) => void onCommentSubmit(event)}
              >
                <label className={styles.srOnly} htmlFor="comment-body">
                  New comment
                </label>
                <textarea
                  id="comment-body"
                  maxLength={5000}
                  name="body"
                  placeholder="Write a comment…"
                  required
                  rows={3}
                />
                <button disabled={isSubmittingComment} type="submit">
                  {isSubmittingComment ? "Sending" : "Comment"}
                </button>
              </form>
            ) : null}
            {isLoading ? (
              <p className={styles.empty}>Loading comments…</p>
            ) : null}
            {!isLoading && comments.length === 0 ? (
              <p className={styles.empty}>No comments yet.</p>
            ) : null}
            {comments.length ? (
              <ol className={styles.commentList}>
                {comments.map((comment) => {
                  const canManage = canManageComment(
                    comment,
                    currentUserId,
                    role,
                  );
                  const isEditing = editingCommentId === comment.id;
                  return (
                    <li key={comment.id}>
                      <div className={styles.commentHeading}>
                        <div>
                          <strong>
                            {comment.author?.displayName ?? "Former member"}
                          </strong>
                          <time dateTime={comment.createdAt}>
                            {formatDateTime(comment.createdAt)}
                          </time>
                        </div>
                        {canManage ? (
                          <div className={styles.commentActions}>
                            <button
                              aria-label="Edit comment"
                              disabled={isSavingCommentId === comment.id}
                              onClick={() => setEditingCommentId(comment.id)}
                              title="Edit comment"
                              type="button"
                            >
                              <Pencil aria-hidden="true" size={14} />
                            </button>
                            <button
                              aria-label="Delete comment"
                              className={styles.deleteButton}
                              disabled={isSavingCommentId === comment.id}
                              onClick={() => void onCommentDelete(comment.id)}
                              title="Delete comment"
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {isEditing ? (
                        <form
                          className={styles.editCommentForm}
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
                          <div>
                            <button
                              disabled={isSavingCommentId === comment.id}
                              type="submit"
                            >
                              {isSavingCommentId === comment.id
                                ? "Saving"
                                : "Save"}
                            </button>
                            <button
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
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : (
          <div role="tabpanel">
            {isLoading ? (
              <p className={styles.empty}>Loading history…</p>
            ) : null}
            {!isLoading && activity.length === 0 ? (
              <p className={styles.empty}>No history yet.</p>
            ) : null}
            {activity.length ? (
              <ol className={styles.historyList}>
                {activity.map((event) => (
                  <li key={event.id}>
                    <Check aria-hidden="true" size={15} />
                    <div>
                      <span>{describeActivity(event)}</span>
                      <time dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}
      </section>
    </section>
  );
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function canManageComment(
  comment: TaskComment,
  currentUserId: string | undefined,
  role: WorkspaceRole | undefined,
) {
  if (!role) return false;
  return (
    comment.authorUserId === currentUserId ||
    can(role, "comment:update") ||
    can(role, "comment:delete")
  );
}

function describeActivity(event: TaskActivityEvent) {
  const actor = event.actor?.displayName ?? "A former member";
  const descriptions: Record<TaskActivityEvent["eventType"], string> = {
    task_created: "created this task",
    task_updated: "updated this task",
    task_deleted: "deleted this task",
    task_restored: "restored this task",
    task_comment_created: "added a comment",
    task_comment_updated: "updated a comment",
    task_comment_deleted: "deleted a comment",
  };
  return `${actor} ${descriptions[event.eventType]}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
