"use client";

import { ArrowUpRight, Bell, Boxes, Cable, ClipboardList, KeyRound, LayoutList, SlidersHorizontal, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import styles from "./workspace-settings-pages.module.css";
import { WorkspaceSettingsIntegrations } from "./workspace-settings-integrations";
import { WorkspaceSettingsNotifications } from "./workspace-settings-notifications";
import { WorkspaceSettingsConfiguration } from "./workspace-settings-configuration";

const sections = {
  access: { description: "Manage workspace members, their roles and invitations.", icon: UsersRound, title: "Access", action: "Manage members" },
  notifications: { description: "Workspace-wide notification rules will be configured here.", icon: Bell, title: "Notifications" },
  fields: { description: "Manage fields that are available for work items in this workspace.", icon: LayoutList, title: "Fields" },
  "work-types": { description: "Configure the work item types used by projects in this workspace.", icon: ClipboardList, title: "Work types" },
  features: { description: "Enable optional workspace features as they become available.", icon: SlidersHorizontal, title: "Features" },
  filters: { description: "Save reusable filters for your workspace and projects.", icon: KeyRound, title: "Custom filters" },
  toolchain: { description: "Connect developer tools and manage their workspace behavior.", icon: Cable, title: "Toolchain" },
  apps: { description: "Manage installed apps and workspace integrations.", icon: Boxes, title: "Apps" },
} as const;

export function WorkspaceSettingsSection() {
  const { workspaceId, section } = useParams<{ workspaceId: string; section: keyof typeof sections }>();
  if (section === "notifications") return <WorkspaceSettingsNotifications />;
  if (section === "apps") return <WorkspaceSettingsIntegrations />;
  if (section === "toolchain") return <WorkspaceSettingsIntegrations toolchain />;
  if (section === "fields" || section === "work-types" || section === "features" || section === "filters") return <WorkspaceSettingsConfiguration section={section} />;
  const current = sections[section] ?? sections.features;
  const Icon = current.icon;
  return <><header className={styles.header}><p>Workspace settings</p><h1>{current.title}</h1><span>{current.description}</span></header><article className={styles.sectionCard}><Icon size={26} /><h2>{current.title}</h2><p>{current.description}</p>{section === "access" ? <Link className={styles.action} href={`/workspaces/${workspaceId}/members`}>Manage members<ArrowUpRight size={16} /></Link> : <p className={styles.muted}>This section is ready for its dedicated workspace configuration.</p>}</article></>;
}
