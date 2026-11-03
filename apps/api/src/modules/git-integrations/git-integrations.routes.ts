import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../../core/crypto/integrations.js";
import { db } from "../../core/db/client.js";
import { gitConnections, projectRepositories, taskGitLinks } from "../../core/db/schema/git-integrations.js";
import { AppError } from "../../core/errors/app-error.js";
import { type AuthenticatedRequest, requireAuth } from "../auth/auth.middleware.js";
import { recordTaskActivity } from "../task-activity/task-activity.service.js";
import { findProjectInWorkspace, findActiveWorkspaceMembership } from "../projects/projects.repository.js";
import { canUpdateProject } from "../projects/projects.policy.js";
import { findTaskInProject } from "../tasks/tasks.repository.js";
import { updateTaskDevelopmentFlowInDb, findTaskDevelopmentFlow } from "../task-development-flows/task-development-flows.repository.js";

const providerSchema = z.enum(["github", "gitlab"]);
const projectParams = z.object({ workspaceId: z.uuid(), projectId: z.uuid() });
const taskParams = projectParams.extend({ taskId: z.uuid() });
const repositoryInput = z.object({ connectionId: z.uuid(), fullName: z.string().trim().min(3).max(500) });
const branchInput = z.object({ baseBranch: z.string().trim().min(1).max(255).optional(), name: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/, "Use letters, digits, '.', '_' , '/' or '-'") });
const pullRequestInput = z.object({ baseBranch: z.string().trim().min(1).max(255).optional(), body: z.string().trim().max(30_000).optional(), title: z.string().trim().min(1).max(255).optional() });

type Provider = z.infer<typeof providerSchema>;
type Connection = typeof gitConnections.$inferSelect;
type Repository = typeof projectRepositories.$inferSelect;

export const gitIntegrationsRouter = Router({ mergeParams: true });

gitIntegrationsRouter.get("/:provider/connect", requireAuth, (req, res) => {
  const provider = providerSchema.parse(req.params.provider);
  assertConfigured(provider);
  const state = encryptIntegrationSecret(JSON.stringify({ expiresAt: Date.now() + 10 * 60 * 1000, nonce: randomBytes(16).toString("base64url"), provider, userId: userId(req) }));
  const url = authorizationUrl(provider, state);
  res.redirect(302, url.toString());
});

gitIntegrationsRouter.get("/:provider/callback", requireAuth, async (req, res) => {
  const provider = providerSchema.parse(req.params.provider);
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!code || !state) throw new AppError(400, "GIT_CALLBACK_INVALID", "Git provider callback is invalid");
  assertConfigured(provider);
  let payload: { expiresAt: number; provider: Provider; userId: string };
  try { payload = JSON.parse(decryptIntegrationSecret(state)); } catch { throw new AppError(400, "GIT_OAUTH_STATE_INVALID", "Git authorization state is invalid"); }
  if (payload.provider !== provider || payload.userId !== userId(req) || payload.expiresAt < Date.now()) throw new AppError(400, "GIT_OAUTH_STATE_INVALID", "Git authorization state has expired");
  const token = await exchangeCode(provider, code);
  const profile = await getProfile(provider, token.accessToken);
  await db.insert(gitConnections).values({
    accessTokenEncrypted: encryptIntegrationSecret(token.accessToken), avatarUrl: profile.avatarUrl, expiresAt: token.expiresAt,
    provider, providerUserId: profile.id, refreshTokenEncrypted: token.refreshToken ? encryptIntegrationSecret(token.refreshToken) : null,
    scopes: token.scopes, userId: payload.userId, username: profile.username,
  }).onConflictDoUpdate({ target: [gitConnections.userId, gitConnections.provider], set: {
    accessTokenEncrypted: encryptIntegrationSecret(token.accessToken), avatarUrl: profile.avatarUrl, expiresAt: token.expiresAt,
    providerUserId: profile.id, refreshTokenEncrypted: token.refreshToken ? encryptIntegrationSecret(token.refreshToken) : null,
    scopes: token.scopes, updatedAt: new Date(), username: profile.username,
  }});
  res.redirect(302, new URL("/profile?git=connected", env.WEB_ORIGIN).toString());
});

gitIntegrationsRouter.get("/connections", requireAuth, async (req, res) => {
  const connections = await db.select({ avatarUrl: gitConnections.avatarUrl, connectedAt: gitConnections.createdAt, id: gitConnections.id, provider: gitConnections.provider, scopes: gitConnections.scopes, username: gitConnections.username }).from(gitConnections).where(eq(gitConnections.userId, userId(req))).orderBy(desc(gitConnections.createdAt));
  res.json({ connections, configured: { github: isConfigured("github"), gitlab: isConfigured("gitlab") } });
});

gitIntegrationsRouter.delete("/connections/:connectionId", requireAuth, async (req, res) => {
  const connectionId = z.uuid().parse(req.params.connectionId);
  const [deleted] = await db.delete(gitConnections).where(and(eq(gitConnections.id, connectionId), eq(gitConnections.userId, userId(req)))).returning({ id: gitConnections.id });
  if (!deleted) throw new AppError(404, "GIT_CONNECTION_NOT_FOUND", "Git connection not found");
  res.status(204).send();
});

export const projectRepositoryRouter = Router({ mergeParams: true });
projectRepositoryRouter.use(requireAuth);
projectRepositoryRouter.get("/", async (req, res) => {
  const params = projectParams.parse(req.params); await requireProject(params, userId(req), false);
  const [repository] = await db.select({ connectionId: projectRepositories.connectionId, defaultBranch: projectRepositories.defaultBranch, fullName: projectRepositories.fullName, id: projectRepositories.id, isPrivate: projectRepositories.isPrivate, lastSyncedAt: projectRepositories.lastSyncedAt, provider: projectRepositories.provider, webUrl: projectRepositories.webUrl }).from(projectRepositories).where(and(eq(projectRepositories.workspaceId, params.workspaceId), eq(projectRepositories.projectId, params.projectId))).limit(1);
  res.json({ repository: repository ? { ...repository, lastSyncedAt: repository.lastSyncedAt?.toISOString() ?? null } : null });
});
projectRepositoryRouter.put("/", async (req, res) => {
  const params = projectParams.parse(req.params); await requireProject(params, userId(req), true);
  const input = repositoryInput.parse(req.body);
  const connection = await requireConnection(input.connectionId, userId(req));
  const remote = await getRepository(connection, normalizeRepositoryName(connection.provider, input.fullName));
  const [repository] = await db.insert(projectRepositories).values({ connectionId: connection.id, defaultBranch: remote.defaultBranch, externalId: remote.id, fullName: remote.fullName, isPrivate: remote.isPrivate, projectId: params.projectId, provider: connection.provider, webUrl: remote.webUrl, workspaceId: params.workspaceId }).onConflictDoUpdate({ target: projectRepositories.projectId, set: { connectionId: connection.id, defaultBranch: remote.defaultBranch, externalId: remote.id, fullName: remote.fullName, isPrivate: remote.isPrivate, provider: connection.provider, updatedAt: new Date(), webUrl: remote.webUrl } }).returning();
  res.json({ repository: { ...repository!, lastSyncedAt: repository!.lastSyncedAt?.toISOString() ?? null } });
});
projectRepositoryRouter.delete("/", async (req, res) => {
  const params = projectParams.parse(req.params); await requireProject(params, userId(req), true);
  await db.delete(projectRepositories).where(and(eq(projectRepositories.workspaceId, params.workspaceId), eq(projectRepositories.projectId, params.projectId)));
  res.status(204).send();
});
projectRepositoryRouter.get("/release-notes", async (req, res) => {
  const params = projectParams.parse(req.params); await requireProject(params, userId(req), false);
  const rows = await db.select({ key: taskGitLinks.externalId, title: taskGitLinks.label, url: taskGitLinks.url }).from(taskGitLinks)
    .where(and(eq(taskGitLinks.workspaceId, params.workspaceId), eq(taskGitLinks.projectId, params.projectId), eq(taskGitLinks.type, "pull_request"), eq(taskGitLinks.status, "merged")))
    .orderBy(desc(taskGitLinks.updatedAt));
  const notes = rows.length ? rows.map((row) => `- [${row.title}](${row.url})`).join("\n") : "- No merged pull requests or merge requests have been synchronized yet.";
  res.json({ generatedAt: new Date().toISOString(), markdown: `## Release notes\n\n${notes}`, mergedChanges: rows.length });
});

export const taskGitRouter = Router({ mergeParams: true });
taskGitRouter.use(requireAuth);
taskGitRouter.get("/", async (req, res) => {
  const params = taskParams.parse(req.params); await requireTask(params, userId(req), false);
  const links = await db.select().from(taskGitLinks).where(and(eq(taskGitLinks.workspaceId, params.workspaceId), eq(taskGitLinks.projectId, params.projectId), eq(taskGitLinks.taskId, params.taskId))).orderBy(desc(taskGitLinks.createdAt));
  res.json({ links: links.map(toLink) });
});
taskGitRouter.post("/branch", async (req, res) => {
  const params = taskParams.parse(req.params); const task = await requireTask(params, userId(req), true); const input = branchInput.parse(req.body);
  const repository = await requireRepository(params); const connection = await requireConnection(repository.connectionId, userId(req));
  const branch = await createBranch(connection, repository, input.name, input.baseBranch ?? repository.defaultBranch);
  const link = await upsertLink({ ...params, provider: repository.provider, type: "branch", externalId: branch.name, label: branch.name, url: branch.url, status: "created" });
  await updateFlowGitFields(params, { branchName: branch.name, ciStatus: "pending" }); await activity(params, task, userId(req), `created branch ${branch.name}`);
  res.status(201).json({ link: toLink(link) });
});
taskGitRouter.post("/pull-request", async (req, res) => {
  const params = taskParams.parse(req.params); const task = await requireTask(params, userId(req), true); const input = pullRequestInput.parse(req.body);
  const repository = await requireRepository(params); const connection = await requireConnection(repository.connectionId, userId(req));
  const flow = await findTaskDevelopmentFlow(params); const head = flow?.branchName;
  if (!head) throw new AppError(409, "GIT_BRANCH_REQUIRED", "Create or link a branch before opening a pull request");
  const pr = await createPullRequest(connection, repository, { base: input.baseBranch ?? repository.defaultBranch, body: input.body ?? flow?.summary ?? "", head, title: input.title ?? `${task.projectKey}-${task.number}: ${task.title}` });
  const link = await upsertLink({ ...params, provider: repository.provider, type: "pull_request", externalId: pr.id, label: pr.title, url: pr.url, status: pr.status });
  await updateFlowGitFields(params, { pullRequestUrl: pr.url, ciStatus: "pending" }); await activity(params, task, userId(req), `opened pull request ${pr.title}`);
  res.status(201).json({ link: toLink(link) });
});
taskGitRouter.post("/sync", async (req, res) => {
  const params = taskParams.parse(req.params); const task = await requireTask(params, userId(req), false); const repository = await requireRepository(params); const connection = await requireConnection(repository.connectionId, userId(req));
  const result = await syncTask(connection, repository, params); await activity(params, task, userId(req), "synchronized Git activity");
  res.json({ links: result.links.map(toLink), ciStatus: result.ciStatus, synchronizedAt: new Date().toISOString() });
});

function userId(req: unknown) { return (req as AuthenticatedRequest).auth.user.id; }
function isConfigured(provider: Provider) { return provider === "github" ? Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_REDIRECT_URI && env.INTEGRATION_ENCRYPTION_KEY) : Boolean(env.GITLAB_CLIENT_ID && env.GITLAB_CLIENT_SECRET && env.GITLAB_REDIRECT_URI && env.INTEGRATION_ENCRYPTION_KEY); }
function assertConfigured(provider: Provider) { if (!isConfigured(provider)) throw new AppError(503, "GIT_PROVIDER_NOT_CONFIGURED", `${provider === "github" ? "GitHub" : "GitLab"} integration is not configured`); }
function authorizationUrl(provider: Provider, state: string) { const url = new URL(provider === "github" ? "https://github.com/login/oauth/authorize" : "https://gitlab.com/oauth/authorize"); url.searchParams.set("client_id", provider === "github" ? env.GITHUB_CLIENT_ID! : env.GITLAB_CLIENT_ID!); url.searchParams.set("redirect_uri", provider === "github" ? env.GITHUB_REDIRECT_URI! : env.GITLAB_REDIRECT_URI!); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", provider === "github" ? "repo read:user" : "api read_user"); url.searchParams.set("state", state); return url; }

async function exchangeCode(provider: Provider, code: string) { const github = provider === "github"; const response = await fetch(github ? "https://github.com/login/oauth/access_token" : "https://gitlab.com/oauth/token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: github ? env.GITHUB_CLIENT_ID! : env.GITLAB_CLIENT_ID!, client_secret: github ? env.GITHUB_CLIENT_SECRET! : env.GITLAB_CLIENT_SECRET!, code, grant_type: "authorization_code", redirect_uri: github ? env.GITHUB_REDIRECT_URI! : env.GITLAB_REDIRECT_URI! }) });
  if (!response.ok) throw new AppError(502, "GIT_TOKEN_EXCHANGE_FAILED", "Unable to connect the Git account"); const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }; if (!data.access_token) throw new AppError(502, "GIT_TOKEN_EXCHANGE_FAILED", "Git provider returned an invalid token"); return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null, scopes: data.scope?.split(/[ ,]+/).filter(Boolean) ?? [] };
}
async function getProfile(provider: Provider, token: string) { const response = await providerFetch(provider, "/user", token); if (!response.ok) throw new AppError(502, "GIT_PROFILE_REQUEST_FAILED", "Unable to read the Git account profile"); const data = await response.json() as any; return provider === "github" ? { id: String(data.id), username: data.login as string, avatarUrl: data.avatar_url as string | undefined } : { id: String(data.id), username: (data.username ?? data.name) as string, avatarUrl: data.avatar_url as string | undefined }; }
async function providerFetch(provider: Provider, path: string, token: string, init: RequestInit = {}) { const base = provider === "github" ? "https://api.github.com" : "https://gitlab.com/api/v4"; return fetch(`${base}${path}`, { ...init, headers: { Accept: "application/json", Authorization: provider === "github" ? `Bearer ${token}` : `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}), ...(provider === "github" ? { "X-GitHub-Api-Version": "2022-11-28" } : {}) }, signal: AbortSignal.timeout(15_000) }); }
async function requireConnection(id: string, userId: string) { const [connection] = await db.select().from(gitConnections).where(and(eq(gitConnections.id, id), eq(gitConnections.userId, userId))).limit(1); if (!connection) throw new AppError(409, "GIT_CONNECTION_REQUIRED", "Connect this Git provider in your profile first"); return connection; }
async function requireProject(params: z.infer<typeof projectParams>, currentUserId: string, update: boolean) { const membership = await findActiveWorkspaceMembership({ userId: currentUserId, workspaceId: params.workspaceId }); if (!membership) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace not found"); if (update && !canUpdateProject(membership.role)) throw new AppError(403, "PROJECT_UPDATE_FORBIDDEN", "You cannot configure this project"); const project = await findProjectInWorkspace(params); if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found"); return project; }
async function requireTask(params: z.infer<typeof taskParams>, currentUserId: string, update: boolean) { const project = await requireProject(params, currentUserId, update); const task = await findTaskInProject(params); if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found"); return task; }
async function requireRepository(params: z.infer<typeof projectParams>) { const [repository] = await db.select().from(projectRepositories).where(and(eq(projectRepositories.workspaceId, params.workspaceId), eq(projectRepositories.projectId, params.projectId))).limit(1); if (!repository) throw new AppError(409, "PROJECT_REPOSITORY_REQUIRED", "Connect a GitHub or GitLab repository in project settings first"); return repository; }
async function accessToken(connection: Connection) { if (connection.expiresAt && connection.expiresAt <= new Date()) throw new AppError(401, "GIT_CONNECTION_EXPIRED", "Git connection expired. Reconnect it in Profile settings."); return decryptIntegrationSecret(connection.accessTokenEncrypted); }
async function getRepository(connection: Connection, fullName: string) { const response = await providerFetch(connection.provider, repositoryPath(connection.provider, fullName), await accessToken(connection)); if (response.status === 404) throw new AppError(404, "GIT_REPOSITORY_NOT_FOUND", "Repository not found or access was not granted"); if (!response.ok) throw new AppError(502, "GIT_REPOSITORY_REQUEST_FAILED", "Unable to read repository details"); const data = await response.json() as any; return connection.provider === "github" ? { id: String(data.id), fullName: data.full_name as string, webUrl: data.html_url as string, defaultBranch: data.default_branch as string, isPrivate: Boolean(data.private) } : { id: String(data.id), fullName: data.path_with_namespace as string, webUrl: data.web_url as string, defaultBranch: data.default_branch as string, isPrivate: data.visibility !== "public" }; }
function repositoryPath(provider: Provider, fullName: string) { return provider === "github" ? `/repos/${fullName.split("/").map(encodeURIComponent).join("/")}` : `/projects/${encodeURIComponent(fullName)}`; }
function normalizeRepositoryName(provider: Provider, value: string) {
  const trimmed = value.trim().replace(/\.git\/?$/, "");
  let path = trimmed;
  try {
    const url = new URL(trimmed);
    const expectedHost = provider === "github" ? "github.com" : "gitlab.com";
    if (url.hostname !== expectedHost) {
      throw new AppError(400, "GIT_REPOSITORY_URL_INVALID", `Use a ${expectedHost} repository URL or its namespace/name.`);
    }
    path = url.pathname;
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part))) {
    throw new AppError(400, "GIT_REPOSITORY_NAME_INVALID", "Enter owner/repository or paste its full GitHub/GitLab URL");
  }
  return parts.join("/");
}
async function createBranch(connection: Connection, repository: Repository, name: string, base: string) { const token = await accessToken(connection); if (connection.provider === "github") { const ref = await providerFetch("github", `${repositoryPath("github", repository.fullName)}/git/ref/heads/${encodeURIComponent(base)}`, token); if (!ref.ok) throw new AppError(502, "GIT_BASE_BRANCH_NOT_FOUND", "Unable to read the base branch"); const current = await ref.json() as any; const created = await providerFetch("github", `${repositoryPath("github", repository.fullName)}/git/refs`, token, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${name}`, sha: current.object.sha }) }); if (created.status === 422) throw new AppError(409, "GIT_BRANCH_EXISTS", "A branch with this name already exists"); if (!created.ok) throw new AppError(502, "GIT_BRANCH_CREATE_FAILED", "Unable to create the GitHub branch"); return { name, url: `${repository.webUrl}/tree/${encodeURIComponent(name)}` }; }
  const response = await providerFetch("gitlab", `${repositoryPath("gitlab", repository.fullName)}/repository/branches`, token, { method: "POST", body: JSON.stringify({ branch: name, ref: base }) }); if (response.status === 400) throw new AppError(409, "GIT_BRANCH_EXISTS", "A branch with this name already exists"); if (!response.ok) throw new AppError(502, "GIT_BRANCH_CREATE_FAILED", "Unable to create the GitLab branch"); const data = await response.json() as any; return { name: data.name as string, url: `${repository.webUrl}/-/tree/${encodeURIComponent(data.name as string)}` }; }
async function createPullRequest(connection: Connection, repository: Repository, input: { base: string; body: string; head: string; title: string }) { const token = await accessToken(connection); if (connection.provider === "github") { const response = await providerFetch("github", `${repositoryPath("github", repository.fullName)}/pulls`, token, { method: "POST", body: JSON.stringify({ base: input.base, body: input.body, head: input.head, title: input.title }) }); if (!response.ok) throw new AppError(502, "GIT_PULL_REQUEST_CREATE_FAILED", "Unable to create the GitHub pull request"); const data = await response.json() as any; return { id: String(data.number), title: data.title as string, url: data.html_url as string, status: data.state as string }; }
  const response = await providerFetch("gitlab", `${repositoryPath("gitlab", repository.fullName)}/merge_requests`, token, { method: "POST", body: JSON.stringify({ source_branch: input.head, target_branch: input.base, title: input.title, description: input.body }) }); if (!response.ok) throw new AppError(502, "GIT_PULL_REQUEST_CREATE_FAILED", "Unable to create the GitLab merge request"); const data = await response.json() as any; return { id: String(data.iid), title: data.title as string, url: data.web_url as string, status: data.state as string }; }
async function upsertLink(input: { workspaceId: string; projectId: string; taskId: string; provider: Provider; type: "branch" | "commit" | "pull_request" | "pipeline" | "deployment"; externalId: string; label: string; url: string; status?: string }) { const [link] = await db.insert(taskGitLinks).values({ ...input, metadata: {} }).onConflictDoUpdate({ target: [taskGitLinks.taskId, taskGitLinks.provider, taskGitLinks.type, taskGitLinks.externalId], set: { label: input.label, status: input.status, updatedAt: new Date(), url: input.url } }).returning(); return link!; }
async function updateFlowGitFields(params: z.infer<typeof taskParams>, fields: { branchName?: string; pullRequestUrl?: string; ciStatus?: "pending" | "passing" | "failing" }) { const flow = await findTaskDevelopmentFlow(params); if (flow) await updateTaskDevelopmentFlowInDb({ id: flow.id, ...fields }); }
async function syncTask(connection: Connection, repository: Repository, params: z.infer<typeof taskParams>) { const token = await accessToken(connection); const flow = await findTaskDevelopmentFlow(params); const links = [] as (typeof taskGitLinks.$inferSelect)[]; let ciStatus: "not_configured" | "pending" | "passing" | "failing" = "not_configured"; if (flow?.branchName) { const commitsResponse = await providerFetch(connection.provider, connection.provider === "github" ? `${repositoryPath("github", repository.fullName)}/commits?sha=${encodeURIComponent(flow.branchName)}&per_page=20` : `${repositoryPath("gitlab", repository.fullName)}/repository/commits?ref_name=${encodeURIComponent(flow.branchName)}&per_page=20`, token); if (commitsResponse.ok) { const commits = await commitsResponse.json() as any[]; for (const commit of commits) { const sha = String(commit.sha ?? commit.id); const url = connection.provider === "github" ? commit.html_url : commit.web_url; links.push(await upsertLink({ ...params, provider: connection.provider, type: "commit", externalId: sha, label: `${sha.slice(0, 7)} ${String(commit.commit?.message ?? commit.title ?? "Commit").split("\n")[0]}`, url, status: "synced" })); } }
    const prResponse = await providerFetch(connection.provider, connection.provider === "github" ? `${repositoryPath("github", repository.fullName)}/pulls?head=${encodeURIComponent(repository.fullName.split("/")[0] + ":" + flow.branchName)}&state=all` : `${repositoryPath("gitlab", repository.fullName)}/merge_requests?source_branch=${encodeURIComponent(flow.branchName)}&state=all`, token); if (prResponse.ok) { const prs = await prResponse.json() as any[]; const pr = prs[0]; if (pr) { const id = String(pr.number ?? pr.iid); const url = pr.html_url ?? pr.web_url; const prStatus = pr.merged_at ? "merged" : pr.state; links.push(await upsertLink({ ...params, provider: connection.provider, type: "pull_request", externalId: id, label: pr.title, url, status: prStatus })); await updateFlowGitFields(params, { pullRequestUrl: url }); const sha = pr.head?.sha ?? pr.sha; if (sha && connection.provider === "github") { const checks = await providerFetch("github", `${repositoryPath("github", repository.fullName)}/commits/${sha}/check-runs`, token); if (checks.ok) { const runs = (await checks.json() as any).check_runs as any[]; ciStatus = !runs.length ? "pending" : runs.some((run) => run.status !== "completed") ? "pending" : runs.every((run) => run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped") ? "passing" : "failing"; } } if (sha && connection.provider === "gitlab") { const pipelines = await providerFetch("gitlab", `${repositoryPath("gitlab", repository.fullName)}/pipelines?sha=${encodeURIComponent(sha)}&per_page=1`, token); if (pipelines.ok) { const pipeline = (await pipelines.json() as any[])[0]; if (pipeline) { ciStatus = pipeline.status === "success" ? "passing" : ["failed", "canceled", "skipped"].includes(pipeline.status) ? "failing" : "pending"; links.push(await upsertLink({ ...params, provider: "gitlab", type: "pipeline", externalId: String(pipeline.id), label: `Pipeline #${pipeline.id}`, url: pipeline.web_url, status: pipeline.status })); } } } } } }
  if (ciStatus !== "not_configured") await updateFlowGitFields(params, { ciStatus }); await db.update(projectRepositories).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(projectRepositories.id, repository.id)); return { links, ciStatus };
}
async function activity(params: z.infer<typeof taskParams>, task: { number: number; projectKey: string; title: string }, actorUserId: string, message: string) { await recordTaskActivity({ actorUserId, data: { fields: ["git"], message, taskKey: `${task.projectKey}-${task.number}`, title: task.title }, eventType: "task_updated", ...params }); }
function toLink(link: typeof taskGitLinks.$inferSelect) { return { ...link, createdAt: link.createdAt.toISOString(), updatedAt: link.updatedAt.toISOString() }; }
