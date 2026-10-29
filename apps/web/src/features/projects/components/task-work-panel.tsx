"use client";

import {
  Check,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Link2,
  Maximize2,
  MessageSquare,
  Pencil,
  Paperclip,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ApiClientError,
  createTask,
  createTaskChecklistItem,
  createTaskComment,
  addTaskWatcher,
  createManualTaskTimeEntry,
  createTaskRelation,
  deleteTaskAttachment,
  deleteTaskChecklistItem,
  deleteTaskComment,
  deleteTaskRelation,
  getCurrentUser,
  getProjects,
  getTaskActivity,
  getTaskAttachments,
  getTaskAttachmentDownloadUrl,
  getTaskAttachmentPreviewUrl,
  getTaskChecklist,
  getTaskComments,
  getTaskRelations,
  getTaskTimeEntries,
  getTaskWatchers,
  getWorkspaceMembers,
  getTasks,
  updateTaskChecklistItem,
  updateTaskComment,
  uploadTaskAttachment,
  uploadTaskCommentAttachment,
  startTaskTimer,
  stopTaskTimer,
  followTask,
  removeTaskWatcher,
  unfollowTask,
} from "@/shared/lib/api-client";
import { Modal } from "@/shared/components/modal";
import {
  RichTextContent,
  RichTextEditor,
  removeEmbeddedMedia,
  replaceEmbeddedMediaAttachment,
} from "@/shared/components/rich-text-editor";
import type {
  Task,
  TaskActivityEvent,
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  TaskRelation,
  TaskRelationType,
  TaskTimeEntry,
  TaskWatcher,
  WorkspaceMember,
  WorkspaceRole,
} from "@devflow/shared";
import { can } from "@devflow/shared";

import styles from "./task-work-panel.module.css";

type ActivityTab = "comments" | "history";
type AttachmentPreviewSelection = {
  attachment: TaskAttachment;
  previewUrl: string;
};

export function TaskWorkPanel({
  availableRelatedTasks,
  description,
  editorFormId,
  onDescriptionMediaSave,
  role,
  task,
  workspaceId,
}: {
  availableRelatedTasks: Task[];
  description: string | null;
  editorFormId: string;
  onDescriptionMediaSave?: (description: string) => Promise<void>;
  role: WorkspaceRole | undefined;
  task: Task;
  workspaceId: string;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("comments");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [relations, setRelations] = useState<TaskRelation[]>([]);
  const [relatedTaskOptions, setRelatedTaskOptions] = useState<Task[]>(
    availableRelatedTasks,
  );
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TaskTimeEntry[]>([]);
  const [watchers, setWatchers] = useState<TaskWatcher[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [timeSummary, setTimeSummary] = useState<{
    activeEntry: TaskTimeEntry | null;
    estimateMinutes: number | null;
    loggedMinutes: number;
    remainingMinutes: number | null;
  }>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploadingCommentAttachments, setIsUploadingCommentAttachments] =
    useState(false);
  const [commentDraftFiles, setCommentDraftFiles] = useState<File[]>([]);
  const [commentEditorResetKey, setCommentEditorResetKey] = useState(0);
  const [isSubmittingChecklistItem, setIsSubmittingChecklistItem] =
    useState(false);
  const [isSavingItemId, setIsSavingItemId] = useState<string>();
  const [isSavingCommentId, setIsSavingCommentId] = useState<string>();
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isDeletingAttachmentId, setIsDeletingAttachmentId] =
    useState<string>();
  const [isReplacingAttachmentId, setIsReplacingAttachmentId] =
    useState<string>();
  const [isCreatingRelation, setIsCreatingRelation] = useState(false);
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);
  const [isSavingTime, setIsSavingTime] = useState(false);
  const [isUpdatingWatchers, setIsUpdatingWatchers] = useState(false);
  const [isDeletingRelationId, setIsDeletingRelationId] = useState<string>();
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [editingChecklistItemId, setEditingChecklistItemId] =
    useState<string>();
  const [error, setError] = useState<string>();
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentPreviewSelection>();
  const canUpdateTask = role ? can(role, "task:update") : false;
  const canCreateTask = role ? can(role, "task:create") : false;
  const canCreateComments = role ? can(role, "comment:create") : false;
  const completedItems = checklistItems.filter(
    (item) => item.isCompleted,
  ).length;
  const subtasks = relatedTaskOptions.filter(
    (candidate) => candidate.parentTaskId === task.id,
  );
  const parentTask = task.parentTaskId
    ? relatedTaskOptions.find((candidate) => candidate.id === task.parentTaskId)
    : undefined;

  const loadWork = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [
        commentsResponse,
        checklistResponse,
        activityResponse,
        attachmentsResponse,
        relationsResponse,
        timeEntriesResponse,
        watchersResponse,
        membersResponse,
        userResponse,
      ] = await Promise.all([
        getTaskComments(workspaceId, task.projectId, task.id, { limit: 25 }),
        getTaskChecklist(workspaceId, task.projectId, task.id),
        getTaskActivity(workspaceId, task.projectId, task.id, { limit: 25 }),
        getTaskAttachments(workspaceId, task.projectId, task.id),
        getTaskRelations(workspaceId, task.projectId, task.id),
        getTaskTimeEntries(workspaceId, task.projectId, task.id),
        getTaskWatchers(workspaceId, task.projectId, task.id),
        getWorkspaceMembers(workspaceId),
        getCurrentUser(),
      ]);
      setComments(commentsResponse.comments);
      setChecklistItems(checklistResponse.items);
      setActivity(activityResponse.events);
      setAttachments(attachmentsResponse.attachments);
      setRelations(relationsResponse.relations);
      setTimeEntries(timeEntriesResponse.entries);
      setTimeSummary(timeEntriesResponse.summary);
      setWatchers(watchersResponse.watchers);
      setIsWatching(watchersResponse.isWatching);
      setWorkspaceMembers(membersResponse.members);
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

  useEffect(() => {
    let active = true;

    void getProjects(workspaceId)
      .then(async ({ projects }) => {
        const responses = await Promise.all(
          projects.map((project) =>
            getTasks(workspaceId, project.id, {
              limit: 100,
              sortBy: "number",
              sortOrder: "asc",
            }),
          ),
        );
        if (active)
          setRelatedTaskOptions(
            responses.flatMap((response) => response.tasks),
          );
      })
      .catch(() => {
        if (active) setRelatedTaskOptions(availableRelatedTasks);
      });

    return () => {
      active = false;
    };
  }, [availableRelatedTasks, workspaceId]);

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

  async function refreshTimeEntries() {
    const response = await getTaskTimeEntries(
      workspaceId,
      task.projectId,
      task.id,
    );
    setTimeEntries(response.entries);
    setTimeSummary(response.summary);
  }

  async function onTimerToggle() {
    setError(undefined);
    setIsSavingTime(true);
    try {
      if (timeSummary?.activeEntry) {
        await stopTaskTimer(
          workspaceId,
          task.projectId,
          task.id,
          timeSummary.activeEntry.id,
        );
      } else {
        await startTaskTimer(workspaceId, task.projectId, task.id);
      }
      await Promise.all([refreshTimeEntries(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update the timer."));
    } finally {
      setIsSavingTime(false);
    }
  }

  async function onManualTimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const durationMinutes = Number(form.get("durationMinutes"));
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return;
    setError(undefined);
    setIsSavingTime(true);
    try {
      await createManualTaskTimeEntry(workspaceId, task.projectId, task.id, {
        description: String(form.get("description") ?? "").trim() || undefined,
        durationMinutes,
        startedAt: new Date().toISOString(),
      });
      event.currentTarget.reset();
      await Promise.all([refreshTimeEntries(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to log time."));
    } finally {
      setIsSavingTime(false);
    }
  }

  async function onWatchToggle() {
    setError(undefined);
    setIsUpdatingWatchers(true);
    try {
      const response = isWatching
        ? await unfollowTask(workspaceId, task.projectId, task.id)
        : await followTask(workspaceId, task.projectId, task.id);
      setIsWatching(response.isWatching);
      setWatchers(response.watchers);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update task watchers."));
    } finally {
      setIsUpdatingWatchers(false);
    }
  }

  async function onAddWatcher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = String(new FormData(event.currentTarget).get("userId") ?? "");
    if (!targetUserId) return;
    setIsUpdatingWatchers(true);
    try {
      const response = await addTaskWatcher(workspaceId, task.projectId, task.id, targetUserId);
      setWatchers(response.watchers);
      setIsWatching(response.isWatching);
      event.currentTarget.reset();
    } finally {
      setIsUpdatingWatchers(false);
    }
  }

  async function onRemoveWatcher(targetUserId: string) {
    setIsUpdatingWatchers(true);
    try {
      const response = await removeTaskWatcher(workspaceId, task.projectId, task.id, targetUserId);
      setWatchers(response.watchers);
      setIsWatching(response.isWatching);
    } finally {
      setIsUpdatingWatchers(false);
    }
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
      await Promise.all([refreshChecklist(), refreshActivity()]);
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

  async function refreshRelations() {
    const response = await getTaskRelations(
      workspaceId,
      task.projectId,
      task.id,
    );
    setRelations(response.relations);
  }

  async function onRelationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    setIsCreatingRelation(true);
    try {
      await createTaskRelation(workspaceId, task.projectId, task.id, {
        relationType: form.get("relationType") as TaskRelationType,
        targetTaskId: String(form.get("targetTaskId") ?? ""),
      });
      await Promise.all([refreshRelations(), refreshActivity()]);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to create task relation."));
    } finally {
      setIsCreatingRelation(false);
    }
  }

  async function onRelationDelete(relationId: string) {
    setError(undefined);
    setIsDeletingRelationId(relationId);
    try {
      await deleteTaskRelation(
        workspaceId,
        task.projectId,
        task.id,
        relationId,
      );
      await Promise.all([refreshRelations(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete task relation."));
    } finally {
      setIsDeletingRelationId(undefined);
    }
  }

  async function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;

    setError(undefined);
    setIsUploadingAttachment(true);
    try {
      for (const file of files) {
        await uploadTaskAttachment(workspaceId, task.projectId, task.id, file);
      }
      await Promise.all([refreshAttachments(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to upload attachment."));
    } finally {
      event.currentTarget.value = "";
      setIsUploadingAttachment(false);
    }
  }

  async function onDescriptionMediaUpload(files: File[]) {
    setError(undefined);
    setIsUploadingAttachment(true);
    try {
      const responses = await Promise.all(
        files.map((file) =>
          uploadTaskAttachment(workspaceId, task.projectId, task.id, file),
        ),
      );
      const uploadedAttachments = responses.map(({ attachment }) => attachment);
      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...uploadedAttachments.filter(
          (attachment) =>
            !currentAttachments.some((current) => current.id === attachment.id),
        ),
      ]);
      await refreshActivity();
      return uploadedAttachments;
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to upload description media."));
      return [];
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function onDescriptionMediaChange(description: string) {
    if (!onDescriptionMediaSave) return;
    try {
      await onDescriptionMediaSave(description);
    } catch (caughtError) {
      setError(
        messageFor(caughtError, "Unable to save media in the description."),
      );
    }
  }

  async function onAttachmentDelete(attachmentId: string) {
    setError(undefined);
    setIsDeletingAttachmentId(attachmentId);
    try {
      const nextDescription = description
        ? removeEmbeddedMedia(description, attachmentId)
        : description;
      if (
        nextDescription !== description &&
        nextDescription !== null &&
        nextDescription !== undefined &&
        onDescriptionMediaSave
      ) {
        await onDescriptionMediaSave(nextDescription);
      }
      await deleteTaskAttachment(
        workspaceId,
        task.projectId,
        task.id,
        attachmentId,
      );
      await Promise.all([refreshAttachments(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete attachment."));
    } finally {
      setIsDeletingAttachmentId(undefined);
    }
  }

  async function onAttachmentReplace(
    event: ChangeEvent<HTMLInputElement>,
    attachment: TaskAttachment,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setError(undefined);
    setIsReplacingAttachmentId(attachment.id);
    try {
      const response = await uploadTaskAttachment(
        workspaceId,
        task.projectId,
        task.id,
        file,
      );
      const nextDescription = description
        ? replaceEmbeddedMediaAttachment(
            description,
            attachment.id,
            response.attachment.id,
          )
        : description;
      if (
        nextDescription !== description &&
        nextDescription !== null &&
        nextDescription !== undefined &&
        onDescriptionMediaSave
      ) {
        await onDescriptionMediaSave(nextDescription);
      }
      await deleteTaskAttachment(
        workspaceId,
        task.projectId,
        task.id,
        attachment.id,
      );
      setAttachments((currentAttachments) =>
        currentAttachments.map((current) =>
          current.id === attachment.id ? response.attachment : current,
        ),
      );
      await refreshActivity();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to replace attachment."));
    } finally {
      setIsReplacingAttachmentId(undefined);
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
      await Promise.all([refreshChecklist(), refreshActivity()]);
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
      await Promise.all([refreshChecklist(), refreshActivity()]);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete checklist item."));
    } finally {
      setIsSavingItemId(undefined);
    }
  }

  async function onChecklistUpdate(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault();
    const content = String(
      new FormData(event.currentTarget).get("content") ?? "",
    );
    setError(undefined);
    setIsSavingItemId(itemId);
    try {
      await updateTaskChecklistItem(
        workspaceId,
        task.projectId,
        task.id,
        itemId,
        { content },
      );
      await Promise.all([refreshChecklist(), refreshActivity()]);
      setEditingChecklistItemId(undefined);
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to update checklist item."));
    } finally {
      setIsSavingItemId(undefined);
    }
  }

  async function onCreateSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title") ?? "");
    setError(undefined);
    setIsCreatingSubtask(true);
    try {
      const response = await createTask(workspaceId, task.projectId, {
        parentTaskId: task.id,
        priority: "medium",
        statusId: task.statusId,
        title,
        type: "task",
        ...(task.sprintId ? { sprintId: task.sprintId } : {}),
      });
      setRelatedTaskOptions((current) => [...current, response.task]);
      await refreshActivity();
      form.reset();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to create subtask."));
    } finally {
      setIsCreatingSubtask(false);
    }
  }

  async function onCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    setError(undefined);
    setIsSubmittingComment(true);
    let commentCreated = false;
    try {
      const response = await createTaskComment(
        workspaceId,
        task.projectId,
        task.id,
        { body },
      );
      commentCreated = true;
      setComments((currentComments) => [...currentComments, response.comment]);
      form.reset();
      setCommentDraftFiles([]);
      setCommentEditorResetKey((current) => current + 1);

      if (commentDraftFiles.length) {
        setIsUploadingCommentAttachments(true);
        const attachmentResults = await Promise.allSettled(
          commentDraftFiles.map((file) =>
            uploadTaskCommentAttachment(
              workspaceId,
              task.projectId,
              task.id,
              response.comment.id,
              file,
            ),
          ),
        );
        const uploadedAttachments = attachmentResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value.attachment] : [],
        );
        setComments((currentComments) =>
          currentComments.map((comment) =>
            comment.id === response.comment.id
              ? {
                  ...comment,
                  attachments: [...comment.attachments, ...uploadedAttachments],
                }
              : comment,
          ),
        );
        if (attachmentResults.some((result) => result.status === "rejected")) {
          throw new Error("COMMENT_MEDIA_UPLOAD_FAILED");
        }
      }
      await refreshActivity();
    } catch (caughtError) {
      setError(
        commentCreated
          ? messageFor(
              caughtError,
              "Comment was sent, but some media could not be uploaded.",
            )
          : messageFor(caughtError, "Unable to add comment."),
      );
    } finally {
      setIsUploadingCommentAttachments(false);
      setIsSubmittingComment(false);
    }
  }

  function removeCommentDraftFile(fileToRemove: File) {
    setCommentDraftFiles((currentFiles) =>
      currentFiles.filter(
        (file) =>
          !(
            file.name === fileToRemove.name &&
            file.lastModified === fileToRemove.lastModified &&
            file.size === fileToRemove.size
          ),
      ),
    );
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
      const response = await updateTaskComment(
        workspaceId,
        task.projectId,
        task.id,
        commentId,
        { body },
      );
      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === commentId ? response.comment : comment,
        ),
      );
      await refreshActivity();
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
      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      );
      await refreshActivity();
    } catch (caughtError) {
      setError(messageFor(caughtError, "Unable to delete comment."));
    } finally {
      setIsSavingCommentId(undefined);
    }
  }

  return (
    <section className={styles.panel} aria-label="Task work">
      <section
        className={styles.descriptionSection}
        aria-labelledby="description-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="description-title">Description</h3>
            <p>Context, acceptance criteria and implementation notes</p>
          </div>
          <Pencil aria-hidden="true" size={18} />
        </div>
        <label
          className={styles.srOnly}
          htmlFor={`task-description-${task.id}`}
        >
          Description
        </label>
        <RichTextEditor
          attachments={attachments}
          defaultValue={description}
          form={editorFormId}
          getAttachmentPreviewUrl={(attachmentId) =>
            getTaskAttachmentPreviewUrl(
              workspaceId,
              task.projectId,
              task.id,
              attachmentId,
            ) ?? undefined
          }
          id={`task-description-${task.id}`}
          maxLength={10000}
          name="description"
          onMediaChange={onDescriptionMediaChange}
          onMediaUpload={canUpdateTask ? onDescriptionMediaUpload : undefined}
          placeholder="Add context, acceptance criteria or implementation notes…"
        />
      </section>
      <section className={styles.timeTrackingSection} aria-labelledby="time-tracking-title">
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="time-tracking-title">Time tracking</h3>
            <p>
              {timeSummary?.estimateMinutes === null || timeSummary?.estimateMinutes === undefined
                ? "No estimate set"
                : `${formatDuration(timeSummary.estimateMinutes)} planned`}
            </p>
          </div>
          <Clock3 aria-hidden="true" size={18} />
        </div>
        {isLoading ? <p className={styles.empty}>Loading time entries…</p> : null}
        {!isLoading ? (
          <div className={styles.timeSummary}>
            <div>
              <span>Logged</span>
              <strong>{formatDuration(timeSummary?.loggedMinutes ?? 0)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>
                {timeSummary?.remainingMinutes === null || timeSummary?.remainingMinutes === undefined
                  ? "—"
                  : formatDuration(timeSummary.remainingMinutes)}
              </strong>
            </div>
            {canUpdateTask ? (
              <button
                className={styles.timerButton}
                disabled={isSavingTime}
                onClick={() => void onTimerToggle()}
                type="button"
              >
                {timeSummary?.activeEntry ? <Square aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
                {timeSummary?.activeEntry ? "Stop timer" : "Start timer"}
              </button>
            ) : null}
          </div>
        ) : null}
        {timeSummary?.activeEntry ? (
          <p className={styles.activeTimer}>Timer is running for you.</p>
        ) : null}
        {canUpdateTask ? (
          <form className={styles.timeEntryForm} onSubmit={(event) => void onManualTimeSubmit(event)}>
            <label>
              <span>Minutes</span>
              <input defaultValue={30} min={1} name="durationMinutes" required type="number" />
            </label>
            <label>
              <span>Note</span>
              <input maxLength={1000} name="description" placeholder="What did you work on?" />
            </label>
            <button disabled={isSavingTime} type="submit">Log time</button>
          </form>
        ) : null}
        {timeEntries.length ? (
          <ul className={styles.timeEntryList}>
            {timeEntries.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <span>{entry.user.displayName}</span>
                <span>{entry.description || "Time entry"}</span>
                <strong>{formatDuration(entry.durationMinutes)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className={styles.watchersSection} aria-labelledby="watchers-title">
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="watchers-title">Watching</h3>
            <p>Followers receive notifications for comments and status updates.</p>
          </div>
          <Eye aria-hidden="true" size={18} />
        </div>
        <div className={styles.watcherControls}>
          <span>{watchers.length} following</span>
          <button
            disabled={isUpdatingWatchers}
            onClick={() => void onWatchToggle()}
            type="button"
          >
            {isWatching ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
            {isWatching ? "Stop watching" : "Watch task"}
          </button>
        </div>
        {canUpdateTask ? <form className={styles.watcherForm} onSubmit={(event) => void onAddWatcher(event)}><select defaultValue="" name="userId"><option value="">Add participant…</option>{workspaceMembers.filter((member) => !watchers.some((watcher) => watcher.userId === member.userId)).map((member) => <option key={member.userId} value={member.userId}>{member.user.displayName}</option>)}</select><button type="submit">Add</button></form> : null}
        {watchers.length ? (
          <ul className={styles.watcherList}>
            {watchers.map((watcher) => (
              <li key={watcher.userId}>
                <span>{initials(watcher.user.displayName)}</span>
                {watcher.user.displayName}
                {canUpdateTask && watcher.userId !== currentUserId ? <button aria-label={`Remove ${watcher.user.displayName}`} onClick={() => void onRemoveWatcher(watcher.userId)} type="button">×</button> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No one is watching this task yet.</p>
        )}
      </section>
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
                {editingChecklistItemId === item.id ? (
                  <form
                    className={styles.inlineEditForm}
                    onSubmit={(event) => void onChecklistUpdate(event, item.id)}
                  >
                    <input
                      autoFocus
                      defaultValue={item.content}
                      maxLength={500}
                      name="content"
                      required
                    />
                    <button disabled={isSavingItemId === item.id} type="submit">
                      Save
                    </button>
                    <button
                      disabled={isSavingItemId === item.id}
                      onClick={() => setEditingChecklistItemId(undefined)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
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
                )}
                {canUpdateTask ? (
                  <div className={styles.checklistActions}>
                    <button
                      aria-label={`Edit checklist item: ${item.content}`}
                      className={styles.iconButton}
                      disabled={isSavingItemId === item.id}
                      onClick={() => setEditingChecklistItemId(item.id)}
                      title="Edit checklist item"
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={14} />
                    </button>
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
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section
        className={styles.subtasksSection}
        aria-labelledby="subtasks-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="subtasks-title">Subtasks</h3>
            <p>
              {task.parentTaskId
                ? "This is a subtask"
                : `${subtasks.length} work items`}
            </p>
          </div>
          <ClipboardList aria-hidden="true" size={18} />
        </div>
        {parentTask ? (
          <Link
            className={styles.parentTaskLink}
            href={`/workspaces/${workspaceId}/projects/${parentTask.projectId}?taskId=${parentTask.id}`}
          >
            <span>Parent</span>
            <strong>
              {parentTask.key}: {parentTask.title}
            </strong>
          </Link>
        ) : null}
        {!task.parentTaskId && canCreateTask ? (
          <form
            className={styles.inlineForm}
            onSubmit={(event) => void onCreateSubtask(event)}
          >
            <label className={styles.srOnly} htmlFor="subtask-title">
              New subtask
            </label>
            <input
              id="subtask-title"
              maxLength={200}
              minLength={2}
              name="title"
              placeholder="Add a subtask"
              required
            />
            <button disabled={isCreatingSubtask} type="submit">
              {isCreatingSubtask ? "Adding" : "Add"}
            </button>
          </form>
        ) : null}
        {!task.parentTaskId && subtasks.length === 0 ? (
          <p className={styles.empty}>No subtasks yet.</p>
        ) : null}
        {subtasks.length ? (
          <ul className={styles.subtaskList}>
            {subtasks.map((subtask) => (
              <li key={subtask.id}>
                <Link
                  href={`/workspaces/${workspaceId}/projects/${subtask.projectId}?taskId=${subtask.id}`}
                >
                  <strong>{subtask.key}</strong>
                  <span>{subtask.title}</span>
                </Link>
                <span>{subtask.status.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className={styles.attachmentsSection}
        aria-labelledby="attachments-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="attachments-title">Attachments</h3>
            <p>PDF, images, MP4 or WebM up to 50 MB</p>
          </div>
          <Paperclip aria-hidden="true" size={18} />
        </div>
        {canUpdateTask ? (
          <label className={styles.uploadButton}>
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm"
              disabled={isUploadingAttachment}
              multiple
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
            {attachments.map((attachment) => {
              const previewUrl = getTaskAttachmentPreviewUrl(
                workspaceId,
                task.projectId,
                task.id,
                attachment.id,
              );
              const canPreview =
                isPreviewableAttachment(attachment) && previewUrl;

              return (
                <li key={attachment.id}>
                  {canPreview ? (
                    <AttachmentPreview
                      attachment={attachment}
                      onOpen={() =>
                        setSelectedAttachment({ attachment, previewUrl })
                      }
                      previewUrl={previewUrl}
                    />
                  ) : null}
                  <div>
                    <strong>{attachment.originalFilename}</strong>
                    <span>
                      {formatFileSize(attachment.sizeBytes)} ·{" "}
                      {attachment.uploadedBy?.displayName ?? "Former member"}
                    </span>
                  </div>
                  <div className={styles.attachmentActions}>
                    {canPreview ? (
                      <button
                        aria-label={`Open ${attachment.originalFilename}`}
                        onClick={() =>
                          setSelectedAttachment({ attachment, previewUrl })
                        }
                        title="Open preview"
                        type="button"
                      >
                        <Maximize2 aria-hidden="true" size={16} />
                      </button>
                    ) : null}
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
                      <label
                        className={styles.replaceAttachmentButton}
                        title="Replace attachment"
                      >
                        <input
                          accept={
                            attachment.mimeType.startsWith("image/")
                              ? "image/jpeg,image/png,image/webp"
                              : attachment.mimeType.startsWith("video/")
                                ? "video/mp4,video/webm"
                                : "application/pdf"
                          }
                          disabled={
                            isReplacingAttachmentId === attachment.id ||
                            isDeletingAttachmentId === attachment.id
                          }
                          onChange={(event) =>
                            void onAttachmentReplace(event, attachment)
                          }
                          type="file"
                        />
                        <Pencil aria-hidden="true" size={15} />
                        <span className={styles.srOnly}>
                          Replace {attachment.originalFilename}
                        </span>
                      </label>
                    ) : null}
                    {canUpdateTask ? (
                      <button
                        aria-label={`Delete ${attachment.originalFilename}`}
                        className={styles.deleteButton}
                        disabled={
                          isDeletingAttachmentId === attachment.id ||
                          isReplacingAttachmentId === attachment.id
                        }
                        onClick={() => void onAttachmentDelete(attachment.id)}
                        title="Delete attachment"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section
        className={styles.relationsSection}
        aria-labelledby="relations-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="relations-title">Linked work items</h3>
            <p>Dependencies and related tasks</p>
          </div>
          <Link2 aria-hidden="true" size={18} />
        </div>
        {canUpdateTask ? (
          <form
            className={styles.relationForm}
            onSubmit={(event) => void onRelationSubmit(event)}
          >
            <label className={styles.srOnly} htmlFor="relation-type">
              Relation type
            </label>
            <select
              defaultValue="relates_to"
              id="relation-type"
              name="relationType"
            >
              <option value="blocks">Blocks</option>
              <option value="relates_to">Relates to</option>
              <option value="duplicates">Duplicates</option>
            </select>
            <label className={styles.srOnly} htmlFor="relation-target">
              Related task
            </label>
            <select id="relation-target" name="targetTaskId" required>
              <option value="">Choose a task</option>
              {relatedTaskOptions
                .filter((candidate) => candidate.id !== task.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.key}: {candidate.title}
                  </option>
                ))}
            </select>
            <button disabled={isCreatingRelation} type="submit">
              {isCreatingRelation ? "Linking" : "Link"}
            </button>
          </form>
        ) : null}
        {isLoading ? (
          <p className={styles.empty}>Loading linked items…</p>
        ) : null}
        {!isLoading && relations.length === 0 ? (
          <p className={styles.empty}>No linked work items yet.</p>
        ) : null}
        {relations.length ? (
          <ul className={styles.relationList}>
            {relations.map((relation) => (
              <li key={relation.id}>
                <span className={styles.relationType}>
                  {formatRelationType(relation.relationType)}
                </span>
                <Link
                  className={styles.relatedTaskLink}
                  href={`/workspaces/${workspaceId}/projects/${relation.task.projectId}?taskId=${relation.task.id}`}
                >
                  <strong>{relation.task.key}</strong>
                  <span>{relation.task.title}</span>
                </Link>
                {canUpdateTask ? (
                  <button
                    aria-label={`Remove relation to ${relation.task.key}`}
                    className={styles.deleteButton}
                    disabled={isDeletingRelationId === relation.id}
                    onClick={() => void onRelationDelete(relation.id)}
                    title="Remove task relation"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                ) : null}
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
                <RichTextEditor
                  id="comment-body"
                  maxLength={5000}
                  name="body"
                  placeholder="Write a comment…"
                  resetKey={commentEditorResetKey}
                />
                <div className={styles.commentComposerActions}>
                  <label className={styles.commentUploadButton}>
                    <input
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      disabled={
                        isSubmittingComment || isUploadingCommentAttachments
                      }
                      multiple
                      onChange={(event) =>
                        setCommentDraftFiles(
                          Array.from(event.target.files ?? []),
                        )
                      }
                      type="file"
                    />
                    <Paperclip aria-hidden="true" size={15} />
                    Add media
                  </label>
                  <button
                    disabled={
                      isSubmittingComment || isUploadingCommentAttachments
                    }
                    type="submit"
                  >
                    {isSubmittingComment || isUploadingCommentAttachments
                      ? "Sending"
                      : "Comment"}
                  </button>
                </div>
                {commentDraftFiles.length ? (
                  <ul className={styles.commentDraftFiles}>
                    {commentDraftFiles.map((file) => (
                      <li key={`${file.name}-${file.lastModified}`}>
                        <span>
                          {file.type.startsWith("video/") ? "Video" : "Image"}:{" "}
                          {file.name}
                        </span>
                        <button
                          aria-label={`Remove ${file.name}`}
                          disabled={
                            isSubmittingComment || isUploadingCommentAttachments
                          }
                          onClick={() => removeCommentDraftFile(file)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
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
                          <RichTextEditor
                            defaultValue={comment.body}
                            id={`comment-edit-${comment.id}`}
                            maxLength={5000}
                            name="body"
                            placeholder="Edit comment…"
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
                        <>
                          <RichTextContent value={comment.body} />
                          {comment.attachments.length ? (
                            <ul className={styles.commentAttachmentList}>
                              {comment.attachments.map((attachment) => {
                                const previewUrl = getTaskAttachmentPreviewUrl(
                                  workspaceId,
                                  task.projectId,
                                  task.id,
                                  attachment.id,
                                );
                                return (
                                  <li key={attachment.id}>
                                    <AttachmentPreview
                                      attachment={attachment}
                                      onOpen={() => {
                                        if (previewUrl) {
                                          setSelectedAttachment({
                                            attachment,
                                            previewUrl,
                                          });
                                        }
                                      }}
                                      previewUrl={previewUrl ?? undefined}
                                    />
                                    <span>{attachment.originalFilename}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </>
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
      {selectedAttachment ? (
        <Modal
          isOpen
          onClose={() => setSelectedAttachment(undefined)}
          title={selectedAttachment.attachment.originalFilename}
          width="wide"
        >
          <div className={styles.attachmentPreviewDialog}>
            <AttachmentMedia
              attachment={selectedAttachment.attachment}
              previewUrl={selectedAttachment.previewUrl}
            />
            <a
              className={styles.downloadPreviewLink}
              href={
                getTaskAttachmentDownloadUrl(
                  workspaceId,
                  task.projectId,
                  task.id,
                  selectedAttachment.attachment.id,
                ) ?? undefined
              }
            >
              <Download aria-hidden="true" size={16} />
              Download original
            </a>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function AttachmentPreview({
  attachment,
  onOpen,
  previewUrl,
}: {
  attachment: TaskAttachment;
  onOpen: () => void;
  previewUrl?: string;
}) {
  if (!previewUrl) return null;

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <video
        aria-label={`Preview of ${attachment.originalFilename}`}
        className={styles.attachmentVideo}
        controls
        preload="metadata"
      >
        <source src={previewUrl} type={attachment.mimeType} />
        Your browser cannot play this video. Download it instead.
      </video>
    );
  }

  return (
    <button
      aria-label={`Open ${attachment.originalFilename}`}
      className={styles.attachmentImageLink}
      onClick={onOpen}
      type="button"
    >
      <Image
        alt={`Preview of ${attachment.originalFilename}`}
        className={styles.attachmentImage}
        height={240}
        loading="lazy"
        src={previewUrl}
        unoptimized
        width={360}
      />
    </button>
  );
}

function AttachmentMedia({
  attachment,
  previewUrl,
}: AttachmentPreviewSelection) {
  if (attachment.mimeType.startsWith("video/")) {
    return (
      <video className={styles.attachmentDialogVideo} controls autoPlay>
        <source src={previewUrl} type={attachment.mimeType} />
        Your browser cannot play this video. Download it instead.
      </video>
    );
  }

  return (
    <Image
      alt={`Preview of ${attachment.originalFilename}`}
      className={styles.attachmentDialogImage}
      height={900}
      src={previewUrl}
      unoptimized
      width={1200}
    />
  );
}

function isPreviewableAttachment(attachment: TaskAttachment) {
  return (
    attachment.mimeType.startsWith("image/") ||
    attachment.mimeType.startsWith("video/")
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
    task_updated: describeTaskUpdate(event),
    task_deleted: "deleted this task",
    task_restored: "restored this task",
    task_comment_created: "added a comment",
    task_comment_updated: "updated a comment",
    task_comment_deleted: "deleted a comment",
    task_attachment_added: `uploaded ${activityValue(event, "filename", "a file")}`,
    task_attachment_removed: `removed ${activityValue(event, "filename", "a file")}`,
    task_relation_added: `linked ${activityValue(event, "targetTaskKey", "a task")}`,
    task_relation_removed: "removed a task link",
    task_checklist_item_added: `added checklist item “${activityValue(event, "content", "Untitled")}”`,
    task_checklist_item_updated: describeChecklistUpdate(event),
    task_checklist_item_removed: `removed checklist item “${activityValue(event, "content", "Untitled")}”`,
    task_time_logged: `logged ${formatDuration(Number(event.data.minutes) || 0)}`,
    task_timer_started: "started the timer",
    task_timer_stopped: `stopped the timer after ${formatDuration(Number(event.data.minutes) || 0)}`,
  };
  return `${actor} ${descriptions[event.eventType]}`;
}

function describeChecklistUpdate(event: TaskActivityEvent) {
  if (typeof event.data.isCompleted === "boolean") {
    return `${event.data.isCompleted ? "completed" : "reopened"} checklist item “${activityValue(event, "content", "Untitled")}”`;
  }
  return `updated checklist item “${activityValue(event, "content", "Untitled")}”`;
}

function describeTaskUpdate(event: TaskActivityEvent) {
  const statusName = activityValue(event, "statusName", "");
  if (statusName) return `moved this task to ${statusName}`;

  const fields = event.data.fields;
  if (!Array.isArray(fields)) return "updated this task";

  const fieldLabels: Record<string, string> = {
    assigneeUserId: "assignee",
    description: "description",
    dueDate: "due date",
    parentTaskId: "parent task",
    priority: "priority",
    sprintId: "sprint",
    statusId: "status",
    title: "title",
    type: "work type",
  };
  const labels = fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => fieldLabels[field] ?? field)
    .slice(0, 3);

  if (!labels.length) return "updated this task";
  return `updated ${formatList(labels)}`;
}

function formatList(values: string[]) {
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function activityValue(
  event: TaskActivityEvent,
  key: string,
  fallback: string,
) {
  const value = event.data[key];
  return typeof value === "string" && value ? value : fallback;
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatRelationType(relationType: TaskRelation["relationType"]) {
  return relationType.replaceAll("_", " ");
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
