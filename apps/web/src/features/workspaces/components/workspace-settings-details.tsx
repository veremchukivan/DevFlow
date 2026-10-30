"use client";

import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { ApiClientError, getWorkspace, getWorkspaceMembers, getWorkspaceSettings, updateWorkspace, updateWorkspaceSettings } from "@/shared/lib/api-client";
import { notifyWorkspacesChanged } from "@/shared/lib/workspace-events";
import type { Workspace, WorkspaceMember } from "@devflow/shared";

import styles from "./workspace-settings-pages.module.css";

export function WorkspaceSettingsDetails() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [defaultAssigneeUserId, setDefaultAssigneeUserId] = useState("");
  useEffect(() => { void Promise.all([getWorkspace(workspaceId), getWorkspaceMembers(workspaceId), getWorkspaceSettings(workspaceId)]).then(([workspaceResponse, membersResponse, settingsResponse]) => { setWorkspace(workspaceResponse.workspace); setMembers(membersResponse.members.filter((member) => member.status === "active")); setDefaultAssigneeUserId(settingsResponse.settings.defaultAssigneeUserId ?? ""); }).catch(() => setError("Unable to load workspace settings.")); }, [workspaceId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(undefined); setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await updateWorkspace(workspaceId, { name: String(form.get("name") ?? ""), slug: String(form.get("slug") ?? "") });
      await updateWorkspaceSettings(workspaceId, { defaultAssigneeUserId: defaultAssigneeUserId || null });
      setWorkspace(response.workspace); notifyWorkspacesChanged(); setSaved(true);
    } catch (caughtError) { setError(caughtError instanceof ApiClientError ? caughtError.message : "Unable to save workspace details."); } finally { setSaving(false); }
  }
  if (!workspace) return <p className={styles.loading}>{error ?? "Loading details"}</p>;
  return <><header className={styles.header}><p>Workspace settings / Details</p><h1>Details</h1><span>Update the name and address used across this workspace.</span></header><form className={styles.form} onSubmit={onSubmit}><div className={styles.iconPreview}>{workspace.name.slice(0, 1).toUpperCase()}</div><label><span>Workspace name</span><input defaultValue={workspace.name} maxLength={120} minLength={2} name="name" required /></label><label><span>Workspace URL</span><input defaultValue={workspace.slug} maxLength={80} name="slug" required /></label><label><span>Default assignee</span><select onChange={(event) => setDefaultAssigneeUserId(event.target.value)} value={defaultAssigneeUserId}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.user.displayName}</option>)}</select></label>{error ? <p className={styles.error}>{error}</p> : null}{saved ? <p className={styles.saved}>Details saved.</p> : null}<button disabled={saving} type="submit">{saving ? "Saving" : "Save changes"}</button></form></>;
}
