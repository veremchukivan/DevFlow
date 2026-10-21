"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, getCurrentUser, logout } from "@/lib/api-client";
import { createWorkspace, getWorkspaces } from "@/lib/api-client";
import type { AuthUser, Workspace } from "@devflow/shared";

export function SessionHome() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string>();

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((response) => {
        if (active) {
          setUser(response.user);
        }

        return getWorkspaces();
      })
      .then((response) => {
        if (active && response) {
          setWorkspaces(response.workspaces);
        }
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiClientError &&
          error.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        if (active) {
          router.replace("/login?reason=unavailable");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  async function onCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(undefined);
    setIsCreatingWorkspace(true);

    const form = new FormData(event.currentTarget);
    const slug = String(form.get("slug") ?? "").trim();

    try {
      const response = await createWorkspace({
        name: String(form.get("name") ?? ""),
        ...(slug ? { slug } : {}),
      });
      setWorkspaces((current) => [response.workspace, ...current]);
      setShowWorkspaceForm(false);
      event.currentTarget.reset();
    } catch (error) {
      setWorkspaceError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create the workspace. Try again.",
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  if (isLoading || !user) {
    return <main className="session-loading">Loading your workspace</main>;
  }

  return (
    <main className="workspace-home">
      <header className="workspace-home-header">
        <div>
          <p className="eyebrow">DevFlow</p>
          <h1>Welcome, {user.displayName}</h1>
          <p>Choose a workspace to manage its projects and tasks.</p>
        </div>
        <button
          className="secondary-button"
          disabled={isSigningOut}
          onClick={signOut}
          type="button"
        >
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </header>
      <section className="workspace-section" aria-labelledby="workspaces-title">
        <div className="section-heading">
          <div>
            <h2 id="workspaces-title">Your workspaces</h2>
            <p>{workspaces.length} available</p>
          </div>
          <button
            className="primary-button"
            onClick={() => setShowWorkspaceForm((current) => !current)}
            type="button"
          >
            New workspace
          </button>
        </div>

        {showWorkspaceForm ? (
          <form className="workspace-form" onSubmit={onCreateWorkspace}>
            <label>
              <span>Workspace name</span>
              <input maxLength={120} minLength={2} name="name" required />
            </label>
            <label>
              <span>Workspace URL</span>
              <input maxLength={80} name="slug" placeholder="product-team" />
            </label>
            {workspaceError ? (
              <p className="form-error" role="alert">
                {workspaceError}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={isCreatingWorkspace}
                type="submit"
              >
                {isCreatingWorkspace ? "Creating" : "Create workspace"}
              </button>
              <button
                className="text-button"
                onClick={() => setShowWorkspaceForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {workspaces.length === 0 ? (
          <p className="empty-state">
            Create your first workspace to start organizing work.
          </p>
        ) : (
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <Link
                className="workspace-row"
                href={`/workspaces/${workspace.id}`}
                key={workspace.id}
              >
                <div>
                  <h3>{workspace.name}</h3>
                  <p>{workspace.slug}</p>
                </div>
                <span className="role-badge">{workspace.role}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
