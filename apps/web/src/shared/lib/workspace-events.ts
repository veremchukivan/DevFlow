const workspaceChangedEvent = "devflow:workspaces-changed";

export function notifyWorkspacesChanged() {
  window.dispatchEvent(new Event(workspaceChangedEvent));
}

export function subscribeToWorkspaceChanges(listener: () => void) {
  window.addEventListener(workspaceChangedEvent, listener);
  return () => window.removeEventListener(workspaceChangedEvent, listener);
}
