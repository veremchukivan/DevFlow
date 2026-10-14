import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskComments } from "../../core/db/schema/task-comments.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { users } from "../../core/db/schema/users.js";
import { workspaceMembers } from "../../core/db/schema/workspace-members.js";
import { workspaces } from "../../core/db/schema/workspaces.js";

export async function findActiveWorkspaceMembership(input: {
  userId: string;
  workspaceId: string;
}) {
  const [membership] = await db
    .select({
      role: workspaceMembers.role,
      workspaceId: workspaceMembers.workspaceId
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return membership;
}

export async function findTaskInProject(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      workspaceId: tasks.workspaceId
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.workspaceId, tasks.workspaceId)
      )
    )
    .where(
      and(
        eq(tasks.id, input.taskId),
        eq(tasks.projectId, input.projectId),
        eq(tasks.workspaceId, input.workspaceId),
        isNull(projects.deletedAt),
        isNull(tasks.deletedAt)
      )
    )
    .limit(1);

  return task;
}

export async function createTaskComment(input: {
  authorUserId: string;
  body: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [comment] = await db
    .insert(taskComments)
    .values(input)
    .returning({
      id: taskComments.id
    });

  if (!comment) {
    throw new Error("Failed to create task comment");
  }

  return findTaskCommentById({
    commentId: comment.id,
    projectId: input.projectId,
    taskId: input.taskId,
    workspaceId: input.workspaceId
  });
}

export async function listTaskComments(input: {
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  return taskCommentSelect()
    .where(
      and(
        eq(taskComments.projectId, input.projectId),
        eq(taskComments.taskId, input.taskId),
        eq(taskComments.workspaceId, input.workspaceId),
        isNull(taskComments.deletedAt)
      )
    )
    .orderBy(asc(taskComments.createdAt));
}

async function findTaskCommentById(input: {
  commentId: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  const [comment] = await taskCommentSelect()
    .where(
      and(
        eq(taskComments.id, input.commentId),
        eq(taskComments.projectId, input.projectId),
        eq(taskComments.taskId, input.taskId),
        eq(taskComments.workspaceId, input.workspaceId),
        isNull(taskComments.deletedAt)
      )
    )
    .limit(1);

  return comment;
}

function taskCommentSelect() {
  return db
    .select({
      authorDisplayName: users.displayName,
      authorId: users.id,
      authorUserId: taskComments.authorUserId,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      id: taskComments.id,
      projectId: taskComments.projectId,
      taskId: taskComments.taskId,
      updatedAt: taskComments.updatedAt,
      workspaceId: taskComments.workspaceId
    })
    .from(taskComments)
    .leftJoin(
      users,
      and(eq(users.id, taskComments.authorUserId), isNull(users.deletedAt))
    );
}
