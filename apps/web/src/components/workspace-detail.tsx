"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import {
  ApiClientError,
  createProject,
  getProjects,
  getWorkspace,
} from "@/lib/api-client";
import type { ProjectSummary, Workspace } from "@devflow/shared";

export function WorkspaceDetail() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const [workspace, setWorkspace] = useState<Workspace>();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    void Promise.all([getWorkspace(workspaceId), getProjects(workspaceId)])
      .then(([workspaceResponse, projectResponse]) => {
        if (!active) {
          return;
        }

        setWorkspace(workspaceResponse.workspace);
        setProjects(projectResponse.projects);
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

  if (isLoading) {
    return <main className="session-loading">Loading workspace</main>;
  }

  if (!workspace) {
    return (
      <main className="workspace-home">
        <Link className="back-link" href="/">
          All workspaces
        </Link>
        <p className="form-error">{error ?? "Workspace not found."}</p>
      </main>
    );
  }

  return (
    <main className="workspace-home">
      <Link className="back-link" href="/">
        All workspaces
      </Link>
      <header className="workspace-home-header">
        <div>
          <p className="eyebrow">{workspace.slug}</p>
          <h1>{workspace.name}</h1>
          <p>Projects are where tasks, status, and activity live.</p>
        </div>
      </header>

      <section className="workspace-section" aria-labelledby="projects-title">
        <div className="section-heading">
          <div>
            <h2 id="projects-title">Projects</h2>
            <p>{projects.length} available</p>
          </div>
          <button
            className="primary-button"
            onClick={() => setShowProjectForm((current) => !current)}
            type="button"
          >
            New project
          </button>
        </div>

        {showProjectForm ? (
          <form className="project-form" onSubmit={onCreateProject}>
            <label>
              <span>Project name</span>
              <input maxLength={160} minLength={2} name="name" required />
            </label>
            <label>
              <span>Key</span>
              <input maxLength={12} name="key" placeholder="WEB" />
            </label>
            <label className="project-description">
              <span>Description</span>
              <input maxLength={2000} name="description" />
            </label>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={isCreatingProject}
                type="submit"
              >
                {isCreatingProject ? "Creating" : "Create project"}
              </button>
              <button
                className="text-button"
                onClick={() => setShowProjectForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {projects.length === 0 ? (
          <p className="empty-state">
            Create a project to start tracking work.
          </p>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <Link
                className="project-row"
                href={`/workspaces/${workspaceId}/projects/${project.id}`}
                key={project.id}
              >
                <span className="project-key">{project.key}</span>
                <div>
                  <h3>{project.name}</h3>
                  {project.description ? <p>{project.description}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
