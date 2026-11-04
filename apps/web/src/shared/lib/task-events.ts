const taskActivityChangedEvent = "devflow:task-activity-changed";

export function notifyTaskActivityChanged(taskId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ taskId: string }>(taskActivityChangedEvent, {
      detail: { taskId },
    }),
  );
}

export function subscribeToTaskActivityChanges(
  taskId: string,
  onChanged: () => void,
) {
  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent) || event.detail?.taskId !== taskId)
      return;
    onChanged();
  };

  window.addEventListener(taskActivityChangedEvent, listener);
  return () => window.removeEventListener(taskActivityChangedEvent, listener);
}
