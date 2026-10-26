import { sendDeadlineNotifications } from "./notifications.service.js";

const deadlineSweepIntervalMs = 60 * 60 * 1_000;

export function scheduleDeadlineNotifications() {
  const run = () => {
    void sendDeadlineNotifications().catch((error: unknown) => {
      console.error("Failed to send deadline notifications", error);
    });
  };

  run();
  const intervalId = setInterval(run, deadlineSweepIntervalMs);
  intervalId.unref();

  return () => clearInterval(intervalId);
}
