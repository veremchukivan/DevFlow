import type { AuthUser } from "@devflow/shared";

const userChangedEvent = "devflow:user-changed";

export function notifyUserChanged(user: AuthUser) {
  window.dispatchEvent(
    new CustomEvent<AuthUser>(userChangedEvent, { detail: user }),
  );
}

export function subscribeToUserChanges(listener: (user: AuthUser) => void) {
  const handleChange = (event: Event) =>
    listener((event as CustomEvent<AuthUser>).detail);
  window.addEventListener(userChangedEvent, handleChange);

  return () => window.removeEventListener(userChangedEvent, handleChange);
}
