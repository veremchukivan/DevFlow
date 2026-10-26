"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
} from "lucide-react";

import {
  ApiClientError,
  createProject,
  deleteWorkspace,
  getProjects,
  getApiAssetUrl,
  getWorkspace,
  getWorkspaceMembers,
  getProjectSprints,
  getTasks,
  updateWorkspace,
} from "@/shared/lib/api-client";
import {
  notifyProjectsChanged,
  notifyWorkspacesChanged,
} from "@/shared/lib/workspace-events";
import {
  can,
  type ProjectSummary,
  type ProjectSprint,
  type Task,
  type Workspace,
  type WorkspaceMember,
} from "@devflow/shared";
import styles from "@/shared/styles/ui.module.css";

export function WorkspaceDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>(
    {},
  );
  const [sprintsByProject, setSprintsByProject] = useState<
    Record<string, ProjectSprint[]>
  >({});
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    "7d" | "30d" | "90d" | "all"
  >("30d");
  const [analyticsProjectId, setAnalyticsProjectId] = useState("all");
  const [analyticsAssigneeId, setAnalyticsAssigneeId] = useState("all");
  const [analyticsSprintId, setAnalyticsSprintId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([
      getWorkspace(workspaceId),
      getProjects(workspaceId),
      getWorkspaceMembers(workspaceId),
    ])
      .then(async ([workspaceResponse, projectResponse, membersResponse]) => {
        const taskResponses = await Promise.all(
          projectResponse.projects.map(
            async (project) =>
              [
                project.id,
                await getAllProjectTasks(workspaceId, project.id),
              ] as const,
          ),
        );
        const sprintResponses = await Promise.all(
          projectResponse.projects.map(
            async (project) =>
              [
                project.id,
                (await getProjectSprints(workspaceId, project.id)).sprints,
              ] as const,
          ),
        );
        if (!active) {
          return;
        }

        setWorkspace(workspaceResponse.workspace);
        setProjects(projectResponse.projects);
        setTasksByProject(Object.fromEntries(taskResponses));
        setSprintsByProject(Object.fromEntries(sprintResponses));
        setMembers(
          membersResponse.members.filter(
            (member) => member.status === "active",
          ),
        );
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        if (active) {
          setError("Unable to load this workspace.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, workspaceId]);

  useEffect(() => {
    if (searchParams.get("newProject") !== "1") return;
    setShowProjectForm(true);
    router.replace(`/workspaces/${workspaceId}`, { scroll: false });
  }, [router, searchParams, workspaceId]);

  useEffect(() => {
    if (!projects.length) return;
    let active = true;

    async function refreshTaskStatistics() {
      try {
        const responses = await Promise.all(
          projects.map(async (project) => [
            project.id,
            await getAllProjectTasks(workspaceId, project.id),
          ]),
        );
        if (active) setTasksByProject(Object.fromEntries(responses));
      } catch {
        // Keep the most recent dashboard values during a transient failure.
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshTaskStatistics();
      }
    }, 15_000);
    const onFocus = () => void refreshTaskStatistics();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [projects, workspaceId]);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreatingProject(true);

    const form = new FormData(event.currentTarget);
    const key = String(form.get("key") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    try {
      const response = await createProject(workspaceId, {
        name: String(form.get("name") ?? ""),
        ...(key ? { key } : {}),
        ...(description ? { description } : {}),
      });
      setProjects((current) => [response.project, ...current]);
      notifyProjectsChanged(workspaceId);
      setShowProjectForm(false);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create the project. Try again.",
      );
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function onWorkspaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    setError(undefined);
    setIsSavingWorkspace(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateWorkspace(workspaceId, {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
      });
      setWorkspace(response.workspace);
      setIsEditingWorkspace(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update workspace.",
      );
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  async function onWorkspaceDelete() {
    if (
      !window.confirm(
        "Delete this workspace and all its projects? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteWorkspace(workspaceId);
      notifyWorkspacesChanged();
      router.replace("/workspaces");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete workspace.",
      );
    }
  }

  if (isLoading) {
    return <main className={styles.loading}>Loading workspace</main>;
  }

  if (!workspace) {
    return (
      <main className={styles.workspaceHome}>
        <Link className={styles.backLink} href="/workspaces">
          All workspaces
        </Link>
        <p className={styles.formError}>{error ?? "Workspace not found."}</p>
      </main>
    );
  }

  const canUpdateWorkspace = can(workspace.role, "workspace:update");
  const canDeleteWorkspace = can(workspace.role, "workspace:delete");
  const canCreateProjects = can(workspace.role, "project:create");
  const workspaceTasks = Object.values(tasksByProject).flat();
  const analyticsTasks = workspaceTasks.filter((task) => {
    if (analyticsProjectId !== "all" && task.projectId !== analyticsProjectId)
      return false;
    if (analyticsAssigneeId === "unassigned" && task.assigneeUserId !== null)
      return false;
    if (
      analyticsAssigneeId !== "all" &&
      analyticsAssigneeId !== "unassigned" &&
      task.assigneeUserId !== analyticsAssigneeId
    )
      return false;
    if (analyticsSprintId === "backlog" && task.sprintId !== null) return false;
    if (
      analyticsSprintId !== "all" &&
      analyticsSprintId !== "backlog" &&
      task.sprintId !== analyticsSprintId
    )
      return false;
    return isTaskInAnalyticsPeriod(task, analyticsPeriod);
  });
  const completedTasks = analyticsTasks.filter(
    (task) => task.status.category === "done",
  );
  const openTasks = analyticsTasks.filter(
    (task) => task.status.category !== "done",
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate && task.dueDate < today,
  );
  const completionRate = analyticsTasks.length
    ? Math.round((completedTasks.length / analyticsTasks.length) * 100)
    : 0;
  const completedThisWeek = completedTasks.filter((task) =>
    isTaskInAnalyticsPeriod(task, "7d"),
  );
  const activeProjects = projects.filter((project) =>
    analyticsTasks.some(
      (task) =>
        task.projectId === project.id && task.status.category !== "done",
    ),
  ).length;
  const statusDistribution = buildStatusDistribution(analyticsTasks);
  const workload = buildMemberWorkload(analyticsTasks, members);
  const deliveryTrend = buildDeliveryTrend(completedTasks);
  const allSprints = projects.flatMap((project) =>
    (sprintsByProject[project.id] ?? []).map((sprint) => ({
      projectName: project.name,
      sprint,
    })),
  );
  const projectHealth = projects
    .map((project) => {
      const projectTasks = analyticsTasks.filter(
        (task) => task.projectId === project.id,
      );
      const projectDone = projectTasks.filter(
        (task) => task.status.category === "done",
      ).length;
      const projectOpen = projectTasks.length - projectDone;
      const projectOverdue = projectTasks.filter(
        (task) =>
          task.status.category !== "done" &&
          task.dueDate &&
          task.dueDate < today,
      ).length;
      return {
        completionRate: projectTasks.length
          ? Math.round((projectDone / projectTasks.length) * 100)
          : 0,
        open: projectOpen,
        overdue: projectOverdue,
        project,
      };
    })
    .filter(({ project }) =>
      analyticsProjectId === "all" ? true : project.id === analyticsProjectId,
    )
    .sort(
      (left, right) => right.overdue - left.overdue || right.open - left.open,
    );

  return (
    <main className={styles.workspaceHome}>
      <Link className={styles.backLink} href="/workspaces">
        All workspaces
      </Link>
      <header className={styles.workspaceHomeHeader}>
        <div>
          <p className={styles.eyebrow}>{workspace.slug}</p>
          <h1>{workspace.name}</h1>
          <p>Projects are where tasks, status, and activity live.</p>
        </div>
        {canUpdateWorkspace || canDeleteWorkspace ? (
          <div className={styles.formActions}>
            {canUpdateWorkspace ? (
              <button
                className={styles.secondaryButton}
                onClick={() => setIsEditingWorkspace((current) => !current)}
                type="button"
              >
                Settings
              </button>
            ) : null}
            {canDeleteWorkspace ? (
              <button
                className={styles.textButton}
                onClick={() => void onWorkspaceDelete()}
                type="button"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      {isEditingWorkspace ? (
        <form className={styles.projectForm} onSubmit={onWorkspaceSubmit}>
          <label>
            <span>Workspace name</span>
            <input
              defaultValue={workspace.name}
              maxLength={120}
              minLength={2}
              name="name"
              required
            />
          </label>
          <label>
            <span>Workspace URL</span>
            <input
              defaultValue={workspace.slug}
              maxLength={80}
              name="slug"
              required
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isSavingWorkspace}
              type="submit"
            >
              {isSavingWorkspace ? "Saving" : "Save settings"}
            </button>
            <button
              className={styles.textButton}
              onClick={() => setIsEditingWorkspace(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section
        className={`${styles.workspaceDashboard} card shadow-sm`}
        aria-labelledby="dashboard-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="dashboard-title">Dashboard</h2>
            <p>Current delivery health for {workspace.name}.</p>
          </div>
          <LayoutDashboard
            aria-hidden="true"
            className={styles.workspaceDashboardIcon}
            size={21}
          />
        </div>
        <div className={styles.analyticsFilters}>
          <label>
            <span>Period</span>
            <select
              onChange={(event) =>
                setAnalyticsPeriod(
                  event.target.value as "7d" | "30d" | "90d" | "all",
                )
              }
              value={analyticsPeriod}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              onChange={(event) => {
                setAnalyticsProjectId(event.target.value);
                setAnalyticsSprintId("all");
              }}
              value={analyticsProjectId}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Assignee</span>
            <select
              onChange={(event) => setAnalyticsAssigneeId(event.target.value)}
              value={analyticsAssigneeId}
            >
              <option value="all">Everyone</option>
              <option value="unassigned">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select
              onChange={(event) => setAnalyticsSprintId(event.target.value)}
              value={analyticsSprintId}
            >
              <option value="all">All sprints</option>
              <option value="backlog">Backlog</option>
              {allSprints
                .filter(
                  ({ sprint }) =>
                    analyticsProjectId === "all" ||
                    sprint.projectId === analyticsProjectId,
                )
                .map(({ projectName, sprint }) => (
                  <option key={sprint.id} value={sprint.id}>
                    {projectName}: {sprint.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className={styles.workspaceMetrics}>
          <article className={`${styles.workspaceMetric} card`}>
            <CheckCircle2 aria-hidden="true" size={19} />
            <span>Completion rate</span>
            <strong>{completionRate}%</strong>
          </article>
          <article className={`${styles.workspaceMetric} card`}>
            <Clock3 aria-hidden="true" size={19} />
            <span>Open tasks</span>
            <strong>{openTasks.length}</strong>
          </article>
          <article className={`${styles.workspaceMetric} card`}>
            <AlertTriangle aria-hidden="true" size={19} />
            <span>Overdue</span>
            <strong>{overdueTasks.length}</strong>
          </article>
          <article className={`${styles.workspaceMetric} card`}>
            <CheckCircle2 aria-hidden="true" size={19} />
            <span>Completed this week</span>
            <strong>{completedThisWeek.length}</strong>
          </article>
          <article className={`${styles.workspaceMetric} card`}>
            <LayoutDashboard aria-hidden="true" size={19} />
            <span>Active projects</span>
            <strong>{activeProjects}</strong>
          </article>
        </div>
        <p className={styles.workspaceDashboardSummary}>
          {activeProjects} active projects · {analyticsTasks.length} tasks ·{" "}
          {completedTasks.length} completed in the selected view
        </p>
        <div className={styles.analyticsGrid}>
          <section
            className={styles.analyticsCard}
            aria-labelledby="status-chart-title"
          >
            <div>
              <h3 id="status-chart-title">Status distribution</h3>
              <p>How selected work is spread across statuses.</p>
            </div>
            {statusDistribution.length ? (
              <ul className={styles.analyticsBarList}>
                {statusDistribution.map((status) => (
                  <li key={status.id}>
                    <span>{status.name}</span>
                    <div aria-hidden="true">
                      <i
                        style={{
                          backgroundColor: status.color,
                          width: `${Math.max(
                            5,
                            (status.count /
                              Math.max(analyticsTasks.length, 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{status.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>No tasks match these filters.</p>
            )}
          </section>
          <section
            className={styles.analyticsCard}
            aria-labelledby="velocity-chart-title"
          >
            <div>
              <h3 id="velocity-chart-title">Delivery velocity</h3>
              <p>Completed tasks over the last seven days.</p>
            </div>
            <div className={styles.velocityChart}>
              {deliveryTrend.map((day) => (
                <div key={day.key}>
                  <span>{day.count}</span>
                  <i
                    aria-label={`${day.label}: ${day.count} completed tasks`}
                    style={{
                      height: `${Math.max(
                        6,
                        (day.count /
                          Math.max(
                            ...deliveryTrend.map((item) => item.count),
                            1,
                          )) *
                          100,
                      )}%`,
                    }}
                  />
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </section>
          <section
            className={styles.analyticsCard}
            aria-labelledby="workload-chart-title"
          >
            <div>
              <h3 id="workload-chart-title">Team workload</h3>
              <p>Open and completed tasks by assignee.</p>
            </div>
            {workload.length ? (
              <ul className={styles.workloadList}>
                {workload.map((member) => (
                  <li key={member.id}>
                    <span>{member.name}</span>
                    <div>
                      <i style={{ width: `${member.openShare}%` }} />
                      <b style={{ width: `${member.doneShare}%` }} />
                    </div>
                    <strong>
                      {member.open} open · {member.done} done
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                No assigned tasks in this view.
              </p>
            )}
          </section>
        </div>
        {projectHealth.length ? (
          <section
            className={styles.projectHealth}
            aria-labelledby="project-health-title"
          >
            <div>
              <h3 id="project-health-title">Project health</h3>
              <p>Open work, overdue tasks, and completion by project.</p>
            </div>
            <div className={styles.projectHealthList}>
              {projectHealth.map(
                ({ completionRate, open, overdue, project }) => (
                  <Link
                    className={styles.projectHealthRow}
                    href={`/workspaces/${workspaceId}/projects/${project.id}`}
                    key={project.id}
                  >
                    <span className={styles.projectListIcon}>
                      {project.iconUrl ? (
                        <img
                          alt=""
                          src={getApiAssetUrl(project.iconUrl) ?? undefined}
                        />
                      ) : (
                        project.key.slice(0, 1)
                      )}
                    </span>
                    <strong>{project.name}</strong>
                    <span>{open} open</span>
                    <span
                      className={overdue ? styles.overdueMetric : undefined}
                    >
                      {overdue} overdue
                    </span>
                    <span>{completionRate}% complete</span>
                  </Link>
                ),
              )}
            </div>
          </section>
        ) : null}
      </section>

      <section
        className={`${styles.workspaceSection} card shadow-sm`}
        aria-labelledby="projects-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="projects-title">Projects</h2>
            <p>{projects.length} available</p>
          </div>
          {canCreateProjects ? (
            <button
              className={styles.primaryButton}
              onClick={() => setShowProjectForm((current) => !current)}
              type="button"
            >
              New project
            </button>
          ) : null}
        </div>

        {showProjectForm && canCreateProjects ? (
          <form className={styles.projectForm} onSubmit={onCreateProject}>
            <label>
              <span>Project name</span>
              <input maxLength={160} minLength={2} name="name" required />
            </label>
            <label>
              <span>Key</span>
              <input maxLength={12} name="key" placeholder="WEB" />
            </label>
            <label className={styles.projectDescription}>
              <span>Description</span>
              <input maxLength={2000} name="description" />
            </label>
            {error ? (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isCreatingProject}
                type="submit"
              >
                {isCreatingProject ? "Creating" : "Create project"}
              </button>
              <button
                className={styles.textButton}
                onClick={() => setShowProjectForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {projects.length === 0 ? (
          <p className={styles.emptyState}>
            Create a project to start tracking work.
          </p>
        ) : (
          <div className={styles.projectList}>
            {projects.map((project) => (
              <Link
                className={styles.projectRow}
                href={`/workspaces/${workspaceId}/projects/${project.id}`}
                key={project.id}
              >
                <span className={styles.projectListIcon}>
                  {project.iconUrl ? (
                    <img
                      alt=""
                      src={getApiAssetUrl(project.iconUrl) ?? undefined}
                    />
                  ) : (
                    project.key.slice(0, 1)
                  )}
                </span>
                <div>
                  <h3>{project.name}</h3>
                  {project.description ? <p>{project.description}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function getAllProjectTasks(workspaceId: string, projectId: string) {
  const tasks: Task[] = [];
  let offset = 0;

  do {
    const response = await getTasks(workspaceId, projectId, {
      limit: 100,
      offset,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    tasks.push(...response.tasks);
    if (!response.pageInfo.hasNextPage) return tasks;
    offset += response.pageInfo.limit;
  } while (true);
}

function isTaskInAnalyticsPeriod(
  task: Task,
  period: "7d" | "30d" | "90d" | "all",
) {
  if (period === "all") return true;
  const days = Number.parseInt(period, 10);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return new Date(task.updatedAt) >= start;
}

function buildStatusDistribution(tasks: Task[]) {
  const statuses = new Map<
    string,
    { color: string; count: number; id: string; name: string }
  >();
  for (const task of tasks) {
    const current = statuses.get(task.status.id);
    statuses.set(task.status.id, {
      color: task.status.color,
      count: (current?.count ?? 0) + 1,
      id: task.status.id,
      name: task.status.name,
    });
  }
  return [...statuses.values()].sort((left, right) => right.count - left.count);
}

function buildMemberWorkload(tasks: Task[], members: WorkspaceMember[]) {
  const counts = new Map<
    string,
    { done: number; id: string; name: string; open: number }
  >(
    members.map((member) => [
      member.userId,
      { done: 0, id: member.userId, name: member.user.displayName, open: 0 },
    ]),
  );
  let unassignedOpen = 0;
  let unassignedDone = 0;

  for (const task of tasks) {
    if (!task.assigneeUserId) {
      if (task.status.category === "done") unassignedDone += 1;
      else unassignedOpen += 1;
      continue;
    }
    const current = counts.get(task.assigneeUserId) ?? {
      done: 0,
      id: task.assigneeUserId,
      name: task.assignee?.displayName ?? "Unknown member",
      open: 0,
    };
    if (task.status.category === "done") current.done += 1;
    else current.open += 1;
    counts.set(task.assigneeUserId, current);
  }

  if (unassignedOpen || unassignedDone) {
    counts.set("unassigned", {
      done: unassignedDone,
      id: "unassigned",
      name: "Unassigned",
      open: unassignedOpen,
    });
  }
  const max = Math.max(
    ...[...counts.values()].map((member) => member.open + member.done),
    1,
  );
  return [...counts.values()]
    .filter((member) => member.open + member.done > 0)
    .map((member) => ({
      ...member,
      doneShare: (member.done / max) * 100,
      openShare: (member.open / max) * 100,
    }))
    .sort((left, right) => right.open - left.open || right.done - left.done);
}

function buildDeliveryTrend(tasks: Task[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      count: tasks.filter((task) => task.updatedAt.slice(0, 10) === key).length,
      key,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
        date,
      ),
    };
  });
  return days;
}
