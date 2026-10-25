import { AppError } from "../../core/errors/app-error.js";
import {
  deleteStoredFile,
  readStoredFile,
  saveTaskAttachment,
} from "../../core/uploads/images.js";
import { canUpdateTask } from "../tasks/tasks.policy.js";
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
    return await createTaskAttachment({
      mimeType: input.file.mimetype,
      originalFilename: normalizeFilename(input.file.originalname),
      projectId: input.projectId,
      sizeBytes: input.file.size,
      storageKey,
      taskId: input.taskId,
      uploadedByUserId: input.userId,
      workspaceId: input.workspaceId,
    });
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
  const content = await readStoredFile(attachment.storageKey).catch((error) => {
    if (error instanceof AppError) throw error;
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  });
  return { attachment, content };
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
}

function normalizeFilename(filename: string) {
  return (
    filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "attachment"
  );
}
