"use client";

import { ArrowLeft, Bell, Boxes, Cable, ChevronDown, ClipboardList, KeyRound, LayoutList, Settings2, SlidersHorizontal, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { getWorkspace } from "@/shared/lib/api-client";
import type { Workspace } from "@devflow/shared";

import styles from "./workspace-settings-layout.module.css";

const navigation = [
  { href: "", icon: Settings2, label: "Details" },
  { href: "/access", icon: UsersRound, label: "Access" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/automation", icon: Sparkles, label: "Automation" },
  { href: "/fields", icon: LayoutList, label: "Fields" },
  { href: "/work-types", icon: ClipboardList, label: "Work types" },
  { href: "/features", icon: SlidersHorizontal, label: "Features" },
  { href: "/filters", icon: KeyRound, label: "Custom filters" },
  { href: "/toolchain", icon: Cable, label: "Toolchain" },
  { href: "/apps", icon: Boxes, label: "Apps" },
] as const;

export function WorkspaceSettingsLayout({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<Workspace>();

  useEffect(() => {
    void getWorkspace(workspaceId).then((response) => setWorkspace(response.workspace)).catch(() => undefined);
  }, [workspaceId]);

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <Link className={styles.back} href={`/workspaces/${workspaceId}`}><ArrowLeft size={17} /> Workspace settings</Link>
      <div className={styles.workspaceIdentity}>
        <span>{workspace?.name.slice(0, 1).toUpperCase() ?? "W"}</span>
        <div><strong>{workspace?.name ?? "Workspace"}</strong><small>Workspace</small></div>
      </div>
      <nav aria-label="Workspace settings" className={styles.navigation}>
        {navigation.map((item) => {
          const href = `/workspaces/${workspaceId}/settings${item.href}`;
          const isActive = item.href ? pathname === href : pathname === `/workspaces/${workspaceId}/settings`;
          const Icon = item.icon;
          return <Link aria-current={isActive ? "page" : undefined} className={isActive ? styles.active : undefined} href={href} key={item.label}><Icon size={17} />{item.label}{item.label === "Notifications" || item.label === "Work types" ? <ChevronDown className={styles.chevron} size={15} /> : null}</Link>;
        })}
      </nav>
    </aside>
    <section className={styles.content}>{children}</section>
  </main>;
}
