"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ApiClientError,
  createWorkspace,
  getWorkspaces,
} from "@/lib/api-client";
import { notifyWorkspacesChanged } from "@/lib/workspace-events";
import type { PageInfo, Workspace } from "@devflow/shared";

import styles from "./ui.module.css";

const workspacePageSize = 25;

export function WorkspaceHome() {
  const [isLoading, setIsLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>();
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string>();

  useEffect(() => {
    let active = true;

    void getWorkspaces({ limit: workspacePageSize })
      .then((response) => {
        if (active) {
          setWorkspaces(response.workspaces);
          setPageInfo(response.pageInfo);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setWorkspaceError(
            error instanceof ApiClientError
              ? error.message
              : "Unable to load workspaces. Try again.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadWorkspaces(offset = 0) {
    try {
      const response = await getWorkspaces({ limit: workspacePageSize, offset });
      setWorkspaces(response.workspaces);
      setPageInfo(response.pageInfo);
    } catch (error) {
      setWorkspaceError(error instanceof ApiClientError ? error.message : "Unable to load workspaces. Try again.");
    }
  }

  async function onCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(undefined);
    setIsCreatingWorkspace(true);

    const form = new FormData(event.currentTarget);
    const slug = String(form.get("slug") ?? "").trim();

    try {
      await createWorkspace({
        name: String(form.get("name") ?? ""),
        ...(slug ? { slug } : {}),
      });
      await loadWorkspaces(0);
      notifyWorkspacesChanged();
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

  if (isLoading)
    return <main className={styles.loading}>Loading workspaces</main>;

  return (
    <main className={styles.workspaceHome}>
      <header className={styles.workspaceHomeHeader}>
        <div>
          <p className={styles.eyebrow}>Workspaces</p>
          <h1>Organize work with your team</h1>
          <p>Choose a workspace to manage its projects and tasks.</p>
        </div>
      </header>
      <section
        className={styles.workspaceSection}
        aria-labelledby="workspaces-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="workspaces-title">Your workspaces</h2>
            <p>{pageInfo?.total ?? workspaces.length} available</p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => setShowWorkspaceForm((current) => !current)}
            type="button"
          >
            New workspace
          </button>
        </div>
        {showWorkspaceForm ? (
          <form className={styles.workspaceForm} onSubmit={onCreateWorkspace}>
            <label>
              <span>Workspace name</span>
              <input maxLength={120} minLength={2} name="name" required />
            </label>
            <label>
              <span>Workspace URL</span>
              <input maxLength={80} name="slug" placeholder="product-team" />
            </label>
            {workspaceError ? (
              <p className={styles.formError} role="alert">
                {workspaceError}
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isCreatingWorkspace}
                type="submit"
              >
                {isCreatingWorkspace ? "Creating" : "Create workspace"}
              </button>
              <button
                className={styles.textButton}
                onClick={() => setShowWorkspaceForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {workspaceError && !showWorkspaceForm ? (
          <p className={styles.formError} role="alert">
            {workspaceError}
          </p>
        ) : null}
        {workspaces.length === 0 ? (
          <p className={styles.emptyState}>
            Create your first workspace to start organizing work.
          </p>
        ) : (
          <div className={styles.workspaceList}>
            {workspaces.map((workspace) => (
              <Link
                className={styles.workspaceRow}
                href={`/workspaces/${workspace.id}`}
                key={workspace.id}
              >
                <div>
                  <h3>{workspace.name}</h3>
                  <p>{workspace.slug}</p>
                </div>
                <span className={styles.roleBadge}>{workspace.role}</span>
              </Link>
            ))}
          </div>
        )}
        {pageInfo ? (
          <nav aria-label="Workspace pagination" className={styles.pagination}>
            <span>{pageInfo.total === 0 ? "No workspaces" : `${pageInfo.offset + 1}-${Math.min(pageInfo.offset + workspaces.length, pageInfo.total)} of ${pageInfo.total}`}</span>
            <div>
              <button aria-label="Previous workspaces" className={styles.iconButton} disabled={pageInfo.offset === 0} onClick={() => void loadWorkspaces(Math.max(0, pageInfo.offset - pageInfo.limit))} title="Previous page" type="button"><ChevronLeft aria-hidden="true" size={16} /></button>
              <button aria-label="Next workspaces" className={styles.iconButton} disabled={!pageInfo.hasNextPage} onClick={() => void loadWorkspaces(pageInfo.offset + pageInfo.limit)} title="Next page" type="button"><ChevronRight aria-hidden="true" size={16} /></button>
            </div>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
