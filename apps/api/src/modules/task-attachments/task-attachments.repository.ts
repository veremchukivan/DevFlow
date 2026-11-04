import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskAttachments } from "../../core/db/schema/task-attachments.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

const uploadedByUsers = alias(users, "task_attachment_uploaded_by_users");

type TaskScope = {
  projectId: string;
  taskId: string;
  workspaceId: string;
};

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  return membership;
}

export async function findTaskInProject(input: TaskScope) {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId),
      ),
    )
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  return task;
}

export async function listTaskAttachments(input: TaskScope) {
  return attachmentSelect()
    .where(and(attachmentConditions(input), isNull(taskAttachments.commentId)))
    .orderBy(asc(taskAttachments.createdAt), asc(taskAttachments.id));
}

export async function listCommentAttachments(input: TaskScope & { commentIds: string[] }) {
  if (input.commentIds.length === 0) return [];

  return attachmentSelect()
    .where(
      and(
        attachmentConditions(input),
        inArray(taskAttachments.commentId, input.commentIds),
      ),
    )
    .orderBy(asc(taskAttachments.createdAt), asc(taskAttachments.id));
}

export async function findTaskAttachment(
  input: TaskScope & { attachmentId: string },
) {
  const [attachment] = await attachmentSelect()
    .where(
      and(
        attachmentConditions(input),
        eq(taskAttachments.id, input.attachmentId),
      ),
    )
    .limit(1);
  return attachment;
}

export async function createTaskAttachment(
  input: TaskScope & {
    commentId?: string;
    mimeType: string;
    originalFilename: string;
    sizeBytes: number;
    storageKey: string;
    uploadedByUserId: string;
  },
) {
  const [attachment] = await db
    .insert(taskAttachments)
    .values(input)
    .returning();
  if (!attachment) throw new Error("Failed to create task attachment");
  return attachment;
}

export async function deleteTaskAttachment(
  input: TaskScope & { attachmentId: string },
) {
  const [attachment] = await db
    .delete(taskAttachments)
    .where(
      and(
        attachmentConditions(input),
        eq(taskAttachments.id, input.attachmentId),
      ),
    )
    .returning();
  return attachment;
}

function attachmentConditions(input: TaskScope) {
  return and(
    eq(taskAttachments.workspaceId, input.workspaceId),
    eq(taskAttachments.projectId, input.projectId),
    eq(taskAttachments.taskId, input.taskId),
  );
}

function attachmentSelect() {
  return db
    .select({
      createdAt: taskAttachments.createdAt,
      commentId: taskAttachments.commentId,
      id: taskAttachments.id,
      mimeType: taskAttachments.mimeType,
      originalFilename: taskAttachments.originalFilename,
      projectId: taskAttachments.projectId,
      sizeBytes: taskAttachments.sizeBytes,
      storageKey: taskAttachments.storageKey,
      taskId: taskAttachments.taskId,
      uploadedByUserId: taskAttachments.uploadedByUserId,
      uploadedBy: {
        displayName: uploadedByUsers.displayName,
        id: uploadedByUsers.id,
      },
      workspaceId: taskAttachments.workspaceId,
    })
    .from(taskAttachments)
    .leftJoin(
      uploadedByUsers,
      and(
        eq(uploadedByUsers.id, taskAttachments.uploadedByUserId),
        isNull(uploadedByUsers.deletedAt),
      ),
    );
}
