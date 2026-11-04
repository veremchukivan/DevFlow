import { notifyTaskAssigned } from "../notifications/notifications.service.js";
import { createCall } from "../workspace-calls/workspace-calls.repository.js";
import { createTaskWithNextNumber } from "../tasks/tasks.repository.js";
import {
  createWorkspaceAutomationRun,
  ensureWorkspaceAutomationRules,
  findAutomationTask,
  findAutomationProject,
  findProjectDefaultStatus,
  findProjectDoneStatus,
  isActiveWorkspaceMember,
  listAutomationChildTasks,
  listEnabledWorkspaceAutomationRules,
  listEnabledWorkspaceAutomationRulesForTrigger,
  updateAutomationTask,
  updateWorkspaceAutomationRule,
} from "./workspace-automation.repository.js";

type AutomationTask = NonNullable<
  Awaited<ReturnType<typeof findAutomationTask>>
>;

export async function runWorkspaceAutomationForTaskTransition(input: {
  actorUserId: string;
  projectId: string;
  taskId: string;
  workspaceId: string;
}) {
  await ensureWorkspaceAutomationRules({
    createdByUserId: input.actorUserId,
    workspaceId: input.workspaceId,
  });

  const task = await findAutomationTask(input);
  if (!task) return;
  const rules = await listEnabledWorkspaceAutomationRules(input.workspaceId);

  for (const rule of rules) {
    try {
      switch (rule.ruleType) {
        case "children_completed_close_parent":
          await closeParentWhenChildrenComplete({ ...input, rule, task });
          break;
        case "task_transition_assign":
          await assignOnTaskTransition({ ...input, rule, task });
          break;
        case "parent_completed_close_children":
          await closeChildrenWhenParentComplete({ ...input, rule, task });
          break;
      }
    } catch (error) {
      await createWorkspaceAutomationRun({
        actorUserId: input.actorUserId,
        data: { error: error instanceof Error ? error.message : "Unknown error" },
        outcome: "failed",
        ruleId: rule.id,
        summary: "Flow could not complete its action",
        triggerTaskId: input.taskId,
        workspaceId: input.workspaceId,
      });
    }
  }

  await runWorkspaceAutomation({ ...input, triggerType: "task_status_changed" });
}

export async function runWorkspaceAutomation(input: {
  actorUserId: string;
  projectId: string;
  taskId: string;
  dedupeKey?: string;
  triggerType: "task_created" | "task_status_changed" | "task_due" | "comment_created" | "pull_request_merged";
  workspaceId: string;
}) {
  const task = await findAutomationTask(input);
  if (!task) return;
  const rules = await listEnabledWorkspaceAutomationRulesForTrigger({ triggerType: input.triggerType, workspaceId: input.workspaceId });
  for (const rule of rules.filter((candidate) => candidate.ruleType.startsWith("custom-"))) {
    const conditions = rule.conditions ?? {};
    if (!matchesConditions(task, conditions)) {
      await createWorkspaceAutomationRun({ actorUserId: input.actorUserId, data: { projectId: input.projectId }, dedupeKey: input.dedupeKey, outcome: "skipped", ruleId: rule.id, summary: "Rule conditions did not match this work item", triggerTaskId: task.id, workspaceId: input.workspaceId });
      continue;
    }
    try {
      const results: string[] = [];
      for (const action of rule.actions ?? []) results.push(await executeAction({ action, input, task }));
      await updateWorkspaceAutomationRule({ lastError: null, ruleId: rule.id, workspaceId: input.workspaceId });
      await createWorkspaceAutomationRun({ actorUserId: input.actorUserId, data: { projectId: input.projectId, results }, dedupeKey: input.dedupeKey, outcome: "succeeded", ruleId: rule.id, summary: results.join("; "), triggerTaskId: task.id, workspaceId: input.workspaceId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown automation error";
      await updateWorkspaceAutomationRule({ lastError: message.slice(0, 500), ruleId: rule.id, workspaceId: input.workspaceId });
      await createWorkspaceAutomationRun({ actorUserId: input.actorUserId, data: { error: message, projectId: input.projectId }, dedupeKey: input.dedupeKey, outcome: "failed", ruleId: rule.id, summary: "Flow could not complete its action", triggerTaskId: task.id, workspaceId: input.workspaceId });
    }
  }
}

function matchesConditions(task: AutomationTask, conditions: Record<string, unknown>) {
  return (conditions.taskType === undefined || conditions.taskType === task.type)
    && (conditions.priority === undefined || conditions.priority === task.priority)
    && (conditions.statusId === undefined || conditions.statusId === task.statusId)
    && (conditions.assigneeUserId === undefined || conditions.assigneeUserId === task.assigneeUserId);
}

async function executeAction(input: { action: Record<string, unknown>; input: { actorUserId: string; projectId: string; taskId: string; workspaceId: string }; task: AutomationTask }) {
  const type = input.action.type;
  if (type === "assign" && typeof input.action.userId === "string") {
    if (!(await isActiveWorkspaceMember({ userId: input.action.userId, workspaceId: input.input.workspaceId }))) throw new Error("Selected assignee is not an active workspace member");
    await updateAutomationTask({ assigneeUserId: input.action.userId, taskId: input.task.id, workspaceId: input.input.workspaceId });
    await notifyTaskAssigned({ actorUserId: input.input.actorUserId, projectId: input.input.projectId, recipientUserId: input.action.userId, taskId: input.task.id, taskKey: input.task.title, taskTitle: input.task.title, workspaceId: input.input.workspaceId });
    return "Assigned work item";
  }
  if (type === "change_status" && typeof input.action.statusId === "string") {
    await updateAutomationTask({ statusId: input.action.statusId, taskId: input.task.id, workspaceId: input.input.workspaceId });
    return "Changed status";
  }
  if (type === "add_to_sprint" && typeof input.action.sprintId === "string") {
    await updateAutomationTask({ sprintId: input.action.sprintId, taskId: input.task.id, workspaceId: input.input.workspaceId });
    return "Added to sprint";
  }
  if (type === "create_subtask" && typeof input.action.title === "string") {
    const [project, status] = await Promise.all([findAutomationProject(input.input), findProjectDefaultStatus(input.input)]);
    if (!project || !status) throw new Error("Project needs an available status before a subtask can be created");
    await createTaskWithNextNumber({ activity: { actorUserId: input.input.actorUserId, projectKey: project.key }, parentTaskId: input.task.id, projectId: input.input.projectId, reporterUserId: input.input.actorUserId, statusId: status.id, title: input.action.title, workspaceId: input.input.workspaceId });
    return "Created subtask";
  }
  if (type === "create_call" && typeof input.action.title === "string") {
    const hours = typeof input.action.startsInHours === "number" ? input.action.startsInHours : 24;
    const startsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await createCall({ attendeeUserIds: [input.input.actorUserId, ...(input.task.assigneeUserId ? [input.task.assigneeUserId] : [])], createdByUserId: input.input.actorUserId, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000), projectId: input.input.projectId, startsAt, title: input.action.title, workspaceId: input.input.workspaceId });
    return "Scheduled call";
  }
  if (type === "notify") {
    await notifyTaskAssigned({ actorUserId: input.input.actorUserId, projectId: input.input.projectId, recipientUserId: typeof input.action.userId === "string" ? input.action.userId : input.task.assigneeUserId, taskId: input.task.id, taskKey: input.task.title, taskTitle: input.task.title, workspaceId: input.input.workspaceId });
    return "Sent notification";
  }
  throw new Error("Automation action is invalid");
}

async function closeParentWhenChildrenComplete(input: FlowInput) {
  if (!input.task.parentTaskId || input.task.statusCategory !== "done") {
    return skip(input, "Waiting for a child work item to be completed");
  }

  const children = await listAutomationChildTasks({
    parentTaskId: input.task.parentTaskId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
  });
  if (!children.length || children.some((child) => child.statusCategory !== "done")) {
    return skip(input, "Not all child work items are completed yet");
  }

  const parent = await findAutomationTask({
    projectId: input.projectId,
    taskId: input.task.parentTaskId,
    workspaceId: input.workspaceId,
  });
  if (!parent || parent.statusCategory === "done") {
    return skip(input, "Parent work item is already completed");
  }

  const doneStatus = await findProjectDoneStatus(input);
  if (!doneStatus) return skip(input, "Project has no completed status");

  await updateAutomationTask({
    statusId: doneStatus.id,
    taskId: parent.id,
    workspaceId: input.workspaceId,
  });
  await succeeded(input, `Completed parent work item “${parent.title}”`, {
    updatedTaskId: parent.id,
  });
}

async function assignOnTaskTransition(input: FlowInput) {
  const assigneeUserId = readString(input.rule.configuration.assigneeUserId);
  if (!assigneeUserId) {
    return skip(input, "Choose an assignee in this flow to enable automatic assignment");
  }
  if (
    input.rule.configuration.onlyWhenUnassigned !== false &&
    input.task.assigneeUserId
  ) {
    return skip(input, "Work item already has an assignee");
  }
  if (
    !(await isActiveWorkspaceMember({
      userId: assigneeUserId,
      workspaceId: input.workspaceId,
    }))
  ) {
    return skip(input, "Configured assignee is not an active workspace member");
  }

  await updateAutomationTask({
    assigneeUserId,
    taskId: input.task.id,
    workspaceId: input.workspaceId,
  });
  await notifyTaskAssigned({
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    recipientUserId: assigneeUserId,
    taskId: input.task.id,
    taskKey: input.task.title,
    taskTitle: input.task.title,
    workspaceId: input.workspaceId,
  });
  await succeeded(input, `Assigned “${input.task.title}” after its status changed`, {
    assigneeUserId,
  });
}

async function closeChildrenWhenParentComplete(input: FlowInput) {
  if (input.task.parentTaskId || input.task.statusCategory !== "done") {
    return skip(input, "Waiting for a parent work item to be completed");
  }

  const children = await listAutomationChildTasks({
    parentTaskId: input.task.id,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
  });
  const unfinishedChildren = children.filter(
    (child) => child.statusCategory !== "done",
  );
  if (!unfinishedChildren.length) {
    return skip(input, "Parent has no unfinished child work items");
  }

  const doneStatus = await findProjectDoneStatus(input);
  if (!doneStatus) return skip(input, "Project has no completed status");

  await Promise.all(
    unfinishedChildren.map((child) =>
      updateAutomationTask({
        statusId: doneStatus.id,
        taskId: child.id,
        workspaceId: input.workspaceId,
      }),
    ),
  );
  await succeeded(
    input,
    `Completed ${unfinishedChildren.length} child work item${unfinishedChildren.length === 1 ? "" : "s"}`,
    { updatedTaskIds: unfinishedChildren.map((child) => child.id) },
  );
}

type FlowInput = {
  actorUserId: string;
  projectId: string;
  rule: {
    configuration: Record<string, unknown>;
    id: string;
  };
  task: AutomationTask;
  taskId: string;
  workspaceId: string;
};

function skip(input: FlowInput, summary: string) {
  return createWorkspaceAutomationRun({
    actorUserId: input.actorUserId,
    outcome: "skipped",
    ruleId: input.rule.id,
    summary,
    triggerTaskId: input.taskId,
    workspaceId: input.workspaceId,
  });
}

function succeeded(
  input: FlowInput,
  summary: string,
  data: Record<string, unknown>,
) {
  return createWorkspaceAutomationRun({
    actorUserId: input.actorUserId,
    data,
    outcome: "succeeded",
    ruleId: input.rule.id,
    summary,
    triggerTaskId: input.taskId,
    workspaceId: input.workspaceId,
  });
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
