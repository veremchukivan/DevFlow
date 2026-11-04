"use client";

import { useParams } from "next/navigation";

import { WorkspaceSettingsIntegrations } from "./workspace-settings-integrations";
import { WorkspaceSettingsNotifications } from "./workspace-settings-notifications";
import { WorkspaceSettingsConfiguration } from "./workspace-settings-configuration";
import { WorkspaceMembers } from "./workspace-members";

export function WorkspaceSettingsSection() {
  const { section } = useParams<{ section: string }>();
  if (section === "notifications") return <WorkspaceSettingsNotifications />;
  if (section === "apps") return <WorkspaceSettingsIntegrations />;
  if (section === "toolchain")
    return <WorkspaceSettingsIntegrations toolchain />;
  if (
    section === "fields" ||
    section === "work-types" ||
    section === "features" ||
    section === "filters"
  )
    return <WorkspaceSettingsConfiguration section={section} />;
  if (section === "access") return <WorkspaceMembers />;
  return null;
}
