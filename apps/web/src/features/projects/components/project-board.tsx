"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  GripVertical,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import {
  ApiClientError,
  createTask,
  createProjectSprint,
  deleteProjectSprint,
  restoreTask,
  createProjectStatus,
  deleteProject,
  deleteProjectStatus,
  getProject,
  getProjectSprints,
  getTasks,
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspace,
  getApiAssetUrl,
  replaceTaskLabels,
  reorderProjectStatuses,
  updateTask,
  updateProject,
  updateProjectSprint,
  updateProjectStatus,
  uploadProjectIcon,
  deleteProjectIcon,
} from "@/shared/lib/api-client";
import type {
  Label,
  PageInfo,
  Project,
  Task,
  TaskType,
  UpdateTaskRequest,
  TaskPriority,
  TaskSortField,
  TaskSortOrder,
  WorkspaceMember,
  WorkspaceRole,
  ProjectSprint,
} from "@devflow/shared";
import { can } from "@devflow/shared";
import { Modal } from "@/shared/components/modal";
import styles from "@/shared/styles/ui.module.css";

type BoardFilters = {
  archived?: boolean;
  priority?: TaskPriority;
  labelId?: string;
  assigneeUserId?: string | "none";
  due?: "overdue" | "today" | "week" | "none";
  search?: string;
  sortBy?: TaskSortField;
  sortOrder?: TaskSortOrder;
  sprintId?: string | "backlog";
};

type ProjectView = "board" | "list";
type BoardColumnSize = "fixed" | "flexible";
type BoardScrolling = "column" | "board";
type TaskCardField =
  "assignee" | "dueDate" | "labels" | "priority" | "taskKey" | "taskType";

const taskCardFields: Array<{ id: TaskCardField; label: string }> = [
  { id: "assignee", label: "Assignee" },
  { id: "dueDate", label: "Due date" },
  { id: "labels", label: "Labels" },
  { id: "priority", label: "Priority" },
  { id: "taskKey", label: "Work item key" },
  { id: "taskType", label: "Work type" },
];
const defaultTaskCardFields: TaskCardField[] = [
  "assignee",
  "dueDate",
  "labels",
  "priority",
  "taskKey",
  "taskType",
];

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const taskTypes: TaskType[] = ["task", "bug", "feature", "story"];
const taskPageSize = 50;
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
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | "backlog">(
    "backlog",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [pageInfo, setPageInfo] = useState<PageInfo>();
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
  const [sortBy, setSortBy] = useState<TaskSortField>("number");
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string>();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [draftStatusId, setDraftStatusId] = useState<string>();
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSize, setColumnSize] = useState<BoardColumnSize>("flexible");
  const [boardScrolling, setBoardScrolling] = useState<BoardScrolling>("board");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hideDoneTasks, setHideDoneTasks] = useState(false);
  const [visibleTaskFields, setVisibleTaskFields] = useState<TaskCardField[]>(
    defaultTaskCardFields,
  );
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [showSprintSettings, setShowSprintSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSavingSprint, setIsSavingSprint] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingProjectIcon, setIsSavingProjectIcon] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isReorderingStatuses, setIsReorderingStatuses] = useState(false);
  const [view, setView] = useState<ProjectView>("board");
  const [error, setError] = useState<string>();
  const [draggedTaskId, setDraggedTaskId] = useState<string>();
  const [draggedStatusId, setDraggedStatusId] = useState<string>();
  const [dropStatusId, setDropStatusId] = useState<string>();
  const [resizingColumn, setResizingColumn] = useState<{
    id: string;
    startWidth: number;
    startX: number;
  }>();
  const [showArchived, setShowArchived] = useState(false);
  const canCreateTasks = role ? can(role, "task:create") : false;
  const canUpdateTasks = role ? can(role, "task:update") : false;
  const canDeleteTasks = role ? can(role, "task:delete") : false;
  const canUpdateProject = role ? can(role, "project:update") : false;
  const canDeleteProject = role ? can(role, "project:delete") : false;
  const selectedSprint = sprints.find(
    (sprint) => sprint.id === selectedSprintId,
  );
  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const completedSprints = sprints.filter(
    (sprint) => sprint.status === "completed",
  );
  const plannedSprints = sprints.filter(
    (sprint) => sprint.status === "planning",
  );
  const activeFilterCount = [
    priority,
    labelId,
    assigneeUserId,
    due,
    showArchived,
    sortBy !== "number",
    sortOrder !== "asc",
  ].filter(Boolean).length;

  useEffect(() => {
    if (!resizingColumn) return;
    const activeResize = resizingColumn;

    function onPointerMove(event: PointerEvent) {
      const nextWidth = Math.max(
        240,
        Math.min(
          640,
          activeResize.startWidth + event.clientX - activeResize.startX,
        ),
      );
      setColumnWidths((current) => ({
        ...current,
        [activeResize.id]: nextWidth,
      }));
    }

    function onPointerUp() {
      setResizingColumn(undefined);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [resizingColumn]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      getProject(workspaceId, projectId),
      getWorkspaceLabels(workspaceId),
      getWorkspaceMembers(workspaceId),
      getWorkspace(workspaceId),
      getProjectSprints(workspaceId, projectId),
    ])
      .then(
        async ([
          projectResponse,
          labelsResponse,
          membersResponse,
          workspaceResponse,
          sprintsResponse,
        ]) => {
          if (!active) return;
          const activeSprint = sprintsResponse.sprints.find(
            (sprint) => sprint.status === "active",
          );
          const initialSprintId = activeSprint?.id ?? "backlog";
          const taskResponse = await getTasks(workspaceId, projectId, {
            limit: taskPageSize,
            sprintId: initialSprintId,
          });
          if (!active) return;
          setProject(projectResponse.project);
          setTasks(taskResponse.tasks);
          setPageInfo(taskResponse.pageInfo);
          setSprints(sprintsResponse.sprints);
          setSelectedSprintId(initialSprintId);
          setFilters({ sprintId: initialSprintId });
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

  async function loadTasks(nextFilters: BoardFilters, offset = 0) {
    setError(undefined);
    setIsRefreshing(true);
    try {
      const requestFilters = {
        ...nextFilters,
        limit: taskPageSize,
        offset,
      };
      let response = await getTasks(workspaceId, projectId, requestFilters);

      if (
        response.tasks.length === 0 &&
        response.pageInfo.total > 0 &&
        response.pageInfo.offset > 0
      ) {
        const lastPageOffset =
          Math.floor((response.pageInfo.total - 1) / response.pageInfo.limit) *
          response.pageInfo.limit;

        response = await getTasks(workspaceId, projectId, {
          ...requestFilters,
          offset: lastPageOffset,
        });
      }

      setTasks(response.tasks);
      setPageInfo(response.pageInfo);
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
      ...(showArchived ? { archived: true } : {}),
      sprintId: selectedSprintId,
      sortBy,
      sortOrder,
    };
    setFilters(nextFilters);
    await loadTasks(nextFilters);
    setShowFilters(false);
  }

  async function onClearFilters() {
    setSearch("");
    setPriority("");
    setLabelId("");
    setAssigneeUserId("");
    setDue("");
    setSortBy("number");
    setSortOrder("asc");
    setShowArchived(false);
    const nextFilters = {
      sortBy: "number" as const,
      sortOrder: "asc" as const,
      sprintId: selectedSprintId,
    };
    setFilters(nextFilters);
    await loadTasks(nextFilters);
    setShowFilters(false);
  }

  async function onRestoreTask(task: Task) {
    try {
      await restoreTask(workspaceId, projectId, task.id, task.version);
      const nextFilters = { ...filters, archived: true };
      setFilters(nextFilters);
      await loadTasks(nextFilters, pageInfo?.offset);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to restore task.",
      );
    }
  }

  async function onChangeTaskPage(offset: number) {
    await loadTasks(filters, offset);
  }

  async function onMoveStatus(statusId: string, direction: -1 | 1) {
    if (!project) return;

    const currentIndex = project.statuses.findIndex(
      (status) => status.id === statusId,
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= project.statuses.length
    ) {
      return;
    }

    const statuses = [...project.statuses];
    [statuses[currentIndex], statuses[targetIndex]] = [
      statuses[targetIndex]!,
      statuses[currentIndex]!,
    ];

    await onReorderStatuses(statuses.map((status) => status.id));
  }

  async function onReorderStatuses(statusIds: string[]) {
    setIsReorderingStatuses(true);
    setError(undefined);
    try {
      const response = await reorderProjectStatuses(workspaceId, projectId, {
        statusIds,
      });
      setProject(response.project);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to reorder board statuses.",
      );
    } finally {
      setIsReorderingStatuses(false);
    }
  }

  async function onDropStatus(statusId: string) {
    if (!project || !draggedStatusId || draggedStatusId === statusId) return;

    const statusIds = project.statuses.map((status) => status.id);
    const sourceIndex = statusIds.indexOf(draggedStatusId);
    const targetIndex = statusIds.indexOf(statusId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    statusIds.splice(sourceIndex, 1);
    statusIds.splice(statusIds.indexOf(statusId), 0, draggedStatusId);
    await onReorderStatuses(statusIds);
  }

  function onColumnResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    statusId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setColumnSize("fixed");
    setResizingColumn({
      id: statusId,
      startWidth: columnWidths[statusId] ?? 320,
      startX: event.clientX,
    });
  }

  function toggleVisibleTaskField(field: TaskCardField) {
    setVisibleTaskFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreating(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await createTask(workspaceId, projectId, {
        title: String(form.get("title") ?? ""),
        statusId: String(form.get("statusId")),
        priority: form.get("priority") as TaskPriority,
        ...(selectedSprintId === "backlog"
          ? {}
          : { sprintId: selectedSprintId }),
        type: form.get("type") as TaskType,
        assigneeUserId: String(form.get("assigneeUserId") ?? "") || undefined,
        dueDate: String(form.get("dueDate") ?? "") || undefined,
      });
      setTasks((current) => [...current, response.task]);
      event.currentTarget.reset();
      setShowTaskForm(false);
      setDraftStatusId(undefined);
      await loadTasks(filters, pageInfo?.offset);
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

  async function onCreateSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSavingSprint(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await createProjectSprint(workspaceId, projectId, {
        endDate: String(form.get("endDate") ?? "") || undefined,
        goal: String(form.get("goal") ?? "").trim() || undefined,
        name: String(form.get("name") ?? ""),
        startDate: String(form.get("startDate") ?? "") || undefined,
        status: "active",
      });
      const nextFilters = { ...filters, sprintId: response.sprint.id };
      setSprints((current) => [response.sprint, ...current]);
      setSelectedSprintId(response.sprint.id);
      setFilters(nextFilters);
      setShowSprintForm(false);
      await loadTasks(nextFilters);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create sprint.",
      );
    } finally {
      setIsSavingSprint(false);
    }
  }

  async function onSelectSprint(sprintId: string | "backlog") {
    const nextFilters = { ...filters, sprintId };
    setSelectedSprintId(sprintId);
    setFilters(nextFilters);
    await loadTasks(nextFilters);
  }

  async function onSprintSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSprint) return;

    setError(undefined);
    setIsSavingSprint(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateProjectSprint(
        workspaceId,
        projectId,
        selectedSprint.id,
        {
          endDate: String(form.get("endDate") ?? "") || null,
          goal: String(form.get("goal") ?? "").trim() || null,
          name: String(form.get("name") ?? ""),
          startDate: String(form.get("startDate") ?? "") || null,
          status: form.get("status") as ProjectSprint["status"],
        },
      );
      setSprints((current) =>
        current.map((sprint) =>
          sprint.id === response.sprint.id ? response.sprint : sprint,
        ),
      );
      setShowSprintSettings(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update sprint.",
      );
    } finally {
      setIsSavingSprint(false);
    }
  }

  async function onDeleteSprint() {
    if (
      !selectedSprint ||
      !window.confirm(
        "Delete this sprint? Tasks must be moved to the backlog first.",
      )
    ) {
      return;
    }

    setError(undefined);
    setIsSavingSprint(true);
    try {
      await deleteProjectSprint(workspaceId, projectId, selectedSprint.id);
      const nextFilters = { ...filters, sprintId: "backlog" as const };
      setSprints((current) =>
        current.filter((sprint) => sprint.id !== selectedSprint.id),
      );
      setSelectedSprintId("backlog");
      setFilters(nextFilters);
      setShowSprintSettings(false);
      await loadTasks(nextFilters);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete sprint.",
      );
    } finally {
      setIsSavingSprint(false);
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

  async function onProjectIconChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !project) return;
    setError(undefined);
    setIsSavingProjectIcon(true);
    try {
      const response = await uploadProjectIcon(workspaceId, projectId, file);
      setProject(response.project);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to upload project icon.",
      );
    } finally {
      event.currentTarget.value = "";
      setIsSavingProjectIcon(false);
    }
  }

  async function onProjectIconRemove() {
    setError(undefined);
    setIsSavingProjectIcon(true);
    try {
      const response = await deleteProjectIcon(workspaceId, projectId);
      setProject(response.project);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to remove project icon.",
      );
    } finally {
      setIsSavingProjectIcon(false);
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
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add status.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onQuickCreateStatus(event: FormEvent<HTMLFormElement>) {
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
      setShowAddColumn(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add column.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onUpdateStatus(
    event: FormEvent<HTMLFormElement>,
    statusId: string,
  ) {
    event.preventDefault();
    setError(undefined);
    setIsSavingStatus(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateProjectStatus(
        workspaceId,
        projectId,
        statusId,
        {
          category: form.get("category") as "todo" | "in_progress" | "done",
          color: String(form.get("color") ?? "#64748b"),
          name: String(form.get("name") ?? ""),
        },
      );
      setProject(response.project);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update status.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onDeleteStatus(statusId: string) {
    if (
      !window.confirm(
        "Delete this status? Empty it first if it contains tasks.",
      )
    )
      return;
    setError(undefined);
    setIsSavingStatus(true);
    try {
      await deleteProjectStatus(workspaceId, projectId, statusId);
      setProject((current) =>
        current
          ? {
              ...current,
              statuses: current.statuses.filter(
                (status) => status.id !== statusId,
              ),
            }
          : current,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete status.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function onUpdateTask(task: Task, input: UpdateTaskRequest) {
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
        await loadTasks(filters, pageInfo?.offset);
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

  async function onTaskEditorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;

    setError(undefined);
    setUpdatingTaskId(selectedTask.id);
    const form = new FormData(event.currentTarget);
    const assigneeUserId = String(form.get("assigneeUserId") ?? "");
    const dueDate = String(form.get("dueDate") ?? "");
    const sprintId = String(form.get("sprintId") ?? "");
    const description = String(form.get("description") ?? "").trim();

    try {
      const response = await updateTask(
        workspaceId,
        projectId,
        selectedTask.id,
        {
          assigneeUserId: assigneeUserId || null,
          description: description || null,
          dueDate: dueDate || null,
          priority: form.get("priority") as TaskPriority,
          sprintId: sprintId || null,
          statusId: String(form.get("statusId")),
          title: String(form.get("title") ?? ""),
          type: form.get("type") as TaskType,
        },
        selectedTask.version,
      );
      const labelIds = form.getAll("labelIds").map(String);
      await replaceTaskLabels(
        workspaceId,
        projectId,
        selectedTask.id,
        labelIds,
      );
      setTasks((current) =>
        current.map((task) =>
          task.id === response.task.id ? response.task : task,
        ),
      );
      setSelectedTask(undefined);
      await loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "TASK_VERSION_CONFLICT"
      ) {
        await loadTasks(filters, pageInfo?.offset);
        setSelectedTask(undefined);
        setError("This task changed elsewhere. The latest version is shown.");
        return;
      }
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the task.",
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
        <div className={styles.projectIdentity}>
          <span className={styles.projectIcon}>
            {project.iconUrl ? (
              <img alt="" src={getApiAssetUrl(project.iconUrl) ?? undefined} />
            ) : (
              project.key.slice(0, 1)
            )}
          </span>
          <div>
            <p className={styles.eyebrow}>{project.key}</p>
            <h1>{project.name}</h1>
            {project.description ? <p>{project.description}</p> : null}
          </div>
        </div>
        <div className={styles.projectHeaderActions}>
          <div className={styles.projectMenu}>
            <button
              aria-expanded={showProjectMenu}
              aria-haspopup="menu"
              aria-label="Project actions"
              className={styles.iconButton}
              onClick={() => setShowProjectMenu((current) => !current)}
              title="Project actions"
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={19} strokeWidth={1.8} />
            </button>
            {showProjectMenu ? (
              <div className={styles.projectMenuList} role="menu">
                <button
                  disabled={!canUpdateProject}
                  onClick={() => {
                    setShowProjectMenu(false);
                    setShowProjectSettings(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Settings aria-hidden="true" size={17} strokeWidth={1.8} />
                  Project settings
                </button>
              </div>
            ) : null}
          </div>
          <button
            className={styles.primaryButton}
            disabled={!canUpdateProject}
            onClick={() => setShowSprintForm(true)}
            type="button"
          >
            New sprint
          </button>
        </div>
      </header>
      <section
        className={styles.activeSprintPanel}
        aria-labelledby="active-sprint-title"
      >
        <div>
          <p className={styles.eyebrow}>Active sprint</p>
          <h2 id="active-sprint-title">
            {activeSprint ? activeSprint.name : "No active sprint"}
          </h2>
          <p>
            {activeSprint
              ? formatSprintPeriod(activeSprint.startDate, activeSprint.endDate)
              : "Start a sprint when the team is ready to focus on a new goal."}
          </p>
          {activeSprint?.goal ? (
            <p className={styles.activeSprintGoal}>{activeSprint.goal}</p>
          ) : null}
        </div>
        {activeSprint ? (
          <button
            aria-label="Active sprint settings"
            className={styles.secondaryButton}
            disabled={!canUpdateProject}
            onClick={() => {
              if (selectedSprintId !== activeSprint.id) {
                void onSelectSprint(activeSprint.id).then(() =>
                  setShowSprintSettings(true),
                );
                return;
              }
              setShowSprintSettings(true);
            }}
            type="button"
          >
            <Settings aria-hidden="true" size={17} strokeWidth={1.8} />
            Manage sprint
          </button>
        ) : (
          <button
            className={styles.primaryButton}
            disabled={!canUpdateProject}
            onClick={() => setShowSprintForm(true)}
            type="button"
          >
            Start sprint
          </button>
        )}
      </section>
      <div className={styles.sprintToolbar}>
        <label>
          <span>View tasks</span>
          <select
            disabled={isRefreshing}
            onChange={(event) => void onSelectSprint(event.target.value)}
            value={selectedSprintId}
          >
            {activeSprint ? (
              <option value={activeSprint.id}>
                Active sprint: {activeSprint.name}
              </option>
            ) : null}
            <option value="backlog">Backlog</option>
            {plannedSprints.length ? (
              <optgroup label="Planned sprints">
                {plannedSprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {completedSprints.length ? (
              <optgroup label="Past sprints">
                {completedSprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      </div>
      {showSprintForm ? (
        <Modal
          isOpen={showSprintForm}
          onClose={() => setShowSprintForm(false)}
          title="Start a sprint"
        >
          <form className={styles.modalForm} onSubmit={onCreateSprint}>
            <label>
              <span>Sprint name</span>
              <input autoFocus maxLength={120} name="name" required />
            </label>
            <label>
              <span>Goal</span>
              <textarea maxLength={2000} name="goal" rows={3} />
            </label>
            <label>
              <span>Start date</span>
              <input name="startDate" type="date" />
            </label>
            <label>
              <span>End date</span>
              <input name="endDate" type="date" />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isSavingSprint}
                type="submit"
              >
                {isSavingSprint ? "Starting" : "Start sprint"}
              </button>
              <button
                className={styles.textButton}
                disabled={isSavingSprint}
                onClick={() => setShowSprintForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {showSprintSettings && selectedSprint ? (
        <Modal
          isOpen={showSprintSettings}
          onClose={() => setShowSprintSettings(false)}
          title="Sprint settings"
        >
          <form className={styles.modalForm} onSubmit={onSprintSettingsSubmit}>
            <label>
              <span>Sprint name</span>
              <input
                defaultValue={selectedSprint.name}
                maxLength={120}
                name="name"
                required
              />
            </label>
            <label>
              <span>Goal</span>
              <textarea
                defaultValue={selectedSprint.goal ?? ""}
                maxLength={2000}
                name="goal"
                rows={3}
              />
            </label>
            <label>
              <span>Status</span>
              <select defaultValue={selectedSprint.status} name="status">
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              <span>Start date</span>
              <input
                defaultValue={selectedSprint.startDate ?? ""}
                name="startDate"
                type="date"
              />
            </label>
            <label>
              <span>End date</span>
              <input
                defaultValue={selectedSprint.endDate ?? ""}
                name="endDate"
                type="date"
              />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isSavingSprint}
                type="submit"
              >
                {isSavingSprint ? "Saving" : "Save sprint"}
              </button>
              <button
                className={styles.textButton}
                disabled={isSavingSprint}
                onClick={() => void onDeleteSprint()}
                type="button"
              >
                Delete sprint
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {selectedTask ? (
        <TaskEditorModal
          isSaving={updatingTaskId === selectedTask.id}
          labels={labels}
          members={members}
          onClose={() => setSelectedTask(undefined)}
          onSubmit={onTaskEditorSubmit}
          project={project}
          sprints={sprints}
          task={selectedTask}
        />
      ) : null}
      {showProjectSettings ? (
        <Modal
          isOpen={showProjectSettings}
          onClose={() => setShowProjectSettings(false)}
          title="Project settings"
          width="wide"
        >
          <section className={styles.projectIconSettings}>
            <span className={styles.projectIcon}>
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
              <label className={styles.secondaryButton}>
                {isSavingProjectIcon ? "Uploading" : "Change icon"}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSavingProjectIcon || !canUpdateProject}
                  onChange={(event) => void onProjectIconChange(event)}
                  type="file"
                />
              </label>
              {project.iconUrl ? (
                <button
                  className={styles.textButton}
                  disabled={isSavingProjectIcon || !canUpdateProject}
                  onClick={() => void onProjectIconRemove()}
                  type="button"
                >
                  Remove icon
                </button>
              ) : null}
            </div>
          </section>
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
          <section className={styles.workspaceSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Danger zone</h2>
                <p>Permanently delete this project and all its tasks.</p>
              </div>
              <button
                className={styles.textButton}
                disabled={!canDeleteProject}
                onClick={() => void onProjectDelete()}
                type="button"
              >
                Delete project
              </button>
            </div>
          </section>
        </Modal>
      ) : null}
      {showBoardSettings ? (
        <Modal
          isOpen={showBoardSettings}
          onClose={() => setShowBoardSettings(false)}
          title="Board settings"
          width="wide"
        >
          <section className={styles.viewSettingsSection}>
            <h2>View settings</h2>
            <label className={styles.viewSettingsSelect}>
              <span>Hide completed work items</span>
              <select
                onChange={(event) =>
                  setHideDoneTasks(event.target.value === "hide")
                }
                value={hideDoneTasks ? "hide" : "show"}
              >
                <option value="show">Show all work items</option>
                <option value="hide">Hide completed work items</option>
              </select>
            </label>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Column size</legend>
              <p>
                Flexible columns fill the board. Fixed columns keep their width.
              </p>
              <div className={styles.segmentedControl}>
                <button
                  aria-pressed={columnSize === "fixed"}
                  onClick={() => setColumnSize("fixed")}
                  type="button"
                >
                  Fixed
                </button>
                <button
                  aria-pressed={columnSize === "flexible"}
                  onClick={() => setColumnSize("flexible")}
                  type="button"
                >
                  Flexible
                </button>
              </div>
            </fieldset>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Scrolling</legend>
              <p>
                Choose whether long boards scroll as one surface or inside each
                column.
              </p>
              <div className={styles.segmentedControl}>
                <button
                  aria-pressed={boardScrolling === "column"}
                  onClick={() => setBoardScrolling("column")}
                  type="button"
                >
                  Within columns
                </button>
                <button
                  aria-pressed={boardScrolling === "board"}
                  onClick={() => setBoardScrolling("board")}
                  type="button"
                >
                  Whole board
                </button>
              </div>
            </fieldset>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Show fields on cards</legend>
              <div className={styles.fieldToggleList}>
                {taskCardFields.map((field) => (
                  <label key={field.id}>
                    <input
                      checked={visibleTaskFields.includes(field.id)}
                      onChange={() => toggleVisibleTaskField(field.id)}
                      type="checkbox"
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
          <section
            className={styles.boardSettingsSection}
            aria-labelledby="statuses-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="statuses-title">Columns</h2>
                <p>Columns are shared by every sprint in this project.</p>
              </div>
            </div>
            {project.statuses.map((status, index) => (
              <form
                className={styles.memberInviteForm}
                key={status.id}
                onSubmit={(event) => void onUpdateStatus(event, status.id)}
              >
                <label>
                  <span>Name</span>
                  <input
                    defaultValue={status.name}
                    maxLength={80}
                    name="name"
                    required
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select defaultValue={status.category} name="category">
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <label>
                  <span>Color</span>
                  <input
                    defaultValue={status.color}
                    name="color"
                    pattern="#[0-9A-Fa-f]{6}"
                    required
                  />
                </label>
                <button
                  className={styles.secondaryButton}
                  disabled={isSavingStatus}
                  type="submit"
                >
                  Save
                </button>
                <button
                  className={styles.textButton}
                  disabled={isSavingStatus}
                  onClick={() => void onDeleteStatus(status.id)}
                  type="button"
                >
                  Remove
                </button>
                <button
                  aria-label={`Move ${status.name} left`}
                  className={styles.iconButton}
                  disabled={
                    isSavingStatus || isReorderingStatuses || index === 0
                  }
                  onClick={() => void onMoveStatus(status.id, -1)}
                  title="Move left"
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={`Move ${status.name} right`}
                  className={styles.iconButton}
                  disabled={
                    isSavingStatus ||
                    isReorderingStatuses ||
                    index === project.statuses.length - 1
                  }
                  onClick={() => void onMoveStatus(status.id, 1)}
                  title="Move right"
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </form>
            ))}
            <form className={styles.memberInviteForm} onSubmit={onCreateStatus}>
              <label>
                <span>Name</span>
                <input maxLength={80} name="name" required />
              </label>
              <label>
                <span>Category</span>
                <select defaultValue="todo" name="category">
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                <span>Color</span>
                <input
                  defaultValue="#64748b"
                  name="color"
                  pattern="#[0-9A-Fa-f]{6}"
                  required
                />
              </label>
              <button
                className={styles.primaryButton}
                disabled={isSavingStatus}
                type="submit"
              >
                Add column
              </button>
            </form>
          </section>
        </Modal>
      ) : null}
      {showAddColumn ? (
        <Modal
          isOpen={showAddColumn}
          onClose={() => setShowAddColumn(false)}
          title="Add a column"
        >
          <form className={styles.modalForm} onSubmit={onQuickCreateStatus}>
            <label>
              <span>Column name</span>
              <input
                autoFocus
                maxLength={80}
                name="name"
                placeholder="For example, In review"
                required
              />
            </label>
            <label>
              <span>Category</span>
              <select defaultValue="todo" name="category">
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>
              <span>Color</span>
              <input defaultValue="#64748b" name="color" type="color" />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isSavingStatus}
                type="submit"
              >
                {isSavingStatus ? "Adding" : "Add column"}
              </button>
              <button
                className={styles.textButton}
                disabled={isSavingStatus}
                onClick={() => setShowAddColumn(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
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

      <form className={styles.boardToolbar} onSubmit={onFilter}>
        <label className={styles.boardSearch}>
          <span className={styles.srOnly}>Search tasks</span>
          <Search aria-hidden="true" size={17} strokeWidth={1.8} />
          <input
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            value={search}
          />
        </label>
        <button
          aria-label="Search tasks"
          className={styles.iconButton}
          disabled={isRefreshing}
          title="Search tasks"
          type="submit"
        >
          <Search aria-hidden="true" size={17} strokeWidth={1.8} />
        </button>
        <button
          className={styles.secondaryButton}
          onClick={() => setShowFilters(true)}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.8} />
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
        <button
          aria-label="Board settings"
          className={styles.iconButton}
          disabled={!canUpdateProject}
          onClick={() => setShowBoardSettings(true)}
          title="Board settings"
          type="button"
        >
          <Settings aria-hidden="true" size={17} strokeWidth={1.8} />
        </button>
      </form>
      {showFilters ? (
        <Modal
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filter tasks"
        >
          <form className={styles.modalForm} onSubmit={onFilter}>
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
            <label>
              <span>Task state</span>
              <select
                onChange={(event) =>
                  setShowArchived(event.target.value === "archived")
                }
                value={showArchived ? "archived" : "active"}
              >
                <option value="active">Active tasks</option>
                <option value="archived">Archived tasks</option>
              </select>
            </label>
            <label>
              <span>Sort by</span>
              <select
                onChange={(event) =>
                  setSortBy(event.target.value as TaskSortField)
                }
                value={sortBy}
              >
                <option value="number">Task number</option>
                <option value="createdAt">Created date</option>
                <option value="updatedAt">Updated date</option>
                <option value="priority">Priority</option>
              </select>
            </label>
            <label>
              <span>Order</span>
              <select
                onChange={(event) =>
                  setSortOrder(event.target.value as TaskSortOrder)
                }
                value={sortOrder}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isRefreshing}
                type="submit"
              >
                Apply filters
              </button>
              <button
                className={styles.textButton}
                disabled={isRefreshing}
                onClick={() => void onClearFilters()}
                type="button"
              >
                Clear all
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      {view === "board" ? (
        <section
          aria-label="Tasks"
          className={styles.taskBoard}
          data-column-size={columnSize}
          data-scrolling={boardScrolling}
        >
          {project.statuses.map((status) => {
            const statusTasks = tasks.filter(
              (task) =>
                task.statusId === status.id &&
                (!hideDoneTasks || status.category !== "done"),
            );
            return (
              <section
                className={`${styles.taskColumn} ${dropStatusId === status.id ? styles.taskColumnDropTarget : ""}`}
                key={status.id}
                onDragEnter={() => setDropStatusId(status.id)}
                onDragLeave={() => setDropStatusId(undefined)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (
                    event.dataTransfer.getData("application/x-devflow-status")
                  ) {
                    void onDropStatus(status.id);
                    return;
                  }
                  void onDropTask(event, status.id);
                }}
                style={
                  columnSize === "fixed"
                    ? { flexBasis: `${columnWidths[status.id] ?? 320}px` }
                    : undefined
                }
              >
                <header
                  className={styles.taskColumnHeader}
                  draggable={canUpdateProject}
                  onDragEnd={() => {
                    setDraggedStatusId(undefined);
                    setDropStatusId(undefined);
                  }}
                  onDragStart={(event) => {
                    if (!canUpdateProject) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "application/x-devflow-status",
                      status.id,
                    );
                    setDraggedStatusId(status.id);
                  }}
                  title={
                    canUpdateProject ? "Drag to reorder this column" : undefined
                  }
                >
                  <div>
                    {canUpdateProject ? (
                      <GripVertical
                        aria-hidden="true"
                        className={styles.columnDragHandle}
                        size={17}
                        strokeWidth={1.8}
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={styles.statusDot}
                      style={{ backgroundColor: status.color }}
                    />
                    <h2>{status.name}</h2>
                  </div>
                  <span>{statusTasks.length}</span>
                </header>
                <div className={styles.taskList}>
                  {statusTasks.map((task) => (
                    <article
                      className={styles.taskCard}
                      draggable={canUpdateTasks}
                      onClick={() => setSelectedTask(task)}
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
                      {visibleTaskFields.includes("taskKey") ||
                      visibleTaskFields.includes("taskType") ||
                      visibleTaskFields.includes("priority") ? (
                        <div className={styles.taskCardMeta}>
                          <span>
                            {visibleTaskFields.includes("taskKey")
                              ? task.key
                              : null}
                            {visibleTaskFields.includes("taskKey") &&
                            visibleTaskFields.includes("taskType")
                              ? " "
                              : null}
                            {visibleTaskFields.includes("taskType") ? (
                              <span className={styles.taskType}>
                                {task.type}
                              </span>
                            ) : null}
                          </span>
                          {visibleTaskFields.includes("priority") ? (
                            <span
                              className={`${styles.priority} ${priorityStyles[task.priority]}`}
                            >
                              {task.priority}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <h3>
                        <button
                          className={styles.taskTitleButton}
                          type="button"
                        >
                          {task.title}
                        </button>
                      </h3>
                      {task.description ? <p>{task.description}</p> : null}
                      {visibleTaskFields.includes("labels") &&
                      task.labels.length ? (
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
                      {visibleTaskFields.includes("dueDate") && task.dueDate ? (
                        <p className={styles.taskDueDate}>Due {task.dueDate}</p>
                      ) : null}
                      {visibleTaskFields.includes("assignee") &&
                      task.assignee ? (
                        <p className={styles.taskAssignee}>
                          {task.assignee.displayName}
                        </p>
                      ) : null}
                      <TaskControls
                        onUpdateTask={onUpdateTask}
                        priorities={priorities}
                        project={project}
                        task={task}
                        updatingTaskId={updatingTaskId}
                        canUpdate={canUpdateTasks}
                        onRestore={
                          showArchived && canDeleteTasks
                            ? onRestoreTask
                            : undefined
                        }
                      />
                    </article>
                  ))}
                  {statusTasks.length === 0 &&
                  (!hideDoneTasks || status.category !== "done") ? (
                    <p className={styles.taskColumnEmpty}>No tasks</p>
                  ) : null}
                  {showTaskForm && draftStatusId === status.id ? (
                    <QuickTaskForm
                      isCreating={isCreating}
                      members={members}
                      onCancel={() => {
                        setShowTaskForm(false);
                        setDraftStatusId(undefined);
                      }}
                      onSubmit={onCreateTask}
                      statusId={status.id}
                    />
                  ) : canCreateTasks &&
                    (!hideDoneTasks || status.category !== "done") ? (
                    <button
                      aria-label={`Create task in ${status.name}`}
                      className={styles.taskQuickAdd}
                      disabled={isCreating}
                      onClick={() => {
                        setDraftStatusId(status.id);
                        setShowTaskForm(true);
                      }}
                      title={`Create task in ${status.name}`}
                      type="button"
                    >
                      +
                    </button>
                  ) : null}
                </div>
                {canUpdateProject ? (
                  <button
                    aria-label={`Resize ${status.name} column`}
                    className={styles.columnResizeHandle}
                    onPointerDown={(event) =>
                      onColumnResizeStart(event, status.id)
                    }
                    title="Drag to resize column"
                    type="button"
                  />
                ) : null}
              </section>
            );
          })}
          {canUpdateProject ? (
            <button
              aria-label="Add column"
              className={styles.addColumnButton}
              onClick={() => setShowAddColumn(true)}
              title="Add column"
              type="button"
            >
              <Plus aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
          ) : null}
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

      {pageInfo ? (
        <nav aria-label="Task pagination" className={styles.pagination}>
          <span>
            {pageInfo.total === 0
              ? "No tasks"
              : `${pageInfo.offset + 1}-${Math.min(pageInfo.offset + tasks.length, pageInfo.total)} of ${pageInfo.total}`}
          </span>
          <div>
            <button
              aria-label="Previous tasks"
              className={styles.iconButton}
              disabled={isRefreshing || pageInfo.offset === 0}
              onClick={() =>
                void onChangeTaskPage(
                  Math.max(0, pageInfo.offset - pageInfo.limit),
                )
              }
              title="Previous page"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="Next tasks"
              className={styles.iconButton}
              disabled={isRefreshing || !pageInfo.hasNextPage}
              onClick={() =>
                void onChangeTaskPage(pageInfo.offset + pageInfo.limit)
              }
              title="Next page"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </nav>
      ) : null}
    </main>
  );
}

function formatSprintPeriod(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `Started ${startDate}`;
  if (endDate) return `Ends ${endDate}`;
  return "Dates have not been set";
}

function TaskEditorModal({
  isSaving,
  labels,
  members,
  onClose,
  onSubmit,
  project,
  sprints,
  task,
}: {
  isSaving: boolean;
  labels: Label[];
  members: WorkspaceMember[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  project: Project;
  sprints: ProjectSprint[];
  task: Task;
}) {
  return (
    <Modal isOpen onClose={onClose} title={`${task.key} details`} width="wide">
      <form
        className={styles.taskEditorForm}
        onSubmit={(event) => void onSubmit(event)}
      >
        <section className={styles.taskEditorMain}>
          <label>
            <span>Title</span>
            <input
              autoFocus
              defaultValue={task.title}
              maxLength={200}
              minLength={2}
              name="title"
              required
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              defaultValue={task.description ?? ""}
              maxLength={10000}
              name="description"
              rows={9}
            />
          </label>
          <fieldset className={styles.taskLabelsFieldset}>
            <legend>Labels</legend>
            {labels.length ? (
              labels.map((label) => (
                <label key={label.id}>
                  <input
                    defaultChecked={task.labels.some(
                      (taskLabel) => taskLabel.id === label.id,
                    )}
                    name="labelIds"
                    type="checkbox"
                    value={label.id}
                  />
                  <span style={{ backgroundColor: label.color }} />
                  {label.name}
                </label>
              ))
            ) : (
              <p className={styles.emptyState}>No workspace labels yet.</p>
            )}
          </fieldset>
        </section>
        <aside className={styles.taskEditorDetails}>
          <label>
            <span>Status</span>
            <select defaultValue={task.statusId} name="statusId">
              {project.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select defaultValue={task.type} name="type">
              {taskTypes.map((type) => (
                <option key={type} value={type}>
                  {type[0]!.toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select defaultValue={task.priority} name="priority">
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0]!.toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Assignee</span>
            <select
              defaultValue={task.assigneeUserId ?? ""}
              name="assigneeUserId"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select defaultValue={task.sprintId ?? ""} name="sprintId">
              <option value="">Backlog</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} ({sprint.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input
              defaultValue={task.dueDate ?? ""}
              name="dueDate"
              type="date"
            />
          </label>
        </aside>
        <div className={styles.formActions}>
          <button
            className={styles.primaryButton}
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving" : "Save changes"}
          </button>
          <button
            className={styles.textButton}
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskControls({
  onUpdateTask,
  priorities,
  project,
  task,
  updatingTaskId,
  canUpdate,
  onRestore,
}: {
  onUpdateTask: (task: Task, input: UpdateTaskRequest) => Promise<void>;
  priorities: TaskPriority[];
  project: Project;
  task: Task;
  updatingTaskId?: string;
  canUpdate: boolean;
  onRestore?: (task: Task) => Promise<void>;
}) {
  return (
    <div
      className={styles.taskCardControls}
      onClick={(event) => event.stopPropagation()}
    >
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
      {onRestore ? (
        <button
          className={styles.textButton}
          onClick={() => void onRestore(task)}
          type="button"
        >
          Restore
        </button>
      ) : null}
    </div>
  );
}

function QuickTaskForm({
  isCreating,
  members,
  onCancel,
  onSubmit,
  statusId,
}: {
  isCreating: boolean;
  members: WorkspaceMember[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  statusId: string;
}) {
  return (
    <form
      className={styles.quickTaskForm}
      onSubmit={(event) => void onSubmit(event)}
    >
      <input name="statusId" type="hidden" value={statusId} />
      <label className={styles.srOnly} htmlFor={`task-title-${statusId}`}>
        Task title
      </label>
      <input
        autoFocus
        id={`task-title-${statusId}`}
        maxLength={200}
        minLength={2}
        name="title"
        placeholder="What needs to be done?"
        required
      />
      <div className={styles.quickTaskControls}>
        <label title="Work type">
          <span className={styles.srOnly}>Work type</span>
          <select defaultValue="task" name="type">
            {taskTypes.map((type) => (
              <option key={type} value={type}>
                {type[0]!.toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label title="Priority">
          <span className={styles.srOnly}>Priority</span>
          <select defaultValue="medium" name="priority">
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0]!.toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.quickTaskIconField} title="Due date">
          <CalendarDays aria-hidden="true" size={16} />
          <span className={styles.srOnly}>Due date</span>
          <input aria-label="Due date" name="dueDate" type="date" />
        </label>
        <label className={styles.quickTaskIconField} title="Assignee">
          <UserRound aria-hidden="true" size={16} />
          <span className={styles.srOnly}>Assignee</span>
          <select aria-label="Assignee" defaultValue="" name="assigneeUserId">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label="Create task"
          className={styles.iconButton}
          disabled={isCreating}
          title="Create task"
          type="submit"
        >
          <CornerDownLeft aria-hidden="true" size={17} />
        </button>
        <button
          className={styles.textButton}
          disabled={isCreating}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
