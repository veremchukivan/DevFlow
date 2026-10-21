"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  createTask,
  getProject,
  getTasks,
} from "@/lib/api-client";
import type { Project, Task, TaskPriority } from "@devflow/shared";

type BoardFilters = {
  priority?: TaskPriority;
  search?: string;
};

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function ProjectBoard() {
  const router = useRouter();
  const params = useParams<{ projectId: string; workspaceId: string }>();
  const { projectId, workspaceId } = params;
  const [project, setProject] = useState<Project>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"" | TaskPriority>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([
      getProject(workspaceId, projectId),
      getTasks(workspaceId, projectId),
    ])
      .then(([projectResponse, taskResponse]) => {
        if (!active) return;
        setProject(projectResponse.project);
        setTasks(taskResponse.tasks);
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        if (active) setError("Unable to load this project.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, router, workspaceId]);

  async function loadTasks(nextFilters: BoardFilters) {
    setError(undefined);
    setIsRefreshing(true);
    try {
      const response = await getTasks(workspaceId, projectId, nextFilters);
      setTasks(response.tasks);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "UNAUTHENTICATED"
      ) {
        router.replace("/login");
        return;
      }
      setError("Unable to refresh tasks.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(priority ? { priority } : {}),
    };
    setFilters(nextFilters);
    await loadTasks(nextFilters);
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreating(true);
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();

    try {
      await createTask(workspaceId, projectId, {
        title: String(form.get("title") ?? ""),
        statusId: String(form.get("statusId")),
        priority: form.get("priority") as TaskPriority,
        ...(description ? { description } : {}),
      });
      event.currentTarget.reset();
      setShowTaskForm(false);
      await loadTasks(filters);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create the task. Try again.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading)
    return <main className="session-loading">Loading project</main>;

  if (!project) {
    return (
      <main className="workspace-home">
        <Link className="back-link" href={`/workspaces/${workspaceId}`}>
          Back to workspace
        </Link>
        <p className="form-error">{error ?? "Project not found."}</p>
      </main>
    );
  }

  return (
    <main className="project-board-page">
      <Link className="back-link" href={`/workspaces/${workspaceId}`}>
        {"<- Back to workspace"}
      </Link>
      <header className="project-board-header">
        <div>
          <p className="eyebrow">{project.key}</p>
          <h1>{project.name}</h1>
          {project.description ? <p>{project.description}</p> : null}
        </div>
        <button
          className="primary-button"
          onClick={() => setShowTaskForm((current) => !current)}
          type="button"
        >
          New task
        </button>
      </header>

      {showTaskForm ? (
        <form className="task-form" onSubmit={onCreateTask}>
          <label className="task-title-field">
            <span>Task title</span>
            <input maxLength={200} minLength={2} name="title" required />
          </label>
          <label>
            <span>Status</span>
            <select
              defaultValue={
                project.statuses.find((status) => status.isDefault)?.id
              }
              name="statusId"
              required
            >
              {project.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select defaultValue="medium" name="priority">
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="task-description-field">
            <span>Description</span>
            <textarea maxLength={10000} name="description" rows={3} />
          </label>
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "Creating" : "Create task"}
            </button>
            <button
              className="text-button"
              onClick={() => setShowTaskForm(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <form className="task-filters" onSubmit={onFilter}>
        <label>
          <span>Search</span>
          <input
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            value={search}
          />
        </label>
        <label>
          <span>Priority</span>
          <select
            onChange={(event) =>
              setPriority(event.target.value as "" | TaskPriority)
            }
            value={priority}
          >
            <option value="">All priorities</option>
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={isRefreshing}
          type="submit"
        >
          {isRefreshing ? "Loading" : "Apply"}
        </button>
      </form>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-label="Tasks" className="task-board">
        {project.statuses.map((status) => {
          const statusTasks = tasks.filter(
            (task) => task.statusId === status.id,
          );
          return (
            <section className="task-column" key={status.id}>
              <header className="task-column-header">
                <div>
                  <span
                    aria-hidden="true"
                    className="status-dot"
                    style={{ backgroundColor: status.color }}
                  />
                  <h2>{status.name}</h2>
                </div>
                <span>{statusTasks.length}</span>
              </header>
              <div className="task-list">
                {statusTasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-meta">
                      <span>{task.key}</span>
                      <span className={`priority priority-${task.priority}`}>
                        {task.priority}
                      </span>
                    </div>
                    <h3>{task.title}</h3>
                    {task.description ? <p>{task.description}</p> : null}
                  </article>
                ))}
                {statusTasks.length === 0 ? (
                  <p className="task-column-empty">No tasks</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
