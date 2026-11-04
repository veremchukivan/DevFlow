"use client";

import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  LayoutList,
  ListTodo,
  Plus,
  Rows3,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ApiClientError,
  getCurrentUser,
  getProjects,
  getTasks,
  getWorkspace,
} from "@/shared/lib/api-client";
import type { ProjectSummary, Task, Workspace } from "@devflow/shared";

import styles from "./my-tasks.module.css";

type MyTasksView = "board" | "calendar" | "dates" | "day" | "list";
type TaskWithProject = Task & { project: ProjectSummary };

const tabs: { icon: typeof LayoutList; id: MyTasksView; label: string }[] = [
  { icon: ListTodo, id: "day", label: "My day" },
  { icon: Rows3, id: "board", label: "Board" },
  { icon: CalendarDays, id: "dates", label: "By date" },
  { icon: CalendarDays, id: "calendar", label: "Calendar" },
  { icon: LayoutList, id: "list", label: "List" },
];

export function MyTasks() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [view, setView] = useState<MyTasksView>("day");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([
      getWorkspace(workspaceId),
      getProjects(workspaceId),
      getCurrentUser(),
    ])
      .then(async ([workspaceResponse, projectsResponse, userResponse]) => {
        const projectTasks = await Promise.all(
          projectsResponse.projects.map(async (project) => ({
            project,
            tasks: await getAllProjectTasks(workspaceId, project.id),
          })),
        );
        if (!active) return;

        setWorkspace(workspaceResponse.workspace);
        setProjects(projectsResponse.projects);
        setTasks(
          projectTasks.flatMap(({ project, tasks: projectTaskList }) =>
            projectTaskList
              .filter((task) => task.assigneeUserId === userResponse.user.id)
              .map((task) => ({ ...task, project })),
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
        if (active) setError("Unable to load your assigned tasks.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, workspaceId]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status.category !== "done"),
    [tasks],
  );
  const overdueTasks = useMemo(
    () => openTasks.filter((task) => isOverdue(task.dueDate)),
    [openTasks],
  );
  const todayTasks = useMemo(
    () => openTasks.filter((task) => isToday(task.dueDate)),
    [openTasks],
  );
  const upcomingTasks = useMemo(
    () =>
      openTasks
        .filter((task) => task.dueDate && !isOverdue(task.dueDate))
        .filter((task) => !isToday(task.dueDate))
        .sort(sortByDueDate),
    [openTasks],
  );
  const createTaskHref = projects[0]
    ? `/workspaces/${workspaceId}/projects/${projects[0].id}?newTask=1`
    : undefined;

  if (isLoading) return <main className={styles.loading}>Loading your tasks</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>My tasks</h1>
          <p>
            {openTasks.length
              ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} assigned to you in ${workspace?.name ?? "this workspace"}.`
              : "Your personal work queue is clear."}
          </p>
        </div>
        {createTaskHref ? (
          <Link className={styles.createButton} href={createTaskHref}>
            <Plus aria-hidden="true" size={17} />
            Create task
          </Link>
        ) : null}
      </header>

      <nav aria-label="Task view" className={styles.tabs}>
        {tabs.map(({ icon: Icon, id, label }) => (
          <button
            aria-current={view === id ? "page" : undefined}
            key={id}
            onClick={() => setView(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={16} />
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {view === "day" ? (
        <div className={styles.dayLayout}>
          <TaskSection
            accent="danger"
            empty="Nothing is overdue."
            icon={CircleAlert}
            title="Overdue"
            tasks={overdueTasks}
            workspaceId={workspaceId}
          />
          <TaskSection
            accent="today"
            empty="You have no tasks due today."
            icon={Clock3}
            title="Today"
            tasks={todayTasks}
            workspaceId={workspaceId}
          />
          <TaskSection
            accent="upcoming"
            empty="No upcoming deadlines yet."
            icon={CalendarDays}
            title="Coming up"
            tasks={upcomingTasks.slice(0, 6)}
            workspaceId={workspaceId}
          />
        </div>
      ) : null}
      {view === "board" ? (
        <div className={styles.board}>
          {buildBoardColumns(openTasks).map((column) => (
            <TaskSection
              accent={column.accent}
              empty={`No tasks ${column.label.toLowerCase()}.`}
              key={column.label}
              title={column.label}
              tasks={column.tasks}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      ) : null}
      {view === "dates" || view === "calendar" ? (
        <section className={styles.dateView}>
          <div className={styles.dateViewHeading}>
            <CalendarDays aria-hidden="true" size={19} />
            <div>
              <h2>{view === "calendar" ? "Calendar" : "Tasks by due date"}</h2>
              <p>
                {view === "calendar"
                  ? "A deadline-focused calendar view of your open work."
                  : "Tasks are ordered from the nearest deadline."}
              </p>
            </div>
          </div>
          {openTasks.length ? (
            <div className={styles.dateList}>
              {[...openTasks].sort(sortByDueDate).map((task) => (
                <TaskRow key={task.id} task={task} workspaceId={workspaceId} />
              ))}
            </div>
          ) : (
            <EmptyState text="No open tasks with deadlines." />
          )}
        </section>
      ) : null}
      {view === "list" ? (
        <section className={styles.listView}>
          <div className={styles.listHeading}>
            <h2>All assigned tasks</h2>
            <span>{tasks.length}</span>
          </div>
          {tasks.length ? (
            <div className={styles.taskTable}>
              {[...tasks]
                .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt))
                .map((task) => (
                  <TaskRow key={task.id} task={task} workspaceId={workspaceId} />
                ))}
            </div>
          ) : (
            <EmptyState text="Tasks assigned to you will appear here." />
          )}
        </section>
      ) : null}
    </main>
  );
}

function TaskSection({
  accent,
  empty,
  icon: Icon,
  tasks,
  title,
  workspaceId,
}: {
  accent: "danger" | "today" | "upcoming";
  empty: string;
  icon?: typeof ListTodo;
  tasks: TaskWithProject[];
  title: string;
  workspaceId: string;
}) {
  return (
    <section className={`${styles.taskSection} ${styles[`accent${capitalize(accent)}`]}`}>
      <header>
        <div>
          {Icon ? <Icon aria-hidden="true" size={17} /> : null}
          <h2>{title}</h2>
          <span>{tasks.length}</span>
        </div>
      </header>
      {tasks.length ? (
        <div className={styles.taskCards}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} workspaceId={workspaceId} />
          ))}
        </div>
      ) : (
        <EmptyState text={empty} />
      )}
    </section>
  );
}

function TaskCard({ task, workspaceId }: { task: TaskWithProject; workspaceId: string }) {
  return (
    <Link
      className={styles.taskCard}
      href={`/workspaces/${workspaceId}/projects/${task.projectId}?taskId=${task.id}`}
    >
      <div className={styles.taskMeta}>
        <span>{task.key}</span>
        <span data-priority={task.priority}>{task.priority}</span>
      </div>
      <strong>{task.title}</strong>
      <div className={styles.taskFooter}>
        <span className={styles.status} style={{ "--status-color": task.status.color } as React.CSSProperties}>
          {task.status.name}
        </span>
        <time className={isOverdue(task.dueDate) ? styles.overdue : undefined}>
          {formatDueDate(task.dueDate)}
        </time>
      </div>
      <span className={styles.projectName}>{task.project.name}</span>
    </Link>
  );
}

function TaskRow({ task, workspaceId }: { task: TaskWithProject; workspaceId: string }) {
  return (
    <Link
      className={styles.taskRow}
      href={`/workspaces/${workspaceId}/projects/${task.projectId}?taskId=${task.id}`}
    >
      <span className={styles.statusDot} style={{ background: task.status.color }} />
      <div>
        <strong>{task.title}</strong>
        <span>{task.project.name} · {task.key}</span>
      </div>
      <span className={styles.rowStatus}>{task.status.name}</span>
      <time className={isOverdue(task.dueDate) ? styles.overdue : undefined}>
        {formatDueDate(task.dueDate)}
      </time>
      <ChevronRight aria-hidden="true" size={17} />
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}

function buildBoardColumns(tasks: TaskWithProject[]) {
  const columns = [
    { accent: "upcoming" as const, category: "todo", label: "To do" },
    { accent: "today" as const, category: "in_progress", label: "In progress" },
    { accent: "upcoming" as const, category: "done", label: "Done" },
  ];
  return columns.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status.category === column.category),
  }));
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

function isOverdue(dueDate: string | null) {
  return Boolean(dueDate && dueDate < todayKey());
}

function isToday(dueDate: string | null) {
  return dueDate === todayKey();
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function sortByDueDate(left: Task, right: Task) {
  return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
}

function formatDueDate(value: string | null) {
  if (!value) return "No deadline";
  if (isToday(value)) return "Today";
  if (isOverdue(value)) return `Overdue · ${formatDate(value)}`;
  return formatDate(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function capitalize(value: string) {
  return value[0]!.toUpperCase() + value.slice(1);
}
