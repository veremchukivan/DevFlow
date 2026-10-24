"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

import {
  ApiClientError,
  createTask,
  createProjectStatus,
  deleteProject,
  deleteProjectStatus,
  getProject,
  getTasks,
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspace,
  replaceTaskLabels,
  updateTask,
  updateProject,
  updateProjectStatus,
} from "@/lib/api-client";
import type {
  Label,
  Project,
  Task,
  TaskPriority,
  WorkspaceMember,
  WorkspaceRole,
} from "@devflow/shared";
import { can } from "@devflow/shared";
import styles from "@/components/ui.module.css";

type BoardFilters = {
  priority?: TaskPriority;
  labelId?: string;
  assigneeUserId?: string | "none";
  due?: "overdue" | "today" | "week" | "none";
  search?: string;
};

type ProjectView = "board" | "list";

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const priorityStyles: Record<TaskPriority, string> = {
  high: styles.priorityHigh!,
  low: styles.priorityLow!,
  medium: styles.priorityMedium!,
  urgent: styles.priorityUrgent!,
};

export function ProjectBoard() {
  const router = useRouter();
  const params = useParams<{ projectId: string; workspaceId: string }>();
  const { projectId, workspaceId } = params;
  const [project, setProject] = useState<Project>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"" | TaskPriority>("");
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelId, setLabelId] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [role, setRole] = useState<WorkspaceRole>();
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [due, setDue] = useState<"" | "overdue" | "today" | "week" | "none">(
    "",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string>();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [draftStatusId, setDraftStatusId] = useState<string>();
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [view, setView] = useState<ProjectView>("board");
  const [error, setError] = useState<string>();
  const [draggedTaskId, setDraggedTaskId] = useState<string>();
  const [dropStatusId, setDropStatusId] = useState<string>();
  const canCreateTasks = role ? can(role, "task:create") : false;
  const canUpdateTasks = role ? can(role, "task:update") : false;
  const canUpdateProject = role ? can(role, "project:update") : false;
  const canDeleteProject = role ? can(role, "project:delete") : false;

  useEffect(() => {
    let active = true;

    void Promise.all([
      getProject(workspaceId, projectId),
      getTasks(workspaceId, projectId),
      getWorkspaceLabels(workspaceId),
      getWorkspaceMembers(workspaceId),
      getWorkspace(workspaceId),
    ])
      .then(
        ([
          projectResponse,
          taskResponse,
          labelsResponse,
          membersResponse,
          workspaceResponse,
        ]) => {
          if (!active) return;
          setProject(projectResponse.project);
          setTasks(taskResponse.tasks);
          setLabels(labelsResponse.labels);
          setMembers(
            membersResponse.members.filter(
              (member) => member.status === "active",
            ),
          );
          setRole(workspaceResponse.workspace.role);
        },
      )
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
      ...(labelId ? { labelId } : {}),
      ...(assigneeUserId
        ? { assigneeUserId: assigneeUserId as string | "none" }
        : {}),
      ...(due ? { due } : {}),
    };
    setFilters(nextFilters);
    await loadTasks(nextFilters);
  }

  async function onClearFilters() {
    setSearch("");
    setPriority("");
    setLabelId("");
    setAssigneeUserId("");
    setDue("");
    setFilters({});
    await loadTasks({});
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreating(true);
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();

    try {
      const response = await createTask(workspaceId, projectId, {
        title: String(form.get("title") ?? ""),
        statusId: String(form.get("statusId")),
        priority: form.get("priority") as TaskPriority,
        assigneeUserId: String(form.get("assigneeUserId") ?? "") || undefined,
        dueDate: String(form.get("dueDate") ?? "") || undefined,
        ...(description ? { description } : {}),
      });
      const labelIds = form.getAll("labelIds").map(String);
      if (labelIds.length) {
        await replaceTaskLabels(
          workspaceId,
          projectId,
          response.task.id,
          labelIds,
        );
      }
      event.currentTarget.reset();
      setShowTaskForm(false);
      setDraftStatusId(undefined);
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

  async function onProjectSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setError(undefined);
    setIsSavingProject(true);
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    try {
      const response = await updateProject(workspaceId, projectId, {
        name: String(form.get("name") ?? ""),
        key: String(form.get("key") ?? ""),
        description: description || null,
      });
      setProject(response.project);
      setShowProjectSettings(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update project.",
      );
    } finally {
      setIsSavingProject(false);
    }
  }

  async function onProjectDelete() {
    if (
      !window.confirm(
        "Delete this project and its tasks? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteProject(workspaceId, projectId);
      router.replace(`/workspaces/${workspaceId}`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete project.",
      );
    }
  }

  async function onCreateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSavingStatus(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await createProjectStatus(workspaceId, projectId, {
        category: form.get("category") as "todo" | "in_progress" | "done",
        color: String(form.get("color") ?? "#64748b"),
        name: String(form.get("name") ?? ""),
      });
      setProject(response.project);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to add status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onUpdateStatus(event: FormEvent<HTMLFormElement>, statusId: string) {
    event.preventDefault();
    setError(undefined);
    setIsSavingStatus(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateProjectStatus(workspaceId, projectId, statusId, {
        category: form.get("category") as "todo" | "in_progress" | "done",
        color: String(form.get("color") ?? "#64748b"),
        name: String(form.get("name") ?? ""),
      });
      setProject(response.project);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to update status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onDeleteStatus(statusId: string) {
    if (!window.confirm("Delete this status? Empty it first if it contains tasks.")) return;
    setError(undefined);
    setIsSavingStatus(true);
    try {
      await deleteProjectStatus(workspaceId, projectId, statusId);
      setProject((current) => current ? { ...current, statuses: current.statuses.filter((status) => status.id !== statusId) } : current);
    } catch (caughtError) {
      setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to delete status.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onUpdateTask(
    task: Task,
    input: { priority?: TaskPriority; statusId?: string },
  ) {
    setError(undefined);
    setUpdatingTaskId(task.id);

    try {
      const response = await updateTask(
        workspaceId,
        projectId,
        task.id,
        input,
        task.version,
      );
      setTasks((current) =>
        current.map((currentTask) =>
          currentTask.id === response.task.id ? response.task : currentTask,
        ),
      );
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "TASK_VERSION_CONFLICT"
      ) {
        await loadTasks(filters);
        setError("This task changed elsewhere. The latest version is shown.");
        return;
      }

      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "UNAUTHENTICATED"
      ) {
        router.replace("/login");
        return;
      }

      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the task. Try again.",
      );
    } finally {
      setUpdatingTaskId(undefined);
    }
  }

  async function onDropTask(event: DragEvent<HTMLElement>, statusId: string) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    setDropStatusId(undefined);
    setDraggedTaskId(undefined);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.statusId === statusId) return;
    await onUpdateTask(task, { statusId });
  }

  if (isLoading) return <main className={styles.loading}>Loading project</main>;

  if (!project) {
    return (
      <main className={styles.workspaceHome}>
        <Link className={styles.backLink} href={`/workspaces/${workspaceId}`}>
          Back to workspace
        </Link>
        <p className={styles.formError}>{error ?? "Project not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.projectBoardPage}>
      <Link className={styles.backLink} href={`/workspaces/${workspaceId}`}>
        {"<- Back to workspace"}
      </Link>
      <header className={styles.projectBoardHeader}>
        <div>
          <p className={styles.eyebrow}>{project.key}</p>
          <h1>{project.name}</h1>
          {project.description ? <p>{project.description}</p> : null}
        </div>
        <div className={styles.formActions}>
          <button
            className={styles.secondaryButton}
            disabled={!canUpdateProject}
            onClick={() => setShowProjectSettings((current) => !current)}
            type="button"
          >
            Settings
          </button>
          <button
            className={styles.textButton}
            disabled={!canDeleteProject}
            onClick={() => void onProjectDelete()}
            type="button"
          >
            Delete
          </button>
          <button
            className={styles.primaryButton}
            disabled={!canCreateTasks}
            onClick={() => setShowTaskForm((current) => !current)}
            type="button"
          >
            New task
          </button>
        </div>
      </header>
      {showProjectSettings ? (
        <form className={styles.taskForm} onSubmit={onProjectSettingsSubmit}>
          <label>
            <span>Project name</span>
            <input
              defaultValue={project.name}
              maxLength={160}
              minLength={2}
              name="name"
              required
            />
          </label>
          <label>
            <span>Key</span>
            <input
              defaultValue={project.key}
              maxLength={12}
              name="key"
              required
            />
          </label>
          <label className={styles.taskDescriptionField}>
            <span>Description</span>
            <textarea
              defaultValue={project.description ?? ""}
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isSavingProject}
              type="submit"
            >
              {isSavingProject ? "Saving" : "Save settings"}
            </button>
            <button
              className={styles.textButton}
              onClick={() => setShowProjectSettings(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {showProjectSettings ? (
        <section className={styles.workspaceSection} aria-labelledby="statuses-title">
          <div className={styles.sectionHeading}><h2 id="statuses-title">Board statuses</h2></div>
          {project.statuses.map((status) => (
            <form className={styles.memberInviteForm} key={status.id} onSubmit={(event) => void onUpdateStatus(event, status.id)}>
              <label><span>Name</span><input defaultValue={status.name} maxLength={80} name="name" required /></label>
              <label><span>Category</span><select defaultValue={status.category} name="category"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
              <label><span>Color</span><input defaultValue={status.color} name="color" pattern="#[0-9A-Fa-f]{6}" required /></label>
              <button className={styles.secondaryButton} disabled={isSavingStatus} type="submit">Save</button>
              <button className={styles.textButton} disabled={isSavingStatus} onClick={() => void onDeleteStatus(status.id)} type="button">Remove</button>
            </form>
          ))}
          <form className={styles.memberInviteForm} onSubmit={onCreateStatus}>
            <label><span>Name</span><input maxLength={80} name="name" required /></label>
            <label><span>Category</span><select defaultValue="todo" name="category"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
            <label><span>Color</span><input defaultValue="#64748b" name="color" pattern="#[0-9A-Fa-f]{6}" required /></label>
            <button className={styles.primaryButton} disabled={isSavingStatus} type="submit">Add status</button>
          </form>
        </section>
      ) : null}

      <div
        className={styles.projectViews}
        role="tablist"
        aria-label="Project views"
      >
        <button
          aria-selected={view === "board"}
          className={styles.projectView}
          onClick={() => setView("board")}
          role="tab"
          type="button"
        >
          <LayoutGrid aria-hidden="true" size={17} strokeWidth={1.8} />
          Kanban
        </button>
        <button
          aria-selected={view === "list"}
          className={styles.projectView}
          onClick={() => setView("list")}
          role="tab"
          type="button"
        >
          <List aria-hidden="true" size={18} strokeWidth={1.8} />
          List
        </button>
      </div>

      {showTaskForm ? (
        <form className={styles.taskForm} onSubmit={onCreateTask}>
          <label>
            <span>Task title</span>
            <input maxLength={200} minLength={2} name="title" required />
          </label>
          <label>
            <span>Status</span>
            <select
              defaultValue={
                draftStatusId ??
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
          <label>
            <span>Assignee</span>
            <select defaultValue="" name="assigneeUserId">
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input name="dueDate" type="date" />
          </label>
          {labels.length ? (
            <fieldset className={styles.taskLabelsFieldset}>
              <legend>Labels</legend>
              {labels.map((label) => (
                <label key={label.id}>
                  <input name="labelIds" type="checkbox" value={label.id} />
                  {label.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className={styles.taskDescriptionField}>
            <span>Description</span>
            <textarea maxLength={10000} name="description" rows={3} />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "Creating" : "Create task"}
            </button>
            <button
              className={styles.textButton}
              onClick={() => {
                setShowTaskForm(false);
                setDraftStatusId(undefined);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <form className={styles.taskFilters} onSubmit={onFilter}>
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
        <label>
          <span>Label</span>
          <select
            onChange={(event) => setLabelId(event.target.value)}
            value={labelId}
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Assignee</span>
          <select
            onChange={(event) => setAssigneeUserId(event.target.value)}
            value={assigneeUserId}
          >
            <option value="">All assignees</option>
            <option value="none">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due date</span>
          <select
            onChange={(event) => setDue(event.target.value as typeof due)}
            value={due}
          >
            <option value="">Any date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="none">No due date</option>
          </select>
        </label>
        <button
          className={styles.secondaryButton}
          disabled={isRefreshing}
          type="submit"
        >
          {isRefreshing ? "Loading" : "Apply"}
        </button>
        <button
          className={styles.textButton}
          disabled={isRefreshing}
          onClick={() => void onClearFilters()}
          type="button"
        >
          Clear
        </button>
      </form>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      {view === "board" ? (
        <section aria-label="Tasks" className={styles.taskBoard}>
          {project.statuses.map((status) => {
            const statusTasks = tasks.filter(
              (task) => task.statusId === status.id,
            );
            return (
              <section
                className={`${styles.taskColumn} ${dropStatusId === status.id ? styles.taskColumnDropTarget : ""}`}
                key={status.id}
                onDragEnter={() => setDropStatusId(status.id)}
                onDragLeave={() => setDropStatusId(undefined)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void onDropTask(event, status.id)}
              >
                <header className={styles.taskColumnHeader}>
                  <div>
                    <span
                      aria-hidden="true"
                      className={styles.statusDot}
                      style={{ backgroundColor: status.color }}
                    />
                    <h2>{status.name}</h2>
                  </div>
                  <span>{statusTasks.length}</span>
                  <button
                    aria-label={`Create task in ${status.name}`}
                    className={styles.iconButton}
                    disabled={!canCreateTasks}
                    onClick={() => {
                      setDraftStatusId(status.id);
                      setShowTaskForm(true);
                    }}
                    title="Create task"
                    type="button"
                  >
                    +
                  </button>
                </header>
                <div className={styles.taskList}>
                  {statusTasks.map((task) => (
                    <article
                      className={styles.taskCard}
                      draggable={canUpdateTasks}
                      onDragEnd={() => {
                        setDraggedTaskId(undefined);
                        setDropStatusId(undefined);
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                        setDraggedTaskId(task.id);
                      }}
                      key={task.id}
                    >
                      <div className={styles.taskCardMeta}>
                        <span>{task.key}</span>
                        <span
                          className={`${styles.priority} ${priorityStyles[task.priority]}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <h3>
                        <Link
                          className={styles.taskLink}
                          href={`/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`}
                        >
                          {task.title}
                        </Link>
                      </h3>
                      {task.description ? <p>{task.description}</p> : null}
                      {task.labels.length ? (
                        <div className={styles.taskLabels}>
                          {task.labels.map((label) => (
                            <span
                              key={label.id}
                              style={{ backgroundColor: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {task.dueDate ? (
                        <p className={styles.taskDueDate}>Due {task.dueDate}</p>
                      ) : null}
                      <TaskControls
                        onUpdateTask={onUpdateTask}
                        priorities={priorities}
                        project={project}
                        task={task}
                        updatingTaskId={updatingTaskId}
                        canUpdate={canUpdateTasks}
                      />
                    </article>
                  ))}
                  {statusTasks.length === 0 ? (
                    <p className={styles.taskColumnEmpty}>No tasks</p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </section>
      ) : (
        <section aria-label="Tasks list" className={styles.taskTable}>
          <div className={styles.taskTableHeader}>
            <span>Task</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Assignee</span>
          </div>
          {tasks.map((task) => (
            <article className={styles.taskTableRow} key={task.id}>
              <div className={styles.taskTableTitle}>
                <span>{task.key}</span>
                <Link
                  href={`/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`}
                >
                  {task.title}
                </Link>
              </div>
              <label>
                <span className={styles.srOnly}>Status for {task.key}</span>
                <select
                  disabled={!canUpdateTasks || updatingTaskId === task.id}
                  onChange={(event) =>
                    void onUpdateTask(task, { statusId: event.target.value })
                  }
                  value={task.statusId}
                >
                  {project.statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={styles.srOnly}>Priority for {task.key}</span>
                <select
                  disabled={!canUpdateTasks || updatingTaskId === task.id}
                  onChange={(event) =>
                    void onUpdateTask(task, {
                      priority: event.target.value as TaskPriority,
                    })
                  }
                  value={task.priority}
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <span>{task.assignee?.displayName ?? "Unassigned"}</span>
            </article>
          ))}
          {tasks.length === 0 ? (
            <p className={styles.emptyState}>No tasks match these filters.</p>
          ) : null}
        </section>
      )}
    </main>
  );
}

function TaskControls({
  onUpdateTask,
  priorities,
  project,
  task,
  updatingTaskId,
  canUpdate,
}: {
  onUpdateTask: (
    task: Task,
    input: { priority?: TaskPriority; statusId?: string },
  ) => Promise<void>;
  priorities: TaskPriority[];
  project: Project;
  task: Task;
  updatingTaskId?: string;
  canUpdate: boolean;
}) {
  return (
    <div className={styles.taskCardControls}>
      <label>
        <span className={styles.srOnly}>Status</span>
        <select
          aria-label={`Status for ${task.key}`}
          disabled={!canUpdate || updatingTaskId === task.id}
          onChange={(event) =>
            void onUpdateTask(task, { statusId: event.target.value })
          }
          value={task.statusId}
        >
          {project.statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={styles.srOnly}>Priority</span>
        <select
          aria-label={`Priority for ${task.key}`}
          disabled={!canUpdate || updatingTaskId === task.id}
          onChange={(event) =>
            void onUpdateTask(task, {
              priority: event.target.value as TaskPriority,
            })
          }
          value={task.priority}
        >
          {priorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
