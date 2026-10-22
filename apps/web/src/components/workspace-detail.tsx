"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  createProject,
  createWorkspaceLabel,
  deleteWorkspaceLabel,
  deleteWorkspace,
  getProjects,
  getWorkspace,
  getWorkspaceLabels,
  updateWorkspace,
  updateWorkspaceLabel,
} from "@/lib/api-client";
import type { Label, ProjectSummary, Workspace } from "@devflow/shared";
import styles from "@/components/ui.module.css";

export function WorkspaceDetail() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string>();
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([
      getWorkspace(workspaceId),
      getProjects(workspaceId),
      getWorkspaceLabels(workspaceId),
    ])
      .then(([workspaceResponse, projectResponse, labelResponse]) => {
        if (!active) {
          return;
        }

        setWorkspace(workspaceResponse.workspace);
        setProjects(projectResponse.projects);
        setLabels(labelResponse.labels);
      })
      .catch((caughtError: unknown) => {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        if (active) {
          setError("Unable to load this workspace.");
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
  }, [router, workspaceId]);

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreatingProject(true);

    const form = new FormData(event.currentTarget);
    const key = String(form.get("key") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    try {
      const response = await createProject(workspaceId, {
        name: String(form.get("name") ?? ""),
        ...(key ? { key } : {}),
        ...(description ? { description } : {}),
      });
      setProjects((current) => [response.project, ...current]);
      setShowProjectForm(false);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create the project. Try again.",
      );
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function onCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsCreatingLabel(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await createWorkspaceLabel(workspaceId, {
        name: String(form.get("name") ?? ""),
        color: String(form.get("color") ?? "#2764ee"),
      });
      setLabels((current) => [...current, response.label]);
      event.currentTarget.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to create label.",
      );
    } finally {
      setIsCreatingLabel(false);
    }
  }

  async function onDeleteLabel(labelId: string) {
    try {
      await deleteWorkspaceLabel(workspaceId, labelId);
      setLabels((current) => current.filter((label) => label.id !== labelId));
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete label.",
      );
    }
  }

  async function onUpdateLabel(
    event: FormEvent<HTMLFormElement>,
    labelId: string,
  ) {
    event.preventDefault();
    setError(undefined);
    setIsSavingLabel(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateWorkspaceLabel(workspaceId, labelId, {
        name: String(form.get("name") ?? ""),
        color: String(form.get("color") ?? ""),
      });
      setLabels((current) =>
        current.map((label) => (label.id === labelId ? response.label : label)),
      );
      setEditingLabelId(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update label.",
      );
    } finally {
      setIsSavingLabel(false);
    }
  }

  async function onWorkspaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    setError(undefined);
    setIsSavingWorkspace(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateWorkspace(workspaceId, {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
      });
      setWorkspace(response.workspace);
      setIsEditingWorkspace(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to update workspace.",
      );
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  async function onWorkspaceDelete() {
    if (
      !window.confirm(
        "Delete this workspace and all its projects? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteWorkspace(workspaceId);
      router.replace("/workspaces");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : "Unable to delete workspace.",
      );
    }
  }

  if (isLoading) {
    return <main className={styles.loading}>Loading workspace</main>;
  }

  if (!workspace) {
    return (
      <main className={styles.workspaceHome}>
        <Link className={styles.backLink} href="/workspaces">
          All workspaces
        </Link>
        <p className={styles.formError}>{error ?? "Workspace not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.workspaceHome}>
      <Link className={styles.backLink} href="/workspaces">
        All workspaces
      </Link>
      <header className={styles.workspaceHomeHeader}>
        <div>
          <p className={styles.eyebrow}>{workspace.slug}</p>
          <h1>{workspace.name}</h1>
          <p>Projects are where tasks, status, and activity live.</p>
        </div>
        {workspace.role === "owner" || workspace.role === "admin" ? (
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              onClick={() => setIsEditingWorkspace((current) => !current)}
              type="button"
            >
              Settings
            </button>
            <button
              className={styles.textButton}
              onClick={() => void onWorkspaceDelete()}
              type="button"
            >
              Delete
            </button>
          </div>
        ) : null}
      </header>
      {isEditingWorkspace ? (
        <form className={styles.projectForm} onSubmit={onWorkspaceSubmit}>
          <label>
            <span>Workspace name</span>
            <input
              defaultValue={workspace.name}
              maxLength={120}
              minLength={2}
              name="name"
              required
            />
          </label>
          <label>
            <span>Workspace URL</span>
            <input
              defaultValue={workspace.slug}
              maxLength={80}
              name="slug"
              required
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isSavingWorkspace}
              type="submit"
            >
              {isSavingWorkspace ? "Saving" : "Save settings"}
            </button>
            <button
              className={styles.textButton}
              onClick={() => setIsEditingWorkspace(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section
        className={styles.workspaceSection}
        aria-labelledby="projects-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="projects-title">Projects</h2>
            <p>{projects.length} available</p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => setShowProjectForm((current) => !current)}
            type="button"
          >
            New project
          </button>
        </div>

        {showProjectForm ? (
          <form className={styles.projectForm} onSubmit={onCreateProject}>
            <label>
              <span>Project name</span>
              <input maxLength={160} minLength={2} name="name" required />
            </label>
            <label>
              <span>Key</span>
              <input maxLength={12} name="key" placeholder="WEB" />
            </label>
            <label className={styles.projectDescription}>
              <span>Description</span>
              <input maxLength={2000} name="description" />
            </label>
            {error ? (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={isCreatingProject}
                type="submit"
              >
                {isCreatingProject ? "Creating" : "Create project"}
              </button>
              <button
                className={styles.textButton}
                onClick={() => setShowProjectForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {projects.length === 0 ? (
          <p className={styles.emptyState}>
            Create a project to start tracking work.
          </p>
        ) : (
          <div className={styles.projectList}>
            {projects.map((project) => (
              <Link
                className={styles.projectRow}
                href={`/workspaces/${workspaceId}/projects/${project.id}`}
                key={project.id}
              >
                <span className={styles.projectKey}>{project.key}</span>
                <div>
                  <h3>{project.name}</h3>
                  {project.description ? <p>{project.description}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section
        className={styles.workspaceSection}
        aria-labelledby="labels-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="labels-title">Labels</h2>
            <p>Reusable labels for tasks in this workspace.</p>
          </div>
        </div>
        <form className={styles.projectForm} onSubmit={onCreateLabel}>
          <label>
            <span>Name</span>
            <input maxLength={80} minLength={1} name="name" required />
          </label>
          <label>
            <span>Color</span>
            <input
              defaultValue="#2764ee"
              name="color"
              pattern="#[0-9A-Fa-f]{6}"
              required
            />
          </label>
          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              disabled={isCreatingLabel}
              type="submit"
            >
              {isCreatingLabel ? "Creating" : "Add label"}
            </button>
          </div>
        </form>
        <div className={styles.labelPicker}>
          {labels.map((label) => (
            <div key={label.id}>
              {editingLabelId === label.id ? (
                <form
                  className={styles.inlineLabelForm}
                  onSubmit={(event) => void onUpdateLabel(event, label.id)}
                >
                  <input
                    defaultValue={label.name}
                    maxLength={80}
                    name="name"
                    required
                  />
                  <input
                    defaultValue={label.color}
                    name="color"
                    pattern="#[0-9A-Fa-f]{6}"
                    required
                  />
                  <button
                    className={styles.secondaryButton}
                    disabled={isSavingLabel}
                    type="submit"
                  >
                    Save
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={() => setEditingLabelId(undefined)}
                    type="button"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span style={{ backgroundColor: label.color }} />
                  {label.name}
                  <button
                    className={styles.textButton}
                    onClick={() => setEditingLabelId(label.id)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className={styles.textButton}
                    onClick={() => void onDeleteLabel(label.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
