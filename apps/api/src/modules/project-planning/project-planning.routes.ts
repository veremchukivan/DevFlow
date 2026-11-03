import { createProjectReleaseRequestSchema, projectPlanningParamsSchema, projectPlanningResponseSchema, projectPlanningTaskParamsSchema, projectReleaseParamsSchema, updateProjectPlanningTaskRequestSchema, updateProjectReleaseRequestSchema } from "@devflow/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../core/db/client.js";
import { projectReleases } from "../../core/db/schema/project-releases.js";
import { projectStatuses } from "../../core/db/schema/project-statuses.js";
import { taskRelations } from "../../core/db/schema/task-relations.js";
import { tasks } from "../../core/db/schema/tasks.js";
import { AppError } from "../../core/errors/app-error.js";
import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import { canUpdateProject } from "../projects/projects.policy.js";
import { findActiveWorkspaceMembership, findProjectInWorkspace } from "../projects/projects.repository.js";

export const projectPlanningRouter = Router({ mergeParams: true });
projectPlanningRouter.use(requireAuth);
const userId = (req: unknown) => (req as AuthenticatedRequest).auth.user.id;

projectPlanningRouter.get("/", async (req, res) => {
  const params = projectPlanningParamsSchema.parse(req.params); await access({ ...params, userId: userId(req) });
  const [taskRows, releaseRows] = await Promise.all([planningTasks(params), releases(params)]);
  res.json(projectPlanningResponseSchema.parse({ tasks: taskRows, releases: releaseRows, generatedAt: new Date().toISOString() }));
});
projectPlanningRouter.post("/releases", async (req, res) => {
  const params = projectPlanningParamsSchema.parse(req.params); await access({ ...params, userId: userId(req) }, true);
  const [release] = await db.insert(projectReleases).values({ ...createProjectReleaseRequestSchema.parse(req.body), createdByUserId: userId(req), projectId: params.projectId, workspaceId: params.workspaceId }).returning();
  if (!release) throw new Error("Failed to create release"); res.status(201).json({ release: await releaseDto(release) });
});
projectPlanningRouter.patch("/releases/:releaseId", async (req, res) => {
  const params = projectReleaseParamsSchema.parse(req.params); await access({ ...params, userId: userId(req) }, true);
  const [release] = await db.update(projectReleases).set({ ...updateProjectReleaseRequestSchema.parse(req.body), updatedAt: new Date() }).where(and(eq(projectReleases.id, params.releaseId), eq(projectReleases.workspaceId, params.workspaceId), eq(projectReleases.projectId, params.projectId))).returning();
  if (!release) throw new AppError(404, "RELEASE_NOT_FOUND", "Release not found"); res.json({ release: await releaseDto(release) });
});
projectPlanningRouter.delete("/releases/:releaseId", async (req, res) => {
  const params = projectReleaseParamsSchema.parse(req.params); await access({ ...params, userId: userId(req) }, true);
  await db.delete(projectReleases).where(and(eq(projectReleases.id, params.releaseId), eq(projectReleases.workspaceId, params.workspaceId), eq(projectReleases.projectId, params.projectId))); res.status(204).send();
});
projectPlanningRouter.patch("/tasks/:taskId", async (req, res) => {
  const params = projectPlanningTaskParamsSchema.parse(req.params); await access({ ...params, userId: userId(req) }, true); const input = updateProjectPlanningTaskRequestSchema.parse(req.body);
  if (input.epicId) { const [epic] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, input.epicId), eq(tasks.workspaceId, params.workspaceId), eq(tasks.projectId, params.projectId), eq(tasks.type, "epic"), isNull(tasks.deletedAt))).limit(1); if (!epic) throw new AppError(400, "EPIC_INVALID", "Choose an Epic from this project"); }
  if (input.releaseId) { const [release] = await db.select({ id: projectReleases.id }).from(projectReleases).where(and(eq(projectReleases.id, input.releaseId), eq(projectReleases.workspaceId, params.workspaceId), eq(projectReleases.projectId, params.projectId))).limit(1); if (!release) throw new AppError(400, "RELEASE_INVALID", "Choose a release from this project"); }
  const [task] = await db.update(tasks).set({ ...input, updatedAt: new Date(), version: sql`${tasks.version} + 1` }).where(and(eq(tasks.id, params.taskId), eq(tasks.workspaceId, params.workspaceId), eq(tasks.projectId, params.projectId), isNull(tasks.deletedAt))).returning(); if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  const result = (await planningTasks(params)).find((row) => row.id === task.id); if (!result) throw new Error("Failed to load planning task"); res.json({ task: result });
});

async function access(input: { workspaceId: string; projectId: string; userId: string }, update = false) { const membership = await findActiveWorkspaceMembership(input); if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found"); if (update && !canUpdateProject(membership.role)) throw new AppError(403, "PROJECT_UPDATE_FORBIDDEN", "You cannot update planning in this workspace"); if (!(await findProjectInWorkspace(input))) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found"); }
async function planningTasks(scope: { workspaceId: string; projectId: string }) {
  const rows = await db.select({ id: tasks.id, number: tasks.number, title: tasks.title, type: tasks.type, priority: tasks.priority, dueDate: tasks.dueDate, sprintId: tasks.sprintId, epicId: tasks.epicId, releaseId: tasks.releaseId, complexityPoints: tasks.complexityPoints, statusCategory: projectStatuses.category }).from(tasks).innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId)).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.projectId, scope.projectId), isNull(tasks.deletedAt))).orderBy(asc(tasks.position));
  const dependencyRows = await db.select({ sourceTaskId: taskRelations.sourceTaskId, targetStatus: projectStatuses.category }).from(taskRelations).innerJoin(tasks, eq(tasks.id, taskRelations.targetTaskId)).innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId)).where(eq(taskRelations.workspaceId, scope.workspaceId)); const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => { const dependencies = dependencyRows.filter((dependency) => dependency.sourceTaskId === row.id); const blocked = dependencies.some((dependency) => dependency.targetStatus !== "done"); const risk = blocked ? "blocked" : row.dueDate && row.statusCategory !== "done" && row.dueDate < today ? "overdue" : row.dueDate && row.statusCategory !== "done" && row.dueDate <= new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) ? "due_soon" : "none"; return { ...row, key: `#${row.number}`, dependencyCount: dependencies.length, blockedByOpenDependency: blocked, risk }; });
}
async function releases(scope: { workspaceId: string; projectId: string }) { const rows = await db.select().from(projectReleases).where(and(eq(projectReleases.workspaceId, scope.workspaceId), eq(projectReleases.projectId, scope.projectId))).orderBy(asc(projectReleases.releaseDate)); return Promise.all(rows.map(releaseDto)); }
async function releaseDto(release: typeof projectReleases.$inferSelect) { const [count] = await db.select({ total: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where ${projectStatuses.category} = 'done')::int` }).from(tasks).innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId)).where(and(eq(tasks.releaseId, release.id), isNull(tasks.deletedAt))); return { ...release, taskCount: count?.total ?? 0, completedTaskCount: count?.done ?? 0, createdAt: release.createdAt.toISOString(), updatedAt: release.updatedAt.toISOString() }; }
