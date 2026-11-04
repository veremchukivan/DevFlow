import {
  sendAgreementOverdueNotifications,
  sendDeadlineNotifications,
} from "./notifications.service.js";
import { findDeadlineNotificationCandidates } from "./notifications.repository.js";
import { runWorkspaceAutomation } from "../workspace-automation/workspace-automation.engine.js";

const deadlineSweepIntervalMs = 60 * 60 * 1_000;

export function scheduleDeadlineNotifications() {
  const run = () => {
    void sendDeadlineNotifications().catch((error: unknown) => {
      console.error("Failed to send deadline notifications", error);
    });
    void sendAgreementOverdueNotifications().catch((error: unknown) => {
      console.error("Failed to send agreement overdue notifications", error);
    });
    void runDueDateAutomations().catch((error: unknown) => {
      console.error("Failed to run due-date automations", error);
    });
  };

  run();
  const intervalId = setInterval(run, deadlineSweepIntervalMs);
  intervalId.unref();

  return () => clearInterval(intervalId);
}

async function runDueDateAutomations(
  today = new Date().toISOString().slice(0, 10),
) {
  const candidates = await findDeadlineNotificationCandidates();
  for (const task of candidates) {
    if (!task.assigneeUserId || !task.dueDate || task.dueDate > today) continue;
    await runWorkspaceAutomation({
      actorUserId: task.assigneeUserId,
      dedupeKey: `task-due:${task.taskId}:${task.dueDate}`,
      projectId: task.projectId,
      taskId: task.taskId,
      triggerType: "task_due",
      workspaceId: task.workspaceId,
    });
  }
}
