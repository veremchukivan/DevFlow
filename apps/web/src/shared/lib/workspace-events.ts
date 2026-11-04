const workspaceChangedEvent = "devflow:workspaces-changed";
const projectsChangedEvent = "devflow:projects-changed";

export function notifyWorkspacesChanged() {
  window.dispatchEvent(new Event(workspaceChangedEvent));
}

export function subscribeToWorkspaceChanges(listener: () => void) {
  window.addEventListener(workspaceChangedEvent, listener);
  return () => window.removeEventListener(workspaceChangedEvent, listener);
}

export function notifyProjectsChanged(workspaceId: string) {
  window.dispatchEvent(
    new CustomEvent<string>(projectsChangedEvent, { detail: workspaceId }),
  );
}

export function subscribeToProjectChanges(
  listener: (workspaceId: string) => void,
) {
  function onProjectsChanged(event: Event) {
    const workspaceId = (event as CustomEvent<string>).detail;
    if (workspaceId) listener(workspaceId);
  }

  window.addEventListener(projectsChangedEvent, onProjectsChanged);
  return () =>
    window.removeEventListener(projectsChangedEvent, onProjectsChanged);
}
