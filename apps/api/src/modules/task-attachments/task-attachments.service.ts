import { AppError } from "../../core/errors/app-error.js";
import {
  deleteStoredFile,
  getStoredFileSize,
  saveTaskAttachment,
} from "../../core/uploads/images.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
import { canUpdateTaskComment } from "../task-comments/task-comments.policy.js";
import { findTaskCommentById } from "../task-comments/task-comments.repository.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import {
  createTaskAttachment,
  deleteTaskAttachment,
  findActiveWorkspaceMembership,
  findTaskAttachment,
  findTaskInProject,
  listTaskAttachments,
} from "./task-attachments.repository.js";

type TaskAttachmentScope = {
  projectId: string;
  taskId: string;
  userId: string;
  workspaceId: string;
};

export async function listAttachments(input: TaskAttachmentScope) {
  await requireTaskReadAccess(input);
  return listTaskAttachments(input);
}

export async function addAttachment(
  input: TaskAttachmentScope & { file: Express.Multer.File },
) {
  await requireTaskUpdateAccess(input);
  const storageKey = await saveTaskAttachment(input.file);
  try {
    const attachment = await createTaskAttachment({
      mimeType: input.file.mimetype,
      originalFilename: normalizeFilename(input.file.originalname),
      projectId: input.projectId,
      sizeBytes: input.file.size,
      storageKey,
      taskId: input.taskId,
      uploadedByUserId: input.userId,
      workspaceId: input.workspaceId,
    });
    await recordTaskActivity({
      actorUserId: input.userId,
      data: { filename: attachment.originalFilename },
      eventType: "task_attachment_added",
      projectId: input.projectId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
    });
    return attachment;
  } catch (error) {
    await deleteStoredFile(storageKey);
    throw error;
  }
}

export async function addCommentAttachment(
  input: TaskAttachmentScope & {
    commentId: string;
    file: Express.Multer.File;
  },
) {
  const membership = await requireTaskUpdateAccess(input);
  const comment = await findTaskCommentById(input);

  if (!comment) {
    throw new AppError(404, "TASK_COMMENT_NOT_FOUND", "Task comment not found");
  }
  if (
    !canUpdateTaskComment(
      membership.role,
      comment.authorUserId === input.userId,
    )
  ) {
    throw new AppError(
      403,
      "TASK_COMMENT_UPDATE_FORBIDDEN",
      "You cannot add files to this task comment",
    );
  }
  if (!input.file.mimetype.startsWith("image/") && !input.file.mimetype.startsWith("video/")) {
    throw new AppError(
      400,
      "COMMENT_ATTACHMENT_TYPE_INVALID",
      "Comments support image and video files only",
    );
  }

  const storageKey = await saveTaskAttachment(input.file);
  try {
    const attachment = await createTaskAttachment({
      commentId: input.commentId,
      mimeType: input.file.mimetype,
      originalFilename: normalizeFilename(input.file.originalname),
      projectId: input.projectId,
      sizeBytes: input.file.size,
      storageKey,
      taskId: input.taskId,
      uploadedByUserId: input.userId,
      workspaceId: input.workspaceId,
    });
    await recordTaskActivity({
      actorUserId: input.userId,
      data: { commentId: input.commentId, filename: attachment.originalFilename },
      eventType: "task_attachment_added",
      projectId: input.projectId,
      taskId: input.taskId,
      workspaceId: input.workspaceId,
    });
    return attachment;
  } catch (error) {
    await deleteStoredFile(storageKey);
    throw error;
  }
}

export async function removeAttachment(
  input: TaskAttachmentScope & { attachmentId: string },
) {
  await requireTaskUpdateAccess(input);
  const attachment = await deleteTaskAttachment(input);
  if (!attachment) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  await recordTaskActivity({
    actorUserId: input.userId,
    data: { filename: attachment.originalFilename },
    eventType: "task_attachment_removed",
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId,
  });
  await deleteStoredFile(attachment.storageKey);
}

export async function downloadAttachment(
  input: TaskAttachmentScope & { attachmentId: string },
) {
  await requireTaskReadAccess(input);
  const attachment = await findTaskAttachment(input);
  if (!attachment) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }
  const fileSize = await getStoredFileSize(attachment.storageKey).catch(
    (error) => {
      if (error instanceof AppError) throw error;
      throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
    },
  );
  return { attachment, fileSize };
}

async function requireTaskReadAccess(input: TaskAttachmentScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
}

async function requireTaskUpdateAccess(input: TaskAttachmentScope) {
  const membership = await findActiveWorkspaceMembership(input);
  if (!membership) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (!canUpdateTask(membership.role)) {
    throw new AppError(
      403,
      "TASK_ATTACHMENT_UPDATE_FORBIDDEN",
      "You cannot update task attachments in this workspace",
    );
  }
  const task = await findTaskInProject(input);
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return membership;
}

function normalizeFilename(filename: string) {
  return (
    filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "attachment"
  );
}
