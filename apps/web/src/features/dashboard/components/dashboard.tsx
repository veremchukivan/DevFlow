"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListChecks,
} from "lucide-react";

import {
  ApiClientError,
  getCurrentUser,
  getApiAssetUrl,
  getProject,
  getProjects,
  getTasks,
  getWorkspaces,
} from "@/shared/lib/api-client";
import type { AuthUser, Project, Task, Workspace } from "@devflow/shared";

import styles from "./dashboard.module.css";

type Range = "week" | "month" | "quarter";
type ProjectData = { project: Project; tasks: Task[]; workspace: Workspace };

export function Dashboard() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("week");
  const [user, setUser] = useState<AuthUser>();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [userResponse, workspaceResponse] = await Promise.all([
          getCurrentUser(),
          getWorkspaces(),
        ]);
        const projectPairs = await Promise.all(
          workspaceResponse.workspaces.map(async (workspace) => {
            const response = await getProjects(workspace.id);
            return response.projects.map((project) => ({ project, workspace }));
          }),
        );
        const details = await Promise.all(
          projectPairs.flat().map(async ({ project, workspace }) => {
            const [projectResponse, taskResponse] = await Promise.all([
              getProject(workspace.id, project.id),
              getTasks(workspace.id, project.id, { limit: 100 }),
            ]);
            return {
              project: projectResponse.project,
              tasks: taskResponse.tasks,
              workspace,
            };
          }),
        );
        if (!active) return;
        setUser(userResponse.user);
        setProjects(details);
      } catch (caughtError) {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        if (active) setError("Unable to load dashboard data.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [router]);

  const summary = useMemo(
    () => calculateSummary(projects, range),
    [projects, range],
  );

  if (isLoading)
    return <main className={styles.loading}>Loading dashboard</main>;
  if (!user)
    return (
      <main className={styles.loading}>
        {error ?? "Dashboard is unavailable."}
      </main>
    );

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Personal dashboard</p>
          <h1>
            {greeting()}, {user.displayName.split(/\s+/)[0]}
          </h1>
          <p>{formatRange(range)} overview across all your workspaces.</p>
        </div>
        <div
          className={styles.rangeSelector}
          role="group"
          aria-label="Dashboard period"
        >
          {(["week", "month", "quarter"] as Range[]).map((item) => (
            <button
              aria-pressed={range === item}
              key={item}
              onClick={() => setRange(item)}
              type="button"
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.metrics} aria-label="Task statistics">
        <Metric
          icon={ListChecks}
          label="Tasks in scope"
          tone="teal"
          value={String(summary.tasksInScope)}
        />
        <Metric
          icon={CheckCircle2}
          label="Completion rate"
          tone="blue"
          value={`${summary.completionRate}%`}
        />
        <Metric
          icon={Clock3}
          label="Open tasks"
          tone="gold"
          value={String(summary.openTasks)}
        />
        <Metric
          icon={AlertTriangle}
          label="Overdue"
          tone="red"
          value={String(summary.overdueTasks)}
        />
      </section>

      <section className={styles.activityPanel}>
        <div className={styles.panelHeading}>
          <BarChart3 aria-hidden="true" size={19} />
          <div>
            <h2>Work distribution</h2>
            <p>Current task state across all active projects.</p>
          </div>
        </div>
        {summary.statuses.length ? (
          <div className={styles.statusList}>
            {summary.statuses.map((status) => (
              <div className={styles.statusRow} key={status.id}>
                <div>
                  <span style={{ backgroundColor: status.color }} />
                  <strong>{status.name}</strong>
                </div>
                <span>{status.count}</span>
                <i
                  style={{
                    width: `${status.percent}%`,
                    backgroundColor: status.color,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      <section className={styles.lowerGrid}>
        <section className={styles.projectsPanel}>
          <div className={styles.panelHeading}>
            <FolderKanban aria-hidden="true" size={19} />
            <div>
              <h2>Active projects</h2>
              <p>
                {summary.activeProjects.length} projects with work in progress.
              </p>
            </div>
          </div>
          {summary.activeProjects.length ? (
            <div className={styles.projectList}>
              {summary.activeProjects.map(
                ({ openTasks, project, workspace }) => (
                  <Link
                    href={`/workspaces/${workspace.id}/projects/${project.id}`}
                    key={project.id}
                  >
                    <span className={styles.projectMark}>
                      {project.iconUrl ? (
                        <img
                          alt=""
                          src={getApiAssetUrl(project.iconUrl) ?? undefined}
                        />
                      ) : (
                        project.key.slice(0, 1)
                      )}
                    </span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>
                        {workspace.name} · {project.key}
                      </small>
                    </span>
                    <b>
                      {openTasks}
                      <small>open</small>
                    </b>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
        <section className={styles.projectsPanel}>
          <div className={styles.panelHeading}>
            <ListChecks aria-hidden="true" size={19} />
            <div>
              <h2>Focus</h2>
              <p>What needs attention now.</p>
            </div>
          </div>
          <div className={styles.focusList}>
            <span>
              <strong>{summary.overdueTasks}</strong> overdue tasks
            </span>
            <span>
              <strong>{summary.openTasks}</strong> open tasks
            </span>
            <span>
              <strong>{summary.completedTasks}</strong> completed tasks
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof ListChecks;
  label: string;
  tone: "teal" | "blue" | "gold" | "red";
  value: string;
}) {
  return (
    <article
      className={`${styles.metric} ${styles[`metric${tone[0]!.toUpperCase() + tone.slice(1)}`]}`}
    >
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <Icon aria-hidden="true" size={20} />
    </article>
  );
}

function EmptyState() {
  return <p className={styles.empty}>No tasks have been created yet.</p>;
}

function calculateSummary(projects: ProjectData[], range: Range) {
  const start = startOfRange(range);
  const projectTasks = projects.flatMap(({ project, tasks, workspace }) =>
    tasks.map((task) => ({ project, task, workspace })),
  );
  const inScope = projectTasks.filter(
    ({ task }) => new Date(task.createdAt) >= start,
  );
  const done = inScope.filter(({ task }) => task.status.category === "done");
  const open = inScope.filter(({ task }) => task.status.category !== "done");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = open.filter(
    ({ task }) => task.dueDate && task.dueDate < today,
  );
  const byStatus = new Map<
    string,
    { color: string; count: number; id: string; name: string }
  >();
  projectTasks.forEach(({ task }) => {
    const entry = byStatus.get(task.statusId) ?? {
      color: task.status.color,
      count: 0,
      id: task.statusId,
      name: task.status.name,
    };
    entry.count += 1;
    byStatus.set(task.statusId, entry);
  });
  const allTaskCount = projectTasks.length;
  const activeProjects = projects
    .map(({ project, tasks, workspace }) => ({
      openTasks: tasks.filter((task) => task.status.category !== "done").length,
      project,
      workspace,
    }))
    .filter((item) => item.openTasks > 0)
    .sort((a, b) => b.openTasks - a.openTasks)
    .slice(0, 6);
  return {
    activeProjects,
    completedTasks: done.length,
    completionRate: inScope.length
      ? Math.round((done.length / inScope.length) * 100)
      : 0,
    openTasks: open.length,
    overdueTasks: overdue.length,
    statuses: [...byStatus.values()].map((status) => ({
      ...status,
      percent: allTaskCount
        ? Math.max(4, Math.round((status.count / allTaskCount) * 100))
        : 0,
    })),
    tasksInScope: inScope.length,
  };
}

function startOfRange(range: Range) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(
    date.getDate() - (range === "week" ? 6 : range === "month" ? 29 : 89),
  );
  return date;
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}
function formatRange(range: Range) {
  return range === "week"
    ? "Last 7 days"
    : range === "month"
      ? "Last 30 days"
      : "Last 90 days";
}
