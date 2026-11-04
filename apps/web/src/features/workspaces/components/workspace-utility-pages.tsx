"use client";

import {
  CalendarPlus,
  ChevronRight,
  FileText,
  FolderKanban,
  History,
  Plus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ApiClientError,
  getApiAssetUrl,
  getProjectActivity,
  getProjects,
} from "@/shared/lib/api-client";
import type { ProjectSummary, TaskActivityEvent } from "@devflow/shared";

import styles from "./workspace-utility-pages.module.css";

type ActivityWithProject = TaskActivityEvent & { project: ProjectSummary };

export function WorkspaceProjects() {
  const { workspaceId } = useWorkspaceParams();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getProjects(workspaceId)
      .then((response) => {
        if (active) setProjects(response.projects);
      })
      .catch((caughtError: unknown) => {
        if (active) setError(messageFor(caughtError, "Unable to load projects."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  return (
    <WorkspacePageFrame
      action={
        <Link className={styles.primaryAction} href={`/workspaces/${workspaceId}?newProject=1`}>
          <Plus aria-hidden="true" size={17} />
          New project
        </Link>
      }
      description="All work in this workspace, organized into focused project boards."
      icon={FolderKanban}
      title="Projects"
    >
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <p className={styles.muted}>Loading projects…</p> : null}
      {!isLoading && !error && !projects.length ? (
        <EmptyPanel
          actionHref={`/workspaces/${workspaceId}?newProject=1`}
          actionLabel="Create the first project"
          description="A project gives tasks, sprints, and activity a shared home."
          icon={FolderKanban}
          title="No projects yet"
        />
      ) : null}
      {projects.length ? (
        <div className={styles.projectList}>
          {projects.map((project) => (
            <Link
              className={styles.projectRow}
              href={`/workspaces/${workspaceId}/projects/${project.id}`}
              key={project.id}
            >
              <span className={styles.projectIcon}>
                {project.iconUrl ? (
                  <Image alt="" height={44} src={getApiAssetUrl(project.iconUrl)!} unoptimized width={44} />
                ) : (
                  project.key.slice(0, 1)
                )}
              </span>
              <span>
                <strong>{project.name}</strong>
                <small>{project.description || `${project.key} project board`}</small>
              </span>
              <span className={styles.projectKey}>{project.key}</span>
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ))}
        </div>
      ) : null}
    </WorkspacePageFrame>
  );
}

export function WorkspaceChangeLog() {
  const { router, workspaceId } = useWorkspaceParams();
  const [events, setEvents] = useState<ActivityWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getProjects(workspaceId)
      .then(async ({ projects }) => {
        const responses = await Promise.all(
          projects.map(async (project) => ({
            events: (await getProjectActivity(workspaceId, project.id, { limit: 50 })).events,
            project,
          })),
        );
        if (!active) return;
        setEvents(
          responses
            .flatMap(({ events: projectEvents, project }) =>
              projectEvents.map((event) => ({ ...event, project })),
            )
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        );
      })
      .catch((caughtError: unknown) => {
        if (caughtError instanceof ApiClientError && caughtError.code === "UNAUTHENTICATED") {
          router.replace("/login");
          return;
        }
        if (active) setError(messageFor(caughtError, "Unable to load the change log."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, workspaceId]);

  return (
    <WorkspacePageFrame
      description="A chronological record of task activity across every project in this workspace."
      icon={History}
      title="Change log"
    >
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <p className={styles.muted}>Loading changes…</p> : null}
      {!isLoading && !error && !events.length ? (
        <EmptyPanel
          description="Changes to tasks, comments, files, and checklists will appear here."
          icon={History}
          title="No changes yet"
        />
      ) : null}
      {events.length ? (
        <ol className={styles.activityList}>
          {events.map((event) => (
            <li key={event.id}>
              <span className={styles.activityDot} />
              <div>
                <p>
                  <strong>{event.actor?.displayName ?? "A former member"}</strong>{" "}
                  {describeActivity(event)}
                  {event.taskTitle ? <b>{event.taskTitle}</b> : "this task"}
                </p>
                <span>
                  {event.project.name} · {formatRelativeTime(event.createdAt)}
                </span>
              </div>
              <Link
                aria-label={`Open ${event.taskTitle ?? "task"}`}
                href={`/workspaces/${workspaceId}/projects/${event.projectId}?taskId=${event.taskId}`}
              >
                Open task
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </WorkspacePageFrame>
  );
}

export function WorkspaceEmptyModule({ description, title }: { description: string; title: string }) {
  const { workspaceId } = useWorkspaceParams();
  const isCalls = title === "Calls";
  return (
    <WorkspacePageFrame
      description={description}
      icon={isCalls ? CalendarPlus : FileText}
      title={title}
    >
      <EmptyPanel
        actionHref={isCalls ? `/workspaces/${workspaceId}/settings/integrations` : undefined}
        actionLabel={isCalls ? "Configure calendar integration" : undefined}
        description={
          isCalls
            ? "Connect a calendar first. Then you will be able to schedule calls, attach agendas, and turn decisions into tasks."
            : "Agreement records will be added with their own access rules, authors, and links to projects or tasks."
        }
        icon={isCalls ? CalendarPlus : FileText}
        title={isCalls ? "No calls planned" : "No agreements yet"}
      />
    </WorkspacePageFrame>
  );
}

function WorkspacePageFrame({ action, children, description, icon: Icon, title }: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  icon: typeof History;
  title: string;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span><Icon aria-hidden="true" size={21} /></span>
          <div><h1>{title}</h1><p>{description}</p></div>
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

function EmptyPanel({ actionHref, actionLabel, description, icon: Icon, title }: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: typeof History;
  title: string;
}) {
  return (
    <section className={styles.emptyPanel}>
      <Icon aria-hidden="true" size={24} />
      <h2>{title}</h2>
      <p>{description}</p>
      {actionHref && actionLabel ? <Link href={actionHref}>{actionLabel}</Link> : null}
    </section>
  );
}

function useWorkspaceParams() {
  const params = useParams<{ workspaceId: string }>();
  return { router: useRouter(), workspaceId: params.workspaceId };
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function describeActivity(event: TaskActivityEvent) {
  const status = typeof event.data.statusName === "string" ? event.data.statusName : undefined;
  if (event.eventType === "task_created") return "created ";
  if (event.eventType === "task_deleted") return "deleted ";
  if (event.eventType === "task_restored") return "restored ";
  if (event.eventType === "task_comment_created") return "commented on ";
  if (event.eventType === "task_attachment_added") return "added a file to ";
  if (event.eventType === "task_checklist_item_added") return "added a checklist item to ";
  if (event.eventType === "task_time_logged") return "logged time on ";
  if (event.eventType === "task_timer_started") return "started a timer on ";
  if (event.eventType === "task_timer_stopped") return "stopped a timer on ";
  if (status) return `moved to ${status}: `;
  return "updated ";
}

function formatRelativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
