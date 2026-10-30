import { notifyTaskAssigned } from "../notifications/notifications.service.js";
import {
  createWorkspaceAutomationRun,
  ensureWorkspaceAutomationRules,
  findAutomationTask,
  findProjectDoneStatus,
  isActiveWorkspaceMember,
  listAutomationChildTasks,
  listEnabledWorkspaceAutomationRules,
  updateAutomationTask,
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
