"use client";

import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  createTaskComment,
  createTaskChecklistItem,
  deleteTask,
  deleteTaskComment,
  deleteTaskChecklistItem,
  getCurrentUser,
  getProject,
  getTask,
  getTaskLabels,
  getTaskChecklist,
  getWorkspaceLabels,
  getWorkspace,
  getTaskActivity,
  getTaskComments,
  getWorkspaceMembers,
  updateTask,
  updateTaskComment,
  updateTaskChecklistItem,
  replaceTaskLabels,
} from "@/shared/lib/api-client";
import type {
  Task,
  Project,
  TaskActivityEvent,
  TaskComment,
  TaskChecklistItem,
  TaskPriority,
  WorkspaceRole,
  Label,
  PageInfo,
  WorkspaceMember,
} from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "@/shared/styles/ui.module.css";

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const detailPageSize = 25;

export function TaskDetail() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>();
  const router = useRouter();
  const [task, setTask] = useState<Task>();
  const [project, setProject] = useState<Project>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [role, setRole] = useState<WorkspaceRole>();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [checklistProgress, setChecklistProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [commentsPageInfo, setCommentsPageInfo] = useState<PageInfo>();
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [activityPageInfo, setActivityPageInfo] = useState<PageInfo>();
  const [workspaceLabels, setWorkspaceLabels] = useState<Label[]>([]);
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  const [error, setError] = useState<string>();
  const [commentError, setCommentError] = useState<string>();
  const [checklistError, setChecklistError] = useState<string>();
  const [editError, setEditError] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingChecklistItem, setIsSubmittingChecklistItem] =
    useState(false);
  const [isSavingChecklistItemId, setIsSavingChecklistItemId] =
    useState<string>();
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [isSavingCommentId, setIsSavingCommentId] = useState<string>();
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const canUpdateTask = role ? can(role, "task:update") : false;
  const canDeleteTask = role ? can(role, "task:delete") : false;
  const canCreateComments = role ? can(role, "comment:create") : false;

  const loadTaskDetails = useCallback(async () => {
    try {
      const [
        taskResponse,
        membersResponse,
        commentsResponse,
        activityResponse,
        currentUserResponse,
        workspaceLabelsResponse,
        taskLabelsResponse,
        workspaceResponse,
        projectResponse,
        checklistResponse,
      ] = await Promise.all([
        getTask(params.workspaceId, params.projectId, params.taskId),
        getWorkspaceMembers(params.workspaceId),
        getTaskComments(params.workspaceId, params.projectId, params.taskId, {
          limit: detailPageSize,
        }),
        getTaskActivity(params.workspaceId, params.projectId, params.taskId, {
          limit: detailPageSize,
        }),
        getCurrentUser(),
        getWorkspaceLabels(params.workspaceId),
        getTaskLabels(params.workspaceId, params.projectId, params.taskId),
        getWorkspace(params.workspaceId),
        getProject(params.workspaceId, params.projectId),
        getTaskChecklist(params.workspaceId, params.projectId, params.taskId),
      ]);

      setTask(taskResponse.task);
      setProject(projectResponse.project);
      setMembers(
        membersResponse.members.filter((member) => member.status === "active"),
      );
      setComments(commentsResponse.comments);
      setCommentsPageInfo(commentsResponse.pageInfo);
      setActivity(activityResponse.events);
      setActivityPageInfo(activityResponse.pageInfo);
      setCurrentUserId(currentUserResponse.user.id);
      setWorkspaceLabels(workspaceLabelsResponse.labels);
      setTaskLabels(taskLabelsResponse.labels);
      setRole(workspaceResponse.workspace.role);
      setChecklistItems(checklistResponse.items);
      setChecklistProgress(checklistResponse.progress);
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

  async function onLabelsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(undefined);
    setIsSavingLabels(true);
    try {
      const labelIds = new FormData(event.currentTarget)
        .getAll("labelIds")
        .map(String);
      const response = await replaceTaskLabels(
        params.workspaceId,
        params.projectId,
        params.taskId,
        labelIds,
      );
      setTaskLabels(response.labels);
    } catch (caughtError) {
      setEditError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update labels.",
      );
    } finally {
      setIsSavingLabels(false);
    }
  }

  useEffect(() => {
    void loadTaskDetails();
  }, [loadTaskDetails]);

  async function loadComments(offset = 0) {
    const response = await getTaskComments(
      params.workspaceId,
      params.projectId,
      params.taskId,
      { limit: detailPageSize, offset },
    );
    setComments(response.comments);
    setCommentsPageInfo(response.pageInfo);
  }

  async function loadActivity(offset = 0) {
    const response = await getTaskActivity(
      params.workspaceId,
      params.projectId,
      params.taskId,
      { limit: detailPageSize, offset },
    );
    setActivity(response.events);
    setActivityPageInfo(response.pageInfo);
  }

  async function loadChecklist() {
    const response = await getTaskChecklist(
      params.workspaceId,
      params.projectId,
      params.taskId,
    );
    setChecklistItems(response.items);
    setChecklistProgress(response.progress);
  }

  async function onChangeCommentsPage(offset: number) {
    try {
      await loadComments(offset);
    } catch (caughtError) {
      setCommentError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to load comments.",
      );
    }
  }

  async function onChangeActivityPage(offset: number) {
    try {
      await loadActivity(offset);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to load activity.",
      );
    }
  }

  async function onTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    setEditError(undefined);
    setIsSavingTask(true);
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    const assigneeUserId = String(form.get("assigneeUserId") ?? "");
    const statusId = String(form.get("statusId") ?? "");

    try {
      const response = await updateTask(
        params.workspaceId,
        params.projectId,
        params.taskId,
        {
          assigneeUserId: assigneeUserId || null,
          description: description || null,
          dueDate: String(form.get("dueDate") ?? "") || null,
          priority: form.get("priority") as TaskPriority,
          ...(statusId ? { statusId } : {}),
          title: String(form.get("title") ?? ""),
        },
        task.version,
      );
      setTask(response.task);
      await loadActivity(activityPageInfo?.offset);
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

  async function onTaskDelete() {
    if (!task || !window.confirm("Delete this task? This cannot be undone.")) {
      return;
    }

    setEditError(undefined);
    setIsDeletingTask(true);
    try {
      await deleteTask(
        params.workspaceId,
        params.projectId,
        params.taskId,
        task.version,
      );
      router.replace(
        `/workspaces/${params.workspaceId}/projects/${params.projectId}`,
      );
      router.refresh();
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
          : "Unable to delete the task.",
      );
    } finally {
      setIsDeletingTask(false);
    }
  }

  async function onCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError(undefined);
    setIsSubmittingComment(true);

    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");

    try {
      await createTaskComment(
        params.workspaceId,
        params.projectId,
        params.taskId,
        { body },
      );
      await Promise.all([
        loadComments(commentsPageInfo?.offset),
        loadActivity(activityPageInfo?.offset),
      ]);
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

  async function onChecklistSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecklistError(undefined);
    setIsSubmittingChecklistItem(true);
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");

    try {
      await createTaskChecklistItem(
        params.workspaceId,
        params.projectId,
        params.taskId,
        { content },
      );
      await loadChecklist();
      form.reset();
    } catch (caughtError) {
      setChecklistError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add the checklist item.",
      );
    } finally {
      setIsSubmittingChecklistItem(false);
    }
  }

  async function onChecklistItemCompletionChange(item: TaskChecklistItem) {
    setChecklistError(undefined);
    setIsSavingChecklistItemId(item.id);

    try {
      await updateTaskChecklistItem(
        params.workspaceId,
        params.projectId,
        params.taskId,
        item.id,
        { isCompleted: !item.isCompleted },
      );
      await loadChecklist();
    } catch (caughtError) {
      setChecklistError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the checklist item.",
      );
    } finally {
      setIsSavingChecklistItemId(undefined);
    }
  }

  async function onChecklistItemDelete(itemId: string) {
    setChecklistError(undefined);
    setIsSavingChecklistItemId(itemId);

    try {
      await deleteTaskChecklistItem(
        params.workspaceId,
        params.projectId,
        params.taskId,
        itemId,
      );
      await loadChecklist();
    } catch (caughtError) {
      setChecklistError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete the checklist item.",
      );
    } finally {
      setIsSavingChecklistItemId(undefined);
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
      await updateTaskComment(
        params.workspaceId,
        params.projectId,
        params.taskId,
        commentId,
        { body },
      );
      await Promise.all([
        loadComments(commentsPageInfo?.offset),
        loadActivity(activityPageInfo?.offset),
      ]);
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
      await Promise.all([
        loadComments(commentsPageInfo?.offset),
        loadActivity(activityPageInfo?.offset),
      ]);
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
            {!isEditing && (canUpdateTask || canDeleteTask) ? (
              <div className={styles.taskDetailActions}>
                {canUpdateTask ? (
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
                {canDeleteTask ? (
                  <button
                    aria-label="Delete task"
                    className={styles.iconButtonDanger}
                    disabled={isDeletingTask}
                    onClick={() => void onTaskDelete()}
                    title="Delete task"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={17} strokeWidth={1.8} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isEditing && canUpdateTask ? (
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
                <span>Status</span>
                <select defaultValue={task.statusId} name="statusId">
                  {project?.statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
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
              <label>
                <span>Due date</span>
                <input
                  defaultValue={task.dueDate ?? ""}
                  name="dueDate"
                  type="date"
                />
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
                <div>
                  <dt>Due date</dt>
                  <dd>{task.dueDate ?? "No due date"}</dd>
                </div>
              </dl>
              <section
                className={styles.taskSection}
                aria-labelledby="labels-title"
              >
                <div className={styles.sectionHeading}>
                  <h2 id="labels-title">Labels</h2>
                </div>
                {canUpdateTask ? (
                  <form className={styles.taskForm} onSubmit={onLabelsSubmit}>
                    <div className={styles.labelPicker}>
                      {workspaceLabels.length ? (
                        workspaceLabels.map((label) => (
                          <label key={label.id}>
                            <input
                              defaultChecked={taskLabels.some(
                                (taskLabel) => taskLabel.id === label.id,
                              )}
                              name="labelIds"
                              type="checkbox"
                              value={label.id}
                            />
                            <span style={{ backgroundColor: label.color }} />
                            {label.name}
                          </label>
                        ))
                      ) : (
                        <p className={styles.emptyState}>
                          Create labels for this workspace first.
                        </p>
                      )}
                    </div>
                    {editError ? (
                      <p className={styles.formError} role="alert">
                        {editError}
                      </p>
                    ) : null}
                    <div className={styles.formActions}>
                      <button
                        className={styles.secondaryButton}
                        disabled={isSavingLabels}
                        type="submit"
                      >
                        {isSavingLabels ? "Saving" : "Save labels"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.readOnlyLabels}>
                    {taskLabels.length ? (
                      taskLabels.map((label) => (
                        <div key={label.id}>
                          <span style={{ backgroundColor: label.color }} />
                          {label.name}
                        </div>
                      ))
                    ) : (
                      <p className={styles.emptyState}>No labels.</p>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          <section
            aria-labelledby="checklist-title"
            className={styles.taskSection}
          >
            <div className={styles.sectionHeading}>
              <h2 id="checklist-title">Checklist</h2>
              <span className={styles.checklistProgress}>
                {checklistProgress.completed}/{checklistProgress.total} complete
              </span>
            </div>
            {canUpdateTask ? (
              <form
                className={styles.checklistForm}
                onSubmit={onChecklistSubmit}
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
                <button
                  className={styles.secondaryButton}
                  disabled={isSubmittingChecklistItem}
                  type="submit"
                >
                  {isSubmittingChecklistItem ? "Adding" : "Add item"}
                </button>
              </form>
            ) : null}
            {checklistError ? (
              <p className={styles.formError} role="alert">
                {checklistError}
              </p>
            ) : null}
            {checklistItems.length ? (
              <ol className={styles.checklistItems}>
                {checklistItems.map((item) => (
                  <li key={item.id}>
                    <label
                      className={
                        item.isCompleted
                          ? styles.checklistItemCompleted
                          : undefined
                      }
                    >
                      <input
                        checked={item.isCompleted}
                        disabled={
                          !canUpdateTask || isSavingChecklistItemId === item.id
                        }
                        onChange={() =>
                          void onChecklistItemCompletionChange(item)
                        }
                        type="checkbox"
                      />
                      <span>{item.content}</span>
                    </label>
                    {canUpdateTask ? (
                      <button
                        aria-label={`Delete checklist item: ${item.content}`}
                        className={styles.commentActionDanger}
                        disabled={isSavingChecklistItemId === item.id}
                        onClick={() => void onChecklistItemDelete(item.id)}
                        title="Delete checklist item"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyState}>No checklist items yet.</p>
            )}
          </section>

          <section
            aria-labelledby="comments-title"
            className={styles.taskSection}
          >
            <div className={styles.sectionHeading}>
              <h2 id="comments-title">Comments</h2>
            </div>
            {canCreateComments ? (
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
            ) : null}
            {comments.length ? (
              <ol className={styles.commentList}>
                {comments.map((comment) => (
                  <li className={styles.comment} key={comment.id}>
                    <div className={styles.commentHeading}>
                      <strong>
                        {comment.author?.displayName ?? "Former member"}
                      </strong>
                      {canManageComment(comment, currentUserId, role) ? (
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
                    {editingCommentId === comment.id &&
                    canManageComment(comment, currentUserId, role) ? (
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
            {commentsPageInfo ? (
              <DetailPagination
                label="comments"
                pageInfo={commentsPageInfo}
                onChange={onChangeCommentsPage}
              />
            ) : null}
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
            {activityPageInfo ? (
              <DetailPagination
                label="activity"
                pageInfo={activityPageInfo}
                onChange={onChangeActivityPage}
              />
            ) : null}
          </section>
        </section>
      )}
    </main>
  );
}

function DetailPagination({
  label,
  onChange,
  pageInfo,
}: {
  label: string;
  onChange: (offset: number) => Promise<void>;
  pageInfo: PageInfo;
}) {
  return (
    <nav aria-label={`${label} pagination`} className={styles.pagination}>
      <span>
        {pageInfo.total === 0
          ? `No ${label}`
          : `${pageInfo.offset + 1}-${Math.min(pageInfo.offset + pageInfo.limit, pageInfo.total)} of ${pageInfo.total}`}
      </span>
      <div>
        <button
          aria-label={`Previous ${label}`}
          className={styles.iconButton}
          disabled={pageInfo.offset === 0}
          onClick={() =>
            void onChange(Math.max(0, pageInfo.offset - pageInfo.limit))
          }
          title="Previous page"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
        <button
          aria-label={`Next ${label}`}
          className={styles.iconButton}
          disabled={!pageInfo.hasNextPage}
          onClick={() => void onChange(pageInfo.offset + pageInfo.limit)}
          title="Next page"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </nav>
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
    case "task_restored":
      return `${actor} restored this task`;
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
