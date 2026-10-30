"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  type DragEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerDownLeft,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  List,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import {
  ApiClientError,
  createTask,
  deleteTask,
  createProjectSprint,
  completeProjectSprint,
  deleteProjectSprint,
  restoreTask,
  createProjectStatus,
  deleteProject,
  deleteProjectStatus,
  getProject,
  getProjectActivity,
  getProjectViewPreferences,
  getCurrentUser,
  getProjectSprints,
  getProjectSprintAnalytics,
  getTask,
  getTasks,
  getWorkspaceMembers,
  getWorkspaceSettings,
  getWorkspace,
  getApiAssetUrl,
  reorderProjectStatuses,
  repositionTask,
  updateTask,
  updateProject,
  updateProjectSprint,
  updateProjectStatus,
  updateProjectViewPreferences,
  uploadProjectIcon,
  deleteProjectIcon,
  createProjectFigmaLink,
  deleteProjectFigmaLink,
  getProjectFigmaLinks,
  getFigmaFilePreview,
  createTaskFigmaLink,
  deleteTaskFigmaLink,
  getTaskFigmaLinks,
} from "@/shared/lib/api-client";
import type {
  PageInfo,
  Project,
  ProjectFigmaLink,
  TaskFigmaLink,
  FigmaFilePreview,
  Task,
  TaskType,
  UpdateTaskRequest,
  TaskPriority,
  TaskSortField,
  TaskSortOrder,
  WorkspaceMember,
  WorkspaceRole,
  ProjectSprint,
  ProjectSprintAnalytics,
  TaskActivityEvent,
} from "@devflow/shared";
import { can } from "@devflow/shared";
import { Modal } from "@/shared/components/modal";
import { TaskWorkPanel } from "./task-work-panel";
import { TaskWatchersPanel } from "./task-watchers-panel";
import { TaskTimeTrackingPanel } from "./task-time-tracking-panel";
import { TaskRelationsPanel } from "./task-relations-panel";
import { ProjectTeamModal } from "./project-team-modal";
import { notifyProjectsChanged } from "@/shared/lib/workspace-events";
import styles from "@/shared/styles/ui.module.css";

type BoardFilters = {
  archived?: boolean;
  priority?: TaskPriority;
  assigneeUserId?: string | "none";
  due?: "overdue" | "today" | "week" | "none";
  search?: string;
  sortBy?: TaskSortField;
  sortOrder?: TaskSortOrder;
  sprintId?: string | "backlog";
};

type TaskSidebarSectionId =
  "automation" | "details" | "development" | "relations" | "time" | "watching";

type ProjectView = "board" | "list";
type BoardColumnSize = "fixed" | "flexible";
type BoardScrolling = "column" | "board";
type TaskCardAccent = "none" | "status" | "priority";
type TaskCardColor = "neutral" | "blue" | "violet" | "sand";
type TaskCardField =
  "assignee" | "dueDate" | "priority" | "taskKey" | "taskType";

const taskCardFields: Array<{ id: TaskCardField; label: string }> = [
  { id: "assignee", label: "Assignee" },
  { id: "dueDate", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "taskKey", label: "Work item key" },
  { id: "taskType", label: "Work type" },
];
const defaultTaskCardFields: TaskCardField[] = [
  "assignee",
  "dueDate",
  "priority",
  "taskKey",
  "taskType",
];

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const taskTypes: TaskType[] = ["task", "bug", "feature", "story"];
const taskPageSize = 50;
const defaultActivityLimit = 1;
const maxActivityLimit = 25;
const priorityStyles: Record<TaskPriority, string> = {
  high: styles.priorityHigh!,
  low: styles.priorityLow!,
  medium: styles.priorityMedium!,
  urgent: styles.priorityUrgent!,
};

export function ProjectBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ projectId: string; workspaceId: string }>();
  const { projectId, workspaceId } = params;
  const taskIdFromUrl = searchParams.get("taskId");
  const [project, setProject] = useState<Project>();
  const [figmaLinks, setFigmaLinks] = useState<ProjectFigmaLink[]>([]);
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | "backlog">(
    "backlog",
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentActivity, setRecentActivity] = useState<TaskActivityEvent[]>([]);
  const [activityLimit, setActivityLimit] = useState(defaultActivityLimit);
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [pageInfo, setPageInfo] = useState<PageInfo>();
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"" | TaskPriority>("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [enabledTaskTypes, setEnabledTaskTypes] =
    useState<TaskType[]>(taskTypes);
  const [workspaceFeatures, setWorkspaceFeatures] = useState({
    attachments: true,
    automation: true,
    sprints: true,
  });
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [role, setRole] = useState<WorkspaceRole>();
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [due, setDue] = useState<"" | "overdue" | "today" | "week" | "none">(
    "",
  );
  const [sortBy, setSortBy] = useState<TaskSortField>("position");
  const [sortOrder, setSortOrder] = useState<TaskSortOrder>("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string>();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [draftStatusId, setDraftStatusId] = useState<string>();
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showProjectTeam, setShowProjectTeam] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showTaskCardSettings, setShowTaskCardSettings] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSize, setColumnSize] = useState<BoardColumnSize>("flexible");
  const [boardScrolling, setBoardScrolling] = useState<BoardScrolling>("board");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hideDoneTasks, setHideDoneTasks] = useState(false);
  const [taskCardAccent, setTaskCardAccent] =
    useState<TaskCardAccent>("status");
  const [taskCardColor, setTaskCardColor] = useState<TaskCardColor>("neutral");
  const [visibleTaskFields, setVisibleTaskFields] = useState<TaskCardField[]>(
    defaultTaskCardFields,
  );
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [taskContextMenu, setTaskContextMenu] = useState<{
    task: Task;
    x: number;
    y: number;
  }>();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [showSprintSettings, setShowSprintSettings] = useState(false);
  const [showCompleteSprint, setShowCompleteSprint] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSavingSprint, setIsSavingSprint] = useState(false);
  const [isCompletingSprint, setIsCompletingSprint] = useState(false);
  const [sprintAnalytics, setSprintAnalytics] =
    useState<ProjectSprintAnalytics>();
  const [isLoadingSprintAnalytics, setIsLoadingSprintAnalytics] =
    useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingProjectIcon, setIsSavingProjectIcon] = useState(false);
  const [isSavingFigmaLink, setIsSavingFigmaLink] = useState(false);
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
  const createTaskInFlight = useRef(false);
  const sprintAnalyticsRequestRef = useRef(0);
  const columnWidthsRef = useRef<Record<string, number>>({});
  const suppressTaskClickAfterDragRef = useRef(false);
  const viewPreferencesSaveRef = useRef(Promise.resolve());
  const saveViewPreferencesRef = useRef<
    (input: Parameters<typeof updateProjectViewPreferences>[2]) => void
  >(() => undefined);
  const canCreateTasks = role ? can(role, "task:create") : false;
  const canUpdateTasks = role ? can(role, "task:update") : false;
  const canDeleteTasks = role ? can(role, "task:delete") : false;
  const canUpdateProject = role ? can(role, "project:update") : false;
  const canDeleteProject = role ? can(role, "project:delete") : false;
  const sprintsEnabled = workspaceFeatures.sprints;
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
    assigneeUserId,
    due,
    showArchived,
    sortBy !== "position",
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
      setColumnWidths((current) => {
        const next = { ...current, [activeResize.id]: nextWidth };
        columnWidthsRef.current = next;
        return next;
      });
    }

    function onPointerUp() {
      setResizingColumn(undefined);
      saveViewPreferencesRef.current({
        columnWidths: columnWidthsRef.current,
      });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [projectId, resizingColumn, workspaceId]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      getProject(workspaceId, projectId),
      getProjectFigmaLinks(workspaceId, projectId),
      getWorkspaceMembers(workspaceId),
      getWorkspace(workspaceId),
      getWorkspaceSettings(workspaceId),
      getProjectSprints(workspaceId, projectId),
      getProjectViewPreferences(workspaceId, projectId),
      getCurrentUser(),
    ])
      .then(
        async ([
          projectResponse,
          figmaLinksResponse,
          membersResponse,
          workspaceResponse,
          workspaceSettingsResponse,
          sprintsResponse,
          preferencesResponse,
          currentUserResponse,
        ]) => {
          if (!active) return;
          const activeSprint = workspaceSettingsResponse.settings.features
            .sprints
            ? sprintsResponse.sprints.find(
                (sprint) => sprint.status === "active",
              )
            : undefined;
          const initialSprintId = activeSprint?.id ?? "backlog";
          const taskResponse = await getTasks(workspaceId, projectId, {
            limit: taskPageSize,
            sprintId: initialSprintId,
          });
          if (!active) return;
          setProject(projectResponse.project);
          setFigmaLinks(figmaLinksResponse.links);
          setTasks(taskResponse.tasks);
          setPageInfo(taskResponse.pageInfo);
          setSprints(sprintsResponse.sprints);
          setSelectedSprintId(initialSprintId);
          setFilters({ sprintId: initialSprintId });
          if (activeSprint) {
            void getProjectSprintAnalytics(
              workspaceId,
              projectId,
              activeSprint.id,
            )
              .then((analytics) => {
                if (active) setSprintAnalytics(analytics);
              })
              .catch(() => undefined);
          }
          setMembers(
            membersResponse.members.filter(
              (member) => member.status === "active",
            ),
          );
          setRole(workspaceResponse.workspace.role);
          setEnabledTaskTypes(
            workspaceSettingsResponse.settings.enabledTaskTypes,
          );
          setWorkspaceFeatures(workspaceSettingsResponse.settings.features);
          setCurrentUserId(currentUserResponse.user.id);
          setActivityLimit(preferencesResponse.preferences.activityLimit);
          setBoardScrolling(preferencesResponse.preferences.boardScrolling);
          setColumnSize(preferencesResponse.preferences.columnSize);
          setColumnWidths(preferencesResponse.preferences.columnWidths);
          columnWidthsRef.current =
            preferencesResponse.preferences.columnWidths;
          setHideDoneTasks(preferencesResponse.preferences.hideDoneTasks);
          setTaskCardAccent(preferencesResponse.preferences.taskCardAccent);
          setTaskCardColor(preferencesResponse.preferences.taskCardColor);
          setVisibleTaskFields(
            preferencesResponse.preferences.visibleTaskFields,
          );
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setTaskContextMenu(undefined);
      if (isMultiSelectMode) {
        setIsMultiSelectMode(false);
        setSelectedTaskIds([]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMultiSelectMode]);

  useEffect(() => {
    if (isLoading) return;

    let active = true;
    async function refreshActivity() {
      try {
        const response = await getProjectActivity(workspaceId, projectId, {
          limit: activityLimit,
        });
        if (active) setRecentActivity(response.events);
      } catch {
        // The board remains usable if the non-critical activity feed is delayed.
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshActivity();
    }, 15_000);
    const onFocus = () => void refreshActivity();
    void refreshActivity();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [activityLimit, isLoading, projectId, workspaceId]);

  useEffect(() => {
    if (!taskIdFromUrl) return;
    let active = true;

    void getTask(workspaceId, projectId, taskIdFromUrl)
      .then((response) => {
        if (active) setSelectedTask(response.task);
      })
      .catch(() => {
        if (active) setError("Unable to open this task.");
      });

    return () => {
      active = false;
    };
  }, [projectId, taskIdFromUrl, workspaceId]);

  function closeTaskEditor() {
    setSelectedTask(undefined);
    if (taskIdFromUrl) {
      router.replace(`/workspaces/${workspaceId}/projects/${projectId}`, {
        scroll: false,
      });
    }
  }

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

  useEffect(() => {
    if (
      isLoading ||
      selectedTask ||
      showTaskForm ||
      draggedTaskId ||
      updatingTaskId
    ) {
      return;
    }

    let active = true;
    async function refreshBoardTasks() {
      try {
        const response = await getTasks(workspaceId, projectId, {
          ...filters,
          limit: taskPageSize,
          offset: pageInfo?.offset ?? 0,
        });
        if (!active) return;
        setTasks(response.tasks);
        setPageInfo(response.pageInfo);
      } catch {
        // Keep the current board visible during a transient background failure.
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshBoardTasks();
      }
    }, 15_000);
    const onFocus = () => void refreshBoardTasks();
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    draggedTaskId,
    filters,
    isLoading,
    pageInfo?.offset,
    projectId,
    selectedTask,
    showTaskForm,
    updatingTaskId,
    workspaceId,
  ]);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(priority ? { priority } : {}),
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
    setAssigneeUserId("");
    setDue("");
    setSortBy("position");
    setSortOrder("asc");
    setShowArchived(false);
    const nextFilters = {
      sortBy: "position" as const,
      sortOrder: "asc" as const,
      sprintId: selectedSprintId,
    };
    setFilters(nextFilters);
    await loadTasks(nextFilters);
    setShowFilters(false);
  }

  async function onQuickFilter(filter: "mine" | "overdue" | "today") {
    const nextAssigneeUserId =
      filter === "mine" && currentUserId
        ? assigneeUserId === currentUserId
          ? ""
          : currentUserId
        : assigneeUserId;
    const nextDue =
      filter === "mine"
        ? due
        : due === filter
          ? ""
          : (filter as "overdue" | "today");
    const nextFilters = {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(priority ? { priority } : {}),
      ...(nextAssigneeUserId
        ? { assigneeUserId: nextAssigneeUserId as string | "none" }
        : {}),
      ...(nextDue ? { due: nextDue } : {}),
      ...(showArchived ? { archived: true } : {}),
      sprintId: selectedSprintId,
      sortBy,
      sortOrder,
    };
    setAssigneeUserId(nextAssigneeUserId);
    setDue(nextDue);
    setFilters(nextFilters);
    await loadTasks(nextFilters);
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

  async function onArchiveTask(task: Task) {
    if (!window.confirm(`Archive “${task.title}”?`)) return;
    try {
      await deleteTask(workspaceId, projectId, task.id, task.version);
      setTaskContextMenu(undefined);
      await loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to archive the task.",
      );
    }
  }

  async function copyTaskCardLink(task: Task) {
    const taskUrl = new URL(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
      window.location.origin,
    ).toString();
    try {
      await navigator.clipboard.writeText(taskUrl);
      setTaskContextMenu(undefined);
    } catch {
      setError("Unable to copy the task link.");
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  function enterMultiSelectMode(taskId: string) {
    setTaskContextMenu(undefined);
    setIsMultiSelectMode(true);
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );
  }

  function exitMultiSelectMode() {
    setIsMultiSelectMode(false);
    setSelectedTaskIds([]);
  }

  function onTaskCardClick(task: Task) {
    if (suppressTaskClickAfterDragRef.current) return;
    setTaskContextMenu(undefined);
    if (isMultiSelectMode) {
      toggleTaskSelection(task.id);
      return;
    }
    setSelectedTask(task);
  }

  async function onBulkUpdate(input: UpdateTaskRequest) {
    const selectedTasks = tasks.filter((task) =>
      selectedTaskIds.includes(task.id),
    );
    if (!selectedTasks.length) return;

    setIsBulkUpdating(true);
    setError(undefined);
    try {
      const results = await Promise.all(
        selectedTasks.map((task) =>
          updateTask(workspaceId, projectId, task.id, input, task.version),
        ),
      );
      const updatedById = new Map(
        results.map((response) => [response.task.id, response.task]),
      );
      setTasks((current) =>
        current.map((task) => updatedById.get(task.id) ?? task),
      );
      setSelectedTaskIds([]);
      await loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      await loadTasks(filters, pageInfo?.offset);
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update the selected tasks.",
      );
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function onBulkDelete() {
    const selectedTasks = tasks.filter((task) =>
      selectedTaskIds.includes(task.id),
    );
    if (
      !selectedTasks.length ||
      !window.confirm(`Delete ${selectedTasks.length} selected task(s)?`)
    )
      return;
    setIsBulkUpdating(true);
    setError(undefined);
    try {
      await Promise.all(
        selectedTasks.map((task) =>
          deleteTask(workspaceId, projectId, task.id, task.version),
        ),
      );
      exitMultiSelectMode();
      await loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      await loadTasks(filters, pageInfo?.offset);
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete the selected tasks.",
      );
    } finally {
      setIsBulkUpdating(false);
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
    saveViewPreferences({ columnSize: "fixed" });
    setResizingColumn({
      id: statusId,
      startWidth: columnWidths[statusId] ?? 320,
      startX: event.clientX,
    });
  }

  function toggleVisibleTaskField(field: TaskCardField) {
    setVisibleTaskFields((current) => {
      const next = current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field];
      saveViewPreferences({ visibleTaskFields: next });
      return next;
    });
  }

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createTaskInFlight.current) return;

    const formElement = event.currentTarget;
    createTaskInFlight.current = true;
    setError(undefined);
    setIsCreating(true);
    const form = new FormData(formElement);
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
      setTasks((current) =>
        current.some((task) => task.id === response.task.id)
          ? current
          : [...current, response.task],
      );
      formElement.reset();
      setShowTaskForm(false);
      setDraftStatusId(undefined);
      void loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create the task. Try again.",
      );
    } finally {
      createTaskInFlight.current = false;
      setIsCreating(false);
    }
  }

  function updateActivityLimit(nextLimit: number) {
    const normalizedLimit = normalizeActivityLimit(nextLimit);
    setActivityLimit(normalizedLimit);
    saveViewPreferences({ activityLimit: normalizedLimit });
  }

  function saveViewPreferences(
    input: Parameters<typeof updateProjectViewPreferences>[2],
  ) {
    viewPreferencesSaveRef.current = viewPreferencesSaveRef.current
      .catch(() => undefined)
      .then(async () => {
        await updateProjectViewPreferences(workspaceId, projectId, input);
      })
      .catch(() => {
        setError("Unable to save board settings.");
      });
  }

  saveViewPreferencesRef.current = saveViewPreferences;

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
        status: form.get("status") as ProjectSprint["status"],
      });
      const nextFilters = { ...filters, sprintId: response.sprint.id };
      setSprints((current) => [response.sprint, ...current]);
      setSelectedSprintId(response.sprint.id);
      setFilters(nextFilters);
      setShowSprintForm(false);
      void loadSprintAnalytics(response.sprint.id);
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
    if (sprintId === "backlog") {
      sprintAnalyticsRequestRef.current += 1;
      setSprintAnalytics(undefined);
      setIsLoadingSprintAnalytics(false);
    } else {
      void loadSprintAnalytics(sprintId);
    }
    await loadTasks(nextFilters);
  }

  async function loadSprintAnalytics(sprintId: string) {
    const requestId = sprintAnalyticsRequestRef.current + 1;
    sprintAnalyticsRequestRef.current = requestId;
    setSprintAnalytics(undefined);
    setIsLoadingSprintAnalytics(true);
    try {
      const analytics = await getProjectSprintAnalytics(
        workspaceId,
        projectId,
        sprintId,
      );
      if (sprintAnalyticsRequestRef.current === requestId) {
        setSprintAnalytics(analytics);
      }
    } catch (caughtError) {
      if (sprintAnalyticsRequestRef.current === requestId) {
        setSprintAnalytics(undefined);
      }
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to load sprint analytics.",
      );
    } finally {
      if (sprintAnalyticsRequestRef.current === requestId) {
        setIsLoadingSprintAnalytics(false);
      }
    }
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
      if (response.sprint.status === "completed") {
        void loadSprintAnalytics(response.sprint.id);
      }
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

  async function onCompleteSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSprint || selectedSprint.status === "completed") return;

    const form = new FormData(event.currentTarget);
    const carryOverValue = String(form.get("carryOver") ?? "backlog");
    const targetSprintId = carryOverValue.startsWith("sprint:")
      ? carryOverValue.slice("sprint:".length)
      : undefined;
    setError(undefined);
    setIsCompletingSprint(true);

    try {
      const response = await completeProjectSprint(
        workspaceId,
        projectId,
        selectedSprint.id,
        targetSprintId
          ? { carryOver: "sprint", targetSprintId }
          : { carryOver: "backlog" },
      );
      const nextFilters = { ...filters, sprintId: response.sprint.id };
      setSprints((current) =>
        current.map((sprint) =>
          sprint.id === response.sprint.id ? response.sprint : sprint,
        ),
      );
      setSelectedSprintId(response.sprint.id);
      setFilters(nextFilters);
      setShowCompleteSprint(false);
      await Promise.all([
        loadTasks(nextFilters),
        loadSprintAnalytics(response.sprint.id),
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to complete sprint.",
      );
    } finally {
      setIsCompletingSprint(false);
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
      notifyProjectsChanged(workspaceId);
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

  async function onProjectFigmaLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSavingFigmaLink(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await createProjectFigmaLink(workspaceId, projectId, {
        name: String(form.get("figmaName") ?? ""),
        url: String(form.get("figmaUrl") ?? ""),
      });
      setFigmaLinks((current) => [response.link, ...current]);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add Figma link.",
      );
    } finally {
      setIsSavingFigmaLink(false);
    }
  }

  async function onProjectFigmaLinkDelete(linkId: string) {
    setError(undefined);
    try {
      await deleteProjectFigmaLink(workspaceId, projectId, linkId);
      setFigmaLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to remove Figma link.",
      );
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
      notifyProjectsChanged(workspaceId);
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
      notifyProjectsChanged(workspaceId);
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
      notifyProjectsChanged(workspaceId);
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
    const parentTaskId = String(form.get("parentTaskId") ?? "");
    const sprintId = String(form.get("sprintId") ?? "");
    const description = String(form.get("description") ?? "").trim();
    const estimateValue = String(form.get("estimateMinutes") ?? "");
    const estimateMinutes = estimateValue ? Number(estimateValue) : null;

    if (
      estimateMinutes !== null &&
      (!Number.isInteger(estimateMinutes) || estimateMinutes < 0)
    ) {
      setError("Estimate must be a whole number of minutes.");
      setUpdatingTaskId(undefined);
      return;
    }

    try {
      const response = await updateTask(
        workspaceId,
        projectId,
        selectedTask.id,
        {
          assigneeUserId: assigneeUserId || null,
          description: description || null,
          dueDate: dueDate || null,
          estimateMinutes,
          parentTaskId: parentTaskId || null,
          priority: form.get("priority") as TaskPriority,
          sprintId: sprintId || null,
          statusId: String(form.get("statusId")),
          title: String(form.get("title") ?? ""),
          type: form.get("type") as TaskType,
        },
        selectedTask.version,
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

  async function onTaskDescriptionMediaSave(description: string) {
    if (!selectedTask) return;

    setError(undefined);
    setUpdatingTaskId(selectedTask.id);
    try {
      const response = await updateTask(
        workspaceId,
        projectId,
        selectedTask.id,
        { description },
        selectedTask.version,
      );
      setTasks((current) =>
        current.map((task) =>
          task.id === response.task.id ? response.task : task,
        ),
      );
      setSelectedTask((current) =>
        current?.id === response.task.id ? response.task : current,
      );
    } catch (caughtError) {
      if (
        caughtError instanceof ApiClientError &&
        caughtError.code === "TASK_VERSION_CONFLICT"
      ) {
        await loadTasks(filters, pageInfo?.offset);
        setError("The task changed elsewhere. Reload it and try again.");
      } else {
        setError(
          caughtError instanceof ApiClientError
            ? caughtError.message
            : "Unable to save media in the description.",
        );
      }
      throw caughtError;
    } finally {
      setUpdatingTaskId(undefined);
    }
  }

  async function onDropTask(
    event: DragEvent<HTMLElement>,
    statusId: string,
    beforeTaskId?: string,
  ) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    setDropStatusId(undefined);
    setDraggedTaskId(undefined);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.id === beforeTaskId) return;
    const targetStatus = project?.statuses.find((item) => item.id === statusId);
    if (!targetStatus) return;

    setTasks((current) => {
      const movingTask = current.find((item) => item.id === task.id);
      if (!movingTask) return current;

      const withoutMovingTask = current.filter((item) => item.id !== task.id);
      const beforeIndex = beforeTaskId
        ? withoutMovingTask.findIndex((item) => item.id === beforeTaskId)
        : -1;
      const lastTargetIndex = withoutMovingTask.reduce(
        (lastIndex, item, index) =>
          item.statusId === statusId ? index : lastIndex,
        -1,
      );
      const insertAt =
        beforeIndex >= 0 ? beforeIndex : Math.max(0, lastTargetIndex + 1);
      const reorderedTask = {
        ...movingTask,
        status: targetStatus,
        statusId,
      };

      return [
        ...withoutMovingTask.slice(0, insertAt),
        reorderedTask,
        ...withoutMovingTask.slice(insertAt),
      ];
    });

    try {
      await repositionTask(workspaceId, projectId, task.id, {
        beforeTaskId: beforeTaskId ?? null,
        statusId,
      });
      await loadTasks(filters, pageInfo?.offset);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to move the task.",
      );
      await loadTasks(filters, pageInfo?.offset);
    }
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
              <Image
                alt=""
                height={88}
                src={getApiAssetUrl(project.iconUrl)!}
                unoptimized
                width={88}
              />
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
                <button
                  onClick={() => {
                    setShowProjectMenu(false);
                    setShowProjectTeam(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <UserRound aria-hidden="true" size={17} strokeWidth={1.8} />
                  Project team
                </button>
              </div>
            ) : null}
          </div>
          {sprintsEnabled ? (
            <button
              className={styles.primaryButton}
              disabled={!canUpdateProject}
              onClick={() => setShowSprintForm(true)}
              type="button"
            >
              New sprint
            </button>
          ) : null}
        </div>
      </header>
      {selectedSprint ? (
        <section
          className={styles.sprintAnalytics}
          aria-labelledby="sprint-analytics-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Sprint analytics</p>
              <h2 id="sprint-analytics-title">{selectedSprint.name}</h2>
            </div>
            {isLoadingSprintAnalytics ? <span>Updating…</span> : null}
          </div>
          {sprintAnalytics ? (
            <>
              <div className={styles.sprintMetricGrid}>
                <article>
                  <span>Completed</span>
                  <strong>{sprintAnalytics.completed}</strong>
                  <small>of {sprintAnalytics.total} tasks</small>
                </article>
                <article>
                  <span>Open</span>
                  <strong>{sprintAnalytics.open}</strong>
                  <small>unfinished work</small>
                </article>
                <article>
                  <span>Overdue</span>
                  <strong>{sprintAnalytics.overdue}</strong>
                  <small>open past due date</small>
                </article>
                <article>
                  <span>Velocity</span>
                  <strong>{sprintAnalytics.velocity}</strong>
                  <small>completed tasks</small>
                </article>
              </div>
              {sprintAnalytics.statusDistribution.length ? (
                <ul className={styles.sprintDistribution}>
                  {sprintAnalytics.statusDistribution.map((status) => (
                    <li key={status.statusId}>
                      <span>{status.statusName}</span>
                      <div aria-hidden="true">
                        <i
                          style={{
                            width: `${Math.max(
                              6,
                              (status.count /
                                Math.max(sprintAnalytics.total, 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <strong>{status.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className={styles.emptySprintAnalytics}>
              No task data is available for this sprint yet.
            </p>
          )}
        </section>
      ) : null}
      {sprintsEnabled && showSprintForm ? (
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
            <label>
              <span>Initial status</span>
              <select defaultValue="active" name="status">
                <option value="active">Start now</option>
                <option value="planning">Plan for later</option>
              </select>
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
      {showCompleteSprint && selectedSprint ? (
        <Modal
          isOpen={showCompleteSprint}
          onClose={() => setShowCompleteSprint(false)}
          title={`Complete ${selectedSprint.name}`}
        >
          <form className={styles.modalForm} onSubmit={onCompleteSprint}>
            <p className={styles.modalHelpText}>
              Completed work remains in this sprint. Choose where to move every
              unfinished task.
            </p>
            <label>
              <span>Move unfinished tasks to</span>
              <select defaultValue="backlog" name="carryOver">
                <option value="backlog">Backlog</option>
                {sprints
                  .filter(
                    (sprint) =>
                      sprint.id !== selectedSprint.id &&
                      sprint.status !== "completed",
                  )
                  .map((sprint) => (
                    <option key={sprint.id} value={`sprint:${sprint.id}`}>
                      Sprint: {sprint.name} ({sprint.status})
                    </option>
                  ))}
              </select>
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isCompletingSprint}
                type="submit"
              >
                {isCompletingSprint ? "Completing" : "Complete sprint"}
              </button>
              <button
                className={styles.textButton}
                disabled={isCompletingSprint}
                onClick={() => setShowCompleteSprint(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {selectedTask ? (
        <TaskEditorModal
          availableParentTasks={tasks}
          attachmentsEnabled={workspaceFeatures.attachments}
          enabledTaskTypes={enabledTaskTypes}
          figmaLinks={figmaLinks}
          isSaving={updatingTaskId === selectedTask.id}
          members={members}
          onClose={closeTaskEditor}
          onDescriptionMediaSave={onTaskDescriptionMediaSave}
          onSubtaskCreated={(createdTask) =>
            setTasks((current) => [...current, createdTask])
          }
          onSubmit={onTaskEditorSubmit}
          project={project}
          role={role}
          sprints={sprints}
          task={selectedTask}
          workspaceId={workspaceId}
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
                <Image
                  alt=""
                  height={64}
                  src={getApiAssetUrl(project.iconUrl)!}
                  unoptimized
                  width={64}
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
                <h2>Figma links</h2>
                <p>
                  Shared design files, pages, and prototypes for this project.
                </p>
              </div>
            </div>
            {figmaLinks.length > 0 ? (
              <ul className={styles.sessionList}>
                {figmaLinks.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} rel="noreferrer" target="_blank">
                      <strong>{link.name}</strong>
                      <span>{link.url}</span>
                    </a>
                    {canUpdateProject ? (
                      <button
                        className={styles.textButton}
                        onClick={() => void onProjectFigmaLinkDelete(link.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.mutedCopy}>
                No Figma links have been added.
              </p>
            )}
            {canUpdateProject ? (
              <form
                className={styles.taskForm}
                onSubmit={onProjectFigmaLinkSubmit}
              >
                <label>
                  <span>Name</span>
                  <input maxLength={160} name="figmaName" required />
                </label>
                <label>
                  <span>Figma URL</span>
                  <input
                    name="figmaUrl"
                    placeholder="https://www.figma.com/..."
                    required
                    type="url"
                  />
                </label>
                <div className={styles.formActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={isSavingFigmaLink}
                    type="submit"
                  >
                    {isSavingFigmaLink ? "Adding…" : "Add Figma link"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
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
      {showProjectTeam ? (
        <ProjectTeamModal
          canManage={canUpdateProject}
          members={members}
          onClose={() => setShowProjectTeam(false)}
          projectId={projectId}
          workspaceId={workspaceId}
        />
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
                  (() => {
                    const next = event.target.value === "hide";
                    setHideDoneTasks(next);
                    saveViewPreferences({ hideDoneTasks: next });
                  })()
                }
                value={hideDoneTasks ? "hide" : "show"}
              >
                <option value="show">Show all work items</option>
                <option value="hide">Hide completed work items</option>
              </select>
            </label>
            <label className={styles.viewSettingsSelect}>
              <span>Recent activity</span>
              <p>Choose how many of the latest project changes to show.</p>
              <select
                className="form-select"
                onChange={(event) => {
                  if (event.target.value !== "custom") {
                    updateActivityLimit(Number(event.target.value));
                  }
                }}
                value={
                  [1, 3, 5].includes(activityLimit)
                    ? String(activityLimit)
                    : "custom"
                }
              >
                <option value="1">One latest action</option>
                <option value="3">Three latest actions</option>
                <option value="5">Five latest actions</option>
                <option value="custom">Custom value below</option>
              </select>
              <input
                className="form-control"
                max={maxActivityLimit}
                min={1}
                onChange={(event) =>
                  updateActivityLimit(Number(event.target.value))
                }
                type="number"
                value={activityLimit}
              />
            </label>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Column size</legend>
              <p>
                Flexible columns fill the board. Fixed columns keep their width.
              </p>
              <div className={styles.segmentedControl}>
                <button
                  aria-pressed={columnSize === "fixed"}
                  onClick={() => {
                    setColumnSize("fixed");
                    saveViewPreferences({ columnSize: "fixed" });
                  }}
                  type="button"
                >
                  Fixed
                </button>
                <button
                  aria-pressed={columnSize === "flexible"}
                  onClick={() => {
                    setColumnSize("flexible");
                    saveViewPreferences({ columnSize: "flexible" });
                  }}
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
              <div
                className={`${styles.segmentedControl} ${styles.cardAccentControl}`}
              >
                <button
                  aria-pressed={boardScrolling === "column"}
                  onClick={() => {
                    setBoardScrolling("column");
                    saveViewPreferences({ boardScrolling: "column" });
                  }}
                  type="button"
                >
                  Within columns
                </button>
                <button
                  aria-pressed={boardScrolling === "board"}
                  onClick={() => {
                    setBoardScrolling("board");
                    saveViewPreferences({ boardScrolling: "board" });
                  }}
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
      {showTaskCardSettings ? (
        <Modal
          isOpen={showTaskCardSettings}
          onClose={() => setShowTaskCardSettings(false)}
          title="Card appearance"
        >
          <section className={styles.viewSettingsSection}>
            <p className={styles.settingsDescription}>
              These preferences only change how cards look on your board.
            </p>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Card color</legend>
              <p>Use a subtle surface color without changing task data.</p>
              <div className={styles.cardAppearanceOptions}>
                {(
                  [
                    ["neutral", "Neutral"],
                    ["blue", "Blue"],
                    ["violet", "Violet"],
                    ["sand", "Sand"],
                  ] as const
                ).map(([color, label]) => (
                  <button
                    aria-pressed={taskCardColor === color}
                    className={styles.cardAppearanceOption}
                    key={color}
                    onClick={() => {
                      setTaskCardColor(color);
                      saveViewPreferences({ taskCardColor: color });
                    }}
                    type="button"
                  >
                    <span data-color={color} />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.viewSettingsFieldset}>
              <legend>Card accent</legend>
              <p>Highlight the left edge using a task property.</p>
              <div className={styles.segmentedControl}>
                {(
                  [
                    ["none", "None"],
                    ["status", "Status"],
                    ["priority", "Priority"],
                  ] as const
                ).map(([accent, label]) => (
                  <button
                    aria-pressed={taskCardAccent === accent}
                    key={accent}
                    onClick={() => {
                      setTaskCardAccent(accent);
                      saveViewPreferences({ taskCardAccent: accent });
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
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
        {sprintsEnabled ? (
          <label className={styles.compactSprintPicker}>
            <span className={styles.srOnly}>View sprint tasks</span>
            <CalendarDays aria-hidden="true" size={16} strokeWidth={1.8} />
            <select
              disabled={isRefreshing}
              onChange={(event) => void onSelectSprint(event.target.value)}
              title={
                activeSprint
                  ? `${activeSprint.name} · ${formatSprintPeriod(activeSprint.startDate, activeSprint.endDate)}`
                  : "Choose a sprint"
              }
              value={selectedSprintId}
            >
              {activeSprint ? (
                <option value={activeSprint.id}>{activeSprint.name}</option>
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
        ) : null}
        {sprintsEnabled && activeSprint ? (
          <>
            <button
              aria-label="Active sprint settings"
              className={styles.iconButton}
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
              title="Manage active sprint"
              type="button"
            >
              <Settings aria-hidden="true" size={17} strokeWidth={1.8} />
            </button>
            <button
              aria-label="Complete active sprint"
              className={styles.iconButton}
              disabled={!canUpdateProject}
              onClick={() => {
                if (selectedSprintId !== activeSprint.id) {
                  void onSelectSprint(activeSprint.id).then(() =>
                    setShowCompleteSprint(true),
                  );
                  return;
                }
                setShowCompleteSprint(true);
              }}
              title="Complete active sprint"
              type="button"
            >
              <CircleCheck aria-hidden="true" size={17} strokeWidth={1.8} />
            </button>
          </>
        ) : null}
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
        <div className={styles.quickFilters} aria-label="Quick filters">
          <button
            aria-pressed={Boolean(
              currentUserId && assigneeUserId === currentUserId,
            )}
            className="btn btn-outline-secondary btn-sm"
            disabled={isRefreshing || !currentUserId}
            onClick={() => void onQuickFilter("mine")}
            type="button"
          >
            My tasks
          </button>
          <button
            aria-pressed={due === "overdue"}
            className="btn btn-outline-secondary btn-sm"
            disabled={isRefreshing}
            onClick={() => void onQuickFilter("overdue")}
            type="button"
          >
            Overdue
          </button>
          <button
            aria-pressed={due === "today"}
            className="btn btn-outline-secondary btn-sm"
            disabled={isRefreshing}
            onClick={() => void onQuickFilter("today")}
            type="button"
          >
            Today
          </button>
        </div>
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
                <option value="position">Manual board order</option>
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

      {isMultiSelectMode ? (
        <section
          className={styles.bulkTaskActions}
          aria-label="Bulk task actions"
        >
          <strong>{selectedTaskIds.length} selected</strong>
          <label>
            <span className={styles.srOnly}>Change status</span>
            <select
              className="form-select form-select-sm"
              defaultValue=""
              disabled={isBulkUpdating || selectedTaskIds.length === 0}
              onChange={(event) => {
                if (event.target.value)
                  void onBulkUpdate({ statusId: event.target.value });
                event.currentTarget.value = "";
              }}
            >
              <option value="">Move to…</option>
              {project.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={styles.srOnly}>Change priority</span>
            <select
              className="form-select form-select-sm"
              defaultValue=""
              disabled={isBulkUpdating || selectedTaskIds.length === 0}
              onChange={(event) => {
                if (event.target.value)
                  void onBulkUpdate({
                    priority: event.target.value as TaskPriority,
                  });
                event.currentTarget.value = "";
              }}
            >
              <option value="">Priority…</option>
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={styles.srOnly}>Change assignee</span>
            <select
              className="form-select form-select-sm"
              defaultValue=""
              disabled={isBulkUpdating || selectedTaskIds.length === 0}
              onChange={(event) => {
                if (event.target.value)
                  void onBulkUpdate({
                    assigneeUserId:
                      event.target.value === "none" ? null : event.target.value,
                  });
                event.currentTarget.value = "";
              }}
            >
              <option value="">Assign to…</option>
              <option value="none">Unassigned</option>
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-outline-danger btn-sm"
            disabled={
              isBulkUpdating || selectedTaskIds.length === 0 || !canDeleteTasks
            }
            onClick={() => void onBulkDelete()}
            type="button"
          >
            Delete selected
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={isBulkUpdating}
            onClick={exitMultiSelectMode}
            type="button"
          >
            <X aria-hidden="true" size={16} />
            Exit selection
          </button>
        </section>
      ) : null}

      {taskContextMenu ? (
        <div
          className={styles.taskContextMenu}
          role="menu"
          style={{ left: taskContextMenu.x, top: taskContextMenu.y }}
        >
          <button
            onClick={() => {
              setSelectedTask(taskContextMenu.task);
              setTaskContextMenu(undefined);
            }}
            role="menuitem"
            type="button"
          >
            Open task
          </button>
          <button
            onClick={() => void copyTaskCardLink(taskContextMenu.task)}
            role="menuitem"
            type="button"
          >
            <Copy aria-hidden="true" size={15} />
            Copy link
          </button>
          {canUpdateTasks ? (
            <div className={styles.taskContextMoveGroup}>
              <span>Move to</span>
              {project.statuses.map((status) => (
                <button
                  key={status.id}
                  onClick={() => {
                    void onUpdateTask(taskContextMenu.task, {
                      statusId: status.id,
                    });
                    setTaskContextMenu(undefined);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {status.name}
                </button>
              ))}
            </div>
          ) : null}
          <button
            onClick={() => {
              setShowTaskCardSettings(true);
              setTaskContextMenu(undefined);
            }}
            role="menuitem"
            type="button"
          >
            <Settings aria-hidden="true" size={15} />
            Card appearance
          </button>
          {canUpdateTasks ? (
            <button
              onClick={() => enterMultiSelectMode(taskContextMenu.task.id)}
              role="menuitem"
              type="button"
            >
              Select multiple
            </button>
          ) : null}
          {canDeleteTasks && !showArchived ? (
            <button
              className={styles.taskCardArchiveAction}
              onClick={() => void onArchiveTask(taskContextMenu.task)}
              role="menuitem"
              type="button"
            >
              Archive task
            </button>
          ) : null}
        </div>
      ) : null}

      {view === "board" ? (
        <section
          aria-label="Tasks"
          className={styles.taskBoard}
          data-card-accent={taskCardAccent}
          data-card-color={taskCardColor}
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
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  )
                    return;
                  setDropStatusId(undefined);
                }}
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
                      className={`${styles.taskCard} ${selectedTaskIds.includes(task.id) ? styles.taskCardSelected : ""} ${draggedTaskId === task.id ? styles.taskCardDragging : ""} card shadow-sm`}
                      data-priority={task.priority}
                      draggable={canUpdateTasks}
                      onClick={() => onTaskCardClick(task)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        const maxLeft = window.innerWidth - 210;
                        const maxTop = window.innerHeight - 260;
                        setTaskContextMenu({
                          task,
                          x: Math.max(8, Math.min(event.clientX, maxLeft)),
                          y: Math.max(8, Math.min(event.clientY, maxTop)),
                        });
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(undefined);
                        setDropStatusId(undefined);
                        suppressTaskClickAfterDragRef.current = true;
                        window.setTimeout(() => {
                          suppressTaskClickAfterDragRef.current = false;
                        }, 0);
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                        setDraggedTaskId(task.id);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void onDropTask(event, status.id, task.id);
                      }}
                      key={task.id}
                      style={
                        { "--task-status-color": status.color } as CSSProperties
                      }
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
                          aria-label={`Open ${task.key}: ${task.title}`}
                          className={styles.taskTitleButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onTaskCardClick(task);
                          }}
                          type="button"
                        >
                          {task.title}
                        </button>
                      </h3>
                      {(visibleTaskFields.includes("dueDate") &&
                        task.dueDate) ||
                      (visibleTaskFields.includes("assignee") &&
                        task.assignee) ? (
                        <div className={styles.taskCardFooter}>
                          {visibleTaskFields.includes("dueDate") &&
                          task.dueDate ? (
                            <p
                              className={`${styles.taskDueDate} ${isTaskOverdue(task.dueDate) ? styles.taskDueDateOverdue : ""}`}
                            >
                              <CalendarDays aria-hidden="true" size={14} />
                              {task.dueDate}
                            </p>
                          ) : null}
                          {visibleTaskFields.includes("assignee") &&
                          task.assignee ? (
                            <p
                              aria-label={`Assignee: ${task.assignee.displayName}`}
                              className={styles.taskAssignee}
                              title={task.assignee.displayName}
                            >
                              <span>
                                {task.assignee.displayName
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {task.metrics.attachmentCount ||
                      task.metrics.commentCount ||
                      task.metrics.checklistTotalCount ? (
                        <div
                          aria-label="Task content summary"
                          className={styles.taskCardMetrics}
                        >
                          {task.metrics.checklistTotalCount ? (
                            <span title="Checklist progress">
                              <ListChecks aria-hidden="true" size={14} />
                              {task.metrics.checklistCompletedCount}/
                              {task.metrics.checklistTotalCount}
                            </span>
                          ) : null}
                          {task.metrics.commentCount ? (
                            <span title="Comments">
                              <MessageSquare aria-hidden="true" size={14} />
                              {task.metrics.commentCount}
                            </span>
                          ) : null}
                          {task.metrics.attachmentCount ? (
                            <span title="Attachments">
                              <Paperclip aria-hidden="true" size={14} />
                              {task.metrics.attachmentCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {showArchived && canDeleteTasks ? (
                        <button
                          className={styles.archivedTaskRestore}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onRestoreTask(task);
                          }}
                          type="button"
                        >
                          Restore task
                        </button>
                      ) : null}
                    </article>
                  ))}
                  {statusTasks.length === 0 &&
                  (!hideDoneTasks || status.category !== "done") ? (
                    <p className={styles.taskColumnEmpty}>No tasks</p>
                  ) : null}
                  {showTaskForm && draftStatusId === status.id ? (
                    <QuickTaskForm
                      enabledTaskTypes={enabledTaskTypes}
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

      <section
        aria-labelledby="project-activity-title"
        aria-live="polite"
        className={`${styles.projectActivity} alert alert-light mb-0`}
      >
        <div className={`${styles.projectActivityHeading} d-flex`}>
          <h2 id="project-activity-title">Recent activity</h2>
        </div>
        {recentActivity.length ? (
          <ol className={styles.projectActivityList}>
            {recentActivity.slice(0, activityLimit).map((event) => (
              <li key={event.id}>
                <div>
                  <p>
                    {describeProjectActivity(event)}
                    {event.taskKey ? (
                      <button
                        className={styles.projectActivityTask}
                        onClick={() =>
                          router.push(
                            `/workspaces/${workspaceId}/projects/${projectId}?taskId=${event.taskId}`,
                          )
                        }
                        type="button"
                      >
                        {event.taskKey}
                        {event.taskTitle ? ` · ${event.taskTitle}` : ""}
                      </button>
                    ) : null}
                  </p>
                  <time dateTime={event.createdAt}>
                    {formatRelativeTime(event.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.projectActivityEmpty}>
            The latest project changes will appear here.
          </p>
        )}
      </section>

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

function normalizeActivityLimit(value: number) {
  if (!Number.isFinite(value)) return defaultActivityLimit;
  return Math.max(1, Math.min(maxActivityLimit, Math.trunc(value)));
}

function isTaskOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().slice(0, 10);
}

function describeProjectActivity(event: TaskActivityEvent) {
  const actor = event.actor?.displayName ?? "A former member";
  const details: Record<TaskActivityEvent["eventType"], string> = {
    task_created: "created ",
    task_updated: describeProjectTaskUpdate(event),
    task_deleted: "deleted ",
    task_restored: "restored ",
    task_comment_created: "commented on ",
    task_comment_updated: "updated a comment on ",
    task_comment_deleted: "deleted a comment on ",
    task_attachment_added: `uploaded ${activityText(event, "filename", "a file")} to `,
    task_attachment_removed: `removed ${activityText(event, "filename", "a file")} from `,
    task_relation_added: `linked ${activityText(event, "targetTaskKey", "a task")} to `,
    task_relation_removed: "removed a task link from ",
    task_checklist_item_added: "added a checklist item to ",
    task_checklist_item_updated: describeProjectChecklistUpdate(event),
    task_checklist_item_removed: "removed a checklist item from ",
    task_time_logged: "logged time on ",
    task_timer_started: "started a timer on ",
    task_timer_stopped: "stopped a timer on ",
  };

  return `${actor} ${details[event.eventType]}`;
}

function describeProjectTaskUpdate(event: TaskActivityEvent) {
  const statusName = activityText(event, "statusName", "");
  if (statusName) return `moved to ${statusName}: `;

  const fields = event.data.fields;
  if (!Array.isArray(fields)) return "updated ";
  const fieldLabels: Record<string, string> = {
    assigneeUserId: "assignee",
    description: "description",
    dueDate: "due date",
    parentTaskId: "parent task",
    priority: "priority",
    sprintId: "sprint",
    statusId: "status",
    title: "title",
    type: "work type",
  };
  const labels = fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => fieldLabels[field] ?? field)
    .slice(0, 3);

  return labels.length ? `updated ${labels.join(", ")} on ` : "updated ";
}

function describeProjectChecklistUpdate(event: TaskActivityEvent) {
  if (typeof event.data.isCompleted === "boolean") {
    return `${event.data.isCompleted ? "completed" : "reopened"} a checklist item on `;
  }
  return "updated a checklist item on ";
}

function activityText(event: TaskActivityEvent, key: string, fallback: string) {
  const value = event.data[key];
  return typeof value === "string" && value ? value : fallback;
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1_000),
  );
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.round(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function TaskEditorModal({
  availableParentTasks,
  attachmentsEnabled,
  enabledTaskTypes,
  figmaLinks,
  isSaving,
  members,
  onClose,
  onDescriptionMediaSave,
  onSubtaskCreated,
  onSubmit,
  project,
  role,
  sprints,
  task,
  workspaceId,
}: {
  availableParentTasks: Task[];
  attachmentsEnabled: boolean;
  enabledTaskTypes: TaskType[];
  figmaLinks: ProjectFigmaLink[];
  isSaving: boolean;
  members: WorkspaceMember[];
  onClose: () => void;
  onDescriptionMediaSave: (description: string) => Promise<void>;
  onSubtaskCreated: (task: Task) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  project: Project;
  role: WorkspaceRole | undefined;
  sprints: ProjectSprint[];
  task: Task;
  workspaceId: string;
}) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [taskFigmaLinks, setTaskFigmaLinks] = useState<TaskFigmaLink[]>([]);
  const [isLoadingTaskFigmaLinks, setIsLoadingTaskFigmaLinks] = useState(true);
  const [isSavingTaskFigmaLink, setIsSavingTaskFigmaLink] = useState(false);
  const [taskFigmaLinkError, setTaskFigmaLinkError] = useState<string>();
  const [taskFigmaPreviews, setTaskFigmaPreviews] = useState<
    Record<string, FigmaFilePreview | undefined>
  >({});
  const [isLoadingTaskFigmaPreviewId, setIsLoadingTaskFigmaPreviewId] =
    useState<string>();
  const [selectedProjectFigmaLinkId, setSelectedProjectFigmaLinkId] =
    useState("");
  const [expandedSidebarSections, setExpandedSidebarSections] = useState<
    Set<TaskSidebarSectionId>
  >(() => new Set(["details"]));
  const statusInputRef = useRef<HTMLInputElement>(null);
  const reviewStatus = project.statuses.find((status) =>
    /review|рев[ью]/i.test(status.name),
  );
  const attachableProjectFigmaLinks = figmaLinks.filter(
    (projectLink) =>
      !taskFigmaLinks.some((taskLink) => taskLink.url === projectLink.url),
  );

  function toggleSidebarSection(section: TaskSidebarSectionId) {
    setExpandedSidebarSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    setIsLoadingTaskFigmaLinks(true);
    setTaskFigmaLinkError(undefined);

    void getTaskFigmaLinks(workspaceId, project.id, task.id)
      .then((response) => {
        if (active) setTaskFigmaLinks(response.links);
      })
      .catch((caughtError) => {
        if (active) {
          setTaskFigmaLinkError(
            caughtError instanceof ApiClientError
              ? caughtError.message
              : "Unable to load task design links.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingTaskFigmaLinks(false);
      });

    return () => {
      active = false;
    };
  }, [project.id, task.id, workspaceId]);

  async function createTaskDesignLink(input: { name: string; url: string }) {
    const { name, url } = input;
    if (!name || !url) return;

    setIsSavingTaskFigmaLink(true);
    setTaskFigmaLinkError(undefined);
    try {
      const response = await createTaskFigmaLink(
        workspaceId,
        project.id,
        task.id,
        {
          name,
          url,
        },
      );
      setTaskFigmaLinks((current) => [response.link, ...current]);
      return true;
    } catch (caughtError) {
      setTaskFigmaLinkError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to add the task design link.",
      );
    } finally {
      setIsSavingTaskFigmaLink(false);
    }
  }

  async function addTaskFigmaLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const didCreate = await createTaskDesignLink({
      name: String(data.get("taskFigmaName") ?? "").trim(),
      url: String(data.get("taskFigmaUrl") ?? "").trim(),
    });
    if (didCreate) form.reset();
  }

  async function attachProjectFigmaLink() {
    const projectLink = figmaLinks.find(
      (link) => link.id === selectedProjectFigmaLinkId,
    );
    if (!projectLink) return;
    const didCreate = await createTaskDesignLink(projectLink);
    if (didCreate) setSelectedProjectFigmaLinkId("");
  }

  async function removeTaskFigmaLink(linkId: string) {
    setTaskFigmaLinkError(undefined);
    try {
      await deleteTaskFigmaLink(workspaceId, project.id, task.id, linkId);
      setTaskFigmaLinks((current) =>
        current.filter((link) => link.id !== linkId),
      );
    } catch (caughtError) {
      setTaskFigmaLinkError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to remove the task design link.",
      );
    }
  }

  async function loadTaskFigmaPreview(link: TaskFigmaLink) {
    setIsLoadingTaskFigmaPreviewId(link.id);
    setTaskFigmaLinkError(undefined);
    try {
      const response = await getFigmaFilePreview(link.url);
      setTaskFigmaPreviews((current) => ({
        ...current,
        [link.id]: response.preview,
      }));
    } catch (caughtError) {
      setTaskFigmaLinkError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to load the Figma preview.",
      );
    } finally {
      setIsLoadingTaskFigmaPreviewId(undefined);
    }
  }

  async function copyTaskLink() {
    const taskUrl = new URL(
      `/workspaces/${workspaceId}/projects/${project.id}/tasks/${task.id}`,
      window.location.origin,
    ).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(taskUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = taskUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.append(textArea);
        textArea.select();
        const wasCopied = document.execCommand("copy");
        textArea.remove();
        if (!wasCopied) throw new Error("Clipboard is unavailable");
      }
      setIsLinkCopied(true);
      window.setTimeout(() => setIsLinkCopied(false), 2_000);
    } catch {
      setIsLinkCopied(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${task.key} details`}
      width="extraWide"
    >
      <div className={styles.taskEditorWorkspace}>
        <form
          className={styles.taskEditorForm}
          id={`task-editor-${task.id}`}
          onSubmit={(event) => void onSubmit(event)}
        >
          <header className={styles.taskEditorHeader}>
            <div className={styles.taskEditorIdentity}>
              <span>{task.key}</span>
              <span>{task.type}</span>
              <span data-priority={task.priority}>
                {task.priority} priority
              </span>
            </div>
            <div className={styles.taskEditorHeaderActions}>
              <button
                className={styles.textButton}
                onClick={() => void copyTaskLink()}
                type="button"
              >
                <Copy aria-hidden="true" size={16} />
                {isLinkCopied ? "Link copied" : "Copy link"}
              </button>
            </div>
            <label className={styles.taskEditorTitleField}>
              <span className={styles.srOnly}>Title</span>
              <input
                autoFocus
                defaultValue={task.title}
                maxLength={200}
                minLength={2}
                name="title"
                required
              />
            </label>
          </header>
          <aside className={styles.taskEditorDetails}>
            <input
              defaultValue={task.statusId}
              name="statusId"
              ref={statusInputRef}
              type="hidden"
            />
            <button
              className={styles.taskReviewButton}
              disabled={
                isSaving || !reviewStatus || task.statusId === reviewStatus.id
              }
              onClick={() => {
                if (reviewStatus && statusInputRef.current) {
                  statusInputRef.current.value = reviewStatus.id;
                }
              }}
              title={
                reviewStatus
                  ? undefined
                  : "Add an In review status to this project first"
              }
              type="submit"
            >
              <CircleCheck aria-hidden="true" size={17} />
              {task.statusId === reviewStatus?.id
                ? "In review"
                : reviewStatus
                  ? "Send to review"
                  : "Review status unavailable"}
            </button>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("details")}
              onToggle={() => toggleSidebarSection("details")}
              summary={`${task.assignee?.displayName ?? "Unassigned"} · ${task.dueDate ?? "No due date"}`}
              title="Details"
            >
              <label>
                <span>Type</span>
                <select defaultValue={task.type} name="type">
                  {enabledTaskTypes.map((type) => (
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
                <span>Parent task</span>
                <select
                  defaultValue={task.parentTaskId ?? ""}
                  name="parentTaskId"
                >
                  <option value="">No parent task</option>
                  {availableParentTasks
                    .filter(
                      (candidate) =>
                        candidate.id !== task.id && !candidate.parentTaskId,
                    )
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.key}: {candidate.title}
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
              <label>
                <span>Estimate (minutes)</span>
                <input
                  defaultValue={task.estimateMinutes ?? ""}
                  min={0}
                  name="estimateMinutes"
                  placeholder="For example, 240"
                  type="number"
                />
              </label>
              <dl className={styles.taskEditorFacts}>
                <div>
                  <dt>Project</dt>
                  <dd>{project.name}</dd>
                </div>
                <div>
                  <dt>Reporter</dt>
                  <dd>{task.reporter?.displayName ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(task.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </TaskSidebarSection>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("relations")}
              onToggle={() => toggleSidebarSection("relations")}
              summary="Dependencies and linked tasks"
              title="Linked work items"
            >
              <TaskRelationsPanel
                role={role}
                task={task}
                workspaceId={workspaceId}
              />
            </TaskSidebarSection>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("time")}
              onToggle={() => toggleSidebarSection("time")}
              summary={
                task.estimateMinutes == null
                  ? "No estimate"
                  : `${task.estimateMinutes} min planned`
              }
              title="Time tracking"
            >
              <TaskTimeTrackingPanel
                role={role}
                task={task}
                workspaceId={workspaceId}
              />
            </TaskSidebarSection>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("watching")}
              onToggle={() => toggleSidebarSection("watching")}
              summary="Task notifications"
              title="Watching"
            >
              <TaskWatchersPanel
                role={role}
                task={task}
                workspaceId={workspaceId}
              />
            </TaskSidebarSection>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("development")}
              onToggle={() => toggleSidebarSection("development")}
              summary="Figma and coding tools"
              title="Development"
            >
              <div className={styles.taskDevelopmentHeading}>
                <span>Task design links</span>
                <span>{taskFigmaLinks.length}</span>
              </div>
              {isLoadingTaskFigmaLinks ? (
                <p className={styles.taskSidebarHint}>Loading task links…</p>
              ) : taskFigmaLinks.length ? (
                <ul className={styles.taskFigmaLinkList}>
                  {taskFigmaLinks.map((link) => (
                    <li key={link.id}>
                      <div className={styles.taskFigmaLinkRow}>
                        <a href={link.url} rel="noreferrer" target="_blank">
                          <span>{link.name}</span>
                          <ExternalLink aria-hidden="true" size={14} />
                        </a>
                        <button
                          className={styles.taskFigmaPreviewButton}
                          disabled={isLoadingTaskFigmaPreviewId === link.id}
                          onClick={() => void loadTaskFigmaPreview(link)}
                          type="button"
                        >
                          {isLoadingTaskFigmaPreviewId === link.id
                            ? "Loading…"
                            : taskFigmaPreviews[link.id]
                              ? "Refresh preview"
                              : "Preview design"}
                        </button>
                        {role && can(role, "task:update") ? (
                          <button
                            aria-label={`Remove ${link.name}`}
                            className={styles.taskFigmaLinkDelete}
                            onClick={() => void removeTaskFigmaLink(link.id)}
                            type="button"
                          >
                            <X aria-hidden="true" size={14} />
                          </button>
                        ) : null}
                      </div>
                      {taskFigmaPreviews[link.id] ? (
                        <FigmaFilePreviewCard
                          preview={taskFigmaPreviews[link.id]!}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.taskSidebarHint}>
                  No Figma link is attached to this task yet.
                </p>
              )}
              {role && can(role, "task:update") ? (
                <>
                  {attachableProjectFigmaLinks.length ? (
                    <div className={styles.taskFigmaProjectAttach}>
                      <label htmlFor={`project-figma-link-${task.id}`}>
                        Attach an existing project file
                      </label>
                      <div>
                        <select
                          id={`project-figma-link-${task.id}`}
                          onChange={(event) =>
                            setSelectedProjectFigmaLinkId(event.target.value)
                          }
                          value={selectedProjectFigmaLinkId}
                        >
                          <option value="">Choose a project Figma file</option>
                          {attachableProjectFigmaLinks.map((link) => (
                            <option key={link.id} value={link.id}>
                              {link.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className={styles.secondaryButton}
                          disabled={
                            !selectedProjectFigmaLinkId || isSavingTaskFigmaLink
                          }
                          onClick={() => void attachProjectFigmaLink()}
                          type="button"
                        >
                          <Plus aria-hidden="true" size={15} />
                          Attach
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <form
                    className={styles.taskFigmaLinkForm}
                    onSubmit={(event) => void addTaskFigmaLink(event)}
                  >
                    <input
                      aria-label="Figma link name"
                      maxLength={160}
                      name="taskFigmaName"
                      placeholder="Design screen name"
                      required
                    />
                    <input
                      aria-label="Figma URL"
                      name="taskFigmaUrl"
                      placeholder="https://figma.com/..."
                      required
                      type="url"
                    />
                    <button
                      className={styles.secondaryButton}
                      disabled={isSavingTaskFigmaLink}
                      type="submit"
                    >
                      <Plus aria-hidden="true" size={15} />
                      {isSavingTaskFigmaLink ? "Adding…" : "Add new Figma link"}
                    </button>
                  </form>
                </>
              ) : null}
              {taskFigmaLinkError ? (
                <p className={styles.formError} role="alert">
                  {taskFigmaLinkError}
                </p>
              ) : null}
              {figmaLinks.length ? (
                <>
                  <div className={styles.taskDevelopmentHeading}>
                    <span>Project design links</span>
                    <span>{figmaLinks.length}</span>
                  </div>
                  <ul className={styles.taskFigmaLinkList}>
                    {figmaLinks.map((link) => (
                      <li key={link.id}>
                        <a href={link.url} rel="noreferrer" target="_blank">
                          <span>{link.name}</span>
                          <ExternalLink aria-hidden="true" size={14} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <Link className={styles.taskSidebarLink} href="/profile">
                Open integrations
              </Link>
            </TaskSidebarSection>
            <TaskSidebarSection
              isOpen={expandedSidebarSections.has("automation")}
              onToggle={() => toggleSidebarSection("automation")}
              summary="No rules configured"
              title="Automation"
            >
              <p className={styles.taskSidebarHint}>
                Automation rules will appear here when this project supports
                configured triggers.
              </p>
            </TaskSidebarSection>
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
        <div className={styles.taskEditorWork}>
          <TaskWorkPanel
            availableRelatedTasks={availableParentTasks}
            attachmentsEnabled={attachmentsEnabled}
            description={task.description}
            editorFormId={`task-editor-${task.id}`}
            onDescriptionMediaSave={onDescriptionMediaSave}
            onSubtaskCreated={onSubtaskCreated}
            role={role}
            task={task}
            workspaceId={workspaceId}
          />
        </div>
      </div>
    </Modal>
  );
}

function FigmaFilePreviewCard({ preview }: { preview: FigmaFilePreview }) {
  return (
    <div className={styles.taskFigmaPreviewCard}>
      {preview.thumbnailUrl ? (
        <div
          aria-hidden="true"
          className={styles.taskFigmaPreviewImage}
          style={{
            backgroundImage: `url(${JSON.stringify(preview.thumbnailUrl)})`,
          }}
        />
      ) : (
        <div aria-hidden="true" className={styles.taskFigmaPreviewPlaceholder}>
          Figma
        </div>
      )}
      <div>
        <strong>{preview.name}</strong>
        <span>
          {preview.editorType ?? "Figma file"} · updated{" "}
          {new Date(preview.lastModified).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function TaskSidebarSection({
  children,
  isOpen,
  onToggle,
  summary,
  title,
}: {
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  summary: string;
  title: string;
}) {
  return (
    <section className={styles.taskSidebarSection}>
      <button
        aria-expanded={isOpen}
        className={styles.taskSidebarSectionToggle}
        onClick={onToggle}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className={isOpen ? styles.taskSidebarChevronOpen : undefined}
          size={17}
          strokeWidth={1.8}
        />
        <span>{title}</span>
        {!isOpen ? <small>{summary}</small> : null}
      </button>
      {isOpen ? (
        <div className={styles.taskSidebarSectionContent}>{children}</div>
      ) : null}
    </section>
  );
}

function QuickTaskForm({
  enabledTaskTypes,
  isCreating,
  members,
  onCancel,
  onSubmit,
  statusId,
}: {
  enabledTaskTypes: TaskType[];
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
        className="form-control"
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
          <select className="form-select" defaultValue="task" name="type">
            {enabledTaskTypes.map((type) => (
              <option key={type} value={type}>
                {type[0]!.toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label title="Priority">
          <span className={styles.srOnly}>Priority</span>
          <select className="form-select" defaultValue="medium" name="priority">
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
          <input
            aria-label="Due date"
            className="form-control"
            name="dueDate"
            type="date"
          />
        </label>
        <label className={styles.quickTaskIconField} title="Assignee">
          <UserRound aria-hidden="true" size={16} />
          <span className={styles.srOnly}>Assignee</span>
          <select
            aria-label="Assignee"
            className="form-select"
            defaultValue=""
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
        <button
          aria-label="Create task"
          className={`${styles.iconButton} btn btn-outline-primary`}
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
