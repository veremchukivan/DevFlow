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
  type Task,
  type Workspace,
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
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([getWorkspace(workspaceId), getProjects(workspaceId)])
      .then(async ([workspaceResponse, projectResponse]) => {
        const taskResponses = await Promise.all(
          projectResponse.projects.map(
            async (project) =>
              [
                project.id,
                (await getTasks(workspaceId, project.id, { limit: 100 })).tasks,
              ] as const,
          ),
        );
        if (!active) {
          return;
        }

        setWorkspace(workspaceResponse.workspace);
        setProjects(projectResponse.projects);
        setTasksByProject(Object.fromEntries(taskResponses));
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
            (await getTasks(workspaceId, project.id, { limit: 100 })).tasks,
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
  const completedTasks = workspaceTasks.filter(
    (task) => task.status.category === "done",
  );
  const openTasks = workspaceTasks.filter(
    (task) => task.status.category !== "done",
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate && task.dueDate < today,
  );
  const completionRate = workspaceTasks.length
    ? Math.round((completedTasks.length / workspaceTasks.length) * 100)
    : 0;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const completedThisWeek = completedTasks.filter(
    (task) => new Date(task.updatedAt) >= weekStart,
  );
  const activeProjects = projects.filter((project) =>
    (tasksByProject[project.id] ?? []).some(
      (task) => task.status.category !== "done",
    ),
  ).length;
  const projectHealth = projects
    .map((project) => {
      const projectTasks = tasksByProject[project.id] ?? [];
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
        className={styles.workspaceDashboard}
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
        <div className={styles.workspaceMetrics}>
          <article className={styles.workspaceMetric}>
            <CheckCircle2 aria-hidden="true" size={19} />
            <span>Completion rate</span>
            <strong>{completionRate}%</strong>
          </article>
          <article className={styles.workspaceMetric}>
            <Clock3 aria-hidden="true" size={19} />
            <span>Open tasks</span>
            <strong>{openTasks.length}</strong>
          </article>
          <article className={styles.workspaceMetric}>
            <AlertTriangle aria-hidden="true" size={19} />
            <span>Overdue</span>
            <strong>{overdueTasks.length}</strong>
          </article>
          <article className={styles.workspaceMetric}>
            <CheckCircle2 aria-hidden="true" size={19} />
            <span>Completed this week</span>
            <strong>{completedThisWeek.length}</strong>
          </article>
          <article className={styles.workspaceMetric}>
            <LayoutDashboard aria-hidden="true" size={19} />
            <span>Active projects</span>
            <strong>{activeProjects}</strong>
          </article>
        </div>
        <p className={styles.workspaceDashboardSummary}>
          {projects.length} projects · {workspaceTasks.length} tasks ·{" "}
          {completedTasks.length} completed
        </p>
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
        className={styles.workspaceSection}
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
