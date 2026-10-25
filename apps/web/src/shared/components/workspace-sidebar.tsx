"use client";

import { FolderKanban, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getWorkspaces } from "@/shared/lib/api-client";
import { subscribeToWorkspaceChanges } from "@/shared/lib/workspace-events";
import type { Workspace } from "@devflow/shared";

import styles from "./workspace-sidebar.module.css";

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const params = useParams<{ workspaceId?: string }>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

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

  return (
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/workspaces">
        <span className={styles.brandMark}>D</span>
        <span>DevFlow</span>
      </Link>

      {activeWorkspace ? (
        <div className={styles.activeWorkspace}>
          <span className={styles.workspaceAvatar}>
            {initials(activeWorkspace.name)}
          </span>
          <span>
            <strong>{activeWorkspace.name}</strong>
            <small>Workspace</small>
          </span>
        </div>
      ) : null}

      <nav aria-label="Workspace navigation" className={styles.navigation}>
        <Link
          aria-current={pathname === "/workspaces" ? "page" : undefined}
          className={styles.navigationLink}
          href="/workspaces"
        >
          <FolderKanban aria-hidden="true" size={19} strokeWidth={1.8} />
          Workspaces
        </Link>
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
