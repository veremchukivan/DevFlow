"use client";

import { LayoutDashboard, Settings, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getApiAssetUrl,
  getProjects,
  getWorkspaces,
} from "@/shared/lib/api-client";
import {
  subscribeToProjectChanges,
  subscribeToWorkspaceChanges,
} from "@/shared/lib/workspace-events";
import type { ProjectSummary, Workspace } from "@devflow/shared";

import styles from "./workspace-sidebar.module.css";

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const params = useParams<{ workspaceId?: string }>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    let active = true;

    async function loadWorkspaces() {
      try {
        const response = await getWorkspaces();
        if (active) setWorkspaces(response.workspaces);
      } catch {
        // Authentication is handled by AppShell; keep the navigation stable on failures.
      }
    }

    void loadWorkspaces();
    const unsubscribe = subscribeToWorkspaceChanges(() => {
      void loadWorkspaces();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === params.workspaceId,
  );

  useEffect(() => {
    if (!activeWorkspace) {
      setProjects([]);
      return;
    }

    let active = true;
    const workspaceId = activeWorkspace.id;
    async function loadProjects() {
      try {
        const response = await getProjects(workspaceId);
        if (active) setProjects(response.projects);
      } catch {
        if (active) setProjects([]);
      }
    }

    void loadProjects();
    const unsubscribe = subscribeToProjectChanges((changedWorkspaceId) => {
      if (changedWorkspaceId === workspaceId) void loadProjects();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeWorkspace]);

  return (
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/workspaces">
        <span className={styles.brandMark}>D</span>
        <span>DevFlow</span>
      </Link>

      {activeWorkspace ? (
        <div className={styles.activeWorkspace}>
          <span className={styles.workspaceAvatar}>
            {activeWorkspace.iconUrl ? (
              <Image
                alt=""
                height={42}
                src={getApiAssetUrl(activeWorkspace.iconUrl)!}
                unoptimized
                width={42}
              />
            ) : (
              initials(activeWorkspace.name)
            )}
          </span>
          <span>
            <strong>{activeWorkspace.name}</strong>
            <small>Workspace</small>
          </span>
        </div>
      ) : null}

      <nav aria-label="Main navigation" className={styles.navigation}>
        {activeWorkspace ? (
          <>
            <Link
              aria-current={
                pathname === `/workspaces/${activeWorkspace.id}`
                  ? "page"
                  : undefined
              }
              className={styles.navigationLink}
              href={`/workspaces/${activeWorkspace.id}`}
            >
              <LayoutDashboard aria-hidden="true" size={19} strokeWidth={1.8} />
              Dashboard
            </Link>
            <Link
              aria-current={
                pathname.startsWith(`/workspaces/${activeWorkspace.id}/settings`)
                  ? "page"
                  : undefined
              }
              className={styles.navigationLink}
              href={`/workspaces/${activeWorkspace.id}/settings/automation`}
            >
              <Settings aria-hidden="true" size={19} strokeWidth={1.8} />
              Settings
            </Link>
            <Link
              aria-current={
                pathname === `/workspaces/${activeWorkspace.id}/members`
                  ? "page"
                  : undefined
              }
              className={styles.navigationLink}
              href={`/workspaces/${activeWorkspace.id}/members`}
            >
              <Users aria-hidden="true" size={19} strokeWidth={1.8} />
              Team
            </Link>
          </>
        ) : null}
      </nav>
      {activeWorkspace ? (
        <nav aria-label="Projects" className={styles.projectsNavigation}>
          <p>Projects</p>
          {projects.length ? (
            projects.map((project) => {
              const href = `/workspaces/${activeWorkspace.id}/projects/${project.id}`;
              return (
                <Link
                  aria-current={pathname === href ? "page" : undefined}
                  className={styles.projectLink}
                  href={href}
                  key={project.id}
                >
                  <span className={styles.projectIcon}>
                    {project.iconUrl ? (
                      <Image
                        alt=""
                        height={36}
                        src={getApiAssetUrl(project.iconUrl)!}
                        unoptimized
                        width={36}
                      />
                    ) : (
                      project.key.slice(0, 1)
                    )}
                  </span>
                  <span>{project.name}</span>
                </Link>
              );
            })
          ) : (
            <p className={styles.emptyProjects}>No projects yet</p>
          )}
        </nav>
      ) : null}
    </aside>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
