import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { db } from "../../core/db/client.js";
import { workspaceCalls } from "../../core/db/schema/workspace-calls.js";
import { workspaceAgreements } from "../../core/db/schema/workspace-agreements.js";
import { projectKnowledgeEntries } from "../../core/db/schema/project-knowledge.js";
import { projects } from "../../core/db/schema/projects.js";
import { taskComments } from "../../core/db/schema/task-comments.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { AppError } from "../../core/errors/app-error.js";
import { findWorkspaceForUser } from "../workspaces/workspaces.repository.js";

const take = 8;

export async function searchWorkspace(input: {
  query: string;
  userId: string;
  workspaceId: string;
}) {
  if (
    !(await findWorkspaceForUser({
      userId: input.userId,
      workspaceId: input.workspaceId,
    }))
  )
    throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  const term = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
  const [
    taskRows,
    projectRows,
    callRows,
    agreementRows,
    commentRows,
    knowledgeRows,
  ] = await Promise.all([
    db
      .select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, input.workspaceId),
          isNull(tasks.deletedAt),
          or(ilike(tasks.title, term), ilike(tasks.description, term)),
        ),
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(take),
    db
      .select({ id: projects.id, key: projects.key, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          isNull(projects.deletedAt),
          or(ilike(projects.name, term), ilike(projects.key, term)),
        ),
      )
      .orderBy(desc(projects.updatedAt))
      .limit(take),
    db
      .select({
        id: workspaceCalls.id,
        projectId: workspaceCalls.projectId,
        title: workspaceCalls.title,
      })
      .from(workspaceCalls)
      .where(
        and(
          eq(workspaceCalls.workspaceId, input.workspaceId),
          or(
            ilike(workspaceCalls.title, term),
            ilike(workspaceCalls.description, term),
          ),
        ),
      )
      .orderBy(desc(workspaceCalls.updatedAt))
      .limit(take),
    db
      .select({ id: workspaceAgreements.id, title: workspaceAgreements.title })
      .from(workspaceAgreements)
      .where(
        and(
          eq(workspaceAgreements.workspaceId, input.workspaceId),
          or(
            ilike(workspaceAgreements.title, term),
            ilike(workspaceAgreements.description, term),
          ),
        ),
      )
      .orderBy(desc(workspaceAgreements.updatedAt))
      .limit(take),
    db
      .select({
        body: taskComments.body,
        projectId: taskComments.projectId,
        taskId: taskComments.taskId,
      })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.workspaceId, input.workspaceId),
          isNull(taskComments.deletedAt),
          ilike(taskComments.body, term),
        ),
      )
      .orderBy(desc(taskComments.updatedAt))
      .limit(take),
    db
      .select({
        id: projectKnowledgeEntries.id,
        projectId: projectKnowledgeEntries.projectId,
        title: projectKnowledgeEntries.title,
      })
      .from(projectKnowledgeEntries)
      .where(
        and(
          eq(projectKnowledgeEntries.workspaceId, input.workspaceId),
          or(
            ilike(projectKnowledgeEntries.title, term),
            ilike(projectKnowledgeEntries.summary, term),
            ilike(projectKnowledgeEntries.content, term),
          ),
        ),
      )
      .orderBy(desc(projectKnowledgeEntries.updatedAt))
      .limit(take),
  ]);
  return [
    ...taskRows.map((item) => ({
      id: item.id,
      kind: "task" as const,
      projectId: item.projectId,
      subtitle: "Task",
      title: item.title,
      url: `/workspaces/${input.workspaceId}/projects/${item.projectId}/tasks/${item.id}`,
    })),
    ...projectRows.map((item) => ({
      id: item.id,
      kind: "project" as const,
      projectId: item.id,
      subtitle: `Project · ${item.key}`,
      title: item.name,
      url: `/workspaces/${input.workspaceId}/projects/${item.id}`,
    })),
    ...callRows.map((item) => ({
      id: item.id,
      kind: "call" as const,
      projectId: item.projectId,
      subtitle: "Call",
      title: item.title,
      url: `/workspaces/${input.workspaceId}/calls?call=${item.id}`,
    })),
    ...agreementRows.map((item) => ({
      id: item.id,
      kind: "agreement" as const,
      projectId: null,
      subtitle: "Agreement",
      title: item.title,
      url: `/workspaces/${input.workspaceId}/agreements#${item.id}`,
    })),
    ...commentRows.map((item) => ({
      id: item.taskId,
      kind: "comment" as const,
      projectId: item.projectId,
      subtitle: "Comment",
      title: item.body.replace(/<[^>]*>/g, " ").slice(0, 160),
      url: `/workspaces/${input.workspaceId}/projects/${item.projectId}/tasks/${item.taskId}`,
    })),
    ...knowledgeRows.map((item) => ({
      id: item.id,
      kind: "knowledge" as const,
      projectId: item.projectId,
      subtitle: "Knowledge base",
      title: item.title,
      url: `/workspaces/${input.workspaceId}/projects/${item.projectId}/knowledge#${item.id}`,
    })),
  ].slice(0, 30);
}
